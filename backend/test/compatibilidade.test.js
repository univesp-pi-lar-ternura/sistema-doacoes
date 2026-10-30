const {test,before,beforeEach,afterEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const {readFileSync}=require('node:fs');
const {fixture,reset,migration,root}=require('../scripts/test-fixture.cjs');
const {createApp}=require('../src/app');const {Store}=require('../src/store');const SEC=require('../src/security');
let pg,db,store,server,base,adminHash,goals;
let currentTime='2030-01-01T12:00:00Z';
const config={times:['09:00','10:00','14:00','15:00'],capacity:3,secret:'teste-compatibilidade-'.repeat(3),sessionHours:8,origins:['http://localhost:5173'],proxyHops:0};
const password='Senha-apenas-para-teste-123';
async function call(path,{method='GET',body,token,key,headers={}}={}){
 const r=await fetch(base+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();return{status:r.status,body:text?JSON.parse(text):null,headers:r.headers};
}
const booking=(o={})=>({doador:{nome:'Pessoa teste',email:'pessoa@example.test',telefone:'11999999999',tipo_doador:'PF'},data:'2030-02-20',horario:'14:00',itens:[{id_item:1,id_necessidade:goals[0],quantidade_doada:10},{id_item:2,id_necessidade:goals[1],quantidade_doada:4}],...o});
const create=(body=booking(),key=randomUUID())=>call('/agendamentos',{method:'POST',body,key});
const received=(id=null,quantity=2,goal=goals[0])=>({id_agendamento:id,ocorrido_em:new Date(Date.now()-120000).toISOString(),itens:[{id_item:1,id_necessidade:goal,quantidade_recebida:quantity}]});
async function login(){const r=await call('/auth/login',{method:'POST',body:{email:'ong@example.test',senha:password}});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.token;}
async function receive(body,token,key=randomUUID()){return call('/doacoes',{method:'POST',body,token,key});}
before(async()=>{({pg,db}=await fixture());adminHash=await SEC.hashPassword(password);});
beforeEach(async()=>{
 currentTime='2030-01-01T12:00:00Z';await reset(pg);
 await db.query('INSERT INTO public.usuarios_ong(nome,email,senha_hash) VALUES($1,$2,$3)',['Equipe teste','ong@example.test',adminHash]);
 await db.query("INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria) VALUES('Arroz','pacotes','Alimentos',1),('Sabonete','unidades','Higiene',2)");
 goals=(await db.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta,criada_por) VALUES(1,1,40,1),(2,2,80,1) RETURNING id_necessidade::text')).rows.map(x=>x.id_necessidade);
 store=new Store(db,config);server=createApp({store,config,clock:()=>new Date(currentTime),logger:{error:()=>{}}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
afterEach(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});after(async()=>pg.close());
test('migração complementar é repetível e preserva dados, metas, triggers e views',async()=>{
 const before=(await db.query('SELECT count(*)::int AS n FROM arrecadacao.necessidades')).rows[0].n;
 await pg.exec(migration);assert.equal((await db.query('SELECT count(*)::int AS n FROM arrecadacao.necessidades')).rows[0].n,before);
 assert.equal((await call('/ready')).status,200);assert.equal((await call('/itens')).body.length,2);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='itens_necessidades' AND column_name IN ('quantidade_atual','quantidade_necessaria')")).rows[0].n,0);
});
test('migração recusa base antiga/mista e desfaz alterações',async()=>{
 await pg.exec('ALTER TABLE public.itens_necessidades ADD COLUMN quantidade_atual integer');
 await assert.rejects(pg.exec(migration),/Modelo misto/);await pg.exec('ROLLBACK');
 assert.equal((await call('/health')).status,200);
});
test('catálogo público usa view e mantém aliases sem expor contatos',async()=>{
 const r=await call('/itens?q=Arroz&prioridade=1&limit=1');assert.equal(r.status,200);assert.equal(r.body.length,1);
 assert.equal(r.body[0].id_necessidade,goals[0]);assert.equal(r.body[0].quantidade_meta,40);assert.equal(r.body[0].quantidade_atual,0);assert.equal(r.body[0].prioridade,'Alta/Crítica');
 assert.ok(!JSON.stringify(r.body).includes('email'));assert.equal((await call('/itens?limit=-1')).status,422);assert.equal((await call('/itens/abc')).status,422);assert.equal((await call('/necessidades')).body.length,2);
});
test('produto e meta são criados separadamente e unidade em uso é protegida',async()=>{
 const token=await login(),product={nome_item:'Leite',unidade_medida:'latas',categoria_suprimento:'Alimentos',id_categoria:1};
 assert.equal((await call('/itens',{method:'POST',body:product})).status,401);
 const p=await call('/itens',{method:'POST',body:product,token});assert.equal(p.status,201);assert.equal((await call('/itens/'+p.body.id_item)).status,404);
 const n=await call('/admin/necessidades',{method:'POST',body:{id_item:p.body.id_item,id_categoria:1,quantidade_meta:30},token});assert.equal(n.status,201);
 assert.equal((await call('/itens/'+p.body.id_item)).body.quantidade_necessaria,30);
 assert.equal((await call('/itens/'+p.body.id_item,{method:'PUT',body:{...product,unidade_medida:'caixas'},token})).status,409);
 assert.equal((await call('/itens',{method:'POST',body:{...product,quantidade_necessaria:50},token})).status,422);
 assert.equal((await call('/itens/'+p.body.id_item,{method:'DELETE',token})).status,204);assert.equal((await call('/itens/'+p.body.id_item)).status,404);
});
test('renovar zera a nova meta e preserva o histórico anterior',async()=>{
 const token=await login();assert.equal((await receive(received(),token)).status,201);
 const n=await call('/admin/necessidades/'+goals[0]+'/renovar',{method:'POST',body:{id_categoria:2,quantidade_meta:60},token});assert.equal(n.status,201);
 const item=(await call('/itens/1')).body;assert.equal(item.quantidade_atual,0);assert.notEqual(item.id_necessidade,goals[0]);
 const old=(await call('/admin/necessidades/historico',{token})).body.find(x=>x.id_necessidade===goals[0]);assert.equal(old.status,'Encerrada');assert.equal(old.quantidade_arrecadada,'2');
});
test('renovação que falha não encerra a meta original',async()=>{
 const token=await login();assert.equal((await call('/admin/necessidades/'+goals[0]+'/renovar',{method:'POST',body:{id_categoria:999,quantidade_meta:60},token})).status,422);
 assert.equal((await call('/itens/1')).body.id_necessidade,goals[0]);
});
test('login, revogação, expiração, cargo e usuário inativo são respeitados',async()=>{
 let token=await login();assert.ok(!('senha_hash' in(await call('/auth/me',{token})).body));await db.query('UPDATE public.usuarios_ong SET ativo=false WHERE id_usuario=1');assert.equal((await call('/auth/me',{token})).status,401);assert.equal((await call('/auth/login',{method:'POST',body:{email:'ong@example.test',senha:password}})).status,401);
 await db.query('UPDATE public.usuarios_ong SET ativo=true WHERE id_usuario=1');token=await login();await call('/auth/logout',{method:'POST',token});assert.equal((await call('/auth/me',{token})).status,401);
 token=await login();await db.query("UPDATE api_apoio.sessoes_ong SET expira_em='2020-01-01'");assert.equal((await call('/auth/me',{token})).status,401);
 await db.query("UPDATE public.usuarios_ong SET cargo='Consulta'");assert.equal((await call('/auth/login',{method:'POST',body:{email:'ong@example.test',senha:password}})).status,401);
});
test('agendar só promete; PF/PJ e fuso são preservados',async()=>{
 const b=booking();b.doador.tipo_doador='PJ';const r=await create(b);assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(r.body.agendamento.data_hora_agendada,'2030-02-20T14:00:00');assert.ok(!r.body.agendamento.doador);assert.equal((await call('/itens/1')).body.quantidade_atual,0);
 assert.equal((await db.query('SELECT tipo_doador FROM public.doadores')).rows[0].tipo_doador,'PJ');assert.notEqual((await db.query('SELECT token_gestao_hash FROM public.agendamentos')).rows[0].token_gestao_hash,r.body.token_acesso);
 assert.equal((await db.query('SELECT extract(hour FROM data_hora_agendada AT TIME ZONE $1)::int AS h FROM public.agendamentos',['UTC'])).rows[0].h,17);
});
test('modelo exige meta como string e rejeita CPF/CNPJ, frações e campos indevidos',async()=>{
 for(const b of [booking({itens:[{id_item:1,quantidade_doada:1}]}),booking({itens:[{id_item:1,id_necessidade:1,quantidade_doada:1}]}),booking({itens:[{id_item:1,id_necessidade:goals[0],quantidade_doada:1.5}]})])assert.equal((await create(b)).status,422);
 const b=booking();b.doador.cpf_cnpj='123';assert.equal((await create(b)).status,422);
});
test('seleção de meta antiga é recusada após renovação',async()=>{
 const token=await login(),b=booking();await call('/admin/necessidades/'+goals[0]+'/renovar',{method:'POST',body:{id_categoria:1,quantidade_meta:50},token});assert.equal((await create(b)).body.erro.codigo,'ITEM_INDISPONIVEL');assert.equal((await db.query('SELECT count(*)::int AS n FROM public.agendamentos')).rows[0].n,0);
});
test('reenvio concorrente devolve uma reserva e o mesmo código privado',async()=>{
 const key=randomUUID(),b=booking(),r=await Promise.all([create(b,key),create(b,key)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,201]);assert.equal(r[0].body.token_acesso,r[1].body.token_acesso);assert.equal((await create(booking({horario:'15:00'}),key)).status,409);
});
test('retry recupera reserva mesmo após tempo passar e meta fechar',async()=>{
 const key=randomUUID(),b=booking(),a=await create(b,key),token=await login();await call('/admin/necessidades/'+goals[0]+'/encerrar',{method:'PATCH',token});currentTime='2030-03-01T12:00:00Z';const r=await create(b,key);assert.equal(r.status,200);assert.equal(r.body.agendamento.id_agendamento,a.body.agendamento.id_agendamento);
});
test('capacidade conta Confirmado, última vaga e cancelamento',async()=>{
 const rs=await Promise.all(Array.from({length:4},()=>create()));assert.equal(rs.filter(r=>r.status===201).length,3);assert.equal(rs.filter(r=>r.status===409).length,1);
 const a=rs.find(r=>r.status===201);await db.query("UPDATE public.agendamentos SET status_agendamento='Confirmado' WHERE id_agendamento=$1",[a.body.agendamento.id_agendamento]);assert.equal((await call('/disponibilidade?data=2030-02-20')).body.horarios.find(h=>h.horario==='14:00').vagas,0);
 assert.equal((await call('/agendamentos/'+a.body.agendamento.id_agendamento+'/cancelar',{method:'PATCH',token:a.body.token_acesso})).status,200);assert.equal((await create()).status,201);
});
test('código errado não permite consultar/remarcar e vaga lotada mantém horário original',async()=>{
 const a=await create(),b=await create(booking({horario:'15:00'}));const id=a.body.agendamento.id_agendamento;
 assert.equal((await call('/agendamentos/'+id,{token:b.body.token_acesso})).status,404);assert.equal((await call('/agendamentos/'+id)).status,401);
 await create(booking({horario:'15:00'}));await create(booking({horario:'15:00'}));
 assert.equal((await call('/agendamentos/'+id+'/remarcar',{method:'PATCH',body:{data:'2030-02-20',horario:'15:00'},token:a.body.token_acesso})).status,409);
 assert.equal((await call('/agendamentos/'+id,{token:a.body.token_acesso})).body.data_hora_agendada,'2030-02-20T14:00:00');
});
test('recebimento parcial soma somente o que chegou e não conclui promessa',async()=>{
 const a=await create(),token=await login(),b=received(a.body.agendamento.id_agendamento,3),r=await receive(b,token);assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(typeof r.body.doacao.id_recebimento,'string');assert.equal(r.body.doacao.confirmado_por,1);assert.equal((await call('/itens/1')).body.quantidade_atual,3);
 assert.equal((await call('/agendamentos/'+a.body.agendamento.id_agendamento,{token:a.body.token_acesso})).body.status_agendamento,'Pendente');
 assert.equal((await receive(received(a.body.agendamento.id_agendamento,2),token)).status,201);assert.equal((await call('/itens/1')).body.quantidade_atual,5);
 assert.equal((await call('/agendamentos/'+a.body.agendamento.id_agendamento+'/cancelar',{method:'PATCH',token:a.body.token_acesso})).body.erro.codigo,'ENTREGA_INICIADA');
});
test('idempotência de recebimento compara corpo e usuário e não duplica totais',async()=>{
 const token=await login(),key=randomUUID(),body=received();const a=await receive(body,token,key),b=await receive(body,token,key);assert.equal(a.status,201);assert.equal(b.status,200);assert.equal(a.body.doacao.id_recebimento,b.body.doacao.id_recebimento);assert.equal((await call('/itens/1')).body.quantidade_atual,2);
 assert.equal((await receive({...body,itens:[{...body.itens[0],quantidade_recebida:4}]},token,key)).status,409);
 assert.equal((await receive(body,token,'nao-uuid')).status,422);
});
test('recebimento espontâneo sem meta entra no mês sem preencher termômetro',async()=>{
 const token=await login(),b=received(null,7,null),r=await receive(b,token);assert.equal(r.status,201);assert.equal((await call('/itens/1')).body.quantidade_atual,0);assert.equal((await call('/admin/arrecadacao/mensal',{token})).body[0].quantidade_arrecadada,'7');
});
test('meta de outro produto, data futura, produto inativo e item não prometido são recusados sem cabeçalho órfão',async()=>{
 const token=await login();assert.equal((await receive(received(null,2,goals[1]),token)).status,409);
 const future=received();future.ocorrido_em='2099-01-01T00:00:00Z';assert.equal((await receive(future,token)).status,422);
 await db.query('UPDATE public.itens_necessidades SET ativo=false WHERE id_item=1');assert.equal((await receive(received(),token)).status,409);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM arrecadacao.recebimentos')).rows[0].n,0);
});
test('estorno preserva registros, corrige mês original e exige motivo',async()=>{
 const token=await login(),body=received();body.ocorrido_em='2025-10-31T23:30:00-03:00';const r=await receive(body,token),id=r.body.doacao.id_recebimento;
 assert.equal((await call('/admin/arrecadacao/mensal?mes=2025-10',{token})).body[0].quantidade_arrecadada,'2');assert.equal((await call('/admin/arrecadacao/mensal?mes=2025-11',{token})).body.length,0);
 assert.equal((await call('/doacoes/'+id+'/estornar',{method:'PATCH',body:{motivo:''},token})).status,422);
 const req={method:'PATCH',body:{motivo:'Correção da entrega'},token};assert.equal((await call('/doacoes/'+id+'/estornar',req)).status,200);assert.equal((await call('/doacoes/'+id+'/estornar',req)).status,200);
 assert.equal((await call('/itens/1')).body.quantidade_atual,0);assert.equal((await call('/admin/arrecadacao/mensal?mes=2025-10',{token})).body.length,0);assert.equal((await call('/doacoes/'+id,{token})).body.status,'Estornado');
});
test('conclusão parcial exige decisão explícita e registra itens entregues/cancelados',async()=>{
 const a=await create(),token=await login(),id=a.body.agendamento.id_agendamento;await receive(received(id,3),token);
 assert.equal((await call('/admin/agendamentos/'+id+'/concluir',{method:'PATCH',body:{},token})).status,409);
 const r=await call('/admin/agendamentos/'+id+'/concluir',{method:'PATCH',body:{motivo_pendencias:'Doador encerrou a entrega parcial'},token});assert.equal(r.status,200);assert.equal(r.body.status_agendamento,'Concluído');assert.ok(r.body.itens.every(i=>i.status_item==='Cancelado'));
 assert.equal((await receive(received(id),token)).status,409);
});
test('conclusão integral permite excedente e limita só a barra, não o percentual real',async()=>{
 const a=await create(),token=await login(),id=a.body.agendamento.id_agendamento,b=received(id,50);b.itens.push({id_item:2,id_necessidade:goals[1],quantidade_recebida:4});assert.equal((await receive(b,token)).status,201);
 const i=(await call('/itens/1')).body;assert.equal(i.percentual_atendimento,125);assert.equal(i.percentual_barra,100);assert.equal(i.quantidade_faltante,0);
 const r=await call('/admin/agendamentos/'+id+'/concluir',{method:'PATCH',body:{},token});assert.equal(r.status,200);assert.ok(r.body.itens.every(i=>i.status_item==='Entregue'));
});
test('IDs bigint maiores que Number seguro mantêm precisão nas respostas e rotas',async()=>{
 await db.query('ALTER TABLE arrecadacao.necessidades ALTER COLUMN id_necessidade RESTART WITH 9007199254740993');await db.query("UPDATE arrecadacao.necessidades SET status='Encerrada',encerrada_por=1 WHERE id_necessidade=$1",[goals[0]]);
 const n=(await db.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta) VALUES(1,1,40) RETURNING id_necessidade::text')).rows[0].id_necessidade;assert.equal(n,'9007199254740993');assert.equal((await call('/itens/1')).body.id_necessidade,n);
 const b=booking();b.itens[0].id_necessidade=n;assert.equal((await create(b)).status,201);assert.equal((await call('/admin/necessidades/9223372036854775808/encerrar',{method:'PATCH',token:await login()})).status,422);
});
test('contrato do frontend envia PF/PJ e meta, e recupera resposta perdida com API real local',async()=>{
 const core=await import(pathToFileURL(join(__dirname,'fixtures/cliente-agendamento.mjs')).href);const b=core.bookingBody(booking().doador,'2030-02-20','14:00',booking().itens);let first=true;
 const client=new core.ApiClient(base,async(url,options)=>{const r=await fetch(url,options);if(first){first=false;await r.text();throw Error('Resposta perdida depois do commit');}return r;});
 const attempt=new core.BookingAttempt(b);await assert.rejects(attempt.send(client));assert.equal(attempt.uncertain,true);const r=await attempt.send(client);assert.equal(r.repetido,true);assert.equal((await db.query('SELECT count(*)::int AS n FROM public.agendamentos')).rows[0].n,1);
});
test('CORS, JSON inválido, autenticação e campos de autoria indevidos são bloqueados',async()=>{
 assert.equal((await call('/itens',{headers:{Origin:'https://origem-invalida.example'}})).status,403);assert.equal((await call('/doacoes')).status,401);assert.equal((await receive(received(),null)).status,401);
 assert.equal((await receive({...received(),registrado_por:999},await login())).status,422);
 const r=await fetch(base+'/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(r.status,400);
});
test('25 verificações SQL originais passam e rollback não altera metas da API',async()=>{
 const original=readFileSync(join(root,'banco-vinicius/04_TESTES_NEON.sql'),'utf8');
 const results=await pg.exec(original);const checks=results.find(r=>r.rows?.length===25&&r.rows[0].resultado==='OK');
 assert.ok(checks);assert.ok(checks.rows.every(r=>r.resultado==='OK'));assert.equal((await call('/itens')).body.length,2);
});
test('SQL de demonstração original produz cinco metas e não admite carga repetida',async()=>{
 await reset(pg);const original=readFileSync(join(root,'banco-vinicius/05_DADOS_FICTICIOS.sql'),'utf8');
 // Apenas o nome da conexão local é adaptado; tabelas, regras e dados permanecem originais.
 const sql=original.replace("current_database() <> 'neondb'","current_database() <> current_database()");
 await pg.exec(sql);const items=(await call('/itens')).body;assert.equal(items.length,5);
 const milk=items.find(i=>i.nome_item.includes('Leite'));assert.equal(milk.quantidade_arrecadada,22);assert.equal(milk.quantidade_meta,60);
 await assert.rejects(pg.exec(sql),/Carga recusada/);await pg.exec('ROLLBACK');assert.equal((await call('/itens')).body.length,5);
});
test('recebimento com item não prometido e doador incompatível falha integralmente',async()=>{
 const b=booking({itens:[{id_item:2,id_necessidade:goals[1],quantidade_doada:4}]});const a=await create(b),token=await login();
 assert.equal((await receive(received(a.body.agendamento.id_agendamento),token)).status,409);
 assert.equal((await receive({...received(a.body.agendamento.id_agendamento),id_doador:999},token)).status,422);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM arrecadacao.recebimentos')).rows[0].n,0);
});
test('recebimento idempotente não permite reaproveitar chave de outro administrador',async()=>{
 const token=await login(),body=received(),key=randomUUID();await receive(body,token,key);
 await db.query('INSERT INTO public.usuarios_ong(nome,email,senha_hash) VALUES($1,$2,$3)',['Outro','outro@example.test',adminHash]);
 const session=await call('/auth/login',{method:'POST',body:{email:'outro@example.test',senha:password}});
 assert.equal((await receive(body,session.body.token,key)).status,409);
});
test('recebimento de entrega encerrada só é aceito se ocorreu antes do encerramento',async()=>{
 const token=await login();await call('/admin/necessidades/'+goals[0]+'/encerrar',{method:'PATCH',token});
 assert.equal((await receive(received(),token)).status,201);
 await call('/admin/necessidades/'+goals[1]+'/cancelar',{method:'PATCH',token});const b=received();b.itens=[{id_item:2,id_necessidade:goals[1],quantidade_recebida:1}];assert.equal((await receive(b,token)).status,409);
});
test('metas duplicadas, frações e acesso público ao histórico são recusados',async()=>{
 const token=await login(),body={id_item:1,id_categoria:1,quantidade_meta:30};assert.equal((await call('/admin/necessidades',{method:'POST',body,token})).status,409);
 assert.equal((await call('/admin/necessidades',{method:'POST',body:{...body,quantidade_meta:1.5},token})).status,422);
 assert.equal((await call('/admin/necessidades/historico')).status,401);assert.equal((await call('/admin/arrecadacao/mensal?mes=2026-13',{token})).status,422);
});
test('role limitada do exemplo executa API/triggers e não pode apagar histórico',async()=>{
 await pg.exec('CREATE ROLE api_teste_limitada NOLOGIN');
 const grants=readFileSync(join(root,'backend/migrations/EXEMPLO_GRANTS.sql'),'utf8').replaceAll('lar_ternura_api','api_teste_limitada');
 await pg.exec(grants);await pg.exec('SET ROLE api_teste_limitada');
 try{
  const token=await login();assert.equal((await call('/ready')).status,200);assert.equal((await create()).status,201);
  assert.equal((await receive(received(),token)).status,201);
  assert.equal((await call('/itens/1')).body.quantidade_arrecadada,2);
  assert.equal((await db.query('SELECT registrado_por_banco FROM arrecadacao.recebimentos')).rows[0].registrado_por_banco,'api_teste_limitada');
  await assert.rejects(db.query('DELETE FROM arrecadacao.recebimentos'),e=>e.code==='42501');
 }finally{await pg.exec('RESET ROLE');}
});
