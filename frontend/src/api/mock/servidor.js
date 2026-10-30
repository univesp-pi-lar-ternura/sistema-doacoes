// Servidor simulado da API 2.0.0 do Anderson (openapi.json), com as regras dos triggers do banco.
// Serve para desenvolver e demonstrar o front sem a API publicada. Ativado com VITE_USAR_MOCK=true.
// Fidelidade: rotas, corpos, cabeçalhos e formatos seguem o openapi.json. Os textos e códigos de
// erro são aproximados (o contrato não fixa os valores de erro.codigo).
import { criarDadosIniciais, HORARIOS_DEMO, CAPACIDADE_DEMO } from './dados.js';
import { partesSP } from '../../utils/formatar.js';

const CHAVE_DB = 'lar-ternura:mock-db:v2';
const LATENCIA_MS = 250;
const SESSAO_MS = 8 * 3600 * 1000;

let db = carregar();

function carregar() {
  try {
    const texto = localStorage.getItem(CHAVE_DB);
    if (texto) return JSON.parse(texto);
  } catch { /* sem storage */ }
  return criarDadosIniciais();
}
function salvar() {
  try { localStorage.setItem(CHAVE_DB, JSON.stringify(db)); } catch { /* ignora */ }
}
export function restaurarDadosMock() {
  db = criarDadosIniciais();
  salvar();
}

// ---------------------------------------------------------------- erros (envelope da API)

class ErroMock {
  constructor(status, codigo, mensagem) { Object.assign(this, { status, codigo, mensagem }); }
}
const falhar = (status, codigo, mensagem) => { throw new ErroMock(status, codigo, mensagem); };
const invalido = (mensagem) => falhar(422, 'VALIDACAO', mensagem);
const naoEncontrado = (o = 'Registro') => falhar(404, 'NAO_ENCONTRADO', `${o} não encontrado.`);
const conflito = (mensagem) => falhar(409, 'CONFLITO', mensagem);

// ---------------------------------------------------------------- utilidades

const normalizar = (s = '') => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const normEmail = (s = '') => s.trim().toLowerCase();
const ehInt = (v, min = 1) => Number.isInteger(v) && v >= min && v <= 2147483647;
const ehTexto = (v, max, min = 1) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const ID_BIGINT = /^[1-9][0-9]{0,18}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const round2 = (n) => Math.round(n * 100) / 100;
const proximo = (t) => { db.seq[t] += 1; return db.seq[t]; };
const diaDe = (iso) => { const p = partesSP(new Date(iso)); return `${p.ano}-${p.mes}-${p.dia}`; };
const mesDe = (iso) => diaDe(iso).slice(0, 7);
/** Instante UTC -> "AAAA-MM-DDTHH:mm:ss" local de São Paulo, como a API devolve agendamentos. */
const localSP = (iso) => { const p = partesSP(new Date(iso)); return `${p.ano}-${p.mes}-${p.dia}T${p.hora}:${p.minuto}:${p.segundo}`; };
const deLocalSP = (data, horario) => new Date(`${data}T${horario}:00-03:00`).toISOString();
const paginar = (lista, q) => {
  const limit = Math.min(Number(q.limit) || 50, 100);
  const offset = Number(q.offset) || 0;
  return lista.slice(offset, offset + limit);
};
const hex64 = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

const categoria = (idc) => db.categorias.find((c) => c.id_categoria === idc);
const item = (idi) => db.itens.find((i) => i.id_item === idi);
const necessidadeAberta = (idi) => db.necessidades.find((n) => n.id_item === idi && n.status === 'Aberta');

// ---------------------------------------------------------------- "views" do banco

function arrecadado() {
  const ok = new Set(db.recebimentos.filter((r) => r.status === 'Confirmado').map((r) => r.id_recebimento));
  const t = new Map();
  for (const ir of db.itens_recebimento) {
    if (ir.id_necessidade && ok.has(ir.id_recebimento)) t.set(ir.id_necessidade, (t.get(ir.id_necessidade) ?? 0) + ir.quantidade_recebida);
  }
  return t;
}

function calculo(n, totais) {
  const arr = totais.get(n.id_necessidade) ?? 0;
  const pct = round2((arr * 100) / n.quantidade_meta);
  return { arr, pct, falta: Math.max(n.quantidade_meta - arr, 0) };
}

function necessidadePublica(n, totais) {
  const i = item(n.id_item);
  const c = categoria(n.id_categoria);
  const { arr, pct, falta } = calculo(n, totais);
  return {
    id_item: i.id_item, id_necessidade: String(n.id_necessidade), nome_item: n.nome_item_registrado,
    unidade_medida: n.unidade_registrada, categoria_suprimento: i.categoria_suprimento, id_categoria: c.id_categoria,
    ativo: i.ativo, prioridade: c.nome_categoria, cor_indicador: c.cor_indicador, nivel_ordem: c.nivel_ordem,
    status: 'Aberta', quantidade_meta: n.quantidade_meta, quantidade_arrecadada: arr, quantidade_faltante: falta,
    percentual_atendimento: pct, percentual_barra: Math.min(pct, 100), meta_atingida: arr >= n.quantidade_meta,
    quantidade_necessaria: n.quantidade_meta, quantidade_atual: arr, prazo_necessidade: null, descricao: null,
  };
}

