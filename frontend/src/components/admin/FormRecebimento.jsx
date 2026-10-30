import { useMemo, useRef, useState } from 'react';
import { listarItens, listarNecessidades, registrarRecebimento } from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useEnvio } from '../../hooks/useEnvio.js';
import { Botao } from '../ui/Botao.jsx';
import { Alerta } from '../ui/Alerta.jsx';
import { Campo } from '../ui/Campo.jsx';
import { SeletorQuantidade } from '../ui/SeletorQuantidade.jsx';
import { AjudaConversao } from './AjudaConversao.jsx';
import { formatarNumero, DESLOCAMENTO_SP, hojeSP, partesSP } from '../../utils/formatar.js';
import { gerarUuid, quantidadeValida } from '../../utils/validar.js';

function agoraComFuso() {
  const p = partesSP();
  return `${p.ano}-${p.mes}-${p.dia}T${p.hora}:${p.minuto}:${p.segundo}${DESLOCAMENTO_SP}`;
}

/**
 * A tela pede só o dia; a API exige data e hora com fuso e recusa horário no futuro.
 * Hoje: usa a hora atual. Dia anterior: meio-dia, só para a entrega cair no dia certo do relatório.
 */
const instanteDoDia = (dia) => (dia === hojeSP() ? agoraComFuso() : `${dia}T12:00:00${DESLOCAMENTO_SP}`);

/**
 * Registra uma doação que chegou (POST /doacoes). Com `agendamento`, vem preenchida com o
 * prometido e já ligada à meta escolhida pelo doador. Sem ele, é uma doação avulsa: o front
 * sugere a meta aberta do produto e mostra isso, porque a API exige o vínculo explícito.
 *
 * A Idempotency-Key (UUID) é reaproveitada só quando a tentativa anterior falhou por rede.
 */
