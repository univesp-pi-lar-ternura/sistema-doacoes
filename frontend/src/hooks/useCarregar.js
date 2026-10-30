import { useCallback, useEffect, useRef, useState } from 'react';

const AVISO_LENTO_MS = 3000;

export function useCarregar(funcao, dependencias = []) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true, demorando: false });
  const versao = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++versao.current;
    setEstado((e) => ({ ...e, carregando: true, erro: null, demorando: false }));
    const timer = setTimeout(() => {
      if (minha === versao.current) setEstado((e) => ({ ...e, demorando: true }));
    }, AVISO_LENTO_MS);
    try {
      const dados = await funcao();
      if (minha === versao.current) setEstado({ dados, erro: null, carregando: false, demorando: false });
    } catch (erro) {
      if (minha === versao.current) setEstado((e) => ({ ...e, erro, carregando: false, demorando: false }));
    } finally {
      clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  useEffect(() => { carregar(); }, [carregar]);

  return { ...estado, recarregar: carregar };
}
