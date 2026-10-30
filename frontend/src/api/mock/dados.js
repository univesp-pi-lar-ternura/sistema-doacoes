import { partesSP } from '../../utils/formatar.js';

const HORA_UTC_14H_SP = 17; // 14:00 em São Paulo = 17:00 UTC

function dia10DoMes(deslocamentoMeses) {
  const p = partesSP();
  return new Date(Date.UTC(Number(p.ano), Number(p.mes) - 1 + deslocamentoMeses, 10, HORA_UTC_14H_SP)).toISOString();
}

function hojeAs(horaSP) {
  const p = partesSP();
  return new Date(Date.UTC(Number(p.ano), Number(p.mes) - 1, Number(p.dia), horaSP + 3)).toISOString();
}

export const CONTA_DEMO = { email: 'admin@demo.org', senha: 'demo12345' };

/** Configuração equivalente a DELIVERY_TIMES e SLOT_CAPACITY da API (valores provisórios). */
export const HORARIOS_DEMO = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
export const CAPACIDADE_DEMO = 10; // SLOT_CAPACITY combinado com o Vinicius

export function criarDadosIniciais() {
  const agora = new Date().toISOString();
  const emDias = (n) => new Date(Date.now() + n * 86400000).toISOString();
  const anterior = dia10DoMes(-1);
  const antiga = dia10DoMes(-2);

  const categorias = [
    { id_categoria: 1, nome_categoria: 'Alta/Crítica', cor_indicador: '#EF4444', nivel_ordem: 1 },
    { id_categoria: 2, nome_categoria: 'Média', cor_indicador: '#F59E0B', nivel_ordem: 2 },
    { id_categoria: 3, nome_categoria: 'Baixa', cor_indicador: '#10B981', nivel_ordem: 3 },
  ];

  // Mesma ordem do 05 (ORDER BY chave)
  const itens = [
    { id_item: 1, nome_item: '[DEMO] Arroz tipo 1 - pacote 5 kg', unidade_medida: 'pacotes', categoria_suprimento: 'Alimentos', id_categoria: 2, ativo: true },
    { id_item: 2, nome_item: '[DEMO] Cobertor solteiro - item inativo', unidade_medida: 'unidades', categoria_suprimento: 'Vestuário', id_categoria: 3, ativo: false },
    { id_item: 3, nome_item: '[DEMO] Fralda geriátrica G - pacote 8 unidades', unidade_medida: 'pacotes', categoria_suprimento: 'Higiene', id_categoria: 1, ativo: true },
    { id_item: 4, nome_item: '[DEMO] Leite em pó integral 400 g', unidade_medida: 'latas', categoria_suprimento: 'Alimentos', id_categoria: 1, ativo: true },
    { id_item: 5, nome_item: '[DEMO] Sabão em pó 1 kg', unidade_medida: 'caixas', categoria_suprimento: 'Limpeza', id_categoria: 2, ativo: true },
    { id_item: 6, nome_item: '[DEMO] Sabonete neutro 90 g', unidade_medida: 'unidades', categoria_suprimento: 'Higiene', id_categoria: 3, ativo: true },
  ];

  const nec = (id, id_item, meta, status = 'Aberta', encerrada_em = null) => {
    const item = itens.find((i) => i.id_item === id_item);
    return {
      id_necessidade: id, id_item, id_categoria: item.id_categoria,
      nome_item_registrado: item.nome_item, unidade_registrada: item.unidade_medida,
      quantidade_meta: meta, status, criada_em: agora, encerrada_em,
    };
  };
  const necessidades = [
    nec(1, 1, 50, 'Encerrada', agora), // arroz: meta antiga atendida e encerrada
    nec(2, 2, 20),
    nec(3, 3, 120),
    nec(4, 4, 60),
    nec(5, 5, 40),
    nec(6, 6, 100),
    nec(7, 1, 50), // arroz renovado, começa em zero
  ];

  const doadores = [
    { id_doador: 1, nome: '[DEMO] Maria Oliveira - fictícia', email: 'maria.demo@example.com', telefone: '(00) 00000-0001', tipo_doador: 'PF', data_cadastro: agora },
    { id_doador: 2, nome: '[DEMO] João Santos - fictício', email: 'joao.demo@example.com', telefone: '(00) 00000-0002', tipo_doador: 'PF', data_cadastro: agora },
    { id_doador: 3, nome: '[DEMO] Mercado Aurora - fictício', email: 'mercado.demo@example.com', telefone: '(00) 00000-0003', tipo_doador: 'PJ', data_cadastro: agora },
    { id_doador: 4, nome: '[DEMO] Ana Lima - fictícia', email: 'ana.demo@example.com', telefone: '(00) 00000-0004', tipo_doador: 'PF', data_cadastro: agora },
  ];

  const agendamentos = [
    { id_agendamento: 1, id_doador: 1, data_hora_agendada: anterior, status_agendamento: 'Confirmado', observacoes: '[DEMO] Entrega parcial: prometidos 40 leites e 60 pacotes de fralda; recebidos 22 e 30.', data_criacao: agora },
    { id_agendamento: 2, id_doador: 3, data_hora_agendada: antiga, status_agendamento: 'Concluído', observacoes: '[DEMO] Entrega integral de 50 pacotes de arroz.', data_criacao: agora },
    { id_agendamento: 3, id_doador: 2, data_hora_agendada: emDias(3), status_agendamento: 'Pendente', observacoes: '[DEMO] Promessa futura de sabonetes; não conta no termômetro.', data_criacao: agora },
    { id_agendamento: 4, id_doador: 1, data_hora_agendada: emDias(5), status_agendamento: 'Cancelado', observacoes: '[DEMO] Doadora cancelou antes da entrega.', data_criacao: agora },
    { id_agendamento: 5, id_doador: 4, data_hora_agendada: hojeAs(16), status_agendamento: 'Pendente', observacoes: '[DEMO] Só no modo simulado: entrega marcada para hoje.', data_criacao: agora },
  ];

  const itens_agendamento = [
    { id_agendamento: 1, id_item: 4, id_necessidade: 4, quantidade_doada: 40, status_item: 'Agendado' },
    { id_agendamento: 1, id_item: 3, id_necessidade: 3, quantidade_doada: 60, status_item: 'Agendado' },
    { id_agendamento: 2, id_item: 1, id_necessidade: 1, quantidade_doada: 50, status_item: 'Entregue' },
    { id_agendamento: 3, id_item: 6, id_necessidade: 6, quantidade_doada: 30, status_item: 'Agendado' },
    { id_agendamento: 4, id_item: 4, id_necessidade: 4, quantidade_doada: 10, status_item: 'Cancelado' },
    { id_agendamento: 5, id_item: 5, id_necessidade: 5, quantidade_doada: 10, status_item: 'Agendado' },
    { id_agendamento: 5, id_item: 4, id_necessidade: 4, quantidade_doada: 5, status_item: 'Agendado' },
  ];

  const rec = (id, id_doador, id_agendamento, ocorrido_em, status, motivo_estorno = null) => ({
    id_recebimento: id,
    chave_operacao: `10000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    id_doador, id_agendamento, ocorrido_em, status, motivo_estorno, registrado_em: agora,
  });
  const recebimentos = [
    rec(1, 1, 1, anterior, 'Confirmado'),
    rec(2, 2, null, agora, 'Confirmado'),
    rec(3, 3, 2, antiga, 'Confirmado'),
    rec(4, 3, null, agora, 'Confirmado'),
    rec(5, 1, null, anterior, 'Estornado', '[DEMO] Lançamento duplicado identificado na conferência.'),
    rec(6, 2, null, agora, 'Rascunho'),
    rec(7, null, null, anterior, 'Confirmado'),
    rec(8, null, null, agora, 'Confirmado'),
  ];

  const ir = (id_recebimento, id_item, quantidade_recebida, id_necessidade) => {
    const item = itens.find((i) => i.id_item === id_item);
    return { id_recebimento, id_item, id_necessidade, quantidade_recebida, nome_item_registrado: item.nome_item, unidade_registrada: item.unidade_medida };
  };
  const itens_recebimento = [
    ir(1, 4, 22, 4), ir(1, 3, 30, 3),
    ir(2, 3, 30, 3),
    ir(3, 1, 50, 1),
    ir(4, 5, 50, 5),
    ir(5, 4, 5, 4),
    ir(6, 6, 15, 6),
    ir(7, 2, 5, 2),
    ir(8, 3, 10, null), // fraldas sem vínculo com meta
  ];

  const usuarios = [
    { id_usuario: 1, nome: 'Administrador Demo', email: CONTA_DEMO.email, senha: CONTA_DEMO.senha, cargo: 'Administrador', ativo: true },
  ];

  return {
    categorias, itens, necessidades, doadores, agendamentos, itens_agendamento,
    recebimentos, itens_recebimento, usuarios,
    seq: { itens: 6, necessidades: 7, doadores: 4, agendamentos: 5, recebimentos: 8, usuarios: 1 },
    sessoes: {}, tokensAgendamento: {}, idempotencia: {},
  };
}
