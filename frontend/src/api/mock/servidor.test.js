// Confere o servidor simulado contra o openapi.json do Anderson (API 2.0.0) e contra os
// resultados esperados da documentação do banco (seção 9). Rodar com: npm test
import { describe, it, expect, beforeEach } from 'vitest';
import { tratarRequisicao, restaurarDadosMock } from './servidor.js';
import { HORARIOS_DEMO, CAPACIDADE_DEMO } from './dados.js';
import { diaSP } from '../../utils/formatar.js';

const req = (metodo, caminho, extra = {}) => tratarRequisicao({ metodo, caminho, latencia: 0, ...extra });
const uuid = () => crypto.randomUUID();
const amanha = () => new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

async function token() {
  return (await req('POST', '/auth/login', { corpo: { email: 'admin@demo.org', senha: 'demo12345' } })).corpo.token;
}

beforeEach(() => restaurarDadosMock());

describe('termômetro público', () => {
  it('cenário do 05: 5 metas, percentuais esperados, cobertor inativo fora', async () => {
    const { status, corpo } = await req('GET', '/necessidades');
    expect(status).toBe(200);
    expect(corpo).toHaveLength(5);
    const pct = Object.fromEntries(corpo.map((i) => [i.nome_item.split(' ')[1], i.percentual_atendimento]));
    expect(pct).toEqual({ Leite: 36.67, Fralda: 50, Arroz: 0, 'Sabão': 125, Sabonete: 0 });
  });

  it('id_item é inteiro, id_necessidade é string, aliases presentes', async () => {
    const [n] = (await req('GET', '/necessidades')).corpo;
    expect(typeof n.id_item).toBe('number');
    expect(typeof n.id_necessidade).toBe('string');
    expect(n.quantidade_atual).toBe(n.quantidade_arrecadada);
    expect(n.quantidade_necessaria).toBe(n.quantidade_meta);
  });
});

describe('POST /agendamentos', () => {
  const corpo = (extra = {}) => ({
    doador: { nome: 'Pessoa fictícia', email: 'teste@example.com', telefone: '11999999999', tipo_doador: 'PJ' },
    data: amanha(), horario: HORARIOS_DEMO[0],
    itens: [{ id_item: 4, id_necessidade: '4', quantidade_doada: 2 }],
    ...extra,
  });

  it('exige Idempotency-Key e devolve código privado; repetição devolve 200', async () => {
    expect((await req('POST', '/agendamentos', { corpo: corpo() })).status).toBe(422);
    const chave = uuid();
    const r1 = await req('POST', '/agendamentos', { corpo: corpo(), cabecalhos: { 'Idempotency-Key': chave } });
    expect(r1.status).toBe(201);
    expect(r1.corpo.token_acesso).toMatch(/^[a-f0-9]{64}$/);
    expect(r1.corpo.agendamento.data_hora_agendada).not.toMatch(/Z$/);
    const r2 = await req('POST', '/agendamentos', { corpo: corpo(), cabecalhos: { 'Idempotency-Key': chave } });
    expect(r2.status).toBe(200);
    expect(r2.corpo.repetido).toBe(true);
    const r3 = await req('POST', '/agendamentos', { corpo: corpo({ horario: HORARIOS_DEMO[1] }), cabecalhos: { 'Idempotency-Key': chave } });
    expect(r3.status).toBe(409);
  });

  it('meta atendida ou encerrada devolve 409', async () => {
    const r = await req('POST', '/agendamentos', { corpo: corpo({ itens: [{ id_item: 5, id_necessidade: '5', quantidade_doada: 1 }] }), cabecalhos: { 'Idempotency-Key': uuid() } });
    expect(r.status).toBe(409); // sabão está em 125%
  });

  it('lota o horário pela capacidade (10 vagas)', async () => {
    for (let n = 0; n < CAPACIDADE_DEMO; n += 1) {
      await req('POST', '/agendamentos', { corpo: corpo({ doador: { nome: 'Pessoa', email: `p${n}@example.com`, telefone: '11999999999' } }), cabecalhos: { 'Idempotency-Key': uuid() } });
    }
    const disp = (await req('GET', '/disponibilidade', { params: { data: amanha() } })).corpo;
    expect(disp.horarios.find((h) => h.horario === HORARIOS_DEMO[0]).vagas).toBe(0);
    const r = await req('POST', '/agendamentos', { corpo: corpo(), cabecalhos: { 'Idempotency-Key': uuid() } });
    expect(r.status).toBe(409);
  });

  it('doador consulta, remarca e cancela com o código privado', async () => {
    const r = await req('POST', '/agendamentos', { corpo: corpo(), cabecalhos: { 'Idempotency-Key': uuid() } });
    const { agendamento, token_acesso: t } = r.corpo;
    const id = agendamento.id_agendamento;
    expect((await req('GET', `/agendamentos/${id}`, { token: 'x'.repeat(64) })).status).toBe(401);
    expect((await req('GET', `/agendamentos/${id}`, { token: t })).status).toBe(200);
    const rem = await req('PATCH', `/agendamentos/${id}/remarcar`, { token: t, corpo: { data: amanha(), horario: HORARIOS_DEMO[2] } });
    expect(rem.corpo.data_hora_agendada).toContain(`T${HORARIOS_DEMO[2]}`);
    const can = await req('PATCH', `/agendamentos/${id}/cancelar`, { token: t, corpo: {} });
    expect(can.corpo.status_agendamento).toBe('Cancelado');
  });
});

