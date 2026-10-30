const test = require('node:test');
const assert = require('node:assert/strict');
const { criarClienteFeriados } = require('../src/integrations/brasilapi-feriados');
const dados = [{ date: '2026-12-25', name: 'Natal', type: 'national' }, { date: '2026-01-01', name: 'Confraternização mundial', type: 'national' }];
const resposta = payload => ({ ok: true, json: async () => payload });

test('consulta apenas ano, valida contrato, ordena datas e compartilha chamadas concorrentes/cache', async () => {
  let chamadas = 0;
  const cliente = criarClienteFeriados({ fetchImpl: async (url, options) => {
    chamadas++;
    assert.equal(url, 'https://brasilapi.com.br/api/feriados/v1/2026');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body, undefined);
    return resposta(dados);
  } });
  const [a, b] = await Promise.all([cliente.consultarAno(2026), cliente.consultarAno(2026)]);
  assert.equal(a.status, 'disponivel');
  assert.equal(a.feriados[0].data, '2026-01-01');
  a.feriados[0].nome = 'alteração do consumidor';
  assert.equal(b.feriados[0].nome, 'Confraternização mundial');
  assert.deepEqual(await cliente.consultarAno(2026), b);
  assert.equal(chamadas, 1);
});

test('ano inválido é recusado antes da rede', async () => {
  const cliente = criarClienteFeriados({ fetchImpl: () => { throw new Error('Não deve consultar'); } });
  for (const ano of ['2026', 1899, 2200, 2026.5, NaN, null]) await assert.rejects(cliente.consultarAno(ano), RangeError);
});

for (const code of [404, 429, 500]) test('HTTP ' + code + ' informa indisponibilidade sem simular ausência de feriados', async () => {
  const cliente = criarClienteFeriados({ fetchImpl: async () => ({ ok: false, status: code }) });
  const r = await cliente.consultarAno(2026);
  assert.equal(r.status, 'indisponivel');assert.equal(r.feriados, null);assert.equal(r.motivo, 'HTTP_' + code);
});

test('JSON malformado e contratos divergentes são recusados', async () => {
  const casos = [null, {}, [], [null], [{ ...dados[0], date: '2026-02-30' }], [{ ...dados[0], date: '2027-12-25' }], [{ ...dados[0], name: '' }], [{ ...dados[0], type: null }]];
  for (const payload of casos) {
    const cliente = criarClienteFeriados({ fetchImpl: async () => resposta(payload) });
    assert.equal((await cliente.consultarAno(2026)).motivo, 'RESPOSTA_INVALIDA');
  }
  const cliente = criarClienteFeriados({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }) });
  assert.equal((await cliente.consultarAno(2026)).motivo, 'RESPOSTA_INVALIDA');
});

test('erro de rede não propaga detalhes do provedor', async () => {
  const cliente = criarClienteFeriados({ fetchImpl: async () => { throw new Error('detalhe interno'); } });
  const r = await cliente.consultarAno(2026);
  assert.equal(r.motivo, 'FALHA_DE_REDE');assert.equal(JSON.stringify(r).includes('detalhe interno'), false);
});

test('tempo limite interrompe também leitura lenta do corpo', async () => {
  const cliente = criarClienteFeriados({ timeoutMs: 20, fetchImpl: async (_, { signal }) => ({ ok: true,
    json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('abort')), { once: true })),
  }) });
  assert.equal((await cliente.consultarAno(2026)).motivo, 'TEMPO_LIMITE');
});

test('cache expira, falha não reutiliza sucesso vencido e recuperação ocorre após 30s', async () => {
  let tempo = 0, chamadas = 0;
  const cliente = criarClienteFeriados({ agora: () => tempo, fetchImpl: async () => {
    chamadas++;return chamadas === 2 ? { ok: false, status: 503 } : resposta(dados);
  } });
  assert.equal((await cliente.consultarAno(2026)).status, 'disponivel');
  tempo += 86400000;
  assert.equal((await cliente.consultarAno(2026)).status, 'indisponivel');
  tempo += 29999;await cliente.consultarAno(2026);assert.equal(chamadas, 2);
  tempo++;assert.equal((await cliente.consultarAno(2026)).status, 'disponivel');assert.equal(chamadas, 3);
});

test('cache limitado a oito anos evita crescimento sem limite', async () => {
  let chamadas = 0;
  const cliente = criarClienteFeriados({ fetchImpl: async url => {
    chamadas++;const ano = url.split('/').at(-1);
    return resposta([{ date: ano + '-01-01', name: 'Data de teste', type: 'national' }]);
  } });
  for (let ano = 2020; ano <= 2028; ano++) await cliente.consultarAno(ano);
  await cliente.consultarAno(2020);assert.equal(chamadas, 10);
});
