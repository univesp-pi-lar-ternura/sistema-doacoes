const {test,before,beforeEach,afterEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {fixture,reset}=require('../scripts/test-fixture.cjs');
const {Store}=require('../src/store');
const {createApp}=require('../src/app');
const SEC=require('../src/security');
let pg,db,store,server,base,goals,adminToken,passwordHash;
const password='Senha-exclusiva-dos-testes-123';
const config={times:['09:00','10:00','14:00','15:00'],capacity:3,secret:'segredo-apenas-para-teste-'.repeat(3),sessionHours:8,origins:[],proxyHops:0};
async function call(path,{method='GET',body,token=adminToken,key}={}){
 const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const raw=await response.text();return{status:response.status,body:raw?JSON.parse(raw):null};
}
const book=async({nome='Pessoa teste',email=randomUUID()+'@example.test',telefone='(11) 98765-4321',data='2030-02-20',horario='14:00',itens}={})=>{
 const r=await call('/agendamentos',{method:'POST',key:randomUUID(),token:null,body:{doador:{nome,email,telefone,tipo_doador:'PF'},data,horario,itens:itens??[{id_item:1,id_necessidade:goals[0],quantidade_doada:10},{id_item:2,id_necessidade:goals[1],quantidade_doada:4}]}});
 assert.equal(r.status,201,JSON.stringify(r.body));return r.body.agendamento;
};
const finish=(id,body={},key=randomUUID(),token=adminToken)=>call(`/admin/agendamentos/${id}/receber-e-concluir`,{method:'POST',body,key,token});
const total=async()=>Number((await db.query("SELECT COALESCE(SUM(quantidade_recebida),0)::text total FROM arrecadacao.itens_recebimento JOIN arrecadacao.recebimentos USING(id_recebimento) WHERE status='Confirmado'")).rows[0].total);
const receive=async(id,qty=2,need=goals[0])=>store.receive({id_agendamento:id,id_doador:null,ocorrido_em:new Date().toISOString(),itens:[{id_item:1,id_necessidade:need,quantidade_recebida:qty}]},randomUUID(),1);
before(async()=>{({pg,db}=await fixture());passwordHash=await SEC.hashPassword(password);});
beforeEach(async()=>{
 await reset(pg);
 await db.query('INSERT INTO public.usuarios_ong(nome,email,senha_hash) VALUES($1,$2,$3)',['Equipe','equipe@example.test',passwordHash]);
 await db.query("INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria) VALUES('Arroz','pacotes','Alimentos',1),('Sabonete','unidades','Higiene',2)");
 goals=(await db.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta,criada_por) VALUES(1,1,10,1),(2,2,20,1) RETURNING id_necessidade::text')).rows.map(x=>x.id_necessidade);
 store=new Store(db,config);server=createApp({store,config,logger:{error(){}},calendario:{consultarAno:async()=>({status:'indisponivel',feriados:null})}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 const login=await call('/auth/login',{method:'POST',token:null,body:{email:'equipe@example.test',senha:password}});assert.equal(login.status,200);adminToken=login.body.token;
});
afterEach(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});after(async()=>pg.close());

test('ordem decrescente usa data da entrega e código como desempate, com paginação',async()=>{
 const a=await book({data:'2030-02-22'}),b=await book({data:'2030-02-20'}),c=await book({data:'2030-02-22'});
 const r=await call('/admin/agendamentos');assert.deepEqual(r.body.map(x=>x.id_agendamento),[c.id_agendamento,a.id_agendamento,b.id_agendamento]);
 assert.deepEqual((await call('/admin/agendamentos?limit=1&offset=1')).body.map(x=>x.id_agendamento),[a.id_agendamento]);
});
test('busca por código simples e com # retorna o agendamento',async()=>{
 const a=await book();for(const q of [String(a.id_agendamento),'#'+a.id_agendamento]){const r=await call('/admin/agendamentos?q='+encodeURIComponent(q));assert.equal(r.status,200);assert.equal(r.body[0].id_agendamento,a.id_agendamento);}
});
test('busca por nome ignora caixa e por email aceita trecho',async()=>{
 const a=await book({nome:'Maria da Silva',email:'maria.silva@example.test'});
 for(const q of ['MARIA DA','silva@example'])assert.equal((await call('/admin/agendamentos?q='+encodeURIComponent(q))).body[0].id_agendamento,a.id_agendamento);
});
test('telefone é pesquisado por trecho de quatro ou mais dígitos, inclusive entrada formatada',async()=>{
 const a=await book();for(const q of ['7654','(11) 98765-4321'])assert.equal((await call('/admin/agendamentos?q='+encodeURIComponent(q))).body[0].id_agendamento,a.id_agendamento);
 assert.deepEqual((await call('/admin/agendamentos?q=765')).body,[]);
});
test('curingas de busca são literais e código grande não causa erro SQL',async()=>{
 await book({nome:'Pessoa comum'});await book({nome:'Pessoa 100%_teste',horario:'15:00'});
 assert.equal((await call('/admin/agendamentos?q='+encodeURIComponent('%_'))).body.length,1);
 assert.deepEqual((await call('/admin/agendamentos?q=999999999999999999999999999')).body,[]);
 assert.deepEqual((await call('/admin/agendamentos?q='+encodeURIComponent("' OR 1=1 --"))).body,[]);
});
test('status único e múltiplos são combinados com busca e data',async()=>{
 const a=await book(),b=await book({horario:'15:00'});await db.query("UPDATE public.agendamentos SET status_agendamento='Confirmado' WHERE id_agendamento=$1",[b.id_agendamento]);
 assert.equal((await call('/admin/agendamentos?status=Pendente,Confirmado')).body.length,2);
 assert.equal((await call('/admin/agendamentos?status=Confirmado')).body[0].id_agendamento,b.id_agendamento);
 assert.equal((await call('/admin/agendamentos?status=Pendente,Confirmado&data=2030-02-20&q='+a.id_agendamento)).body.length,1);
 assert.deepEqual((await call('/admin/agendamentos?data=2030-02-21')).body,[]);
});
test('busca e filtros inválidos retornam 422, contatos exigem autenticação',async()=>{
 for(const query of ['q=','q='+('a'.repeat(101)),'q=a&q=b','status=Pendente,','status=Pendente,Invalido','status=Pendente&status=Confirmado','limit=0','offset=-1'])assert.equal((await call('/admin/agendamentos?'+query)).status,422,query);
 assert.equal((await call('/admin/agendamentos',{token:null})).status,401);
});
test('corpo vazio recebe toda a promessa e conclui em uma transação',async()=>{
 const a=await book();const r=await finish(a.id_agendamento);assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.agendamento.status_agendamento,'Concluído');assert.ok(r.body.agendamento.itens.every(i=>i.status_item==='Entregue'));
 assert.equal(r.body.doacao.status,'Confirmado');assert.equal(await total(),14);
 assert.equal((await call('/itens/1',{token:null})).body.quantidade_arrecadada,10);
});
test('recebimentos anteriores são descontados e total confirmado vem no agendamento',async()=>{
 const a=await book();await receive(a.id_agendamento,3);const r=await finish(a.id_agendamento);
 assert.equal(r.status,200);assert.equal(r.body.doacao.itens.find(i=>i.id_item===1).quantidade_recebida,7);
 assert.equal(r.body.agendamento.itens.find(i=>i.id_item===1).quantidade_recebida,10);assert.equal(await total(),14);
});
test('entrega parcial registra o que chegou, cancela pendências e exige motivo',async()=>{
 const a=await book();const r=await finish(a.id_agendamento,{itens:[{id_item:1,quantidade_recebida:3}],motivo_pendencias:'Trouxe só parte'});
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(await total(),3);assert.ok(r.body.agendamento.itens.every(i=>i.status_item==='Cancelado'));
 assert.equal(r.body.agendamento.status_agendamento,'Concluído');
});
test('falha na conclusão desfaz recebimento, termômetro e chave; correção pode repetir a chave',async()=>{
 const a=await book(),key=randomUUID();const r=await finish(a.id_agendamento,{itens:[{id_item:1,quantidade_recebida:3}]},key);
 assert.equal(r.status,409);assert.equal(r.body.erro.codigo,'ENTREGA_PARCIAL');assert.equal(await total(),0);
 assert.equal((await db.query('SELECT count(*)::int n FROM arrecadacao.recebimentos')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM api_apoio.requisicoes_recebimento WHERE chave=$1',[key])).rows[0].n,0);
 assert.equal((await call('/admin/agendamentos/'+a.id_agendamento)).body.status_agendamento,'Pendente');
 assert.equal((await finish(a.id_agendamento,{itens:[{id_item:1,quantidade_recebida:3}],motivo_pendencias:'Parte'},key)).status,200);
});
test('doação atrasada usa meta atual após renovação e preserva meta anterior',async()=>{
 const a=await book();await db.query("UPDATE public.agendamentos SET data_hora_agendada='2020-01-01 14:00:00-03' WHERE id_agendamento=$1",[a.id_agendamento]);
 const renewed=await call('/admin/necessidades/'+goals[0]+'/renovar',{method:'POST',body:{id_categoria:1,quantidade_meta:40}});assert.equal(renewed.status,201);
 const r=await finish(a.id_agendamento);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.doacao.itens.find(i=>i.id_item===1).id_necessidade,renewed.body.id_necessidade);
 const old=(await call('/admin/necessidades/historico')).body.find(i=>i.id_necessidade===goals[0]);assert.equal(old.quantidade_arrecadada,'0');
});
test('sem meta aberta registra recebimento sem vínculo, com total mensal',async()=>{
 const a=await book();await call('/admin/necessidades/'+goals[0]+'/encerrar',{method:'PATCH',body:{}});
 const r=await finish(a.id_agendamento);assert.equal(r.status,200);assert.equal(r.body.doacao.itens.find(i=>i.id_item===1).id_necessidade,null);
 const monthly=(await call('/admin/arrecadacao/mensal')).body.find(i=>i.id_item===1);assert.equal(monthly.quantidade_arrecadada,'10');
});
test('clique duplo com mesma chave não duplica recebimento',async()=>{
 const a=await book(),key=randomUUID();const rs=await Promise.all([finish(a.id_agendamento,{},key),finish(a.id_agendamento,{},key)]);
 assert.ok(rs.every(r=>r.status===200),JSON.stringify(rs));assert.equal(rs[0].body.doacao.id_recebimento,rs[1].body.doacao.id_recebimento);
 assert.deepEqual(rs.map(r=>r.body.repetido).sort(),[false,true]);assert.equal(await total(),14);
 assert.equal((await db.query('SELECT count(*)::int n FROM arrecadacao.recebimentos')).rows[0].n,1);
});
test('repetição de concluído com outra chave não gera recebimento adicional',async()=>{
 const a=await book();await finish(a.id_agendamento);const r=await finish(a.id_agendamento);assert.equal(r.status,200);assert.equal(r.body.repetido,true);assert.equal(r.body.doacao,null);assert.equal(await total(),14);
});
test('chave não pode mudar corpo ou agendamento nem cruzar rotas',async()=>{
 const a=await book(),b=await book({horario:'15:00'}),key=randomUUID();await finish(a.id_agendamento,{},key);
 assert.equal((await finish(a.id_agendamento,{motivo_pendencias:'Outro'},key)).status,409);
 assert.equal((await finish(b.id_agendamento,{},key)).status,409);
 const r=await call('/doacoes',{method:'POST',key,body:{id_agendamento:b.id_agendamento,ocorrido_em:new Date().toISOString(),itens:[{id_item:1,id_necessidade:goals[0],quantidade_recebida:1}]}});assert.equal(r.status,409);
});
test('idempotência não aceita outro administrador',async()=>{
 const a=await book(),key=randomUUID();await finish(a.id_agendamento,{},key);
 await db.query('INSERT INTO public.usuarios_ong(nome,email,senha_hash) VALUES($1,$2,$3)',['Outro','outro@example.test',passwordHash]);
 const login=await call('/auth/login',{method:'POST',body:{email:'outro@example.test',senha:password}});
 assert.equal((await finish(a.id_agendamento,{},key,login.body.token)).status,409);
});
test('cancelado retorna 409; inexistente 404; acesso anônimo 401',async()=>{
 const a=await book();await call('/admin/agendamentos/'+a.id_agendamento+'/cancelar',{method:'PATCH',body:{}});
 assert.equal((await finish(a.id_agendamento)).status,409);assert.equal((await finish(999)).status,404);assert.equal((await finish(a.id_agendamento,{},randomUUID(),null)).status,401);assert.equal(await total(),0);
});
test('excedente da promessa e produto fora do agendamento são recusados sem gravação',async()=>{
 const a=await book();for(const itens of [[{id_item:1,quantidade_recebida:11}],[{id_item:999,quantidade_recebida:1}]])assert.equal((await finish(a.id_agendamento,{itens,motivo_pendencias:'Teste'})).status,422);
 assert.equal(await total(),0);
});
test('produto desativado responde 409 com mensagem e desfaz toda a operação',async()=>{
 const a=await book();await db.query('UPDATE public.itens_necessidades SET ativo=false WHERE id_item=2');const r=await finish(a.id_agendamento);
 assert.equal(r.status,409);assert.equal(r.body.erro.codigo,'PRODUTO_INATIVO');assert.equal(await total(),0);
});
test('nenhuma quantidade recebida pode concluir com motivo, sem recebimento vazio',async()=>{
 const a=await book();const r=await finish(a.id_agendamento,{itens:[],motivo_pendencias:'Não trouxe os produtos'});assert.equal(r.status,200);assert.equal(r.body.doacao,null);assert.equal(await total(),0);
});
test('promessa integralmente recebida é concluída sem duplicar doações',async()=>{
 const a=await book({itens:[{id_item:1,id_necessidade:goals[0],quantidade_doada:10}]});await receive(a.id_agendamento,10);
 const r=await finish(a.id_agendamento);assert.equal(r.status,200);assert.equal(r.body.doacao,null);assert.equal(r.body.agendamento.itens[0].status_item,'Entregue');assert.equal(await total(),10);
});
test('corpos inválidos e chave ausente são recusados',async()=>{
 const a=await book();
 for(const body of [{registrado_por:99},{itens:[{id_item:1,quantidade_recebida:0.5}]},{itens:[{id_item:1,quantidade_recebida:-1}]},{itens:[{id_item:1,quantidade_recebida:1},{id_item:1,quantidade_recebida:2}]},{itens:[{id_item:1,id_necessidade:'1',quantidade_recebida:1}]}])assert.equal((await finish(a.id_agendamento,body)).status,422);
 assert.equal((await call('/admin/agendamentos/'+a.id_agendamento+'/receber-e-concluir',{method:'POST',body:{}})).status,422);
});
test('meta atingida aceita nova promessa sem alterar arrecadação; meta encerrada e produto inativo continuam recusados',async()=>{
 await receive(null,12);const a=await book();assert.ok(a.id_agendamento);assert.equal((await call('/itens/1',{token:null})).body.quantidade_arrecadada,12);
 await call('/admin/necessidades/'+goals[0]+'/encerrar',{method:'PATCH',body:{}});
 const b={doador:{nome:'Pessoa nova',email:'nova@example.test',telefone:'11999999999'},data:'2030-02-20',horario:'15:00',itens:[{id_item:1,id_necessidade:goals[0],quantidade_doada:1}]};
 assert.equal((await call('/agendamentos',{method:'POST',token:null,key:randomUUID(),body:b})).status,409);
 await db.query('UPDATE public.itens_necessidades SET ativo=false WHERE id_item=2');b.itens=[{id_item:2,id_necessidade:goals[1],quantidade_doada:1}];
 assert.equal((await call('/agendamentos',{method:'POST',token:null,key:randomUUID(),body:b})).status,409);
});
test('consulta para Helena retorna meta, recebido e faltante; promessa não conta e excedente zera faltante',async()=>{
 await book();let item=(await call('/necessidades',{token:null})).body.find(i=>i.id_item===1);
 assert.equal(item.quantidade_meta,10);assert.equal(item.quantidade_arrecadada,0);assert.equal(item.quantidade_faltante,10);
 await receive(null,12);item=(await call('/itens',{token:null})).body.find(i=>i.id_item===1);
 assert.equal(item.quantidade_arrecadada,12);assert.equal(item.quantidade_faltante,0);assert.equal(item.percentual_atendimento,120);
});
test('quantidade_recebida soma histórico inteiro além de 100 recebimentos e ignora estornos',async()=>{
 const a=await book({itens:[{id_item:1,id_necessidade:goals[0],quantidade_doada:200}]});
 let receipt;for(let i=0;i<101;i++)receipt=await receive(a.id_agendamento,1);
 assert.equal((await call('/admin/agendamentos/'+a.id_agendamento)).body.itens[0].quantidade_recebida,101);
 await call('/doacoes/'+receipt.doacao.id_recebimento+'/estornar',{method:'PATCH',body:{motivo:'Correção'}});
 assert.equal((await call('/admin/agendamentos/'+a.id_agendamento)).body.itens[0].quantidade_recebida,100);
});
test('role limitada executa conclusão atômica e consulta de quantidades',async()=>{
 await pg.exec('CREATE ROLE e1_limitada NOLOGIN');
 const {readFileSync}=require('node:fs'),{join}=require('node:path');
 await pg.exec(readFileSync(join(__dirname,'../migrations/EXEMPLO_GRANTS.sql'),'utf8').replaceAll('lar_ternura_api','e1_limitada'));
 const a=await book();await pg.exec('SET ROLE e1_limitada');
 try{const r=await finish(a.id_agendamento);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.agendamento.itens[0].quantidade_recebida,10);}
 finally{await pg.exec('RESET ROLE');}
});
