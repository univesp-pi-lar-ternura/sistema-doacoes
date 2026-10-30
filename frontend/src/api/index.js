import { requisitar, requisitarCompleto } from './cliente.js';
import { hojeSP, diaSP, diasDeAtraso, mesAtualSP, partesSP, paraInstante } from '../utils/formatar.js';

const admin = { autenticado: true };
const LIMITE = 100; // máximo aceito pela API por página
const txt = (v) => (v === null || v === undefined ? null : String(v));
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const idNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Lê todas as páginas (limit/offset). `parar(pagina)` encerra antes quando o restante não interessa. */
export async function buscarTodas(caminho, { params = {}, parar, ...opcoes } = {}) {
  const todas = [];
  for (let offset = 0; ; offset += LIMITE) {
    const pagina = await requisitar('GET', caminho, { ...opcoes, params: { ...params, limit: LIMITE, offset } });
    todas.push(...pagina);
    if (pagina.length < LIMITE || parar?.(pagina)) return todas;
  }
}

// ---------------------------------------------------------------- categorias de urgência

let categoriasEmCache = null;

export async function listarCategorias() {
  if (!categoriasEmCache) {
    const lista = await requisitar('GET', '/categorias');
    categoriasEmCache = [...lista].sort((a, b) => a.nivel_ordem - b.nivel_ordem);
  }
  return categoriasEmCache;
}

async function idCategoriaDoNivel(nivel) {
  const c = (await listarCategorias()).find((x) => x.nivel_ordem === nivel);
  if (!c) throw new Error(`Prioridade ${nivel} não cadastrada.`);
  return c.id_categoria;
}

const urgenciaDe = (c) => (c ? { nivel: c.nivel_ordem, nome: c.nome_categoria, cor: c.cor_indicador } : { nivel: 3, nome: '?', cor: '' });

// ---------------------------------------------------------------- formatos internos

function necessidadePublica(n) {
  return {
    id_necessidade: txt(n.id_necessidade),
    id_item: txt(n.id_item),
    nome_item: n.nome_item,
    unidade_medida: n.unidade_medida,
    categoria_suprimento: n.categoria_suprimento,
    quantidade_meta: num(n.quantidade_meta),
    quantidade_arrecadada: num(n.quantidade_arrecadada),
    quantidade_faltante: num(n.quantidade_faltante),
    percentual_atendimento: num(n.percentual_atendimento),
    percentual_barra: num(n.percentual_barra),
    meta_atingida: Boolean(n.meta_atingida),
    urgencia: { nivel: n.nivel_ordem, nome: n.prioridade, cor: n.cor_indicador },
  };
}

function agendamentoInterno(a, recebidos = new Map()) {
  return {
    id_agendamento: txt(a.id_agendamento),
    data_hora_agendada: a.data_hora_agendada, // hora local de SP, sem fuso (formatar.js entende)
    status_agendamento: a.status_agendamento,
    doador: a.doador ? {
      id_doador: txt(a.doador.id_doador),
      nome: a.doador.nome,
      email: a.doador.email,
      telefone: a.doador.telefone,
      tipo_doador: a.doador.tipo_doador,
    } : null,
    itens: (a.itens ?? []).map((i) => ({
      id_item: txt(i.id_item),
      id_necessidade: txt(i.id_necessidade),
      nome_item: i.nome_item,
      unidade_medida: i.unidade_medida,
      quantidade_prometida: num(i.quantidade_doada),
      // A API proposta devolve o total por item; sem ele, soma a partir de GET /doacoes.
      quantidade_recebida: i.quantidade_recebida !== undefined
        ? num(i.quantidade_recebida)
        : recebidos.get(`${a.id_agendamento}|${i.id_item}`) ?? 0,
      status_item: i.status_item,
    })),
  };
}

function recebimentoInterno(r) {
  return {
    id_recebimento: txt(r.id_recebimento ?? r.id_doacao),
    id_agendamento: txt(r.id_agendamento),
    ocorrido_em: r.ocorrido_em,
    status: r.status,
    motivo_estorno: r.motivo_estorno ?? null,
    itens: (r.itens ?? []).map((i) => ({
      id_item: txt(i.id_item),
      id_necessidade: txt(i.id_necessidade),
      nome_item: i.nome_item_registrado,
      unidade_medida: i.unidade_registrada,
      quantidade: num(i.quantidade_recebida),
    })),
  };
}