function termometro() {
  const totais = arrecadado();
  return db.necessidades
    .filter((n) => n.status === 'Aberta' && item(n.id_item).ativo)
    .map((n) => necessidadePublica(n, totais))
    .sort((a, b) => a.nivel_ordem - b.nivel_ordem || a.percentual_atendimento - b.percentual_atendimento || a.nome_item.localeCompare(b.nome_item, 'pt-BR'));
}

const meta = (n) => ({ id_necessidade: String(n.id_necessidade), id_item: n.id_item, quantidade_meta: n.quantidade_meta, status: n.status });
const produto = (i) => ({ id_item: i.id_item, nome_item: i.nome_item, unidade_medida: i.unidade_medida, categoria_suprimento: i.categoria_suprimento, id_categoria: i.id_categoria, ativo: i.ativo });

function recebidoNoAgendamento(idAg, idItem) {
  const recs = new Set(db.recebimentos.filter((r) => r.status === 'Confirmado' && r.id_agendamento === idAg).map((r) => r.id_recebimento));
  return db.itens_recebimento.filter((ir) => recs.has(ir.id_recebimento) && ir.id_item === idItem).reduce((s, ir) => s + ir.quantidade_recebida, 0);
}
const temRecebimentoConfirmado = (idAg) => db.recebimentos.some((r) => r.status === 'Confirmado' && r.id_agendamento === idAg);

function agendamento(a, { comDoador = false } = {}) {
  const d = db.doadores.find((x) => x.id_doador === a.id_doador);
  return {
    id_agendamento: a.id_agendamento,
    data_hora_agendada: localSP(a.data_hora_agendada),
    status_agendamento: a.status_agendamento,
    fuso_horario: 'America/Sao_Paulo',
    itens: db.itens_agendamento.filter((ia) => ia.id_agendamento === a.id_agendamento).map((ia) => {
      const i = item(ia.id_item);
      return {
        id_item: ia.id_item, id_necessidade: ia.id_necessidade ? String(ia.id_necessidade) : null,
        nome_item: i.nome_item, unidade_medida: i.unidade_medida, quantidade_doada: ia.quantidade_doada, status_item: ia.status_item,
        // Proposta para a API (itens 1/9 do PDF de ajustes): total confirmado por item, sem depender de GET /doacoes.
        quantidade_recebida: recebidoNoAgendamento(a.id_agendamento, ia.id_item),
      };
    }),
    ...(comDoador && d ? { doador: { id_doador: d.id_doador, nome: d.nome, email: d.email, telefone: d.telefone, tipo_doador: d.tipo_doador } } : {}),
  };
}

function recebimento(r) {
  return {
    id_recebimento: String(r.id_recebimento), id_doacao: String(r.id_recebimento), chave_operacao: r.chave_operacao,
    id_agendamento: r.id_agendamento, id_doador: r.id_doador, ocorrido_em: r.ocorrido_em, status: r.status,
    registrado_por: r.registrado_por ?? 1, confirmado_por: r.status === 'Rascunho' ? null : (r.registrado_por ?? 1),
    estornado_por: r.status === 'Estornado' ? (r.estornado_por ?? 1) : null, motivo_estorno: r.motivo_estorno,
    itens: db.itens_recebimento.filter((ir) => ir.id_recebimento === r.id_recebimento).map((ir) => ({
      id_item: ir.id_item, id_necessidade: ir.id_necessidade ? String(ir.id_necessidade) : null,
      quantidade_recebida: ir.quantidade_recebida, nome_item_registrado: ir.nome_item_registrado, unidade_registrada: ir.unidade_registrada,
    })),
  };
}

// ---------------------------------------------------------------- sessão e tokens

function usuarioDaSessao(token) {
  const s = db.sessoes[token];
  const u = s && db.usuarios.find((x) => x.id_usuario === s.id_usuario);
  if (!u || !u.ativo || s.expira < Date.now()) falhar(401, 'NAO_AUTENTICADO', 'Sessão inválida ou expirada.');
  if (u.cargo !== 'Administrador') falhar(403, 'PROIBIDO', 'Operação restrita a administradores.');
  return u;
}

function agendamentoDoToken(id, token) {
  const a = db.agendamentos.find((x) => x.id_agendamento === Number(id));
  if (!a || !token || db.tokensAgendamento[a.id_agendamento] !== token) falhar(401, 'NAO_AUTENTICADO', 'Código do agendamento inválido.');
  return a;
}

const usuarioPublico = (u) => ({ id_usuario: u.id_usuario, nome: u.nome, email: u.email, cargo: u.cargo });

/** Idempotência: mesma chave + mesmo corpo => resposta original (200); corpo diferente => 409. */
function idempotente(escopo, chave, corpo, executar) {
  const registro = db.idempotencia[`${escopo}:${chave}`];
  const assinatura = JSON.stringify(corpo);
  if (registro) {
    if (registro.assinatura !== assinatura) conflito('Idempotency-Key já usada com outro conteúdo.');
    return { status: 200, corpo: { ...registro.resposta, repetido: true } };
  }
  const resposta = executar();
  db.idempotencia[`${escopo}:${chave}`] = { assinatura, resposta };
  return { status: 201, corpo: { ...resposta, repetido: false } };
}

// ---------------------------------------------------------------- capacidade

function vagasEm(data, horario, ignorarId = null) {
  const ocupadas = db.agendamentos.filter((a) => a.id_agendamento !== ignorarId
    && ['Pendente', 'Confirmado'].includes(a.status_agendamento)
    && localSP(a.data_hora_agendada).startsWith(`${data}T${horario}`)).length;
  return Math.max(CAPACIDADE_DEMO - ocupadas, 0);
}

