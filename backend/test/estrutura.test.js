// Regressões do relato de Vinicius. Banco efêmero, sem conexão com Neon.
const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {fixture,reset,ddl,migration,root}=require('../scripts/test-fixture.cjs');
const {Store}=require('../src/store');
const {createApp}=require('../src/app');
const {validationSql}=require('../src/schema');
let pg,db,store;
before(async()=>{({pg,db}=await fixture());store=new Store(db,{});});
beforeEach(async()=>reset(pg));
after(async()=>pg.close());
async function incompatible(sql,detail){
 await pg.exec(sql);
 await assert.rejects(store.ready(),e=>e.code==='LT001'&&e.detail.includes(detail));
 await assert.rejects(pg.exec(migration),e=>e.code==='LT001'&&e.detail.includes(detail));
 await pg.exec('ROLLBACK');
}
const cases=[
 ['varchar com tamanho errado', 'ALTER TABLE api_apoio.sessoes_ong ALTER COLUMN token_hash TYPE varchar(40)', 'token_hash: tipo'],
 ['tipo errado', 'ALTER TABLE api_apoio.requisicoes_agendamento ALTER COLUMN request_hash TYPE text', 'request_hash: tipo'],
 ['coluna ausente', 'ALTER TABLE api_apoio.sessoes_ong DROP COLUMN expira_em', 'expira_em: coluna ausente'],
 ['coluna nullable indevida', 'ALTER TABLE api_apoio.sessoes_ong ALTER COLUMN expira_em DROP NOT NULL', 'expira_em: nulabilidade'],
 ['coluna adicional', 'ALTER TABLE api_apoio.slots_entrega ADD COLUMN extra integer NOT NULL', 'colunas adicionais'],
 ['default indevido', "ALTER TABLE api_apoio.sessoes_ong ALTER COLUMN expira_em SET DEFAULT now()", 'default/geração'],
 ['timestamp sem fuso', 'ALTER TABLE api_apoio.slots_entrega ALTER COLUMN data_hora TYPE timestamp without time zone', 'data_hora: tipo'],
 ['chave primária ausente', 'ALTER TABLE api_apoio.slots_entrega DROP CONSTRAINT slots_entrega_pkey', 'chave primária'],
 ['FK ausente', 'ALTER TABLE api_apoio.sessoes_ong DROP CONSTRAINT sessoes_ong_id_usuario_fkey', 'FK ausente'],
 ['FK com exclusão em cascata', 'ALTER TABLE api_apoio.sessoes_ong DROP CONSTRAINT sessoes_ong_id_usuario_fkey; ALTER TABLE api_apoio.sessoes_ong ADD FOREIGN KEY(id_usuario) REFERENCES public.usuarios_ong ON DELETE CASCADE', 'FK ausente'],
 ['FK não validada', 'ALTER TABLE api_apoio.sessoes_ong DROP CONSTRAINT sessoes_ong_id_usuario_fkey; ALTER TABLE api_apoio.sessoes_ong ADD FOREIGN KEY(id_usuario) REFERENCES public.usuarios_ong ON DELETE RESTRICT NOT VALID', 'FK ausente'],
 ['FK adiada', 'ALTER TABLE api_apoio.sessoes_ong DROP CONSTRAINT sessoes_ong_id_usuario_fkey; ALTER TABLE api_apoio.sessoes_ong ADD FOREIGN KEY(id_usuario) REFERENCES public.usuarios_ong ON DELETE RESTRICT DEFERRABLE', 'FK ausente'],
 ['unicidade parcial', 'ALTER TABLE api_apoio.requisicoes_recebimento DROP CONSTRAINT requisicoes_recebimento_id_recebimento_key; CREATE UNIQUE INDEX recebimento_parcial ON api_apoio.requisicoes_recebimento(id_recebimento) WHERE id_recebimento>100', 'unicidade válida'],
 ['view no lugar de tabela', 'DROP TABLE api_apoio.slots_entrega; CREATE VIEW api_apoio.slots_entrega AS SELECT now() AS data_hora', 'tabela comum persistente'],
 ['token público incompatível', 'ALTER TABLE public.agendamentos ALTER COLUMN token_gestao_hash TYPE varchar(40)', 'token_gestao_hash: tipo'],
];
for(const [name,sql,detail] of cases)test('migração e ready recusam '+name,async()=>incompatible(sql,detail));
test('ready exige tabela e migração instala tabela ausente',async()=>{
 await pg.exec('DROP TABLE api_apoio.slots_entrega');
 await assert.rejects(store.ready(),e=>e.code==='LT001'&&e.detail.includes('tabela ausente'));
 await pg.exec(migration);await store.ready();
});
test('/ready retorna 503 sem detalhes internos, /health mantém liveness',async()=>{
 await pg.exec('ALTER TABLE api_apoio.sessoes_ong ALTER COLUMN token_hash TYPE varchar(40)');
 const server=createApp({store,config:{origins:[],proxyHops:0},logger:{error(){}}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const ready=await fetch(base+'/ready');const body=await ready.json();
  assert.equal(ready.status,503);assert.equal(body.erro.codigo,'ESTRUTURA_INCOMPATIVEL');
  assert.ok(!JSON.stringify(body).includes('sessoes_ong'));assert.ok(!JSON.stringify(body).includes('varchar'));
  assert.equal((await fetch(base+'/health')).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('primeira instalação recusa tabela preexistente divergente sem criar outros objetos nem perder dados',async()=>{
 await pg.exec('DROP SCHEMA api_apoio CASCADE');await pg.exec(ddl);
 await pg.exec("CREATE SCHEMA api_apoio; CREATE TABLE api_apoio.sessoes_ong(token_hash varchar(40) PRIMARY KEY,id_usuario integer NOT NULL,expira_em timestamptz NOT NULL); INSERT INTO api_apoio.sessoes_ong VALUES('preservar',1,now())");
 await assert.rejects(pg.exec(migration),e=>e.code==='LT001');await pg.exec('ROLLBACK');
 assert.equal((await db.query('SELECT token_hash FROM api_apoio.sessoes_ong')).rows[0].token_hash,'preservar');
 assert.equal((await db.query("SELECT to_regclass('api_apoio.slots_entrega') AS tabela")).rows[0].tabela,null);
 assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='agendamentos' AND column_name='token_gestao_hash'")).rows[0].n,0);
});
test('verificação posterior rejeita índice preexistente errado e desfaz DDL novo',async()=>{
 await pg.exec('DROP SCHEMA api_apoio CASCADE');await pg.exec(ddl);
 await pg.exec('CREATE INDEX api_token_gestao ON public.agendamentos(id_agendamento)');
 await assert.rejects(pg.exec(migration),e=>e.code==='LT001'&&e.detail.includes('unicidade válida'));await pg.exec('ROLLBACK');
 assert.equal((await db.query("SELECT to_regnamespace('api_apoio') AS schema")).rows[0].schema,null);
 assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='agendamentos' AND column_name='token_gestao_hash'")).rows[0].n,0);
});
test('migração distribuída usa exatamente o mesmo validador do ready',()=>{
 const folder=join(root,'backend/schema');
 const expected=readFileSync(join(folder,'base-check.sql'),'utf8')+'\n-- Antes de qualquer DDL: recusar objetos existentes divergentes.\n'+validationSql(true)+'\n'+readFileSync(join(folder,'complemento.sql'),'utf8')+'\n-- Depois do DDL: exigir todas as garantias instaladas.\n'+validationSql(false)+'\nCOMMIT;\n';
 // CRLF e LF são equivalentes; todo o restante do SQL continua sendo conferido.
 const normalizeLineEndings=text=>text.replace(/\r\n/g,'\n');
 assert.equal(normalizeLineEndings(migration),normalizeLineEndings(expected));
 // Regressão Windows: mesmo SQL com CRLF deve passar, mas mudança no SQL deve falhar.
 assert.equal(normalizeLineEndings(migration.replace(/\r?\n/g,'\r\n')),normalizeLineEndings(expected));
 assert.notEqual(normalizeLineEndings(migration.replace('COMMIT;','ROLLBACK;')),normalizeLineEndings(expected));
});
