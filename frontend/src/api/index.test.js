import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tratarRequisicao, restaurarDadosMock } from './mock/servidor.js';
import {
  atualizarItem, criarItem, listarAgendamentosAdmin, listarItens, listarNecessidadesAdmin, receberEConcluir, trocarUnidadeItem,
} from './index.js';
import { diaSP } from '../utils/formatar.js';

const estado = vi.hoisted(() => ({ token: null, chamadas: [], agendamentos: null }));

vi.mock('./cliente.js', async () => {
  const { tratarRequisicao: tratar } = await import('./mock/servidor.js');
  async function requisitarCompleto(metodo, caminho, { corpo, params = {}, autenticado, cabecalhos } = {}) {
    const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    estado.chamadas.push({ caminho, query });
    if (estado.agendamentos && caminho === '/admin/agendamentos') {
      const inicio = Number(query.offset);
      return { status: 200, dados: estado.agendamentos.slice(inicio, inicio + Number(query.limit)) };
    }
    const r = await tratar({ metodo, caminho, corpo, params: query, cabecalhos, token: autenticado ? estado.token : undefined, latencia: 0 });
    if (r.status >= 300) throw Object.assign(new Error(r.corpo?.erro?.mensagem), { status: r.status, codigo: r.corpo?.erro?.codigo });
    return { status: r.status, dados: r.corpo };
  }
  return { requisitarCompleto, requisitar: async (...args) => (await requisitarCompleto(...args)).dados };
});

beforeEach(async () => {
  restaurarDadosMock();
  estado.chamadas = [];
  estado.agendamentos = null;
  estado.token = (await tratarRequisicao({
    metodo: 'POST', caminho: '/auth/login', corpo: { email: 'admin@demo.org', senha: 'demo12345' }, latencia: 0,
  })).corpo.token;
});

describe('listarAgendamentosAdmin: paginação', () => {
  let id = 0;
  const ag = (dias) => ({
    id_agendamento: ++id, data_hora_agendada: `${diaSP(dias)}T10:00:00`, status_agendamento: 'Pendente', doador: null,
    itens: [{ id_item: 1, nome_item: 'Arroz', unidade_medida: 'pacotes', quantidade_doada: 1, quantidade_recebida: 0, status_item: 'Agendado' }],
  });
  const ordenar = (lista) => lista.sort((a, b) => b.data_hora_agendada.localeCompare(a.data_hora_agendada) || b.id_agendamento - a.id_agendamento);
  const paginasPedidas = () => estado.chamadas.filter((c) => c.caminho === '/admin/agendamentos').length;

  it('100 entregas futuras não escondem a atrasada (caso relatado na revisão do PR #35)', async () => {
    estado.agendamentos = ordenar([...Array.from({ length: 100 }, (_, i) => ag(1 + (i % 20))), ag(-3)]);
    const passados = await listarAgendamentosAdmin({ periodo: 'passados' });
    expect(passados.agendamentos.map((a) => a.data_hora_agendada.slice(0, 10))).toEqual([diaSP(-3)]);
    expect((await listarAgendamentosAdmin({ periodo: 'abertas' })).total).toBe(101);
  });

  it('envia de/ate só nos períodos com intervalo', async () => {
    estado.agendamentos = [];
    const params = async (filtro) => {
      estado.chamadas = [];
      await listarAgendamentosAdmin(filtro);
      const { de, ate, data } = estado.chamadas[0].query;
      return { de, ate, data };
    };
    expect(await params({ periodo: 'passados' })).toEqual({ de: diaSP(-30), ate: diaSP(0), data: undefined });
    expect(await params({ periodo: 'semana' })).toEqual({ de: diaSP(0), ate: diaSP(7), data: undefined });
    expect(await params({ periodo: 'hoje' })).toEqual({ de: undefined, ate: undefined, data: diaSP(0) });
    expect(await params({ periodo: 'abertas' })).toEqual({ de: undefined, ate: undefined, data: undefined });
    expect(await params({ periodo: 'passados', busca: 'Maria' })).toEqual({ de: undefined, ate: undefined, data: undefined });
  });

  it('para de pedir páginas quando a data passa do início do período', async () => {
    estado.agendamentos = ordenar([...Array.from({ length: 150 }, () => ag(2)), ...Array.from({ length: 450 }, () => ag(-60))]);
    const semana = await listarAgendamentosAdmin({ periodo: 'semana' });
    expect(semana.total).toBe(150);
    expect(paginasPedidas()).toBe(2);
  });
});

describe('produtos: unidade de contagem', () => {
  const produto = async (id) => (await listarItens()).itens.find((p) => p.id_item === String(id));
  const necessidade = async (id) => (await listarNecessidadesAdmin('todas')).necessidades.find((n) => n.id_necessidade === String(id));

  it('produto sem metas ainda pode trocar a unidade; com metas, não', async () => {
    const novo = await criarItem({ nome_item: 'Café 500 g', unidade_medida: 'pacotes', categoria_suprimento: 'Alimentos', nivel: 2 });
    expect((await produto(novo.id_item)).unidade_em_uso).toBe(false);
    expect((await produto(4)).unidade_em_uso).toBe(true);
    await atualizarItem(novo.id_item, { nome_item: 'Café 500 g', unidade_medida: 'unidades', categoria_suprimento: 'Alimentos', nivel: 2 });
    expect((await produto(novo.id_item)).unidade_medida).toBe('unidades');
    await expect(atualizarItem(4, { nome_item: 'Leite', unidade_medida: 'caixas', categoria_suprimento: 'Alimentos', nivel: 1 }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('trocar a unidade cria outro produto, encerra a meta antiga e desativa o antigo', async () => {
    const arroz = await produto(1);
    const { novo, pendentes } = await trocarUnidadeItem(arroz, { nome_item: 'Arroz tipo 1', unidade_medida: 'quilos', quantidade_meta: 200 });
    expect(pendentes).toEqual([]);
    expect(await produto(1)).toMatchObject({ ativo: false, id_necessidade_aberta: null });
    expect((await necessidade(arroz.id_necessidade_aberta)).status).toBe('Encerrada');
    expect(await produto(novo.id_item)).toMatchObject({ ativo: true, unidade_medida: 'quilos' });
    expect((await necessidade((await produto(novo.id_item)).id_necessidade_aberta)).quantidade_meta).toBe(200);
  });

  it('com entrega agendada, o antigo fica ativo e a entrega ainda pode ser concluída', async () => {
    const { pendentes } = await trocarUnidadeItem(await produto(6), { nome_item: 'Sabonete neutro', unidade_medida: 'caixas' });
    expect(pendentes).toEqual(['3']);
    expect((await produto(6)).ativo).toBe(true);
    const r = await receberEConcluir('3', { chave: crypto.randomUUID() });
    expect(r.agendamento.status_agendamento).toBe('Concluído');
  });
});