describe('sessão da ONG', () => {
  it('login errado 401; sem token 401; logout revoga', async () => {
    expect((await req('POST', '/auth/login', { corpo: { email: 'admin@demo.org', senha: 'x' } })).status).toBe(401);
    expect((await req('GET', '/admin/itens')).status).toBe(401);
    const t = await token();
    expect((await req('GET', '/auth/me', { token: t })).status).toBe(200);
    expect((await req('POST', '/auth/logout', { token: t })).status).toBe(204);
    expect((await req('GET', '/auth/me', { token: t })).status).toBe(401);
  });
});

describe('POST /doacoes', () => {
  it('registra parcial do agendamento, soma à meta e é idempotente por UUID', async () => {
    const t = await token();
    const chave = uuid();
    const corpo = { id_agendamento: 5, ocorrido_em: new Date().toISOString(), itens: [{ id_item: 4, id_necessidade: '4', quantidade_recebida: 5 }] };
    const r = await req('POST', '/doacoes', { token: t, corpo, cabecalhos: { 'Idempotency-Key': chave } });
    expect(r.status).toBe(201);
    expect(r.corpo.doacao.status).toBe('Confirmado');
    const leite = (await req('GET', '/necessidades', { params: { q: 'leite' } })).corpo[0];
    expect(leite.quantidade_arrecadada).toBe(27);
    const rep = await req('POST', '/doacoes', { token: t, corpo, cabecalhos: { 'Idempotency-Key': chave } });
    expect(rep.status).toBe(200);
    expect((await req('GET', '/necessidades', { params: { q: 'leite' } })).corpo[0].quantidade_arrecadada).toBe(27);
  });

  it('id_necessidade é obrigatório (string ou null); null não soma ao termômetro', async () => {
    const t = await token();
    const sem = await req('POST', '/doacoes', { token: t, cabecalhos: { 'Idempotency-Key': uuid() }, corpo: { ocorrido_em: new Date().toISOString(), itens: [{ id_item: 6, quantidade_recebida: 3 }] } });
    expect(sem.status).toBe(422);
    const ok = await req('POST', '/doacoes', { token: t, cabecalhos: { 'Idempotency-Key': uuid() }, corpo: { ocorrido_em: new Date().toISOString(), itens: [{ id_item: 6, id_necessidade: null, quantidade_recebida: 3 }] } });
    expect(ok.status).toBe(201);
    expect((await req('GET', '/necessidades', { params: { q: 'sabonete' } })).corpo[0].quantidade_arrecadada).toBe(0);
  });

  it('concluir com pendência exige motivo', async () => {
    const t = await token();
    expect((await req('PATCH', '/admin/agendamentos/5/concluir', { token: t, corpo: {} })).status).toBe(422);
    const r = await req('PATCH', '/admin/agendamentos/5/concluir', { token: t, corpo: { motivo_pendencias: 'Doador não trouxe' } });
    expect(r.corpo.status_agendamento).toBe('Concluído');
  });

  it('estorno retira a entrega dos totais', async () => {
    const t = await token();
    await req('PATCH', '/doacoes/4/estornar', { token: t, corpo: { motivo: 'teste' } });
    expect((await req('GET', '/necessidades', { params: { q: 'sabão' } })).corpo[0].quantidade_arrecadada).toBe(0);
  });
});