export function FormRecebimento({ agendamento = null, aoConcluir, aoCancelar }) {
  const chave = useRef(gerarUuid());
  const [linhas, setLinhas] = useState(() => (agendamento?.itens ?? [])
    .filter((i) => i.status_item === 'Agendado')
    .map((i) => ({
      id_item: i.id_item,
      id_necessidade: i.id_necessidade,
      somarMeta: Boolean(i.id_necessidade),
      nome_item: i.nome_item,
      unidade_medida: i.unidade_medida,
      prometida: i.quantidade_prometida,
      recebida: i.quantidade_recebida,
      quantidade: Math.max(i.quantidade_prometida - i.quantidade_recebida, 1),
      chegou: true,
    })));
  const [dia, setDia] = useState(hojeSP);
  const [erroLocal, setErroLocal] = useState('');
  const [resultado, setResultado] = useState(null);
  const envio = useEnvio();
  const incluidas = linhas.filter((l) => l.chegou);

  async function enviar(e) {
    e.preventDefault();
    setErroLocal('');
    if (!incluidas.length) return setErroLocal('Marque pelo menos um produto que chegou.');
    if (incluidas.some((l) => !quantidadeValida(l.quantidade))) return setErroLocal('Confira as quantidades: use números inteiros de 1 a 9999.');
    if (!dia) return setErroLocal('Informe a data da entrega.');
    if (dia > hojeSP()) return setErroLocal('A data da entrega não pode ser no futuro.');
    try {
      const r = await envio.enviar(() => registrarRecebimento({
        chave: chave.current,
        id_agendamento: agendamento?.id_agendamento ?? null,
        ocorrido_em: instanteDoDia(dia),
        itens: incluidas.map((l) => ({ id_item: l.id_item, id_necessidade: l.somarMeta ? l.id_necessidade : null, quantidade: l.quantidade })),
      }));
      setResultado(r);
    } catch (erro) {
      if (!erro.falhaDeRede) chave.current = gerarUuid();
    }
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tipo="sucesso" titulo={resultado.repetido ? 'Esta doação já estava registrada.' : 'Doação registrada.'}>
          <ul className="mt-1 list-disc pl-5">
            {resultado.itens.map((i) => (
              <li key={i.id_item}>
                {formatarNumero(i.quantidade)} {i.unidade_medida} de {i.nome_item}
                {i.id_necessidade ? ' (somado à necessidade)' : ' (não somado a nenhuma necessidade: conta só no relatório do mês)'}
              </li>
            ))}
          </ul>
        </Alerta>
        <Botao onClick={() => aoConcluir?.(resultado)} className="self-start">Concluir</Botao>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      {agendamento && (
        <p>Doação de <strong>{agendamento.doador?.nome}</strong>. Desmarque o que não veio e ajuste as quantidades.</p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-bold">O que chegou</legend>
        {linhas.length === 0 && <p className="text-tinta-suave">Nenhum produto adicionado ainda.</p>}
        <ul className="flex flex-col gap-3">
          {linhas.map((l, indice) => {
            const idQtd = `rec-qtd-${l.id_item}`;
            const atualizar = (m) => setLinhas((ls) => ls.map((x, i) => (i === indice ? { ...x, ...m } : x)));
            return (
              <li key={l.id_item} className={`rounded-lg border-2 p-3 ${l.chegou ? 'border-lar' : 'border-linha opacity-70'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {agendamento ? (
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
                      <input type="checkbox" className="size-6 accent-lar" checked={l.chegou} onChange={(e) => atualizar({ chegou: e.target.checked })} />
                      {l.nome_item}
                    </label>
                  ) : (
                    <p className="font-bold">{l.nome_item}</p>
                  )}
                  {!agendamento && (
                    <button type="button" className="min-h-11 rounded-md px-2 text-lar underline underline-offset-2"
                      onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== indice))} aria-label={`Retirar ${l.nome_item}`}>
                      Retirar
                    </button>
                  )}
                </div>
                {agendamento && (
                  <p className="text-sm text-tinta-suave">
                    Prometido: {formatarNumero(l.prometida)} {l.unidade_medida}
                    {l.recebida > 0 && `. Já recebido antes: ${formatarNumero(l.recebida)}`}
                  </p>
                )}
                {l.chegou && (
                  <div className="mt-2 flex flex-col gap-2">
                    <label htmlFor={idQtd} className="text-sm font-bold">Quantidade que chegou</label>
                    <SeletorQuantidade id={idQtd} valor={l.quantidade} unidade={l.unidade_medida}
                      rotulo={`quantidade de ${l.nome_item} que chegou`} erro={!quantidadeValida(l.quantidade)}
                      aoMudar={(q) => atualizar({ quantidade: q })} />
                    <AjudaConversao nome={l.nome_item} unidade={l.unidade_medida} aoUsar={(q) => atualizar({ quantidade: q })} />
                    {l.id_necessidade ? (
                      <label className="flex min-h-11 cursor-pointer items-center gap-3">
                        <input type="checkbox" className="size-5 accent-lar" checked={l.somarMeta} onChange={(e) => atualizar({ somarMeta: e.target.checked })} />
                        Somar à necessidade aberta deste produto
                      </label>
                    ) : (
                      <p className="text-sm text-tinta-suave">Este produto não tem necessidade aberta: a entrega conta só no relatório do mês.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!agendamento && (
          <AdicionarProduto jaIncluidos={new Set(linhas.map((l) => l.id_item))}
            aoAdicionar={(p) => setLinhas((ls) => [...ls, { ...p, somarMeta: Boolean(p.id_necessidade), quantidade: 1, chegou: true }])} />
        )}
      </fieldset>

      <Campo id="data-entrega" rotulo="Data da entrega" obrigatorio dica="Hoje ou um dia anterior." className="sm:max-w-xs">
        <input type="date" value={dia} max={hojeSP()} onChange={(e) => setDia(e.target.value)} />
      </Campo>

      {(erroLocal || envio.erro) && (
        <Alerta tipo="erro">
          {erroLocal || envio.erro.message}
          {envio.erro?.falhaDeRede && ' Clique de novo em Registrar: a doação não será contada duas vezes.'}
        </Alerta>
      )}

      <div className="flex flex-wrap gap-3">
        <Botao type="submit" carregando={envio.enviando}>Registrar doação</Botao>
        {aoCancelar && <Botao variante="secundario" onClick={aoCancelar}>Cancelar</Botao>}
      </div>
    </form>
  );
}

/** Produtos ativos, com a meta aberta de cada um (para o vínculo explícito exigido pela API). */
function AdicionarProduto({ jaIncluidos, aoAdicionar }) {
  const dados = useCarregar(() => Promise.all([listarItens('true'), listarNecessidades()]), []);
  const [escolhido, setEscolhido] = useState('');
  const opcoes = useMemo(() => {
    if (!dados.dados) return [];
    const [produtos, termometro] = dados.dados;
    const metas = new Map(termometro.itens.map((n) => [n.id_item, n.id_necessidade]));
    return produtos.itens
      .filter((p) => !jaIncluidos.has(p.id_item))
      .map((p) => ({ ...p, id_necessidade: metas.get(p.id_item) ?? p.id_necessidade_aberta ?? null }));
  }, [dados.dados, jaIncluidos]);

  function adicionar() {
    const p = opcoes.find((x) => x.id_item === escolhido);
    if (!p) return;
    aoAdicionar({ id_item: p.id_item, id_necessidade: p.id_necessidade, nome_item: p.nome_item, unidade_medida: p.unidade_medida });
    setEscolhido('');
  }

  if (dados.erro) return <Alerta tipo="erro">Não foi possível carregar os produtos. {dados.erro.message}</Alerta>;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-nevoa p-3 sm:flex-row sm:items-end">
      <Campo rotulo="Adicionar produto" className="flex-1"
        dica={!dados.carregando && !opcoes.length ? 'Todos os produtos já foram adicionados. Cadastre novos em Produtos.' : undefined}>
        <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} disabled={dados.carregando || !opcoes.length}>
          <option value="">{dados.carregando ? 'Carregando…' : 'Escolha o produto'}</option>
          {opcoes.map((p) => <option key={p.id_item} value={p.id_item}>{p.nome_item} ({p.unidade_medida})</option>)}
        </select>
      </Campo>
      <Botao variante="secundario" onClick={adicionar} disabled={!escolhido}>Adicionar</Botao>
    </div>
  );
}