function validarHorario(data, horario, ignorarId = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? '')) invalido('Informe a data no formato AAAA-MM-DD.');
  if (!HORARIOS_DEMO.includes(horario)) invalido('Horário fora dos horários de entrega.');
  if (new Date(deLocalSP(data, horario)).getTime() <= Date.now()) invalido('Escolha um horário futuro.');
  if (vagasEm(data, horario, ignorarId) === 0) conflito('Este horário está lotado. Escolha outro.');
}

// ================================================================ rotas públicas

function getNecessidades({ query }) {
  let lista = termometro();
  if (query.q) lista = lista.filter((n) => normalizar(n.nome_item).includes(normalizar(query.q)));
  if (query.categoria) lista = lista.filter((n) => n.categoria_suprimento === query.categoria);
  if (query.prioridade) lista = lista.filter((n) => n.id_categoria === Number(query.prioridade));
  return paginar(lista, query);
}

function getItem({ params }) {
  const n = termometro().find((x) => x.id_item === Number(params.id));
  return n ?? naoEncontrado('Meta aberta do produto');
}

// Imita GET /calendario/feriados/:ano (BrasilAPI via backend, PR #32).
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function getFeriados({ params }) {
  const ano = Number(params.ano);
  if (!/^\d{4}$/.test(params.ano) || ano < 1900 || ano > 2199) falhar(422, 'ANO_INVALIDO', 'Informe um ano entre 1900 e 2199.');
  const p = pascoa(ano);
  const rel = (dias) => new Date(p.getTime() + dias * 86400000).toISOString().slice(0, 10);
  const feriados = [
    [`${ano}-01-01`, 'Confraternização mundial'], [rel(-47), 'Carnaval'], [rel(-2), 'Sexta-feira Santa'],
    [rel(0), 'Páscoa'], [`${ano}-04-21`, 'Tiradentes'], [`${ano}-05-01`, 'Dia do trabalho'],
    [rel(60), 'Corpus Christi'], [`${ano}-09-07`, 'Independência do Brasil'],
    [`${ano}-10-12`, 'Nossa Senhora Aparecida'], [`${ano}-11-02`, 'Finados'],
    [`${ano}-11-15`, 'Proclamação da República'], [`${ano}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra'],
    [`${ano}-12-25`, 'Natal'],
  ].map(([data, nome]) => ({ data, nome, tipo: 'national' })).sort((x, y) => x.data.localeCompare(y.data));
  return { status: 'disponivel', fonte: 'BrasilAPI', ano, consultado_em: new Date().toISOString(), feriados };
}

function getDisponibilidade({ query }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.data ?? '')) invalido('Informe a data no formato AAAA-MM-DD.');
  const agora = Date.now();
  return {
    data: query.data,
    fuso_horario: 'America/Sao_Paulo',
    horarios: HORARIOS_DEMO
      .filter((h) => new Date(deLocalSP(query.data, h)).getTime() > agora)
      .map((h) => ({ horario: h, capacidade: CAPACIDADE_DEMO, vagas: vagasEm(query.data, h) })),
  };
}

function postAgendamento({ corpo = {}, cabecalhos }) {
  const chave = cabecalhos['Idempotency-Key'];
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(chave ?? '')) invalido('Cabeçalho Idempotency-Key ausente ou inválido.');
  return idempotente('agendamento', chave, corpo, () => {
    const d = corpo.doador ?? {};
    if (!ehTexto(d.nome, 100, 2)) invalido('Informe o nome (2 a 100 caracteres).');
    if (typeof d.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) invalido('Informe um e-mail válido.');
    if (!ehTexto(d.telefone, 20)) invalido('Informe o telefone.');
    if (d.tipo_doador !== undefined && !['PF', 'PJ'].includes(d.tipo_doador)) invalido('Tipo de doador inválido.');
    validarHorario(corpo.data, corpo.horario);
    const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
    if (!itens.length) invalido('Informe pelo menos um item.');
    const totais = arrecadado();
    const vistos = new Set();
    for (const it of itens) {
      if (!ehInt(it.id_item) || !ID_BIGINT.test(it.id_necessidade ?? '') || !ehInt(it.quantidade_doada)) invalido('Item inválido.');
      if (vistos.has(it.id_item)) invalido('Produto repetido no agendamento.');
      vistos.add(it.id_item);
      const n = db.necessidades.find((x) => x.id_necessidade === Number(it.id_necessidade));
      if (!n || n.id_item !== it.id_item || n.status !== 'Aberta' || !item(n.id_item).ativo) {
        conflito('Uma das necessidades escolhidas mudou ou foi encerrada. Atualize a lista e tente de novo.');
      }
      if (calculo(n, totais).arr >= n.quantidade_meta) conflito('Uma das necessidades escolhidas já foi atendida. Atualize a lista.');
    }
    let doador = db.doadores.find((x) => normEmail(x.email) === normEmail(d.email));
    if (!doador) {
      doador = { id_doador: proximo('doadores'), nome: d.nome.trim(), email: d.email.trim(), telefone: d.telefone.trim(), tipo_doador: d.tipo_doador ?? 'PF', data_cadastro: new Date().toISOString() };
      db.doadores.push(doador);
    }
    const a = { id_agendamento: proximo('agendamentos'), id_doador: doador.id_doador, data_hora_agendada: deLocalSP(corpo.data, corpo.horario), status_agendamento: 'Pendente', observacoes: null, data_criacao: new Date().toISOString() };
    db.agendamentos.push(a);
    for (const it of itens) {
      db.itens_agendamento.push({ id_agendamento: a.id_agendamento, id_item: it.id_item, id_necessidade: Number(it.id_necessidade), quantidade_doada: it.quantidade_doada, status_item: 'Agendado' });
    }
    const token = hex64();
    db.tokensAgendamento[a.id_agendamento] = token;
    salvar();
    return { agendamento: agendamento(a), token_acesso: token };
  });
}

function alterarAgendamento(a, operacao, corpo) {
  if (!['Pendente', 'Confirmado'].includes(a.status_agendamento)) conflito('Este agendamento já foi encerrado.');
  if (temRecebimentoConfirmado(a.id_agendamento)) conflito('Já há entrega registrada para este agendamento. A ONG precisa concluir ou estornar antes.');
  if (operacao === 'cancelar') {
    a.status_agendamento = 'Cancelado';
    db.itens_agendamento.filter((ia) => ia.id_agendamento === a.id_agendamento && ia.status_item === 'Agendado').forEach((ia) => { ia.status_item = 'Cancelado'; });
  } else {
    validarHorario(corpo.data, corpo.horario, a.id_agendamento);
    a.data_hora_agendada = deLocalSP(corpo.data, corpo.horario);
  }
  salvar();
}

const getMeuAgendamento = ({ params, token }) => agendamento(agendamentoDoToken(params.id, token));
function patchMeuAgendamento(operacao) {
  return ({ params, token, corpo = {} }) => {
    const a = agendamentoDoToken(params.id, token);
    alterarAgendamento(a, operacao, corpo);
    return agendamento(a);
  };
}

// ================================================================ autenticação

function postLogin({ corpo = {} }) {
  const u = db.usuarios.find((x) => normEmail(x.email) === normEmail(corpo.email ?? ''));
  if (!u || !u.ativo || u.senha !== corpo.senha || u.cargo !== 'Administrador') falhar(401, 'NAO_AUTENTICADO', 'E-mail ou senha incorretos.');
  const token = hex64();
  const expira = Date.now() + SESSAO_MS;
  db.sessoes[token] = { id_usuario: u.id_usuario, expira };
  salvar();
  return { token, tipo: 'Bearer', expira_em: new Date(expira).toISOString(), usuario: usuarioPublico(u) };
}

const getEu = ({ usuario }) => ({ usuario: usuarioPublico(usuario) });

function postLogout({ token }) {
  delete db.sessoes[token];
  salvar();
  return { status: 204, corpo: undefined };
}

// ================================================================ admin: catálogo

function validarProduto(c) {
  if (!ehTexto(c.nome_item, 120, 2)) invalido('Informe o nome do produto (2 a 120 caracteres).');
  if (!ehTexto(c.unidade_medida, 20)) invalido('Informe a unidade (até 20 caracteres).');
  if (!ehTexto(c.categoria_suprimento, 50)) invalido('Informe o tipo de produto (até 50 caracteres).');
  if (!categoria(c.id_categoria)) invalido('Prioridade inválida.');
}

function postItem({ corpo = {} }) {
  validarProduto(corpo);
  const i = { id_item: proximo('itens'), nome_item: corpo.nome_item.trim(), unidade_medida: corpo.unidade_medida.trim(), categoria_suprimento: corpo.categoria_suprimento.trim(), id_categoria: corpo.id_categoria, ativo: true };
  db.itens.push(i);
  salvar();
  return { status: 201, corpo: produto(i) };
}

function putItem({ params, corpo = {} }) {
  const i = item(Number(params.id)) ?? naoEncontrado('Produto');
  validarProduto(corpo);
  const emUso = db.necessidades.some((n) => n.id_item === i.id_item) || db.itens_agendamento.some((ia) => ia.id_item === i.id_item);
  if (emUso && corpo.unidade_medida.trim() !== i.unidade_medida) conflito('A unidade não pode mudar porque o produto já tem metas ou entregas.');
  Object.assign(i, { nome_item: corpo.nome_item.trim(), unidade_medida: corpo.unidade_medida.trim(), categoria_suprimento: corpo.categoria_suprimento.trim(), id_categoria: corpo.id_categoria });
  salvar();
  return produto(i);
}

function deleteItem({ params }) {
  const i = item(Number(params.id)) ?? naoEncontrado('Produto');
  i.ativo = false;
  salvar();
  return { status: 204, corpo: undefined };
}

const getItensAdmin = ({ query }) => paginar([...db.itens].sort((a, b) => a.id_item - b.id_item).map(produto), query);
const getItemAdmin = ({ params }) => produto(item(Number(params.id)) ?? naoEncontrado('Produto'));

// ================================================================ admin: metas

function abrirMeta(idItem, idCategoria, quantidade) {
  if (necessidadeAberta(idItem)) conflito('Este produto já tem uma meta aberta. Use Renovar.');
  const i = item(idItem);
  const n = { id_necessidade: proximo('necessidades'), id_item: idItem, id_categoria: idCategoria, nome_item_registrado: i.nome_item, unidade_registrada: i.unidade_medida, quantidade_meta: quantidade, status: 'Aberta', criada_em: new Date().toISOString(), encerrada_em: null };
  db.necessidades.push(n);
  return n;
}

function postMeta({ corpo = {} }) {
  if (!ehInt(corpo.id_item) || !ehInt(corpo.id_categoria) || !ehInt(corpo.quantidade_meta)) invalido('Informe produto, prioridade e meta inteira positiva.');
  const i = item(corpo.id_item) ?? naoEncontrado('Produto');
  if (!i.ativo) conflito('Produto inativo.');
  if (!categoria(corpo.id_categoria)) invalido('Prioridade inválida.');
  const n = abrirMeta(i.id_item, corpo.id_categoria, corpo.quantidade_meta);
  salvar();
  return { status: 201, corpo: meta(n) };
}

function fecharMeta(novoStatus) {
  return ({ params }) => {
    if (!ID_BIGINT.test(params.id)) invalido('ID inválido.');
    const n = db.necessidades.find((x) => x.id_necessidade === Number(params.id)) ?? naoEncontrado('Meta');
    if (n.status !== 'Aberta') conflito('Esta meta já foi encerrada.');
    n.status = novoStatus;
    n.encerrada_em = new Date().toISOString();
    salvar();
    return meta(n);
  };
}

function postRenovar({ params, corpo = {} }) {
  if (!ehInt(corpo.id_categoria) || !ehInt(corpo.quantidade_meta)) invalido('Informe prioridade e meta inteira positiva.');
  const antiga = db.necessidades.find((x) => x.id_necessidade === Number(params.id)) ?? naoEncontrado('Meta');
  if (antiga.status !== 'Aberta') conflito('Esta meta já foi encerrada.');
  if (!item(antiga.id_item).ativo) conflito('Produto inativo.');
  antiga.status = 'Encerrada';
  antiga.encerrada_em = new Date().toISOString();
  const nova = abrirMeta(antiga.id_item, corpo.id_categoria, corpo.quantidade_meta);
  salvar();
  return { status: 201, corpo: meta(nova) };
}

function getHistorico({ query }) {
  const totais = arrecadado();
  const lista = [...db.necessidades].sort((a, b) => b.id_necessidade - a.id_necessidade).map((n) => {
    const { arr, pct, falta } = calculo(n, totais);
    return {
      id_necessidade: String(n.id_necessidade), id_item: n.id_item, nome_item: n.nome_item_registrado, unidade_medida: n.unidade_registrada,
      quantidade_meta: n.quantidade_meta, quantidade_arrecadada: String(arr), quantidade_faltante: String(falta), percentual_atendimento: pct.toFixed(2),
      status: n.status, urgencia: categoria(n.id_categoria).nome_categoria, criada_em: n.criada_em, encerrada_em: n.encerrada_em,
    };
  });
  return paginar(lista, query);
}

function getMensal({ query }) {
  const mes = query.mes ?? diaDe(new Date().toISOString()).slice(0, 7);
  const grupos = new Map();
  for (const r of db.recebimentos.filter((x) => x.status === 'Confirmado' && mesDe(x.ocorrido_em) === mes)) {
    for (const ir of db.itens_recebimento.filter((x) => x.id_recebimento === r.id_recebimento)) {
      const k = `${ir.id_item}|${ir.nome_item_registrado}|${ir.unidade_registrada}`;
      const g = grupos.get(k) ?? { mes, id_item: ir.id_item, nome_item: ir.nome_item_registrado, unidade_medida: ir.unidade_registrada, q: 0, e: new Set() };
      g.q += ir.quantidade_recebida;
      g.e.add(r.id_recebimento);
      grupos.set(k, g);
    }
  }
  return paginar([...grupos.values()].map(({ q, e, ...g }) => ({ ...g, quantidade_arrecadada: String(q), entregas: String(e.size) })), query);
}

// ================================================================ admin: agendamentos

const STATUS_AGENDAMENTO = ['Pendente', 'Confirmado', 'Concluído', 'Cancelado'];

/**
 * Busca do item 3 (PDF de ajustes), espelhando o SQL proposto ao backend:
 * código exato, nome (ILIKE: ignora maiúsculas, não ignora acentos), e-mail, e trecho do
 * telefone só com dígitos (4 ou mais).
 */
function combinaBusca(a, q) {
  const d = db.doadores.find((x) => x.id_doador === a.id_doador);
  const texto = q.trim().toLowerCase();
  const codigo = /^#?\d+$/.test(texto) ? Number(texto.replace('#', '')) : null;
  const digitos = /^[\d\s().+#-]+$/.test(texto) ? texto.replace(/\D/g, '') : '';
  if (a.id_agendamento === codigo) return true;
  if (!d) return false;
  return d.nome.toLowerCase().includes(texto)
    || normEmail(d.email).includes(texto)
    || (digitos.length >= 4 && d.telefone.replace(/\D/g, '').includes(digitos));
}

function getAgendamentosAdmin({ query }) {
  let lista = db.agendamentos;
  if (query.data) lista = lista.filter((a) => localSP(a.data_hora_agendada).startsWith(query.data));
  const [de, ate] = [query.de, query.ate];
  if ([de, ate].some((d) => d !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d))) invalido('Período: use datas AAAA-MM-DD.');
  if (de && ate && de > ate) invalido('Período: a data inicial deve ser anterior ou igual à final.');
  if (de) lista = lista.filter((a) => localSP(a.data_hora_agendada).slice(0, 10) >= de);
  if (ate) lista = lista.filter((a) => localSP(a.data_hora_agendada).slice(0, 10) <= ate);
  if (query.status) {
    const status = query.status.split(',').map((s) => s.trim());
    if (status.some((s) => !STATUS_AGENDAMENTO.includes(s))) invalido('Status inválido.');
    lista = lista.filter((a) => status.includes(a.status_agendamento));
  }
  if (query.q !== undefined) {
    if (!ehTexto(query.q, 100)) invalido('Busca: tamanho inválido.');
    lista = lista.filter((a) => combinaBusca(a, query.q));
  }
  // Item 1: do mais recente para o mais antigo (data da entrega).
  lista = [...lista].sort((a, b) => b.data_hora_agendada.localeCompare(a.data_hora_agendada) || b.id_agendamento - a.id_agendamento);
  return paginar(lista.map((a) => agendamento(a, { comDoador: true })), query);
}

const agendamentoAdmin = (id) => db.agendamentos.find((a) => a.id_agendamento === Number(id)) ?? naoEncontrado('Agendamento');
const getAgendamentoAdmin = ({ params }) => agendamento(agendamentoAdmin(params.id), { comDoador: true });

function patchAgendamentoAdmin(operacao) {
  return ({ params, corpo = {} }) => {
    const a = agendamentoAdmin(params.id);
    alterarAgendamento(a, operacao, corpo);
    return agendamento(a, { comDoador: true });
  };
}

function patchConcluir({ params, corpo = {} }) {
  const a = agendamentoAdmin(params.id);
  if (!['Pendente', 'Confirmado'].includes(a.status_agendamento)) conflito('Este agendamento já foi encerrado.');
  const itens = db.itens_agendamento.filter((ia) => ia.id_agendamento === a.id_agendamento && ia.status_item === 'Agendado');
  const incompletos = itens.filter((ia) => recebidoNoAgendamento(a.id_agendamento, ia.id_item) < ia.quantidade_doada);
  if (incompletos.length && !ehTexto(corpo.motivo_pendencias, 500)) invalido('Faltam itens: informe o motivo das pendências.');
  for (const ia of itens) ia.status_item = incompletos.includes(ia) ? 'Cancelado' : 'Entregue';
  a.status_agendamento = 'Concluído';
  salvar();
  return agendamento(a, { comDoador: true });
}

/**
 * Item 9 (PDF de ajustes): registra o que chegou e conclui numa operação só.
 * Corpo vazio = chegou tudo o que faltava. Com `itens`, só os informados chegaram.
 * Cada item é somado à meta ABERTA ATUAL do produto (ou fica sem meta), para que a doação
 * atrasada não falhe quando a meta original foi encerrada ou renovada.
 */
function postReceberEConcluir({ params, corpo = {}, cabecalhos, usuario }) {
  const chave = cabecalhos['Idempotency-Key'];
  if (!UUID.test(chave ?? '')) invalido('Cabeçalho Idempotency-Key deve ser um UUID.');
  const a = agendamentoAdmin(params.id);
  const escopo = `concluir:${usuario.id_usuario}`;
  if (a.status_agendamento === 'Concluído' && !db.idempotencia[`${escopo}:${chave.toLowerCase()}`]) {
    return { status: 200, corpo: { agendamento: agendamento(a, { comDoador: true }), doacao: null, repetido: true } };
  }
  return idempotente(escopo, chave.toLowerCase(), corpo, () => {
    if (a.status_agendamento !== 'Pendente' && a.status_agendamento !== 'Confirmado') conflito('Agendamento cancelado não pode ser concluído.');
    if (corpo.motivo_pendencias !== undefined && !ehTexto(corpo.motivo_pendencias, 500)) invalido('Motivo das pendências: tamanho inválido.');
    const prometidos = db.itens_agendamento.filter((ia) => ia.id_agendamento === a.id_agendamento && ia.status_item === 'Agendado');
    const falta = (ia) => Math.max(ia.quantidade_doada - recebidoNoAgendamento(a.id_agendamento, ia.id_item), 0);
    const chegou = itensQueChegaram(corpo.itens, prometidos, falta);

    const inativo = chegou.map((c) => item(c.id_item)).find((i) => !i.ativo);
    if (inativo) conflito(`O produto ${inativo.nome_item} foi desativado e não pode ser recebido. Use "Chegou só uma parte" e deixe-o de fora.`);

    const recebidoAgora = new Map(chegou.map((c) => [c.id_item, c.quantidade_recebida]));
    const incompletos = prometidos.filter((ia) => (recebidoAgora.get(ia.id_item) ?? 0) < falta(ia));
    if (incompletos.length && !corpo.motivo_pendencias?.trim()) {
      falhar(409, 'ENTREGA_PARCIAL', 'Faltaram itens: informe o motivo para concluir.');
    }

    let r = null;
    if (chegou.length) {
      r = { id_recebimento: proximo('recebimentos'), chave_operacao: chave.toLowerCase(), id_doador: a.id_doador, id_agendamento: a.id_agendamento, ocorrido_em: new Date().toISOString(), status: 'Confirmado', motivo_estorno: null, registrado_em: new Date().toISOString(), registrado_por: usuario.id_usuario };
      db.recebimentos.push(r);
      for (const c of chegou) {
        const i = item(c.id_item);
        db.itens_recebimento.push({ id_recebimento: r.id_recebimento, id_item: i.id_item, id_necessidade: necessidadeAberta(i.id_item)?.id_necessidade ?? null, quantidade_recebida: c.quantidade_recebida, nome_item_registrado: i.nome_item, unidade_registrada: i.unidade_medida });
      }
    }
    for (const ia of prometidos) ia.status_item = incompletos.includes(ia) ? 'Cancelado' : 'Entregue';
    a.status_agendamento = 'Concluído';
    const motivo = corpo.motivo_pendencias ? ': ' + corpo.motivo_pendencias.trim() : '';
    a.observacoes = [a.observacoes, `Conclusão pela ONG #${usuario.id_usuario}${motivo}`].filter(Boolean).join('\n');
    salvar();
    return { agendamento: agendamento(a, { comDoador: true }), doacao: r ? recebimento(r) : null };
  });
}

