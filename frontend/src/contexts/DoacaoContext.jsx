import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CHAVE = 'lar-ternura:minha-doacao:v2';
const DoacaoContext = createContext(null);

function carregar() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export function DoacaoProvider({ children }) {
  const [itens, setItens] = useState(carregar);
  const [aviso, setAviso] = useState(''); // anunciado por leitores de tela (aria-live)

  useEffect(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch { /* ignora */ }
  }, [itens]);

  const definirQuantidade = useCallback((necessidade, quantidade) => {
    setItens((atuais) => {
      const existe = atuais.some((i) => i.id_item === necessidade.id_item);
      const linha = {
        id_item: necessidade.id_item,
        id_necessidade: necessidade.id_necessidade, // a API vincula a promessa à meta escolhida
        nome_item: necessidade.nome_item,
        unidade_medida: necessidade.unidade_medida,
        quantidade,
      };
      return existe ? atuais.map((i) => (i.id_item === necessidade.id_item ? linha : i)) : [...atuais, linha];
    });
    setAviso(`${necessidade.nome_item}: ${quantidade} ${necessidade.unidade_medida} na sua doação.`);
  }, []);

  const remover = useCallback((idItem) => {
    setItens((atuais) => {
      const item = atuais.find((i) => i.id_item === idItem);
      if (item) setAviso(`${item.nome_item} retirado da sua doação.`);
      return atuais.filter((i) => i.id_item !== idItem);
    });
  }, []);

  const sincronizar = useCallback((metas) => {
    setItens((atuais) => {
      const novos = atuais
        .filter((i) => metas.has(i.id_item))
        .map((i) => (metas.get(i.id_item) === i.id_necessidade ? i : { ...i, id_necessidade: metas.get(i.id_item) }));
      const mudou = novos.length !== atuais.length || novos.some((n, k) => n !== atuais[k]);
      return mudou ? novos : atuais;
    });
  }, []);

  const limpar = useCallback(() => setItens([]), []);

  const valor = useMemo(() => ({
    itens,
    aviso,
    total: itens.length,
    quantidadeDe: (idItem) => itens.find((i) => i.id_item === idItem)?.quantidade ?? 0,
    definirQuantidade,
    remover,
    sincronizar,
    limpar,
  }), [itens, aviso, definirQuantidade, remover, sincronizar, limpar]);

  return <DoacaoContext.Provider value={valor}>{children}</DoacaoContext.Provider>;
}

export function useDoacao() {
  const ctx = useContext(DoacaoContext);
  if (!ctx) throw new Error('useDoacao precisa estar dentro de <DoacaoProvider>');
  return ctx;
}
