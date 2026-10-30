'use strict';

// Consulta informativa. Não decide disponibilidade nem envia dados do doador.
function criarClienteFeriados({ fetchImpl = globalThis.fetch, agora = Date.now, timeoutMs = 5000 } = {}) {
  if (typeof fetchImpl !== 'function' || typeof agora !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('Configuração inválida do cliente de feriados.');
  }
  const cache = new Map();
  const pendentes = new Map();

  function validar(payload, ano) {
    if (!Array.isArray(payload) || payload.length === 0 || payload.length > 1000) throw new Error('CONTRATO');
    return payload.map(item => {
      if (!item || typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
          Number(item.date.slice(0, 4)) !== ano || typeof item.name !== 'string' ||
          !item.name.trim() || item.name.length > 300 || typeof item.type !== 'string' ||
          !item.type.trim() || item.type.length > 100) throw new Error('CONTRATO');
      const data = new Date(item.date + 'T12:00:00Z');
      if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== item.date) throw new Error('CONTRATO');
      return { data: item.date, nome: item.name.trim(), tipo: item.type.trim() };
    }).sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
  }

  async function buscar(ano) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let resultado;
    let motivo = 'FALHA_DE_REDE';
    try {
      const response = await fetchImpl('https://brasilapi.com.br/api/feriados/v1/' + ano, {
        method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal,
      });
      if (!response.ok) {
        motivo = 'HTTP_' + response.status;
        throw new Error('HTTP');
      }
      motivo = 'RESPOSTA_INVALIDA';
      const feriados = validar(await response.json(), ano);
      resultado = { status: 'disponivel', fonte: 'BrasilAPI', ano, consultado_em: new Date(agora()).toISOString(), feriados };
    } catch {
      resultado = { status: 'indisponivel', fonte: 'BrasilAPI', ano,
        consultado_em: new Date(agora()).toISOString(), feriados: null,
        motivo: controller.signal.aborted ? 'TEMPO_LIMITE' : motivo };
    } finally {
      clearTimeout(timer);
    }
    // Sucesso por 24h; falhas por 30s para não repetir chamadas a cada clique.
    cache.delete(ano);
    cache.set(ano, { expira: agora() + (resultado.status === 'disponivel' ? 86400000 : 30000), resultado });
    while (cache.size > 8) cache.delete(cache.keys().next().value);
    return resultado;
  }

  async function consultarAno(ano) {
    if (!Number.isInteger(ano) || ano < 1900 || ano > 2199) throw new RangeError('Informe um ano inteiro entre 1900 e 2199.');
    const salvo = cache.get(ano);
    if (salvo && salvo.expira > agora()) return structuredClone(salvo.resultado);
    let consulta = pendentes.get(ano);
    if (!consulta) {
      consulta = buscar(ano).finally(() => pendentes.delete(ano));
      pendentes.set(ano, consulta);
    }
    return structuredClone(await consulta);
  }

  return { consultarAno };
}

module.exports = { criarClienteFeriados };
