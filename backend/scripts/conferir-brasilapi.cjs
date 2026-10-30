// Verificação manual opcional: uma consulta real, sem banco ou dados pessoais.
const { criarClienteFeriados } = require('../src/integrations/brasilapi-feriados');
const ano = process.argv[2] === undefined ? new Date().getFullYear() : Number(process.argv[2]);
(async () => {
  const resultado = await criarClienteFeriados().consultarAno(ano);
  console.log(JSON.stringify(resultado, null, 2));
  if (resultado.status !== 'disponivel') process.exitCode = 1;
})().catch(() => { console.error('Informe um ano inteiro entre 1900 e 2199.');process.exitCode = 1; });