// Contrato proposto ao backend no PDF "Ajustes no backend: itens 1, 3 e 9".
describe('GET /admin/agendamentos: ordem e busca (itens 1 e 3)', () => {
  const ids = (r) => r.corpo.map((a) => a.id_agendamento);
  const listar = async (params) => req('GET', '/admin/agendamentos', { token: await token(), params });

  it('vem do mais recente para o mais antigo e aceita vários status', async () => {
    expect(ids(await listar({}))).toEqual([4, 3, 5, 1, 2]);
    expect(ids(await listar({ status: 'Pendente,Confirmado' }))).toEqual([3, 5, 1]);
    expect((await listar({ status: 'Xyz' })).status).toBe(422);
  });

  it('busca por código, trecho de telefone, nome e e-mail', async () => {
    expect(ids(await listar({ q: '#5' }))).toEqual([5]);
    expect(ids(await listar({ q: '5' }))).toEqual([5]);
    expect(ids(await listar({ q: '00000-0004' }))).toEqual([5]); // trecho do telefone formatado
    expect(ids(await listar({ q: '0004' }))).toEqual([4, 5]); // só dígitos: código 4 e telefone de Ana
    expect(ids(await listar({ q: 'MARIA' }))).toEqual([4, 1]);
    expect(ids(await listar({ q: 'maria', status: 'Pendente,Confirmado' }))).toEqual([1]);
    expect(ids(await listar({ q: 'joao.demo' }))).toEqual([3]);
    expect(ids(await listar({ q: 'ninguém' }))).toEqual([]);
  });

  it('de/ate recortam o período (datas de SP, inclusivas)', async () => {
    expect(ids(await listar({ de: diaSP(0), ate: diaSP(7) }))).toEqual([4, 3, 5]);
    expect(ids(await listar({ de: diaSP(0), ate: diaSP(0) }))).toEqual([5]);
    expect(ids(await listar({ ate: diaSP(-1) }))).toEqual([1, 2]);
    expect((await listar({ de: diaSP(7), ate: diaSP(0) })).status).toBe(422);
    expect((await listar({ de: '26/10/2026' })).status).toBe(422);
  });

  it('cada item traz o total já recebido', async () => {
    const maria = (await listar({ q: '#1' })).corpo[0];
    expect(maria.itens.find((i) => i.id_item === 4).quantidade_recebida).toBe(22);
  });
});

