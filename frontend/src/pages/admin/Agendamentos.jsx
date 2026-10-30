import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cancelarAgendamentoAdmin, listarAgendamentosAdmin, receberEConcluir, remarcarAgendamentoAdmin,
} from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { CabecalhoPagina, Painel } from '../../components/admin/LayoutAdmin.jsx';
import { Dialogo } from '../../components/ui/Dialogo.jsx';
import { Botao } from '../../components/ui/Botao.jsx';
import { Alerta } from '../../components/ui/Alerta.jsx';
import { Campo } from '../../components/ui/Campo.jsx';
import { SeletorQuantidade } from '../../components/ui/SeletorQuantidade.jsx';
import { AjudaConversao } from '../../components/admin/AjudaConversao.jsx';
import { EscolherHorario } from '../../components/ui/EscolherHorario.jsx';
import { Carregando, ErroCarregamento, Vazio } from '../../components/ui/Estados.jsx';
import { diasDeAtraso, formatarData, formatarHora, formatarNumero, primeiroNome } from '../../utils/formatar.js';
import { gerarUuid } from '../../utils/validar.js';
import { linkWhatsApp } from '../../config.js';

const PERIODOS = [
  { valor: 'hoje', texto: 'Hoje' },
  { valor: 'abertas', texto: 'Em aberto' },
  { valor: 'semana', texto: 'Próximos 7 dias' },
  { valor: 'passados', texto: 'Últimos 30 dias' },
];

const ESTILO_STATUS = {
  Pendente: 'bg-media-claro text-media-texto border-media',
  Confirmado: 'bg-lar-claro text-lar-escuro border-lar',
  'Concluído': 'bg-baixa-claro text-sucesso border-sucesso',
  Cancelado: 'bg-nevoa text-tinta-suave border-linha-forte',
};

const jaRecebeu = (a) => a.itens.some((i) => i.quantidade_recebida > 0);

/** Mensagem pronta para a equipe chamar o doador no WhatsApp. */
function mensagemParaDoador(a, atraso) {
  const nome = primeiroNome(a.doador.nome.replace(/^\[[^\]]*\]\s*/, ''));
  const ola = `Olá, ${nome}! Aqui é do Lar Ternura.`;
  const quando = `${formatarData(a.data_hora_agendada)}, às ${formatarHora(a.data_hora_agendada)}`;
  return atraso >= 1
    ? `${ola} Sua entrega de doação (código #${a.id_agendamento}) estava marcada para ${quando}. Você ainda pretende trazer? Pode vir quando for melhor para você.`
    : `${ola} Estamos falando sobre a sua entrega de doação (código #${a.id_agendamento}), marcada para ${quando}.`;
}