const usuarioInterno = (u) => (u ? {
  id_usuario: txt(u.id_usuario ?? u.id), nome: u.nome ?? '', email: u.email ?? '', cargo: u.cargo ?? 'Administrador',
} : null);

// ================================================================ PÚBLICO

export const verificarSaude = () => requisitar('GET', '/health');
export const verificarProntidao = () => requisitar('GET', '/ready');

export async function listarNecessidades({ busca, categoria, nivel } = {}) {
  const lista = await buscarTodas('/necessidades', {
    params: { q: busca || undefined, categoria: categoria || undefined },
  });
  let itens = lista.map(necessidadePublica);
  const niveis = (Array.isArray(nivel) ? nivel : []).map(Number);
  if (niveis.length) itens = itens.filter((i) => niveis.includes(i.urgencia.nivel));
  itens.sort((a, b) => a.urgencia.nivel - b.urgencia.nivel
    || a.percentual_atendimento - b.percentual_atendimento
    || a.nome_item.localeCompare(b.nome_item, 'pt-BR'));
  return { total: itens.length, itens };
}

export async function obterFiltros() {
  const [categorias, todas] = await Promise.all([listarCategorias(), buscarTodas('/necessidades')]);
  return {
    urgencias: categorias.map(urgenciaDe),
    categorias: [...new Set(todas.map((n) => n.categoria_suprimento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

export async function consultarDisponibilidade(data) {
  const r = await requisitar('GET', '/disponibilidade', { params: { data } });
  return (r.horarios ?? []).map((h) => ({ horario: h.horario, capacidade: num(h.capacidade), vagas: num(h.vagas) }));
}

const feriadosEmCache = new Map();

/**
 * GET /calendario/feriados/{ano}: feriados nacionais da BrasilAPI, consultados pelo backend.
 * Só informativo: nunca bloqueia o agendamento. Se a consulta falhar, devolve
 * { disponivel: false } (e não uma lista vazia, que pareceria "sem feriados").
 */
export async function consultarFeriados(ano) {
  if (!feriadosEmCache.has(ano)) {
    const consulta = requisitar('GET', `/calendario/feriados/${ano}`)
      .then((r) => (r?.status === 'disponivel' && Array.isArray(r.feriados)
        ? { disponivel: true, feriados: r.feriados.map((f) => ({ data: f.data, nome: String(f.nome) })) }
        : { disponivel: false, feriados: [] }));
    feriadosEmCache.set(ano, consulta);
    consulta.then((r) => { if (!r.disponivel) feriadosEmCache.delete(ano); }, () => feriadosEmCache.delete(ano));
  }
  try {
    return await feriadosEmCache.get(ano);
  } catch {
    return { disponivel: false, feriados: [] };
  }
}

export async function criarAgendamento({ chave, doador, data, horario, itens }) {
  const r = await requisitar('POST', '/agendamentos', {
    cabecalhos: { 'Idempotency-Key': chave },
    corpo: {
      doador,
      data,
      horario,
      itens: itens.map((i) => ({ id_item: Number(i.id_item), id_necessidade: String(i.id_necessidade), quantidade_doada: i.quantidade })),
    },
  });
  return { agendamento: agendamentoInterno(r.agendamento), token_acesso: r.token_acesso, repetido: r.repetido };
}

// ---- rotas do doador com o código privado do agendamento

export async function consultarMeuAgendamento(id, token) {
  return agendamentoInterno(await requisitar('GET', `/agendamentos/${id}`, { tokenAgendamento: token }));
}

export async function cancelarMeuAgendamento(id, token) {
  return agendamentoInterno(await requisitar('PATCH', `/agendamentos/${id}/cancelar`, { tokenAgendamento: token, corpo: {} }));
}

export async function remarcarMeuAgendamento(id, token, data, horario) {
  return agendamentoInterno(await requisitar('PATCH', `/agendamentos/${id}/remarcar`, { tokenAgendamento: token, corpo: { data, horario } }));
}

// ================================================================ AUTENTICAÇÃO

export async function entrar(email, senha) {
  const r = await requisitar('POST', '/auth/login', { corpo: { email, senha } });
  return { token: r.token, expira_em: r.expira_em, usuario: usuarioInterno(r.usuario) };
}

export async function obterUsuarioAtual() {
  const r = await requisitar('GET', '/auth/me', admin);
  return usuarioInterno(r?.usuario ?? r);
}

/** Revoga a sessão no servidor. Falhas são ignoradas: o token local é apagado de qualquer forma. */
export async function sairDaSessao() {
  try { await requisitar('POST', '/auth/logout', admin); } catch { /* sessão já inválida */ }
}

// ================================================================ ADMIN: agendamentos e recebimentos

async function listarDoacoesBrutas(parar) {
  return buscarTodas('/doacoes', { ...admin, parar });
}

function somarRecebidos(doacoes) {
  const mapa = new Map();
  for (const d of doacoes) {
    if (d.status !== 'Confirmado' || !d.id_agendamento) continue;
    for (const i of d.itens ?? []) {
      const chave = `${d.id_agendamento}|${i.id_item}`;
      mapa.set(chave, (mapa.get(chave) ?? 0) + num(i.quantidade_recebida));
    }
  }
  return mapa;
}

const PERIODOS = {
  hoje: () => [hojeSP(), hojeSP()],
  abertas: () => [null, null], // todas as datas: nada some até a equipe concluir ou cancelar
  semana: () => [hojeSP(), diaSP(7)],
  passados: () => [diaSP(-30), hojeSP()],
};

export async function listarAgendamentosAdmin({ periodo = 'hoje', incluirEncerrados = false, busca = '' } = {}) {
  const q = busca.trim();
  const [de, ate] = PERIODOS[periodo]();
  const semRecorte = Boolean(q) || periodo === 'abertas';
  const intervalo = !semRecorte && periodo !== 'hoje';
  const dia = (a) => a.data_hora_agendada.slice(0, 10);
  const lista = await buscarTodas('/admin/agendamentos', {
    ...admin,
    params: {
      q: q || undefined,
      data: !q && periodo === 'hoje' ? de : undefined,
      de: intervalo ? de : undefined,
      ate: intervalo ? ate : undefined,
      status: incluirEncerrados && !(periodo === 'abertas' && !q) ? undefined : 'Pendente,Confirmado',
    },
    // de/ate ainda não existem na API 2.1 (são ignorados); até lá, o recorte e a parada abaixo garantem o período.
    parar: semRecorte ? undefined : (pagina) => dia(pagina.at(-1)) < de,
  });
  const semTotais = lista.some((a) => (a.itens ?? []).some((i) => i.quantidade_recebida === undefined));
  const recebidos = semTotais ? somarRecebidos(await listarDoacoesBrutas()) : new Map();
  const agendamentos = lista
    .filter((a) => semRecorte || (dia(a) >= de && dia(a) <= ate))
    .map((a) => agendamentoInterno(a, recebidos));
  return { total: agendamentos.length, agendamentos };
}

export const cancelarAgendamentoAdmin = (id) => requisitar('PATCH', `/admin/agendamentos/${id}/cancelar`, { ...admin, corpo: {} });
export const remarcarAgendamentoAdmin = (id, data, horario) =>
  requisitar('PATCH', `/admin/agendamentos/${id}/remarcar`, { ...admin, corpo: { data, horario } });
/** Sem pendências: corpo vazio. Com itens faltando, a API exige motivo_pendencias. */
export const concluirAgendamento = (id, motivo) =>
  requisitar('PATCH', `/admin/agendamentos/${id}/concluir`, { ...admin, corpo: motivo ? { motivo_pendencias: motivo } : {} });

export async function receberEConcluir(id, { chave, itens = null, motivo = null }) {
  const corpo = {};
  if (itens) corpo.itens = itens.map((i) => ({ id_item: Number(i.id_item), quantidade_recebida: i.quantidade }));
  if (motivo) corpo.motivo_pendencias = motivo;
  const r = await requisitar('POST', `/admin/agendamentos/${id}/receber-e-concluir`, {
    ...admin, cabecalhos: { 'Idempotency-Key': chave }, corpo,
  });
  return {
    agendamento: agendamentoInterno(r.agendamento),
    doacao: r.doacao ? recebimentoInterno(r.doacao) : null,
    repetido: Boolean(r.repetido),
  };
}

export async function registrarRecebimento({ chave, id_agendamento, ocorrido_em, itens }) {
  const { dados } = await requisitarCompleto('POST', '/doacoes', {
    ...admin,
    cabecalhos: { 'Idempotency-Key': chave },
    corpo: {
      id_agendamento: idNum(id_agendamento),
      ocorrido_em,
      itens: itens.map((i) => ({
        id_item: Number(i.id_item),
        id_necessidade: i.id_necessidade ? String(i.id_necessidade) : null,
        quantidade_recebida: i.quantidade,
      })),
    },
  });
  return { ...recebimentoInterno(dados.doacao), repetido: Boolean(dados.repetido) };
}

export async function listarRecebimentos() {
  return (await listarDoacoesBrutas()).map(recebimentoInterno);
}

export const estornarRecebimento = (id, motivo) =>
  requisitar('PATCH', `/doacoes/${id}/estornar`, { ...admin, corpo: { motivo } });

export async function obterResumo() {
  const mes = mesAtualSP();
  const mesDe = (iso) => { const p = partesSP(paraInstante(iso)); return `${p.ano}-${p.mes}`; };
  const [hoje, semana, abertas, termometro, doacoes] = await Promise.all([
    listarAgendamentosAdmin({ periodo: 'hoje' }),
    listarAgendamentosAdmin({ periodo: 'semana' }),
    listarAgendamentosAdmin({ periodo: 'abertas' }),
    listarNecessidades(),
    listarDoacoesBrutas((pagina) => pagina.every((d) => mesDe(d.ocorrido_em) < mes)),
  ]);
  return {
    agendamentos_hoje: hoje.total,
    agendamentos_proximos_7_dias: semana.total,
    agendamentos_abertos: abertas.total,
    agendamentos_atrasados: abertas.agendamentos.filter((a) => (diasDeAtraso(a.data_hora_agendada) ?? 0) >= 1).length,
    necessidades_abertas: termometro.total,
    necessidades_criticas_abaixo_30: termometro.itens.filter((n) => n.urgencia.nivel === 1 && n.percentual_atendimento < 30).length,
    recebimentos_mes: { mes, entregas: doacoes.filter((d) => d.status === 'Confirmado' && mesDe(d.ocorrido_em) === mes).length },
  };
}

// ================================================================ ADMIN: necessidades

export async function listarNecessidadesAdmin(status = 'Aberta') {
  const [lista, categorias, catalogo] = await Promise.all([
    buscarTodas('/admin/necessidades/historico', admin),
    listarCategorias(),
    buscarTodas('/admin/itens', admin),
  ]);
  const ativos = new Map(catalogo.map((p) => [p.id_item, p.ativo]));
  const porNome = new Map(categorias.map((c) => [c.nome_categoria, c]));
  const necessidades = lista
    .filter((n) => status === 'todas' || n.status === status)
    .map((n) => {
      const pct = num(n.percentual_atendimento);
      return {
        id_necessidade: txt(n.id_necessidade),
        id_item: txt(n.id_item),
        nome_item: n.nome_item,
        unidade_medida: n.unidade_medida,
        quantidade_meta: num(n.quantidade_meta),
        quantidade_arrecadada: num(n.quantidade_arrecadada),
        quantidade_faltante: num(n.quantidade_faltante),
        percentual_atendimento: pct,
        percentual_barra: Math.min(pct, 100),
        meta_atingida: num(n.quantidade_arrecadada) >= num(n.quantidade_meta),
        urgencia: urgenciaDe(porNome.get(n.urgencia)),
        status: n.status,
        produto_ativo: ativos.get(n.id_item) ?? true,
        criada_em: n.criada_em,
        encerrada_em: n.encerrada_em,
      };
    });
  if (status === 'Aberta') {
    necessidades.sort((a, b) => a.urgencia.nivel - b.urgencia.nivel || a.percentual_atendimento - b.percentual_atendimento);
  }
  return { total: necessidades.length, necessidades };
}

export async function abrirNecessidade({ id_item, nivel, quantidade_meta }) {
  return requisitar('POST', '/admin/necessidades', {
    ...admin, corpo: { id_item: Number(id_item), id_categoria: await idCategoriaDoNivel(nivel), quantidade_meta },
  });
}

export async function renovarNecessidade(id, { quantidade_meta, nivel }) {
  return requisitar('POST', `/admin/necessidades/${id}/renovar`, {
    ...admin, corpo: { id_categoria: await idCategoriaDoNivel(nivel), quantidade_meta },
  });
}

export const encerrarNecessidade = (id, status) =>
  requisitar('PATCH', `/admin/necessidades/${id}/${status === 'Cancelada' ? 'cancelar' : 'encerrar'}`, { ...admin, corpo: {} });

// ================================================================ ADMIN: catálogo de produtos

export async function listarItens(ativo = 'todos') {
  const [catalogo, categorias, historico] = await Promise.all([
    buscarTodas('/admin/itens', admin),
    listarCategorias(),
    buscarTodas('/admin/necessidades/historico', admin),
  ]);
  const porId = new Map(categorias.map((c) => [c.id_categoria, c]));
  const metaAberta = new Map(historico.filter((n) => n.status === 'Aberta').map((n) => [txt(n.id_item), txt(n.id_necessidade)]));
  const comMetas = new Set(historico.map((n) => txt(n.id_item)));
  const itens = catalogo
    .filter((p) => ativo === 'todos' || String(p.ativo) === ativo)
    .sort((a, b) => a.nome_item.localeCompare(b.nome_item, 'pt-BR'))
    .map((p) => ({
      id_item: txt(p.id_item),
      nome_item: p.nome_item,
      unidade_medida: p.unidade_medida,
      categoria_suprimento: p.categoria_suprimento,
      ativo: p.ativo,
      urgencia_sugerida: urgenciaDe(porId.get(p.id_categoria)),
      id_necessidade_aberta: metaAberta.get(txt(p.id_item)) ?? null,
      unidade_em_uso: comMetas.has(txt(p.id_item)),
    }));
  return { total: itens.length, itens };
}

export async function criarItem({ nome_item, unidade_medida, categoria_suprimento, nivel, quantidade_meta }) {
  const id_categoria = await idCategoriaDoNivel(nivel);
  const produto = await requisitar('POST', '/itens', {
    ...admin, corpo: { nome_item, unidade_medida, categoria_suprimento, id_categoria },
  });
  if (quantidade_meta) {
    try {
      await requisitar('POST', '/admin/necessidades', { ...admin, corpo: { id_item: produto.id_item, id_categoria, quantidade_meta } });
    } catch (e) {
      e.message = `Produto cadastrado, mas a necessidade não foi aberta: ${e.message} Abra pela tela Necessidades.`;
      e.parcial = true;
      throw e;
    }
  }
  return produto;
}

export async function atualizarItem(id, { nome_item, unidade_medida, categoria_suprimento, nivel }) {
  return requisitar('PUT', `/itens/${id}`, {
    ...admin, corpo: { nome_item, unidade_medida, categoria_suprimento, id_categoria: await idCategoriaDoNivel(nivel) },
  });
}

export const desativarItem = (id) => requisitar('DELETE', `/itens/${id}`, admin);

/**
 * A unidade de um produto com metas não muda: cadastra um produto novo na nova unidade, encerra a meta
 * do antigo e o desativa. Se ainda houver entregas agendadas com o antigo, ele fica ativo para recebê-las.
 */
export async function trocarUnidadeItem(antigo, { nome_item, unidade_medida, quantidade_meta }) {
  const novo = await criarItem({
    nome_item, unidade_medida, quantidade_meta,
    categoria_suprimento: antigo.categoria_suprimento, nivel: antigo.urgencia_sugerida.nivel,
  });
  try {
    if (antigo.id_necessidade_aberta) await encerrarNecessidade(antigo.id_necessidade_aberta, 'Encerrada');
    const { agendamentos } = await listarAgendamentosAdmin({ periodo: 'abertas' });
    const pendentes = agendamentos
      .filter((a) => a.itens.some((i) => i.id_item === antigo.id_item && i.status_item === 'Agendado'))
      .map((a) => a.id_agendamento);
    if (!pendentes.length) await desativarItem(antigo.id_item);
    return { novo, pendentes };
  } catch (e) {
    e.message = `O produto novo foi cadastrado, mas o antigo não foi encerrado: ${e.message} Encerre a necessidade e desative o produto antigo manualmente.`;
    e.parcial = true;
    throw e;
  }
}

// ================================================================ ADMIN: relatório

export async function obterArrecadacaoMensal(mes = mesAtualSP()) {
  const lista = await buscarTodas('/admin/arrecadacao/mensal', { ...admin, params: { mes } });
  return lista.map((l) => ({ ...l, id_item: txt(l.id_item), quantidade_arrecadada: num(l.quantidade_arrecadada), entregas: num(l.entregas) }));
}
