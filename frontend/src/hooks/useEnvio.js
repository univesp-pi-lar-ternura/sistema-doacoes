import { useCallback, useState } from 'react';

export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [errosCampo, setErrosCampo] = useState({});

  const enviar = useCallback(async (funcao) => {
    setEnviando(true);
    setErro(null);
    setErrosCampo({});
    try {
      return await funcao();
    } catch (e) {
      if (e.codigo === 'VALIDACAO' && e.detalhes?.length) setErrosCampo(e.errosPorCampo);
      else setErro(e);
      throw e;
    } finally {
      setEnviando(false);
    }
  }, []);

  const limpar = useCallback(() => { setErro(null); setErrosCampo({}); }, []);

  return { enviando, erro, errosCampo, setErrosCampo, enviar, limpar };
}