/** Sem `itens` no corpo: chegou tudo o que faltava. Com `itens`: só os informados, validados contra o prometido. */
function itensQueChegaram(itens, prometidos, falta) {
  if (itens === undefined) {
    return prometidos.filter((ia) => falta(ia) > 0).map((ia) => ({ id_item: ia.id_item, quantidade_recebida: falta(ia) }));
  }
  if (!Array.isArray(itens) || itens.length > 100) invalido('Itens inválidos.');
  const vistos = new Set();
  return itens.map((it) => {
    if (!ehInt(it?.id_item) || !ehInt(it?.quantidade_recebida)) invalido('Cada item precisa de id_item e quantidade_recebida inteira positiva.');
    if (vistos.has(it.id_item)) invalido('Produto repetido.');
    vistos.add(it.id_item);
    if (!prometidos.some((ia) => ia.id_item === it.id_item)) conflito('Produto não prometido, cancelado ou já entregue neste agendamento.');
    return { id_item: it.id_item, quantidade_recebida: it.quantidade_recebida };
  });
}

// ================================================================ admin: recebimentos (/doacoes)

function postDoacao({ corpo = {}, cabecalhos, usuario }) {
  const chave = cabecalhos['Idempotency-Key'];
  if (!UUID.test(chave ?? '')) invalido('Cabeçalho Idempotency-Key deve ser um UUID.');
  return idempotente(`doacao:${usuario.id_usuario}`, chave.toLowerCase(), corpo, () => {
    if (typeof corpo.ocorrido_em !== 'string' || !COM_FUSO.test(corpo.ocorrido_em)) invalido('Informe ocorrido_em com fuso horário.');
    if (new Date(corpo.ocorrido_em).getTime() > Date.now() + 60000) conflito('A data da entrega não pode ser no futuro.');
    const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
    if (!itens.length) invalido('Informe pelo menos um item.');
    let idDoador = corpo.id_doador ?? null;
    const idAg = corpo.id_agendamento ?? null;
    if (idAg !== null) {
      const a = agendamentoAdmin(idAg);
      if (!['Pendente', 'Confirmado'].includes(a.status_agendamento)) conflito('Agendamento cancelado ou concluído não recebe novas entregas.');
      if (idDoador !== null && idDoador !== a.id_doador) conflito('Doador não corresponde ao agendamento.');
      idDoador = a.id_doador;
    }
    const vistos = new Set();
    for (const it of itens) {
      if (!ehInt(it.id_item) || !ehInt(it.quantidade_recebida) || !('id_necessidade' in it)) invalido('Cada item precisa de id_item, id_necessidade (ou null) e quantidade_recebida inteira.');
      if (it.id_necessidade !== null && !ID_BIGINT.test(it.id_necessidade)) invalido('id_necessidade inválido.');
      if (vistos.has(it.id_item)) invalido('Produto repetido: some as quantidades numa linha só.');
      vistos.add(it.id_item);
      const i = item(it.id_item) ?? naoEncontrado('Produto');
      if (!i.ativo) conflito('Produto inexistente ou inativo.');
      if (it.id_necessidade !== null) {
        const n = db.necessidades.find((x) => x.id_necessidade === Number(it.id_necessidade));
        if (!n || n.id_item !== it.id_item || n.status === 'Cancelada'
          || (n.status === 'Encerrada' && new Date(corpo.ocorrido_em) > new Date(n.encerrada_em))) {
          conflito('Necessidade incompatível, cancelada ou entrega posterior ao encerramento.');
        }
      }
      if (idAg !== null && !db.itens_agendamento.some((ia) => ia.id_agendamento === idAg && ia.id_item === it.id_item && ia.status_item === 'Agendado')) {
        conflito('Produto não prometido, cancelado ou já entregue no agendamento.');
      }
    }
    const r = { id_recebimento: proximo('recebimentos'), chave_operacao: chave.toLowerCase(), id_doador: idDoador, id_agendamento: idAg, ocorrido_em: new Date(corpo.ocorrido_em).toISOString(), status: 'Confirmado', motivo_estorno: null, registrado_em: new Date().toISOString(), registrado_por: usuario.id_usuario };
    db.recebimentos.push(r);
    for (const it of itens) {
      const i = item(it.id_item);
      db.itens_recebimento.push({ id_recebimento: r.id_recebimento, id_item: i.id_item, id_necessidade: it.id_necessidade === null ? null : Number(it.id_necessidade), quantidade_recebida: it.quantidade_recebida, nome_item_registrado: i.nome_item, unidade_registrada: i.unidade_medida });
    }
    salvar();
    return { doacao: recebimento(r) };
  });
}

