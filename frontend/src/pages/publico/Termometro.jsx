import { useEffect, useState } from 'react';
import { listarNecessidades, obterFiltros } from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { useDoacao } from '../../contexts/DoacaoContext.jsx';
import { useTelaGrande } from '../../hooks/useTelaGrande.js';
import { Filtros } from '../../components/publico/Filtros.jsx';
import { CartaoNecessidade } from '../../components/publico/CartaoNecessidade.jsx';
import { PainelDoacao, BarraDoacaoMovel } from '../../components/publico/PainelDoacao.jsx';
import { Carregando, ErroCarregamento, Vazio } from '../../components/ui/Estados.jsx';

function useAtrasado(valor, ms = 350) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

export default function Termometro() {
  useTitulo('O que o Lar Ternura precisa agora');
  const { aviso, sincronizar } = useDoacao();
  const telaGrande = useTelaGrande();
  const [filtros, setFiltros] = useState({ busca: '', niveis: [], categoria: '' });
  const buscaAtrasada = useAtrasado(filtros.busca);

  const opcoes = useCarregar(obterFiltros, []);
  const lista = useCarregar(
    () => listarNecessidades({ nivel: filtros.niveis, categoria: filtros.categoria, busca: buscaAtrasada.trim() }),
    [filtros.niveis.join(','), filtros.categoria, buscaAtrasada],
  );

  // Se um item escolhido saiu do termômetro (meta encerrada, produto desativado), sai da doação.
  const semFiltro = !filtros.niveis.length && !filtros.categoria && !buscaAtrasada.trim();
  useEffect(() => {
    if (semFiltro && lista.dados) sincronizar(new Map(lista.dados.itens.map((i) => [i.id_item, i.id_necessidade])));
  }, [semFiltro, lista.dados, sincronizar]);

  const total = lista.dados?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 lg:pb-8">
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">O que o Lar Ternura precisa agora</h1>
      <p className="mt-3 max-w-2xl text-lg text-tinta-suave">
        Os itens mais urgentes aparecem primeiro. Escolha o que você pode levar e agende a entrega.
      </p>

      {/* Avisos do carrinho para leitores de tela */}
      <p aria-live="polite" className="so-leitor">{aviso}</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <aside aria-label="Filtros" className="lg:sticky lg:top-6 lg:self-start">
          {telaGrande ? (
            <Filtros opcoes={opcoes.dados} valores={filtros} aoMudar={setFiltros} />
          ) : (
            <details className="rounded-xl border border-linha p-4">
              <summary className="min-h-11 cursor-pointer content-center font-bold">Buscar e filtrar</summary>
              <div className="mt-4">
                <Filtros opcoes={opcoes.dados} valores={filtros} aoMudar={setFiltros} />
              </div>
            </details>
          )}
        </aside>

        <section aria-labelledby="titulo-lista">
          <h2 id="titulo-lista" className="so-leitor">Lista de necessidades</h2>
          <p aria-live="polite" className="mb-4 text-tinta-suave">
            {!lista.carregando && !lista.erro && (total === 1 ? '1 produto encontrado' : `${total} produtos encontrados`)}
          </p>

          {lista.carregando && !lista.dados && <Carregando demorando={lista.demorando} texto="Carregando necessidades…" />}
          {lista.erro && <ErroCarregamento erro={lista.erro} aoTentarDeNovo={lista.recarregar} />}
          {lista.dados && total === 0 && (
            <Vazio titulo={semFiltro ? 'Nenhuma necessidade aberta no momento' : 'Nada encontrado com esses filtros'}>
              {semFiltro ? 'Volte em breve: a lista é atualizada pela equipe do Lar.' : 'Tente outro termo ou limpe os filtros.'}
            </Vazio>
          )}
          {lista.dados && total > 0 && (
            <ul className={`grid gap-5 sm:grid-cols-2 ${lista.carregando ? 'opacity-60' : ''}`}>
              {lista.dados.itens.map((n) => (
                <li key={n.id_necessidade} className="flex flex-col [&>article]:flex-1">
                  <CartaoNecessidade necessidade={n} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {telaGrande && (
          <aside aria-label="Resumo da sua doação" className="sticky top-6 self-start">
            <PainelDoacao />
          </aside>
        )}
      </div>
      <BarraDoacaoMovel />
    </div>
  );
}
