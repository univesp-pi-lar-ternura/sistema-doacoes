const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../src/app');
const config={origins:[],proxyHops:0};
async function withServer(calendario,fn){
 const server=createApp({store:{ready:async()=>{}},config,calendario}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 try{await fn('http://127.0.0.1:'+server.address().port);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
test('rota de calendário publica contrato e recusa ano inválido antes da consulta',async()=>{
 let calls=0;
 await withServer({consultarAno:async ano=>{calls++;return {status:'disponivel',ano,fonte:'BrasilAPI',feriados:[{data:'2026-12-25',nome:'Natal',tipo:'national'}]};}},async base=>{
  const r=await fetch(base+'/calendario/feriados/2026');assert.equal(r.status,200);assert.equal((await r.json()).feriados[0].nome,'Natal');
  for(const ano of ['abc','1899','2200','2026.5'])assert.equal((await fetch(base+'/calendario/feriados/'+ano)).status,422);
  assert.equal(calls,1);
 });
});
test('indisponibilidade explícita do calendário não derruba prontidão',async()=>{
 let calls=0;
 await withServer({consultarAno:async ano=>{calls++;return {status:'indisponivel',ano,fonte:'BrasilAPI',feriados:null,motivo:'TEMPO_LIMITE'};}},async base=>{
  const r=await fetch(base+'/calendario/feriados/2026');assert.equal(r.status,200);assert.equal((await r.json()).feriados,null);
  assert.equal((await fetch(base+'/ready')).status,200);assert.equal(calls,1);
 });
});
test('página de integração servida com CSP e sem servir arquivos do backend',async()=>{
 await withServer({},async base=>{
  const r=await fetch(base+'/integracao/agendamento/');assert.equal(r.status,200);
  assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  assert.ok((await r.text()).includes('Agendar uma entrega'));
  assert.equal((await fetch(base+'/integracao/agendamento/.env')).status,404);
 });
});
test('origem da própria página é permitida; origem externa não autorizada continua recusada',async()=>{
 await withServer({},async base=>{
  const same=await fetch(base+'/integracao/agendamento/agendamento.mjs',{headers:{Origin:base}});
  assert.equal(same.status,200);
  const external=await fetch(base+'/integracao/agendamento/agendamento.mjs',{headers:{Origin:'https://externo.example'}});
  assert.equal(external.status,403);
 });
});