export default function Agendamentos() {
  useTitulo('Doações agendadas');
  const [parametros] = useSearchParams();
  const [periodo, setPeriodo] = useState(() => (PERIODOS.some((p) => p.valor === parametros.get('periodo')) ? parametros.get('periodo') : 'hoje'));
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [dialogo, setDialogo] = useState(null); // { tipo: 'concluir'|'cancelar'|'remarcar', ag }
  const [aviso, setAviso] = useState('');
  const lista = useCarregar(
    () => listarAgendamentosAdmin({ periodo, incluirEncerrados: verEncerrados, busca }),
    [periodo, verEncerrados, busca],
  );

  const fechar = (mensagem) => {
    setDialogo(null);
    if (mensagem) { setAviso(mensagem); lista.recarregar(); }
  };

  function buscar(e) {
    e.preventDefault();
    setAviso('');
    setBusca(texto.trim());
  }

  function limparBusca() {
    setTexto('');
    setBusca('');
  }

  return (
    <div>
      <CabecalhoPagina titulo="Doações agendadas"
        descricao="Quando o doador chegar, busque pelo código, nome, telefone ou e-mail e clique em Concluído." />

      <Painel className="mb-4">
        <form role="search" onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Campo id="busca-doacao" rotulo="Buscar doação" dica="Código (ex.: 25), nome, telefone ou e-mail do doador." className="flex-1">
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={100} autoComplete="off" />
          </Campo>
          <div className="flex flex-wrap gap-2">
            <Botao type="submit">Buscar</Botao>
            {busca && <Botao variante="secundario" onClick={limparBusca}>Limpar busca</Botao>}
          </div>
        </form>
      </Painel>

      <Painel className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {busca ? (
          <p aria-live="polite">Resultados para <strong>“{busca}”</strong>, em todas as datas.</p>
        ) : (
          <fieldset>
            <legend className="so-leitor">Período</legend>
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map((x) => (
                <label key={x.valor} className="flex min-h-11 cursor-pointer items-center rounded-lg border-2 border-linha-forte px-4 font-bold has-[:checked]:border-lar has-[:checked]:bg-lar has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lar">
                  <input type="radio" name="periodo" className="so-leitor" checked={periodo === x.valor} onChange={() => setPeriodo(x.valor)} />
                  {x.texto}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {(busca || periodo !== 'abertas') && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" className="size-5 accent-lar" checked={verEncerrados} onChange={(e) => setVerEncerrados(e.target.checked)} />
            Mostrar concluídos e cancelados
          </label>
        )}
      </Painel>
      {!busca && periodo === 'abertas' && (
        <p className="-mt-3 mb-4 text-tinta-suave">
          Todas as doações que ainda não foram concluídas nem canceladas, de qualquer data. Doações atrasadas continuam aqui até a equipe decidir.
        </p>
      )}

      {aviso && <Alerta tipo="sucesso" className="mb-4">{aviso}</Alerta>}
      {lista.carregando && !lista.dados && <Carregando demorando={lista.demorando} />}
      {lista.erro && <ErroCarregamento erro={lista.erro} aoTentarDeNovo={lista.recarregar} />}
      {lista.dados?.total === 0 && (busca ? (
        <Vazio titulo={`Nenhuma doação encontrada para “${busca}”`}>
          {verEncerrados ? 'Confira o que foi digitado.' : 'Confira o que foi digitado ou marque “Mostrar concluídos e cancelados”.'}
        </Vazio>
      ) : (
        <Vazio titulo={{ hoje: 'Nenhuma entrega agendada para hoje', abertas: 'Nenhuma doação em aberto' }[periodo] ?? 'Nenhuma entrega neste período'}>
          Doações que chegarem sem agendamento podem ser registradas em Registrar doação.
        </Vazio>
      ))}

      <ul className={`flex flex-col gap-4 ${lista.carregando ? 'pointer-events-none opacity-60' : ''}`} aria-busy={lista.carregando || undefined}>
        {lista.dados?.agendamentos.map((a) => {
          const ativo = ['Pendente', 'Confirmado'].includes(a.status_agendamento);
          const atraso = ativo ? diasDeAtraso(a.data_hora_agendada) : null;
          return (
            <li key={a.id_agendamento}>
              <article aria-labelledby={`ag-${a.id_agendamento}`} className="rounded-xl border border-linha bg-papel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold">{formatarHora(a.data_hora_agendada)}</p>
                    {(busca || periodo !== 'hoje') && <p className="text-tinta-suave first-letter:uppercase">{formatarData(a.data_hora_agendada)}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {atraso >= 1 && (
                      <span className="rounded-full border-2 border-erro bg-alta-claro px-3 py-0.5 text-sm font-bold text-erro">
                        Atrasada há {atraso} {atraso === 1 ? 'dia' : 'dias'}
                      </span>
                    )}
                    <span className="rounded-full border-2 border-linha-forte px-3 py-0.5 text-sm font-bold">Código #{a.id_agendamento}</span>
                    <span className={`rounded-full border-2 px-3 py-0.5 text-sm font-bold ${ESTILO_STATUS[a.status_agendamento]}`}>
                      {a.status_agendamento}
                    </span>
                  </div>
                </div>
                <h2 id={`ag-${a.id_agendamento}`} className="mt-3 text-lg font-bold">{a.doador?.nome ?? `Agendamento ${a.id_agendamento}`}</h2>
                {a.doador && (
                  <p className="text-tinta-suave">
                    <a href={`tel:${(a.doador.telefone ?? '').replace(/\D/g, '')}`} className="text-lar underline underline-offset-2">{a.doador.telefone}</a>
                    {' | '}{a.doador.email}
                  </p>
                )}

                <div className="relative mt-4 overflow-x-auto">
                  <table className="w-full text-left">
                    <caption className="so-leitor">Produtos prometidos</caption>
                    <thead>
                      <tr className="border-b-2 border-linha">
                        <th scope="col" className="py-2 pr-3">Produto</th>
                        <th scope="col" className="py-2 pr-3 text-right">Prometido</th>
                        <th scope="col" className="py-2 text-right">Já chegou</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.itens.map((i) => (
                        <tr key={i.id_item} className="border-b border-linha">
                          <td className="py-2 pr-3">{i.nome_item}{i.status_item === 'Cancelado' && <span className="text-tinta-suave"> (não entregue)</span>}</td>
                          <td className="py-2 pr-3 text-right">{formatarNumero(i.quantidade_prometida)} {i.unidade_medida}</td>
                          <td className="py-2 text-right">{formatarNumero(i.quantidade_recebida)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {ativo && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Botao onClick={() => setDialogo({ tipo: 'concluir', ag: a })}>Concluído</Botao>
                    {a.doador?.telefone && (
                      <a href={linkWhatsApp(a.doador.telefone, mensagemParaDoador(a, atraso))} target="_blank" rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center rounded-lg border-2 border-lar px-5 font-bold text-lar no-underline hover:bg-lar-claro">
                        WhatsApp<span className="so-leitor"> de {a.doador.nome} (abre em nova aba)</span>
                      </a>
                    )}
                    {!jaRecebeu(a) && (
                      <>
                        <Botao variante="secundario" onClick={() => setDialogo({ tipo: 'remarcar', ag: a })}>Remarcar</Botao>
                        <Botao variante="perigo" onClick={() => setDialogo({ tipo: 'cancelar', ag: a })}>Cancelar</Botao>
                      </>
                    )}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>

      <Dialogo aberto={dialogo?.tipo === 'concluir'} aoFechar={() => fechar()} largura="max-w-2xl"
        titulo={`Concluir doação #${dialogo?.ag?.id_agendamento ?? ''}`} descricao={dialogo?.ag?.doador?.nome}>
        {dialogo?.tipo === 'concluir' && <FormConcluir key={dialogo.ag.id_agendamento} ag={dialogo.ag} aoConcluir={fechar} />}
      </Dialogo>
      <Dialogo aberto={dialogo?.tipo === 'remarcar'} aoFechar={() => fechar()} titulo="Remarcar entrega" descricao={dialogo?.ag?.doador?.nome}>
        {dialogo?.tipo === 'remarcar' && <FormRemarcar ag={dialogo.ag} aoConcluir={fechar} />}
      </Dialogo>
      <Dialogo aberto={dialogo?.tipo === 'cancelar'} aoFechar={() => fechar()} titulo="Cancelar agendamento?" descricao={dialogo?.ag?.doador?.nome}>
        {dialogo?.tipo === 'cancelar' && <FormCancelar ag={dialogo.ag} aoConcluir={fechar} />}
      </Dialogo>
    </div>
  );
}

function useAcao() {
  const [estado, setEstado] = useState({ processando: false, erro: null });
  async function executar(fn, aoConcluir, mensagem) {
    setEstado({ processando: true, erro: null });
    try { await fn(); aoConcluir(mensagem); } catch (erro) { setEstado({ processando: false, erro }); }
  }
  return { ...estado, executar };
}

const quantidadeOk = (v, max) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= max;

function FormConcluir({ ag, aoConcluir }) {
  const faltando = ag.itens
    .filter((i) => i.status_item === 'Agendado')
    .map((i) => ({ ...i, falta: Math.max(i.quantidade_prometida - i.quantidade_recebida, 0) }))
    .filter((i) => i.falta > 0);
  const chave = useRef(gerarUuid());
  const [parcial, setParcial] = useState(false);
  const [quantidades, setQuantidades] = useState(() => Object.fromEntries(faltando.map((i) => [i.id_item, i.falta])));
  const [motivo, setMotivo] = useState('');
  const [erroLocal, setErroLocal] = useState('');
  const [estado, setEstado] = useState({ processando: false, erro: null });
  const faltouAlgo = parcial && faltando.some((i) => Number(quantidades[i.id_item]) < i.falta);

  async function concluir() {
    setErroLocal('');
    if (parcial && faltando.some((i) => !quantidadeOk(quantidades[i.id_item], i.falta))) {
      return setErroLocal('Confira as quantidades: use números inteiros de 0 até o esperado.');
    }
    if (faltouAlgo && !motivo.trim()) return setErroLocal('Explique por que faltaram itens.');
    setEstado({ processando: true, erro: null });
    try {
      const itens = parcial
        ? faltando.filter((i) => Number(quantidades[i.id_item]) > 0).map((i) => ({ id_item: i.id_item, quantidade: Number(quantidades[i.id_item]) }))
        : null;
      await receberEConcluir(ag.id_agendamento, { chave: chave.current, itens, motivo: faltouAlgo ? motivo.trim() : null });
      aoConcluir(`Doação #${ag.id_agendamento} concluída.`);
    } catch (erro) {
      if (!erro.falhaDeRede) chave.current = gerarUuid();
      setEstado({ processando: false, erro });
    }
  }

  const erro = erroLocal || estado.erro?.message;
  return (
    <div className="flex flex-col gap-4">
      {faltando.length === 0 && <p>Tudo o que foi prometido já chegou. É só concluir.</p>}
      {faltando.length > 0 && !parcial && (
        <>
          <p className="font-bold">Confira o que o doador trouxe:</p>
          <ul className="list-disc pl-6">
            {faltando.map((i) => (
              <li key={i.id_item}><strong>{formatarNumero(i.falta)} {i.unidade_medida}</strong> de {i.nome_item}</li>
            ))}
          </ul>
        </>
      )}
      {faltando.length > 0 && parcial && (
        <>
          <p className="font-bold">Ajuste a quantidade que chegou de cada produto:</p>
          <ul className="flex flex-col gap-3">
            {faltando.map((i) => {
              const id = `concluir-qtd-${i.id_item}`;
              return (
                <li key={i.id_item} className="flex flex-col gap-2 rounded-lg border-2 border-linha p-3">
                  <label htmlFor={id} className="font-bold">{i.nome_item}</label>
                  <p className="text-sm text-tinta-suave">Esperado: {formatarNumero(i.falta)} {i.unidade_medida}</p>
                  <SeletorQuantidade id={id} min={0} max={i.falta} valor={quantidades[i.id_item]} unidade={i.unidade_medida}
                    rotulo={`quantidade de ${i.nome_item} que chegou`} erro={!quantidadeOk(quantidades[i.id_item], i.falta)}
                    aoMudar={(q) => setQuantidades((atual) => ({ ...atual, [i.id_item]: q }))} />
                  <AjudaConversao nome={i.nome_item} unidade={i.unidade_medida} maximo={i.falta}
                    aoUsar={(q) => setQuantidades((atual) => ({ ...atual, [i.id_item]: q }))} />
                </li>
              );
            })}
          </ul>
          {faltouAlgo && (
            <>
              <p>O que não chegou será marcado como não entregue. O que chegou é somado à necessidade.</p>
              <Campo rotulo="Por que faltaram itens?" obrigatorio dica="Ex.: o doador trouxe só uma parte.">
                <textarea rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </Campo>
            </>
          )}
        </>
      )}
      {erro && (
        <Alerta tipo="erro">
          {erro}
          {estado.erro?.falhaDeRede && ' Clique de novo para concluir: a doação não será contada duas vezes.'}
        </Alerta>
      )}
      <div className="flex flex-wrap gap-3">
        <Botao carregando={estado.processando} onClick={concluir}>
          {faltando.length && !parcial ? 'Sim, chegou tudo. Concluir' : 'Concluir doação'}
        </Botao>
        {faltando.length > 0 && (
          <Botao variante="secundario" onClick={() => { setParcial((p) => !p); setErroLocal(''); }}>
            {parcial ? 'Voltar: chegou tudo' : 'Chegou só uma parte'}
          </Botao>
        )}
      </div>
    </div>
  );
}

function FormRemarcar({ ag, aoConcluir }) {
  const [novo, setNovo] = useState({ data: '', horario: '' });
  const [erro, setErro] = useState('');
  const acao = useAcao();

  function salvar() {
    if (!novo.data || !novo.horario) return setErro('Escolha o dia e um horário livre.');
    setErro('');
    acao.executar(() => remarcarAgendamentoAdmin(ag.id_agendamento, novo.data, novo.horario), aoConcluir, 'Entrega remarcada. Avise o doador.');
  }

  return (
    <div className="flex flex-col gap-4">
      <p>Atual: <strong className="first-letter:uppercase">{formatarData(ag.data_hora_agendada)}, às {formatarHora(ag.data_hora_agendada)}</strong></p>
      <EscolherHorario data={novo.data} horario={novo.horario} aoMudar={setNovo} idData="remarcar-dia" idHorario="remarcar-horario" />
      {(erro || acao.erro) && <Alerta tipo="erro">{erro || acao.erro.message}</Alerta>}
      <Botao carregando={acao.processando} onClick={salvar} className="self-start">Salvar novo horário</Botao>
    </div>
  );
}

function FormCancelar({ ag, aoConcluir }) {
  const acao = useAcao();
  return (
    <div className="flex flex-col gap-4">
      <p>Use quando o doador desistiu ou não virá. Não dá para desfazer.</p>
      {acao.erro && <Alerta tipo="erro">{acao.erro.message}</Alerta>}
      <Botao variante="perigoCheio" carregando={acao.processando} className="self-start"
        onClick={() => acao.executar(() => cancelarAgendamentoAdmin(ag.id_agendamento), aoConcluir, 'Agendamento cancelado.')}>
        Cancelar agendamento
      </Botao>
    </div>
  );
}
