import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  abrirNecessidade, encerrarNecessidade, listarItens, listarNecessidadesAdmin, renovarNecessidade,
} from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useEnvio } from '../../hooks/useEnvio.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { CabecalhoPagina } from '../../components/admin/LayoutAdmin.jsx';
import { EscolherPrioridade } from '../../components/admin/EscolherPrioridade.jsx';
import { Dialogo } from '../../components/ui/Dialogo.jsx';
import { Botao } from '../../components/ui/Botao.jsx';
import { Alerta } from '../../components/ui/Alerta.jsx';
import { Campo } from '../../components/ui/Campo.jsx';
import { BarraProgresso } from '../../components/ui/BarraProgresso.jsx';
import { SeloUrgencia } from '../../components/ui/SeloUrgencia.jsx';
import { Carregando, ErroCarregamento, Vazio } from '../../components/ui/Estados.jsx';
import { formatarDataCurta, formatarNumero, formatarPercentual } from '../../utils/formatar.js';

const metaValida = (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && v !== '';

export default function Necessidades() {
  useTitulo('Necessidades');
  const [aba, setAba] = useState('abertas');
  const [dialogo, setDialogo] = useState(null); // { tipo: 'abrir'|'renovar'|'encerrar', necessidade? }
  const [aviso, setAviso] = useState('');
  const lista = useCarregar(() => listarNecessidadesAdmin(aba === 'abertas' ? 'Aberta' : 'todas'), [aba]);
  const itens = (lista.dados?.necessidades ?? []).filter((n) => (aba === 'abertas' ? true : n.status !== 'Aberta'));

  const fechar = (mensagem) => {
    setDialogo(null);
    if (mensagem) { setAviso(mensagem); lista.recarregar(); }
  };

  return (
    <div>
      <CabecalhoPagina titulo="Necessidades"
        descricao="O que os doadores veem na página de doações. Cada necessidade tem uma meta; o que chega é somado a ela."
        acao={<Botao onClick={() => setDialogo({ tipo: 'abrir' })}>Abrir necessidade</Botao>} />

      <div role="group" aria-label="Mostrar" className="mb-4 flex flex-wrap gap-2">
        {[['abertas', 'Abertas'], ['historico', 'Encerradas e canceladas']].map(([valor, texto]) => (
          <button key={valor} type="button" aria-pressed={aba === valor} onClick={() => setAba(valor)}
            className={`min-h-11 rounded-lg px-4 font-bold ${aba === valor ? 'bg-lar text-white' : 'border-2 border-linha-forte bg-papel'}`}>
            {texto}
          </button>
        ))}
      </div>

      {aviso && <Alerta tipo="sucesso" className="mb-4">{aviso}</Alerta>}
      {lista.carregando && !lista.dados && <Carregando demorando={lista.demorando} />}
      {lista.erro && <ErroCarregamento erro={lista.erro} aoTentarDeNovo={lista.recarregar} />}
      {lista.dados && itens.length === 0 && (
        <Vazio titulo={aba === 'abertas' ? 'Nenhuma necessidade aberta' : 'Nada no histórico ainda'}
          acao={aba === 'abertas' && <Botao onClick={() => setDialogo({ tipo: 'abrir' })}>Abrir necessidade</Botao>}>
          {aba === 'abertas' && 'Sem necessidades abertas, a página de doações fica vazia.'}
        </Vazio>
      )}

      <ul className="flex flex-col gap-3">
        {itens.map((n) => (
          <li key={n.id_necessidade} className="rounded-xl border border-linha bg-papel p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-bold">{n.nome_item}</h2>
              <SeloUrgencia nivel={n.urgencia.nivel} nome={n.urgencia.nome} />
            </div>
            {!n.produto_ativo && n.status === 'Aberta' && (
              <p className="mt-1 text-sm font-bold text-erro">Produto desativado: não aparece para os doadores.</p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center sm:gap-6">
              <BarraProgresso valor={n.percentual_barra} nivel={n.urgencia.nivel}
                rotulo={`${n.nome_item}: ${formatarPercentual(n.percentual_atendimento)} da meta`} />
              <p className="sm:text-right">
                <strong>{formatarNumero(n.quantidade_arrecadada)}</strong> de {formatarNumero(n.quantidade_meta)} {n.unidade_medida} ({formatarPercentual(n.percentual_atendimento)})
              </p>
            </div>
            <p className="mt-2 text-sm text-tinta-suave">
              Aberta em {formatarDataCurta(n.criada_em)}
              {n.encerrada_em && `. ${n.status} em ${formatarDataCurta(n.encerrada_em)}`}
              {n.status === 'Aberta' && n.meta_atingida && '. Meta atingida: renove ou encerre quando fizer sentido.'}
            </p>
            {n.status === 'Aberta' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Botao variante="secundario" onClick={() => setDialogo({ tipo: 'renovar', necessidade: n })}>Renovar meta</Botao>
                <Botao variante="perigo" onClick={() => setDialogo({ tipo: 'encerrar', necessidade: n })}>Encerrar</Botao>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialogo aberto={dialogo?.tipo === 'abrir'} aoFechar={() => fechar()} titulo="Abrir necessidade"
        descricao="Escolha o produto e quanto o Lar precisa.">
        {dialogo?.tipo === 'abrir' && <FormAbrir aoConcluir={fechar} />}
      </Dialogo>
      <Dialogo aberto={dialogo?.tipo === 'renovar'} aoFechar={() => fechar()} titulo="Renovar meta"
        descricao={dialogo?.necessidade?.nome_item}>
        {dialogo?.tipo === 'renovar' && <FormRenovar necessidade={dialogo.necessidade} aoConcluir={fechar} />}
      </Dialogo>
      <Dialogo aberto={dialogo?.tipo === 'encerrar'} aoFechar={() => fechar()} titulo="Encerrar necessidade"
        descricao={dialogo?.necessidade?.nome_item}>
        {dialogo?.tipo === 'encerrar' && <FormEncerrar necessidade={dialogo.necessidade} aoConcluir={fechar} />}
      </Dialogo>
    </div>
  );
}

function FormAbrir({ aoConcluir }) {
  const produtos = useCarregar(() => listarItens('true'), []);
  const disponiveis = useMemo(() => (produtos.dados?.itens ?? []).filter((p) => !p.id_necessidade_aberta), [produtos.dados]);
  const [idItem, setIdItem] = useState('');
  const [meta, setMeta] = useState('');
  const [nivel, setNivel] = useState(null);
  const [erros, setErros] = useState({});
  const envio = useEnvio();
  const produto = disponiveis.find((p) => p.id_item === idItem);

  async function enviar(e) {
    e.preventDefault();
    const encontrados = {};
    if (!idItem) encontrados.id_item = 'Escolha o produto.';
    if (!metaValida(meta)) encontrados.quantidade_meta = 'Informe um número inteiro maior que zero.';
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;
    try {
      await envio.enviar(() => abrirNecessidade({ id_item: idItem, quantidade_meta: Number(meta), nivel: nivel ?? produto.urgencia_sugerida.nivel }));
      aoConcluir(`Necessidade aberta: ${produto.nome_item}.`);
    } catch { /* exibido abaixo */ }
  }

  if (produtos.carregando) return <Carregando />;
  if (produtos.erro) return <ErroCarregamento erro={produtos.erro} aoTentarDeNovo={produtos.recarregar} />;
  if (!disponiveis.length) {
    return (
      <Alerta tipo="info" titulo="Todos os produtos ativos já têm necessidade aberta.">
        Para pedir um produto novo, cadastre-o primeiro em <Link to="/admin/produtos" className="font-bold underline">Produtos</Link>.
      </Alerta>
    );
  }
  const err = { ...erros, ...envio.errosCampo };
  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Campo rotulo="Produto" obrigatorio erro={err.id_item}>
        <select value={idItem} onChange={(e) => setIdItem(e.target.value)}>
          <option value="">Escolha</option>
          {disponiveis.map((p) => <option key={p.id_item} value={p.id_item}>{p.nome_item}</option>)}
        </select>
      </Campo>
      <Campo rotulo={`Meta${produto ? ` (em ${produto.unidade_medida})` : ''}`} obrigatorio erro={err.quantidade_meta}
        dica="Quanto o Lar precisa receber deste produto.">
        <input type="number" inputMode="numeric" min={1} step={1} value={meta} onChange={(e) => setMeta(e.target.value)} />
      </Campo>
      <EscolherPrioridade nome="nivel-abrir" valor={nivel} aoMudar={setNivel} erro={err.nivel}
        textoPadrao={produto ? `A do produto (${produto.urgencia_sugerida.nome})` : 'A do produto'} />
      {envio.erro && <Alerta tipo="erro">{envio.erro.message}</Alerta>}
      <Botao type="submit" carregando={envio.enviando} className="self-start">Abrir necessidade</Botao>
    </form>
  );
}

function FormRenovar({ necessidade: n, aoConcluir }) {
  const [meta, setMeta] = useState(String(n.quantidade_meta));
  const [nivel, setNivel] = useState(null);
  const [erro, setErro] = useState('');
  const envio = useEnvio();

  async function enviar(e) {
    e.preventDefault();
    if (!metaValida(meta)) return setErro('Informe um número inteiro maior que zero.');
    setErro('');
    try {
      await envio.enviar(() => renovarNecessidade(n.id_necessidade, { quantidade_meta: Number(meta), nivel: nivel ?? n.urgencia.nivel }));
      aoConcluir(`Meta renovada: ${n.nome_item}.`);
    } catch { /* exibido abaixo */ }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Alerta tipo="atencao">
        A nova meta começa do zero. Os {formatarNumero(n.quantidade_arrecadada)} {n.unidade_medida} já recebidos ficam no histórico.
      </Alerta>
      <Campo rotulo={`Nova meta (em ${n.unidade_medida})`} obrigatorio erro={erro || envio.errosCampo.quantidade_meta}>
        <input type="number" inputMode="numeric" min={1} step={1} value={meta} onChange={(e) => setMeta(e.target.value)} />
      </Campo>
      <EscolherPrioridade nome="nivel-renovar" valor={nivel} aoMudar={setNivel} textoPadrao={`Manter a atual (${n.urgencia.nome})`} />
      {envio.erro && <Alerta tipo="erro">{envio.erro.message}</Alerta>}
      <Botao type="submit" carregando={envio.enviando} className="self-start">Renovar meta</Botao>
    </form>
  );
}

function FormEncerrar({ necessidade: n, aoConcluir }) {
  const [status, setStatus] = useState('Encerrada');
  const envio = useEnvio();

  async function enviar(e) {
    e.preventDefault();
    try {
      await envio.enviar(() => encerrarNecessidade(n.id_necessidade, status));
      aoConcluir(`${n.nome_item} saiu da página de doações.`);
    } catch { /* exibido abaixo */ }
  }

  const opcoes = [
    ['Encerrada', 'Encerrar', 'A meta foi cumprida ou o Lar não precisa mais deste produto.'],
    ['Cancelada', 'Cancelar', 'Foi aberta por engano.'],
  ];
  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <p>O produto sai da página de doações. O que já foi recebido continua no histórico. Não dá para reabrir: depois, abra uma nova necessidade.</p>
      <fieldset>
        <legend className="mb-2 font-bold">Motivo</legend>
        {opcoes.map(([valor, rotulo, descricao]) => (
          <label key={valor} className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
            <input type="radio" name="status-encerrar" className="size-6 shrink-0 accent-lar" checked={status === valor} onChange={() => setStatus(valor)} />
            <span><span className="font-bold">{rotulo}</span><span className="block text-sm text-tinta-suave">{descricao}</span></span>
          </label>
        ))}
      </fieldset>
      {envio.erro && <Alerta tipo="erro">{envio.erro.message}</Alerta>}
      <Botao type="submit" variante="perigoCheio" carregando={envio.enviando} className="self-start">
        {status === 'Encerrada' ? 'Encerrar necessidade' : 'Cancelar necessidade'}
      </Botao>
    </form>
  );
}
