import { useState } from 'react';
import { obterArrecadacaoMensal } from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { CabecalhoPagina, Painel } from '../../components/admin/LayoutAdmin.jsx';
import { CabecalhoImpressao } from '../../components/admin/CabecalhoImpressao.jsx';
import { Botao } from '../../components/ui/Botao.jsx';
import { Campo } from '../../components/ui/Campo.jsx';
import { Carregando, ErroCarregamento, Vazio } from '../../components/ui/Estados.jsx';
import { formatarNumero, mesAtualSP } from '../../utils/formatar.js';

const nomeDoMes = (mes) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${mes}-15T12:00:00Z`));

export default function Relatorio() {
  useTitulo('Relatório do mês');
  const atual = mesAtualSP();
  const [mes, setMes] = useState(atual);
  const valido = /^\d{4}-\d{2}$/.test(mes) && mes <= atual;
  const dados = useCarregar(() => (valido ? obterArrecadacaoMensal(mes) : Promise.resolve([])), [mes]);
  const linhas = [...(dados.dados ?? [])].sort((a, b) => a.nome_item.localeCompare(b.nome_item, 'pt-BR'));

  return (
    <div>
      <CabecalhoImpressao detalhe={valido ? `Mês: ${nomeDoMes(mes)}` : undefined} />
      <CabecalhoPagina titulo="Relatório do mês"
        descricao="O que chegou de fato ao Lar no mês, por produto. Promessas que não chegaram e doações estornadas não entram."
        acao={<Botao variante="secundario" onClick={() => window.print()} disabled={!linhas.length}>Imprimir ou salvar em PDF</Botao>} />

      <Painel className="nao-imprimir mb-6">
        <Campo id="mes-relatorio" rotulo="Mês" erro={valido ? undefined : 'Escolha um mês até o atual.'} className="sm:max-w-xs">
          <input type="month" value={mes} max={atual} onChange={(e) => setMes(e.target.value)} />
        </Campo>
      </Painel>

      {dados.carregando && !dados.dados && <Carregando demorando={dados.demorando} />}
      {dados.erro && <ErroCarregamento erro={dados.erro} aoTentarDeNovo={dados.recarregar} />}
      {valido && dados.dados && linhas.length === 0 && (
        <Vazio titulo={`Nenhuma doação recebida em ${nomeDoMes(mes)}`}>
          As doações aparecem aqui depois que a equipe as marca como concluídas ou registra uma doação que chegou.
        </Vazio>
      )}

      {valido && linhas.length > 0 && (
        <section aria-labelledby="titulo-tabela" className={dados.carregando ? 'opacity-60' : ''}>
          <h2 id="titulo-tabela" className="mb-3 text-xl font-bold first-letter:uppercase">
            {nomeDoMes(mes)}: {linhas.length === 1 ? '1 produto' : `${linhas.length} produtos`}
          </h2>
          <div tabIndex={0} role="region" aria-label="Tabela das doações recebidas no mês" className="relative overflow-x-auto rounded-xl border border-linha bg-papel">
            <table className="w-full text-left">
              <caption className="so-leitor">Doações recebidas em {nomeDoMes(mes)}, por produto</caption>
              <thead className="bg-nevoa">
                <tr>
                  <th scope="col" className="px-4 py-3">Produto</th>
                  <th scope="col" className="px-4 py-3 text-right">Quantidade recebida</th>
                  <th scope="col" className="px-4 py-3 text-right">Entregas</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={`${l.id_item}|${l.nome_item}|${l.unidade_medida}`} className="border-t border-linha">
                    <th scope="row" className="px-4 py-3 font-bold">{l.nome_item}</th>
                    <td className="px-4 py-3 text-right">{formatarNumero(l.quantidade_arrecadada)} {l.unidade_medida}</td>
                    <td className="px-4 py-3 text-right">{formatarNumero(l.entregas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-tinta-suave">
            Cada produto é contado na sua própria unidade. As quantidades não são somadas entre produtos diferentes.
          </p>
        </section>
      )}
    </div>
  );
}
