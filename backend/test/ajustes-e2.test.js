// Regressões dos três pedidos da Helena. HTTP e banco efêmero; sem DATABASE_URL.
const {test,before,beforeEach,afterEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {fixture,reset}=require('../scripts/test-fixture.cjs');
const {Store}=require('../src/store');
const {createApp}=require('../src/app');
const SEC=require('../src/security');
const spec=require('../../docs/api/openapi.json');
const collection=require('../../docs/api/lar-ternura-api-2.1.postman_collection.json');
let pg,db,store,server,base,token,goal,passwordHash;
const password='Senha-ficticia-exclusiva-para-testes-123';
const config={times:['09:00','10:00','14:00','15:00'],capacity:100,secret:'teste-local-sem-credenciais-'.repeat(3),sessionHours:8,origins:[],proxyHops:0};
async function call(path,{method='GET',body,key,auth=true}={}){
 const r=await fetch(base+path,{method,headers:{...(auth?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await r.text();return{status:r.status,body:text?JSON.parse(text):null};
}
async function book(instant,{nome='Pessoa período',status='Pendente'}={}){
 const r=await call('/agendamentos',{method:'POST',auth:false,key:randomUUID(),body:{doador:{nome,email:randomUUID()+'@example.test',telefone:'11987654321'},data:'2030-02-20',horario:'14:00',itens:[{id_item:1,id_necessidade:goal,quantidade_doada:1}]}});
 assert.equal(r.status,201,JSON.stringify(r.body));const id=r.body.agendamento.id_agendamento;
 await db.query('UPDATE public.agendamentos SET data_hora_agendada=$1,status_agendamento=$2 WHERE id_agendamento=$3',[instant,status,id]);return id;
}
async function ids(query=''){
 const r=await call('/admin/agendamentos'+query);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.map(a=>a.id_agendamento);
}
async function donate(instant='2020-02-20T14:00:00-03:00'){
 const r=await call('/doacoes',{method:'POST',key:randomUUID(),body:{ocorrido_em:instant,itens:[{id_item:1,id_necessidade:goal,quantidade_recebida:1}]}});
 assert.equal(r.status,201,JSON.stringify(r.body));return r.body.doacao.id_recebimento;
}
before(async()=>{({pg,db}=await fixture());passwordHash=await SEC.hashPassword(password);});
beforeEach(async()=>{
 await reset(pg);
 await db.query('INSERT INTO public.usuarios_ong(nome,email,senha_hash) VALUES($1,$2,$3)',['Equipe teste','equipe@example.test',passwordHash]);
 await db.query("INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria) VALUES('Arroz','pacotes','Alimentos',1)");
 goal=(await db.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta,criada_por) VALUES(1,1,100,1) RETURNING id_necessidade::text')).rows[0].id_necessidade;
 store=new Store(db,config);
 server=createApp({store,config,logger:{error(){}},calendario:{consultarAno:async()=>({status:'indisponivel',feriados:null})}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 const login=await call('/auth/login',{method:'POST',auth:false,body:{email:'equipe@example.test',senha:password}});assert.equal(login.status,200);token=login.body.token;
});
afterEach(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
after(async()=>pg.close());

test('de sozinho inclui o dia inicial e não limita datas posteriores',async()=>{
 await book('2030-02-28T14:00:00-03:00');const a=await book('2030-03-01T14:00:00-03:00'),b=await book('2030-03-10T14:00:00-03:00');
 assert.deepEqual(await ids('?de=2030-03-01'),[b,a]);
});
test('ate sozinho inclui o dia final e não limita datas anteriores',async()=>{
 const a=await book('2030-02-28T14:00:00-03:00'),b=await book('2030-03-01T14:00:00-03:00');await book('2030-03-02T14:00:00-03:00');
 assert.deepEqual(await ids('?ate=2030-03-01'),[b,a]);
});
test('período usa a data de São Paulo em vez da data UTC na virada do dia',async()=>{
 const anterior=await book('2030-03-01T02:59:59Z'),inicio=await book('2030-03-01T03:00:00Z'),fim=await book('2030-03-02T02:59:59.999Z');await book('2030-03-02T03:00:00Z');
 assert.deepEqual(await ids('?de=2030-03-01&ate=2030-03-01'),[fim,inicio]);
 assert.deepEqual(await ids('?data=2030-02-28&de=2030-02-28&ate=2030-02-28'),[anterior]);
});
test('período combina busca, múltiplos status, ordenação, limit e offset',async()=>{
 const a=await book('2030-03-01T14:00:00-03:00',{nome:'Maria período'}),b=await book('2030-03-01T14:00:00-03:00',{nome:'Maria período',status:'Confirmado'});
 await book('2030-03-01T14:00:00-03:00',{nome:'João período'});await book('2030-03-02T14:00:00-03:00',{nome:'Maria fora'});
 const q='?de=2030-03-01&ate=2030-03-01&q=MARIA&status=Pendente,Confirmado';
 assert.deepEqual(await ids(q),[b,a]);assert.deepEqual(await ids(q+'&limit=1&offset=1'),[a]);
 assert.deepEqual(await ids('?de=2030-03-01&ate=2030-03-01&q=MARIA&status=Confirmado'),[b]);
});
test('data e período são aplicados em interseção, sem substituir filtros antigos',async()=>{
 const a=await book('2030-03-01T14:00:00-03:00'),b=await book('2030-03-02T14:00:00-03:00');
 assert.deepEqual(await ids('?data=2030-03-01&de=2030-03-01&ate=2030-03-02'),[a]);
 assert.deepEqual(await ids('?data=2030-03-02&de=2030-03-01&ate=2030-03-01'),[]);
 assert.deepEqual(await ids('?data=2030-03-02'),[b]);
});
test('sem limites preserva todos os agendamentos e a ordem anterior',async()=>{
 const a=await book('2030-03-01T14:00:00-03:00'),b=await book('2030-03-02T14:00:00-03:00');
 assert.deepEqual(await ids(),[b,a]);assert.deepEqual(await ids('?status=Pendente&q=%23'+a),[a]);
});
test('de maior que ate é recusado com 422, mesmo sem registros',async()=>{
 const r=await call('/admin/agendamentos?de=2030-03-02&ate=2030-03-01');assert.equal(r.status,422);assert.equal(r.body.erro.codigo,'VALIDACAO');
});
test('limites rejeitam datas vazias, inexistentes e fora do formato ou intervalo aceito',async()=>{
 for(const key of ['de','ate'])for(const value of ['', '2030-02-30','2025-02-29','2030-13-01','2030-03-1','01-03-2030','1999-12-31','2100-01-01',"2030-03-01' OR 1=1 --"]){
  const r=await call('/admin/agendamentos?'+key+'='+encodeURIComponent(value));assert.equal(r.status,422,key+'='+value);
 }
});
test('limites rejeitam parâmetros repetidos e objetos em vez de strings',async()=>{
 for(const query of ['de=2030-03-01&de=2030-03-02','ate=2030-03-01&ate=2030-03-02','de[x]=2030-03-01','ate[]=2030-03-01']){
  assert.equal((await call('/admin/agendamentos?'+query)).status,422,query);
 }
});
test('dia bissexto válido e intervalo sem resultados retornam lista vazia',async()=>{
 assert.deepEqual(await ids('?de=2024-02-29&ate=2024-02-29'),[]);
});
test('filtros novos não dispensam a sessão administrativa',async()=>{
 assert.equal((await call('/admin/agendamentos?de=2030-03-01&ate=2030-03-02',{auth:false})).status,401);
});
test('doações ordenam primeiro pelo instante ocorrido, antes do maior ID',async()=>{
 const recente=await donate('2020-02-21T14:00:00-03:00');await donate('2020-02-20T14:00:00-03:00');
 const r=await call('/doacoes');assert.equal(r.status,200);assert.equal(r.body[0].id_recebimento,recente);
});
test('desempate de doações é numérico (10 antes de 2) e ocorre antes da paginação',async()=>{
 const created=[];for(let i=0;i<10;i++)created.push(await donate());
 const expected=created.toReversed();
 const first=await call('/doacoes?limit=3&offset=0'),second=await call('/doacoes?limit=3&offset=3');
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.deepEqual(first.body.map(d=>d.id_recebimento),expected.slice(0,3));
 assert.deepEqual(second.body.map(d=>d.id_recebimento),expected.slice(3,6));
 const all=await call('/doacoes');assert.deepEqual(all.body.map(d=>d.id_recebimento),expected);
});
test('estornos continuam na listagem e o desempate não filtra nem altera doações',async()=>{
 const a=await donate(),b=await donate();
 assert.equal((await call('/doacoes/'+b+'/estornar',{method:'PATCH',body:{motivo:'Correção fictícia'}})).status,200);
 const r=await call('/doacoes');assert.deepEqual(r.body.map(d=>d.id_recebimento),[b,a]);assert.equal(r.body[0].status,'Estornado');
});
test('OpenAPI e coleção Postman publicam os limites e a ordenação de recebimentos',()=>{
 const op=spec.paths['/admin/agendamentos'].get;
 for(const name of ['de','ate']){const p=op.parameters.find(p=>p.name===name);assert.ok(p);assert.equal(p.required,false);assert.equal(p.schema.format,'date');assert.match(p.description,/inclusivo/);}
 assert.ok(op.responses['422']);assert.match(op.description,/America\/Sao_Paulo/);
 assert.match(spec.paths['/doacoes'].get.description,/numérico DESC/);
 const request=collection.item.flatMap(g=>g.item).find(i=>i.request.method==='GET'&&i.request.url.raw==='{{base_url}}/admin/agendamentos').request;
 for(const name of ['de','ate'])assert.ok(request.url.query.some(p=>p.key===name&&p.value==='{{periodo_'+name+'}}'));
});
