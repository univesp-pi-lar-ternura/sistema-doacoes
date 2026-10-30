import { useState } from 'react';
import { listarNecessidadesAdmin } from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { CabecalhoPagina } from '../../components/admin/LayoutAdmin.jsx';
import { CabecalhoImpressao } from '../../components/admin/CabecalhoImpressao.jsx';
import { Botao } from '../../components/ui/Botao.jsx';
import { SeloUrgencia } from '../../components/ui/SeloUrgencia.jsx';
import { Carregando, ErroCarregamento, Vazio } from '../../components/ui/Estados.jsx';
import { formatarDataCurta, formatarNumero, formatarPercentual } from '../../utils/formatar.js';
import { contar } from '../../utils/apresentacao.js';

const VISOES = [
  { valor: 'Aberta', texto: 'Abertas', descricao: 'necessidades abertas' },
  { valor: 'todas', texto: 'Todas, inclusive encerradas', descricao: 'todas as necessidades, inclusive encerradas e canceladas' },
];

function situacao(n) {
  if (n.status === 'Encerrada') return `Encerrada em ${formatarDataCurta(n.encerrada_em)}`;
  if (n.status === 'Cancelada') return `Cancelada em ${formatarDataCurta(n.encerrada_em)}`;
  if (!n.produto_ativo) return 'Aberta, produto desativado';
  return n.meta_atingida ? 'Meta atingida' : 'Aberta';
}

const ordemStatus = { Aberta: 0, Encerrada: 1, Cancelada: 2 };

/**
 * Situação de cada necessidade: meta, quantidade recebida e faltante, por produto.
 * Fonte: GET /admin/necessidades/historico (todas as páginas). Exporta em PDF pela impressão
 * do navegador, sem biblioteca extra.
 */
export default function Situacao() {
  useTitulo('Situação das necessidades');
  const [visao, setVisao] = useState('Aberta');
  const lista = useCarregar(() => listarNecessidadesAdmin(visao), [visao]);
  const v = VISOES.find((x) => x.valor === visao);

  const linhas = [...(lista.dados?.necessidades ?? [])];
  if (visao === 'todas') {
    linhas.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status]
      || a.urgencia.nivel - b.urgencia.nivel || a.nome_item.localeCompare(b.nome_item, 'pt-BR'));
  }
  const abertas = linhas.filter((n) => n.status === 'Aberta');
  const atingidas = abertas.filter((n) => n.meta_atingida).length;

  return (
    <div>
      <CabecalhoImpressao detalhe={`Mostrando ${v.descricao}`} />
      <CabecalhoPagina titulo="Situação das necessidades"
        descricao="Para cada necessidade: a meta, o que já chegou e o que ainda falta."
        acao={<Botao variante="secundario" onClick={() => window.print()} disabled={!linhas.length}>Imprimir ou salvar em PDF</Botao>} />

      <div role="group" aria-label="Mostrar" className="nao-imprimir mb-4 flex flex-wrap gap-2">
        {VISOES.map((x) => (
          <button key={x.valor} type="button" aria-pressed={visao === x.valor} onClick={() => setVisao(x.valor)}
            className={`min-h-11 rounded-lg px-4 font-bold ${visao === x.valor ? 'bg-lar text-white' : 'border-2 border-linha-forte bg-papel'}`}>
            {x.texto}
          </button>
        ))}
      </div>

      {lista.carregando && !lista.dados && <Carregando demorando={lista.demorando} />}
      {lista.erro && <ErroCarregamento erro={lista.erro} aoTentarDeNovo={lista.recarregar} />}
      {lista.dados && linhas.length === 0 && (
        <Vazio titulo={visao === 'Aberta' ? 'Nenhuma necessidade aberta' : 'Nenhuma necessidade cadastrada'}>
          As necessidades são abertas na tela Necessidades.
        </Vazio>
      )}

      {linhas.length > 0 && (
        <section aria-labelledby="titulo-situacao" className={lista.carregando ? 'opacity-60' : ''}>
          <h2 id="titulo-situacao" className="mb-3 text-xl font-bold">
            {abertas.length === 1 ? '1 necessidade aberta' : `${abertas.length} necessidades abertas`}
            {atingidas > 0 && (atingidas === 1 ? ', 1 com a meta atingida' : `, ${atingidas} com a meta atingida`)}
            {visao === 'todas' && linhas.length > abertas.length && (linhas.length - abertas.length === 1
              ? '. 1 encerrada ou cancelada'
              : `. ${linhas.length - abertas.length} encerradas ou canceladas`)}
          </h2>
          <div tabIndex={0} role="region" aria-label="Tabela da situação das necessidades" className="relative overflow-x-auto rounded-xl border border-linha bg-papel">
            <table className="w-full min-w-3xl text-left">
              <caption className="so-leitor">Situação das {v.descricao}: meta, recebido e faltante por produto</caption>
              <thead className="bg-nevoa">
                <tr>
                  <th scope="col" className="min-w-56 px-4 py-3">Produto</th>
                  <th scope="col" className="px-4 py-3">Prioridade</th>
                  <th scope="col" className="px-4 py-3 text-right">Meta</th>
                  <th scope="col" className="px-4 py-3 text-right">Recebido</th>
                  <th scope="col" className="px-4 py-3 text-right">Falta</th>
                  <th scope="col" className="px-4 py-3 text-right">Atendido</th>
                  <th scope="col" className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((n) => (
                  <tr key={n.id_necessidade} className="border-t border-linha">
                    <th scope="row" className="px-4 py-3 font-bold">{n.nome_item}</th>
                    <td className="px-4 py-3 whitespace-nowrap"><SeloUrgencia nivel={n.urgencia.nivel} nome={n.urgencia.nome} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{contar(n.quantidade_meta, n.unidade_medida)}</td>
                    <td className="px-4 py-3 text-right">{formatarNumero(n.quantidade_arrecadada)}</td>
                    <td className="px-4 py-3 text-right">{formatarNumero(n.quantidade_faltante)}</td>
                    <td className="px-4 py-3 text-right">{formatarPercentual(n.percentual_atendimento)}</td>
                    <td className="px-4 py-3">{situacao(n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-tinta-suave">
            Recebido conta só as doações confirmadas e ligadas a cada necessidade; doações registradas sem necessidade
            aparecem apenas no Relatório do mês. Cada produto é contado na sua própria unidade, e as quantidades de
            produtos diferentes não são somadas.
          </p>
        </section>
      )}
    </div>
  );
}