const getDoacoes = ({ query }) => paginar(
  db.recebimentos.filter((r) => r.status !== 'Rascunho')
    .sort((a, b) => new Date(b.ocorrido_em) - new Date(a.ocorrido_em) || b.id_recebimento - a.id_recebimento)
    .map(recebimento), query,
);
const getDoacao = ({ params }) => recebimento(db.recebimentos.find((r) => r.id_recebimento === Number(params.id)) ?? naoEncontrado('Recebimento'));

function patchEstornar({ params, corpo = {}, usuario }) {
  const r = db.recebimentos.find((x) => x.id_recebimento === Number(params.id)) ?? naoEncontrado('Recebimento');
  if (!ehTexto(corpo.motivo, 500)) invalido('Informe o motivo do estorno.');
  if (r.status !== 'Confirmado') conflito('Só é possível estornar um recebimento confirmado.');
  Object.assign(r, { status: 'Estornado', motivo_estorno: corpo.motivo.trim(), estornado_por: usuario.id_usuario });
  salvar();
  return recebimento(r);
}

// ================================================================ roteador

const categorias = () => [...db.categorias].sort((a, b) => a.nivel_ordem - b.nivel_ordem)
  .map((c) => ({ ...c, descricao_prioridade: c.descricao_prioridade ?? null }));

