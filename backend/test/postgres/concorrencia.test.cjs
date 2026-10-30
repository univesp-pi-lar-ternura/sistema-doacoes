// Opt-in: somente cluster local descartável criado pelo runner, nunca DATABASE_URL.
const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {Store}=require(process.env.TEST_PG_STORE_MODULE||'../../src/store');
const V=require('../../src/validation');
const SEC=require('../../src/security');
const url=process.env.TEST_PG_URL;
if(!url)throw Error('Use pnpm test:postgres com PG_BIN; não há conexão configurada para testes descartáveis.');
const parsed=new URL(url);
if(!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)||!/^\/lt_concorrencia_[a-z0-9_]+$/.test(parsed.pathname)||process.env.TEST_PG_ALLOW_RESET!=='SIM_BANCO_DESCARTAVEL')throw Error('Teste recusado: conexão deve ser local, explicitamente descartável e com nome lt_concorrencia_*.');
const root=join(__dirname,'../../..');
const sql=readFileSync(join(root,'banco-vinicius/00_RECRIAR_BANCO_COMPLETO.sql'),'utf8');
assert.equal(createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex'),'771b9ebf60db92a34947d3c09bc39d4ef387698dac16b782e827c4ae0a989e04');
const ddl=sql.replace("banco_alvo text := 'neondb'","banco_alvo text := current_database()");
const migration=readFileSync(join(root,'backend/migrations/002_compatibilidade_vinicius.sql'),'utf8');
const config={times:['14:00'],capacity:10,secret:'segredo-exclusivo-do-teste-local-'.repeat(2)};
let control,left,right,dbA,dbB,storeA,storeB,goals,hash;
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function adapter(client){
 const db={hook:null,query:async(sql,params)=>{const result=await client.query(sql,params);if(db.hook)await db.hook(sql,params,result);return result;},transaction:async fn=>{
  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try{const result=await fn({query:db.query});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}
 }};return db;
}
async function blocked(waiter,blocker){
 const until=Date.now()+6000;
 while(Date.now()<until){
  const r=await control.query('SELECT $2::int=ANY(pg_blocking_pids($1::int)) blocked',[waiter.processID,blocker.processID]);if(r.rows[0].blocked)return;
  await new Promise(r=>setTimeout(r,10));
 }
 throw Error('Não foi observada a espera real entre as duas conexões PostgreSQL.');
}
function watch(p){p.catch(()=>{});return p;}
async function booking(two=false){
 const needs=(await control.query("SELECT id_item,id_necessidade::text FROM arrecadacao.necessidades WHERE status='Aberta' ORDER BY id_item")).rows;
 const itens=needs.filter(n=>two||n.id_item===1).map(n=>({id_item:n.id_item,id_necessidade:n.id_necessidade,quantidade_doada:n.id_item===1?5:2}));
 return(await storeA.createBooking(V.booking({doador:{nome:'Pessoa de teste',email:randomUUID()+'@example.test',telefone:'11999999999'},data:'2030-02-20',horario:'14:00',itens}),randomUUID())).agendamento;
}
const finish=(store,id,key=randomUUID())=>store.receiveAndConclude(id,V.receiveCompletion({}),key,1);
const renew=(store,id)=>store.closeNeed(id,'Encerrada',1,{id_categoria:1,quantidade_meta:20});
async function credit(id){return Number((await control.query('SELECT quantidade_arrecadada::text n FROM arrecadacao.vw_historico_necessidades WHERE id_necessidade=$1',[id])).rows[0].n);}
before(async()=>{
 control=new Client({connectionString:url});left=new Client({connectionString:url});right=new Client({connectionString:url});
 await Promise.all([control.connect(),left.connect(),right.connect()]);assert.notEqual(left.processID,right.processID);
 await control.query('CREATE ROLE lt_api_concorrencia NOLOGIN');hash=await SEC.hashPassword('Senha-ficticia-apenas-para-teste');
 for(const c of [left,right]){await c.query("SET statement_timeout='12s'");await c.query("SET lock_timeout='8s'");}
 console.log('Duas sessões PostgreSQL distintas; READ COMMITTED e role limitada de execução.');
 dbA=adapter(left);dbB=adapter(right);storeA=new Store(dbA,config);storeB=new Store(dbB,config);
});
beforeEach(async()=>{
 dbA.hook=dbB.hook=null;
 await Promise.all([left.query('ROLLBACK'),right.query('ROLLBACK')]);
 await control.query('DROP SCHEMA IF EXISTS api_apoio CASCADE');await control.query(ddl);await control.query(migration);
 await control.query('INSERT INTO public.usuarios_ong(nome,email,senha_hash) VALUES($1,$2,$3)',['Equipe','equipe@example.test',hash]);
 await control.query("INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria) VALUES('Arroz','pacotes','Alimentos',1),('Sabonete','unidades','Higiene',2)");
 goals=(await control.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta,criada_por) VALUES(1,1,20,1),(2,2,20,1) RETURNING id_necessidade::text')).rows.map(x=>x.id_necessidade);
 const grants=readFileSync(join(root,'backend/migrations/EXEMPLO_GRANTS.sql'),'utf8').replaceAll('lar_ternura_api','lt_api_concorrencia');await control.query(grants);
 for(const c of [left,right])await c.query('SET ROLE lt_api_concorrencia');
});
after(async()=>{await Promise.all([left?.end(),right?.end(),control?.end()]);});

async function renewalFirst({two=false,manual=false,closeOnly=false}={}){
 const a=await booking(two);const target=two?goals[1]:goals[0];const held=deferred(),release=deferred();let once=false;
 dbB.hook=async query=>{if(!once&&query.startsWith('UPDATE arrecadacao.necessidades SET status=')){once=true;held.resolve();await release.promise;}};
 const maintenance=watch(manual?dbB.transaction(async tx=>{
  await tx.query("UPDATE arrecadacao.necessidades SET status='Encerrada',encerrada_por=1 WHERE id_necessidade=$1",[target]);
  return(await tx.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta,criada_por) VALUES(1,1,20,1) RETURNING id_necessidade::text')).rows[0];
 }):closeOnly?storeB.closeNeed(target,'Encerrada',1):renew(storeB,target));
 await held.promise;
 const receipt=watch(finish(storeA,a.id_agendamento));
 try{await blocked(left,right);}finally{release.resolve();}
 const [renewed,result]=await Promise.all([maintenance,receipt]);dbB.hook=null;
 return{a,renewed,result,target};
}
test('renovação ganha: entrega usa a nova meta e preenche o termômetro', {timeout:20000},async()=>{
 const {renewed,result,target}=await renewalFirst();
 assert.equal(result.doacao.itens[0].id_necessidade,renewed.id_necessidade,'Recebimento não pode ficar sem vínculo durante renovação simultânea.');
 assert.equal(await credit(renewed.id_necessidade),5);assert.equal(await credit(target),0);
 assert.equal(result.agendamento.status_agendamento,'Concluído');
 assert.equal((await control.query('SELECT quantidade_arrecadada::text n FROM arrecadacao.vw_termometro WHERE id_item=1')).rows[0].n,'5');
});
test('renovação por SQL direto também é reconhecida após a espera', {timeout:20000},async()=>{
 const {renewed,result}=await renewalFirst({manual:true});assert.equal(result.doacao.itens[0].id_necessidade,renewed.id_necessidade);assert.equal(await credit(renewed.id_necessidade),5);
});
test('vários produtos: uma meta renovada não perde vínculo nem duplica outro item', {timeout:20000},async()=>{
 const {renewed,result}=await renewalFirst({two:true});
 assert.equal(result.doacao.itens.find(i=>i.id_item===1).id_necessidade,goals[0]);
 assert.equal(result.doacao.itens.find(i=>i.id_item===2).id_necessidade,renewed.id_necessidade);
 assert.equal(await credit(goals[0]),5);assert.equal(await credit(renewed.id_necessidade),2);
});
test('encerramento sem substituta mantém recebimento sem meta por ausência real', {timeout:20000},async()=>{
 const {result}=await renewalFirst({closeOnly:true});assert.equal(result.doacao.itens[0].id_necessidade,null);assert.equal(await credit(goals[0]),0);
 assert.equal((await control.query("SELECT quantidade_arrecadada::text n FROM arrecadacao.vw_arrecadacao_mensal WHERE id_item=1")).rows[0].n,'5');
});
test('confirmação ganha: renovação aguarda e preserva o crédito no histórico anterior', {timeout:20000},async()=>{
 const a=await booking(),key=randomUUID(),held=deferred(),release=deferred();let once=false;
 dbA.hook=async query=>{if(!once&&query.includes('FROM arrecadacao.necessidades WHERE id_necessidade=ANY')&&query.endsWith('FOR UPDATE')){once=true;held.resolve();await release.promise;}};
 const receipt=watch(finish(storeA,a.id_agendamento,key));await held.promise;
 const maintenance=watch(renew(storeB,goals[0]));try{await blocked(right,left);}finally{release.resolve();}
 const [result,renewed]=await Promise.all([receipt,maintenance]);dbA.hook=null;
 assert.equal(result.doacao.itens[0].id_necessidade,goals[0]);assert.equal(await credit(goals[0]),5);assert.equal(await credit(renewed.id_necessidade),0);
 const repeated=await finish(storeA,a.id_agendamento,key);assert.equal(repeated.doacao.id_recebimento,result.doacao.id_recebimento);
});
test('renovações contínuas fazem rollback e a mesma chave pode recuperar a operação depois', {timeout:20000},async()=>{
 const a=await booking(),key=randomUUID();let changed=0;
 dbA.hook=async(query,params,result)=>{
  if(query.startsWith('SELECT id_item,id_necessidade::text FROM arrecadacao.necessidades')&&!query.includes('FOR UPDATE')){
   changed++;await renew(storeB,result.rows[0].id_necessidade);
  }
 };
 await assert.rejects(finish(storeA,a.id_agendamento,key),e=>e.code==='META_EM_ALTERACAO'&&e.status===409);dbA.hook=null;assert.equal(changed,5);
 assert.equal((await control.query('SELECT count(*)::int n FROM arrecadacao.recebimentos')).rows[0].n,0);
 assert.equal((await control.query('SELECT count(*)::int n FROM api_apoio.requisicoes_recebimento WHERE chave=$1',[key])).rows[0].n,0);
 assert.equal((await control.query('SELECT status_agendamento s FROM public.agendamentos WHERE id_agendamento=$1',[a.id_agendamento])).rows[0].s,'Pendente');
 const recovered=await finish(storeA,a.id_agendamento,key);assert.equal(recovered.agendamento.status_agendamento,'Concluído');assert.ok(recovered.doacao.itens[0].id_necessidade);
 assert.equal(await credit(recovered.doacao.itens[0].id_necessidade),5);
});
test('duas conexões com a mesma chave confirmam uma única doação', {timeout:20000},async()=>{
 const a=await booking(),key=randomUUID();const results=await Promise.all([finish(storeA,a.id_agendamento,key),finish(storeB,a.id_agendamento,key)]);
 assert.equal(results[0].doacao.id_recebimento,results[1].doacao.id_recebimento);assert.deepEqual(results.map(r=>r.repetido).sort(),[false,true]);
 assert.equal((await control.query('SELECT count(*)::int n FROM arrecadacao.recebimentos')).rows[0].n,1);assert.equal(await credit(goals[0]),5);
});
test('cinco corridas controladas consecutivas não perdem crédito', {timeout:30000},async()=>{
 for(let i=0;i<5;i++){
  goals[0]=(await control.query("SELECT id_necessidade::text FROM arrecadacao.necessidades WHERE id_item=1 AND status='Aberta'")).rows[0].id_necessidade;
  const {renewed,result}=await renewalFirst();assert.equal(result.doacao.itens[0].id_necessidade,renewed.id_necessidade);assert.equal(await credit(renewed.id_necessidade),5);
 }
});
test('travas seguem ordem numérica com IDs 2 e 10, compatível com o banco', {timeout:20000},async()=>{
 await control.query("SELECT setval(pg_get_serial_sequence('arrecadacao.necessidades','id_necessidade'),9)");
 const ten=await renew(storeB,goals[0]);assert.equal(ten.id_necessidade,'10');
 const a=await booking(true),held=deferred(),release=deferred();
 const maintenance=watch(dbB.transaction(async tx=>{
  await tx.query('SELECT id_necessidade FROM arrecadacao.necessidades WHERE id_necessidade=$1 FOR UPDATE',[goals[1]]);
  held.resolve();await release.promise;
  await tx.query('SELECT id_necessidade FROM arrecadacao.necessidades WHERE id_necessidade=$1 FOR UPDATE',[ten.id_necessidade]);
 }));await held.promise;
 const receipt=watch(finish(storeA,a.id_agendamento));
 try{await blocked(left,right);}finally{release.resolve();}
 const [result]=await Promise.all([receipt,maintenance]);
 assert.equal(result.agendamento.status_agendamento,'Concluído');assert.equal(await credit(ten.id_necessidade),5);assert.equal(await credit(goals[1]),2);
});