describe('POST /admin/agendamentos/{id}/receber-e-concluir (item 9)', () => {
  const concluir = async (id, corpo = {}, chave = uuid()) => req('POST', `/admin/agendamentos/${id}/receber-e-concluir`, {
    token: await token(), corpo, cabecalhos: { 'Idempotency-Key': chave },
  });
  const arrecadado = async (q) => (await req('GET', '/necessidades', { params: { q } })).corpo[0].quantidade_arrecadada;

  it('corpo vazio: chegou tudo, soma às metas e conclui; clique duplo não duplica', async () => {
    const chave = uuid();
    const r = await concluir(5, {}, chave);
    expect(r.status).toBe(201);
    expect(r.corpo.agendamento.status_agendamento).toBe('Concluído');
    expect(r.corpo.agendamento.itens.every((i) => i.status_item === 'Entregue')).toBe(true);
    expect(await arrecadado('leite')).toBe(27);
    const rep = await concluir(5, {}, chave);
    expect(rep.status).toBe(200);
    expect(rep.corpo.repetido).toBe(true);
    expect(await arrecadado('leite')).toBe(27);
    expect((await concluir(5)).corpo.repetido).toBe(true); // outra chave, já concluído
  });

  it('doação atrasada soma à meta aberta atual quando a original foi renovada', async () => {
    const t = await token();
    await req('POST', '/admin/necessidades/4/renovar', { token: t, corpo: { id_categoria: 1, quantidade_meta: 80 } });
    const r = await concluir(1); // Maria: prometeu 40 leites no mês passado, chegaram 22
    expect(r.status).toBe(201);
    expect(await arrecadado('leite')).toBe(18);
  });

  it('chegou só uma parte: exige motivo e marca o resto como não entregue', async () => {
    const parcial = { itens: [{ id_item: 6, quantidade_recebida: 10 }] };
    expect((await concluir(3, parcial)).status).toBe(409);
    const r = await concluir(3, { ...parcial, motivo_pendencias: 'Trouxe só 10' });
    expect(r.corpo.agendamento.status_agendamento).toBe('Concluído');
    expect(r.corpo.agendamento.itens[0].status_item).toBe('Cancelado');
    expect(await arrecadado('sabonete')).toBe(10);
  });

  it('cancelado responde 409 e a chave é obrigatória', async () => {
    expect((await concluir(4)).status).toBe(409);
    expect((await req('POST', '/admin/agendamentos/5/receber-e-concluir', { token: await token(), corpo: {} })).status).toBe(422);
  });
});

describe('metas e catálogo', () => {
  it('renovar começa do zero e mantém a antiga no histórico (totais como string)', async () => {
    const t = await token();
    const r = await req('POST', '/admin/necessidades/4/renovar', { token: t, corpo: { id_categoria: 1, quantidade_meta: 80 } });
    expect(r.status).toBe(201);
    const hist = (await req('GET', '/admin/necessidades/historico', { token: t })).corpo;
    expect(hist.find((n) => n.id_necessidade === '4')).toMatchObject({ status: 'Encerrada', quantidade_arrecadada: '22' });
    expect(hist.find((n) => n.id_necessidade === r.corpo.id_necessidade).quantidade_arrecadada).toBe('0');
  });

  it('segunda meta aberta para o mesmo produto: 409', async () => {
    const t = await token();
    expect((await req('POST', '/admin/necessidades', { token: t, corpo: { id_item: 4, id_categoria: 1, quantidade_meta: 10 } })).status).toBe(409);
  });

  it('PUT não muda unidade em uso; DELETE desativa', async () => {
    const t = await token();
    const base = { nome_item: 'Leite', unidade_medida: 'caixas', categoria_suprimento: 'Alimentos', id_categoria: 1 };
    expect((await req('PUT', '/itens/4', { token: t, corpo: base })).status).toBe(409);
    expect((await req('DELETE', '/itens/4', { token: t })).status).toBe(204);
    expect((await req('GET', '/necessidades', { params: { q: 'leite' } })).corpo).toHaveLength(0);
  });
});

describe('GET /calendario/feriados/:ano (formato do PR #32)', () => {
  it('devolve feriados nacionais com status disponivel', async () => {
    const r = await req('GET', '/calendario/feriados/2026');
    expect(r.status).toBe(200);
    expect(r.corpo.status).toBe('disponivel');
    expect(r.corpo.feriados).toEqual(expect.arrayContaining([{ data: '2026-11-02', nome: 'Finados', tipo: 'national' }]));
    expect(r.corpo.feriados.find((f) => f.nome === 'Sexta-feira Santa').data).toBe('2026-04-03');
  });

  it('recusa ano inválido com 422', async () => {
    expect((await req('GET', '/calendario/feriados/26')).status).toBe(422);
  });
});