const ROTAS = [
  ['GET', '/health', () => ({ status: 'ok' })],
  ['GET', '/ready', () => ({ status: 'ok', banco: 'ok', complemento: 'ok' })],
  ['POST', '/auth/login', postLogin],
  ['GET', '/auth/me', getEu, 'sessao'],
  ['POST', '/auth/logout', postLogout, 'sessao'],
  ['GET', '/categorias', categorias],
  ['GET', '/itens', getNecessidades],
  ['POST', '/itens', postItem, 'sessao'],
  ['GET', '/necessidades', getNecessidades],
  ['GET', '/itens/:id', getItem],
  ['PUT', '/itens/:id', putItem, 'sessao'],
  ['DELETE', '/itens/:id', deleteItem, 'sessao'],
  ['GET', '/admin/itens', getItensAdmin, 'sessao'],
  ['GET', '/admin/itens/:id', getItemAdmin, 'sessao'],
  ['POST', '/admin/necessidades', postMeta, 'sessao'],
  ['PATCH', '/admin/necessidades/:id/encerrar', fecharMeta('Encerrada'), 'sessao'],
  ['PATCH', '/admin/necessidades/:id/cancelar', fecharMeta('Cancelada'), 'sessao'],
  ['POST', '/admin/necessidades/:id/renovar', postRenovar, 'sessao'],
  ['GET', '/admin/necessidades/historico', getHistorico, 'sessao'],
  ['GET', '/admin/arrecadacao/mensal', getMensal, 'sessao'],
  ['GET', '/disponibilidade', getDisponibilidade],
  ['GET', '/calendario/feriados/:ano', getFeriados],
  ['POST', '/agendamentos', postAgendamento],
  ['GET', '/agendamentos/:id', getMeuAgendamento],
  ['PATCH', '/agendamentos/:id/cancelar', patchMeuAgendamento('cancelar')],
  ['PATCH', '/agendamentos/:id/remarcar', patchMeuAgendamento('remarcar')],
  ['PATCH', '/admin/agendamentos/:id/cancelar', patchAgendamentoAdmin('cancelar'), 'sessao'],
  ['PATCH', '/admin/agendamentos/:id/remarcar', patchAgendamentoAdmin('remarcar'), 'sessao'],
  ['GET', '/admin/agendamentos', getAgendamentosAdmin, 'sessao'],
  ['GET', '/admin/agendamentos/:id', getAgendamentoAdmin, 'sessao'],
  ['PATCH', '/admin/agendamentos/:id/concluir', patchConcluir, 'sessao'],
  ['POST', '/admin/agendamentos/:id/receber-e-concluir', postReceberEConcluir, 'sessao'],
  ['POST', '/doacoes', postDoacao, 'sessao'],
  ['GET', '/doacoes', getDoacoes, 'sessao'],
  ['GET', '/doacoes/:id', getDoacao, 'sessao'],
  ['PATCH', '/doacoes/:id/estornar', patchEstornar, 'sessao'],
].map(([metodo, padrao, tratar, protecao = null]) => ({
  metodo, tratar, protecao, regex: new RegExp(`^${padrao.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
}));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let contador = 0;

/** Mesmo formato do fetch real: { status, corpo }. */
export async function tratarRequisicao({ metodo, caminho, corpo, params = {}, token, cabecalhos = {}, latencia = LATENCIA_MS }) {
  if (latencia) await esperar(latencia);
  const requestId = `mock-${++contador}`;
  const responder = (status, dados) => ({ status, corpo: dados === undefined ? null : JSON.parse(JSON.stringify(dados)) });
  try {
    // /admin/... tem precedência sobre rotas com :id genérico na mesma posição
    const rota = ROTAS.find((r) => r.metodo === metodo && r.regex.test(caminho));
    if (!rota) falhar(404, 'NAO_ENCONTRADO', `Rota ${metodo} ${caminho} não existe.`);
    const usuario = rota.protecao === 'sessao' ? usuarioDaSessao(token) : null;
    const resultado = rota.tratar({
      params: caminho.match(rota.regex).groups ?? {},
      query: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])),
      corpo: corpo === undefined ? undefined : JSON.parse(JSON.stringify(corpo)),
      cabecalhos,
      token,
      usuario,
    });
    if (resultado && typeof resultado === 'object' && 'status' in resultado && 'corpo' in resultado && Object.keys(resultado).length === 2) {
      return responder(resultado.status, resultado.corpo);
    }
    return responder(200, resultado);
  } catch (e) {
    if (e instanceof ErroMock) return responder(e.status, { erro: { codigo: e.codigo, mensagem: e.mensagem }, request_id: requestId });
    console.error('[mock] erro inesperado', e);
    return responder(500, { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Algo deu errado. Tente de novo.' }, request_id: requestId });
  }
}
