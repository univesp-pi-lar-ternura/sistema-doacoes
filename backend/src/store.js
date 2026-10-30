const {assertSchema}=require('./schema');
const {fail}=require('./errors'),SEC=require('./security'),V=require('./validation');
const localSql="data_hora_agendada AT TIME ZONE 'America/Sao_Paulo'";
const bookingSelect=`SELECT id_agendamento,to_char(${localSql},'YYYY-MM-DD"T"HH24:MI:SS') AS data_hora_agendada,status_agendamento FROM public.agendamentos WHERE id_agendamento=$1`;
const amount=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0)fail(503,'TOTAL_FORA_DO_LIMITE','Total fora do limite numérico da API.');return n;};
const normalize=r=>({...r,id_necessidade:String(r.id_necessidade),quantidade_meta:amount(r.quantidade_meta),quantidade_arrecadada:amount(r.quantidade_arrecadada),quantidade_faltante:amount(r.quantidade_faltante),percentual_atendimento:Number(r.percentual_atendimento),percentual_barra:Number(r.percentual_barra),quantidade_necessaria:amount(r.quantidade_meta),quantidade_atual:amount(r.quantidade_arrecadada),prazo_necessidade:null,descricao:null});
const itemSelect=`SELECT v.id_necessidade::text,v.id_item,v.nome_item,v.unidade_medida,v.quantidade_meta,v.quantidade_arrecadada,v.quantidade_faltante,v.percentual_atendimento,v.percentual_barra,v.meta_atingida,v.status,v.urgencia AS prioridade,v.cor_indicador,v.nivel_ordem,i.categoria_suprimento,i.ativo,n.id_categoria FROM arrecadacao.vw_termometro v JOIN public.itens_necessidades i USING(id_item) JOIN arrecadacao.necessidades n USING(id_necessidade)`;
class Store{
 constructor(db,config){this.db=db;this.config=config;}
 async ready(){await assertSchema(this.db);await this.db.query('SELECT id_necessidade FROM arrecadacao.vw_termometro LIMIT 0');await this.db.query('SELECT chave FROM api_apoio.requisicoes_recebimento LIMIT 0');await this.db.query('SELECT a.token_gestao_hash,s.token_hash FROM public.agendamentos a CROSS JOIN api_apoio.sessoes_ong s LIMIT 0');}
 async categories(){return(await this.db.query('SELECT * FROM public.categorias_urgencia ORDER BY nivel_ordem')).rows;}
 async items(f,admin=false){
  if(admin)return(await this.db.query('SELECT * FROM public.itens_necessidades ORDER BY id_item LIMIT $1 OFFSET $2',[f.limit,f.offset])).rows;
  return(await this.db.query(itemSelect+` WHERE ($1::text IS NULL OR v.nome_item ILIKE $1) AND ($2::text IS NULL OR i.categoria_suprimento=$2) AND ($3::int IS NULL OR n.id_categoria=$3) ORDER BY v.nivel_ordem,v.percentual_atendimento,v.nome_item,v.id_item LIMIT $4 OFFSET $5`,[f.q?`%${f.q.replace(/[\\%_]/g,'\\$&')}%`:null,f.categoria||null,f.prioridade||null,f.limit,f.offset])).rows.map(normalize);
 }
 async item(id){const r=(await this.db.query(itemSelect+' WHERE v.id_item=$1',[id])).rows[0];if(!r)fail(404,'NAO_ENCONTRADO','Necessidade aberta não encontrada.');return normalize(r);}
 async product(id){const r=(await this.db.query('SELECT * FROM public.itens_necessidades WHERE id_item=$1',[id])).rows[0];if(!r)fail(404,'NAO_ENCONTRADO','Produto não encontrado.');return r;}
 async saveItem(id,item){return this.db.transaction(async tx=>{
  const a=[item.nome_item,item.unidade_medida,item.categoria_suprimento,item.id_categoria];
  if(id){const prev=(await tx.query('SELECT * FROM public.itens_necessidades WHERE id_item=$1 FOR UPDATE',[id])).rows[0];if(!prev)fail(404,'NAO_ENCONTRADO','Produto não encontrado.');
   if(prev.unidade_medida!==item.unidade_medida&&(await tx.query('SELECT 1 FROM arrecadacao.necessidades WHERE id_item=$1 UNION ALL SELECT 1 FROM public.itens_agendamento WHERE id_item=$1 LIMIT 1',[id])).rows.length)fail(409,'UNIDADE_EM_USO','Cadastre outro produto para uma nova unidade.');
   return(await tx.query('UPDATE public.itens_necessidades SET nome_item=$1,unidade_medida=$2,categoria_suprimento=$3,id_categoria=$4 WHERE id_item=$5 RETURNING *',[...a,id])).rows[0];}
  return(await tx.query('INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria) VALUES($1,$2,$3,$4) RETURNING *',a)).rows[0];
 });}
 async archiveItem(id){const r=await this.db.query('UPDATE public.itens_necessidades SET ativo=false WHERE id_item=$1 RETURNING id_item',[id]);if(!r.rows.length)fail(404,'NAO_ENCONTRADO','Produto não encontrado.');}
 async openNeed(b,u){return(await this.db.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta,criada_por) VALUES($1,$2,$3,$4) RETURNING id_necessidade::text,id_item,quantidade_meta,status',[b.id_item,b.id_categoria,b.quantidade_meta,u])).rows[0];}
 async closeNeed(id,status,u,replacement=null){return this.db.transaction(async tx=>{
  const n=(await tx.query('SELECT * FROM arrecadacao.necessidades WHERE id_necessidade=$1 FOR UPDATE',[id])).rows[0];if(!n)fail(404,'NAO_ENCONTRADO','Meta não encontrada.');if(n.status!=='Aberta')fail(409,'META_FECHADA','Meta já encerrada ou cancelada.');
  await tx.query('UPDATE arrecadacao.necessidades SET status=$1,encerrada_por=$2 WHERE id_necessidade=$3',[status,u,id]);
  if(!replacement)return{id_necessidade:String(id),status};return(await tx.query('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta,criada_por) VALUES($1,$2,$3,$4) RETURNING id_necessidade::text,id_item,quantidade_meta,status',[n.id_item,replacement.id_categoria,replacement.quantidade_meta,u])).rows[0];
 });}
 async history(f){return(await this.db.query('SELECT id_necessidade::text,id_item,nome_item,unidade_medida,quantidade_meta,quantidade_arrecadada::text,quantidade_faltante::text,percentual_atendimento::text,status,urgencia,criada_em,encerrada_em FROM arrecadacao.vw_historico_necessidades ORDER BY criada_em DESC,id_necessidade DESC LIMIT $1 OFFSET $2',[f.limit,f.offset])).rows;}
 async monthly(month,f){return(await this.db.query(`SELECT to_char(mes,'YYYY-MM') AS mes,id_item,nome_item,unidade_medida,quantidade_arrecadada::text,entregas::text FROM arrecadacao.vw_arrecadacao_mensal WHERE ($1::text IS NULL OR to_char(mes,'YYYY-MM')=$1) ORDER BY mes DESC,id_item,nome_item LIMIT $2 OFFSET $3`,[month,f.limit,f.offset])).rows;}
 async userByEmail(email){return(await this.db.query('SELECT * FROM public.usuarios_ong WHERE lower(btrim(email))=$1 AND ativo=true',[email])).rows[0];}
 async createSession(id,token,expires){await this.db.query('INSERT INTO api_apoio.sessoes_ong(token_hash,id_usuario,expira_em) VALUES($1,$2,$3)',[SEC.hash(token),id,expires]);}
 async session(token,now){return(await this.db.query('SELECT u.id_usuario,u.nome,u.email,u.cargo FROM api_apoio.sessoes_ong s JOIN public.usuarios_ong u USING(id_usuario) WHERE token_hash=$1 AND expira_em>$2 AND u.ativo=true',[SEC.hash(token),now])).rows[0];}
 async revoke(token){await this.db.query('DELETE FROM api_apoio.sessoes_ong WHERE token_hash=$1',[SEC.hash(token)]);}
 async availability(day){const rows=(await this.db.query(`SELECT to_char(${localSql},'HH24:MI') AS horario,count(*)::int AS ocupados FROM public.agendamentos WHERE (${localSql})::date=$1 AND status_agendamento IN ('Pendente','Confirmado') GROUP BY data_hora_agendada`,[day])).rows;return this.config.times.map(horario=>({horario,capacidade:this.config.capacity,vagas:Math.max(0,this.config.capacity-(rows.find(r=>r.horario===horario)?.ocupados||0))}));}
 async lockSlot(tx,slot,exclude=null){await tx.query('INSERT INTO api_apoio.slots_entrega(data_hora) VALUES($1) ON CONFLICT DO NOTHING',[slot+'-03:00']);await tx.query('SELECT data_hora FROM api_apoio.slots_entrega WHERE data_hora=$1 FOR UPDATE',[slot+'-03:00']);const n=(await tx.query("SELECT count(*)::int AS n FROM public.agendamentos WHERE data_hora_agendada=$1 AND status_agendamento IN ('Pendente','Confirmado') AND ($2::int IS NULL OR id_agendamento<>$2)",[slot+'-03:00',exclude])).rows[0].n;if(n>=this.config.capacity)fail(409,'HORARIO_LOTADO','Esse horário ficou sem vagas. Escolha outro.');}
 async booking(id,hash=null,tx=this.db,admin=false){const r=(await tx.query(bookingSelect+(hash?' AND token_gestao_hash=$2':''),hash?[id,hash]:[id])).rows[0];if(!r)fail(404,'NAO_ENCONTRADO','Agendamento não encontrado.');r.fuso_horario='America/Sao_Paulo';r.itens=(await tx.query('SELECT ia.id_item,i.nome_item,i.unidade_medida,ia.quantidade_doada,ia.status_item,v.id_necessidade::text,COALESCE((SELECT SUM(ir.quantidade_recebida) FROM arrecadacao.itens_recebimento ir JOIN arrecadacao.recebimentos rec USING(id_recebimento) WHERE rec.id_agendamento=ia.id_agendamento AND ir.id_item=ia.id_item AND rec.status=\'Confirmado\'),0)::text AS quantidade_recebida FROM public.itens_agendamento ia JOIN public.itens_necessidades i USING(id_item) LEFT JOIN api_apoio.itens_agendamento_necessidade v USING(id_agendamento,id_item) WHERE ia.id_agendamento=$1 ORDER BY ia.id_item',[id])).rows.map(i=>({...i,quantidade_recebida:amount(i.quantidade_recebida)}));if(admin)r.doador=(await tx.query('SELECT d.id_doador,d.nome,d.email,d.telefone,d.tipo_doador FROM public.doadores d JOIN public.agendamentos a USING(id_doador) WHERE a.id_agendamento=$1',[id])).rows[0];return r;}
 async createBooking(b,key,now=new Date()){const hash=SEC.hash(JSON.stringify(b)),token=SEC.bookingToken(key,this.config.secret);return this.db.transaction(async tx=>{
  await tx.query('INSERT INTO api_apoio.requisicoes_agendamento(chave,request_hash) VALUES($1,$2) ON CONFLICT DO NOTHING',[key,hash]);const saved=(await tx.query('SELECT * FROM api_apoio.requisicoes_agendamento WHERE chave=$1 FOR UPDATE',[key])).rows[0];if(saved.request_hash!==hash)fail(409,'CHAVE_REUTILIZADA','Chave usada com outros dados.');
  if(saved.id_agendamento){const s=(await tx.query('SELECT token_gestao_hash FROM public.agendamentos WHERE id_agendamento=$1',[saved.id_agendamento])).rows[0];if(!s||s.token_gestao_hash!==SEC.hash(token))fail(409,'CHAVE_EXPIRADA','Use o código original ou contate a ONG.');return{agendamento:await this.booking(saved.id_agendamento,null,tx),token_acesso:token,repetido:true};}
  V.validateSlot(b.data_hora_agendada,this.config,now);await this.lockSlot(tx,b.data_hora_agendada);const ids=b.itens.map(i=>i.id_item);
  await tx.query('SELECT id_item FROM public.itens_necessidades WHERE id_item=ANY($1::int[]) ORDER BY id_item FOR SHARE',[ids]);await tx.query("SELECT id_necessidade FROM arrecadacao.necessidades WHERE id_item=ANY($1::int[]) AND status='Aberta' ORDER BY id_necessidade FOR UPDATE",[ids]);
  const goals=(await tx.query('SELECT id_item,id_necessidade::text,meta_atingida FROM arrecadacao.vw_termometro WHERE id_item=ANY($1::int[])',[ids])).rows;
  if(goals.length!==ids.length||b.itens.some(i=>!goals.find(n=>n.id_item===i.id_item&&n.id_necessidade===i.id_necessidade)))fail(409,'ITEM_INDISPONIVEL','A necessidade mudou ou foi encerrada. Atualize sua seleção.');
  const d=b.doador;await tx.query('INSERT INTO public.doadores(nome,email,telefone,tipo_doador) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[d.nome,d.email,d.telefone,d.tipo_doador]);const donor=(await tx.query('SELECT id_doador FROM public.doadores WHERE lower(btrim(email))=$1',[d.email])).rows[0];
  const id=(await tx.query('INSERT INTO public.agendamentos(data_hora_agendada,id_doador,token_gestao_hash) VALUES($1,$2,$3) RETURNING id_agendamento',[b.data_hora_agendada+'-03:00',donor.id_doador,SEC.hash(token)])).rows[0].id_agendamento;
  for(const i of b.itens){await tx.query('INSERT INTO public.itens_agendamento(id_agendamento,id_item,quantidade_doada) VALUES($1,$2,$3)',[id,i.id_item,i.quantidade_doada]);await tx.query('INSERT INTO api_apoio.itens_agendamento_necessidade(id_agendamento,id_item,id_necessidade) VALUES($1,$2,$3)',[id,i.id_item,i.id_necessidade]);}
  await tx.query('UPDATE api_apoio.requisicoes_agendamento SET id_agendamento=$1 WHERE chave=$2',[id,key]);return{agendamento:await this.booking(id,null,tx),token_acesso:token,repetido:false};
 });}
 async changeBooking(id,hash,newSlot=null,admin=false){return this.db.transaction(async tx=>{
  const r=(await tx.query(`SELECT status_agendamento FROM public.agendamentos WHERE id_agendamento=$1 ${admin?'':'AND token_gestao_hash=$2'} FOR UPDATE`,admin?[id]:[id,hash])).rows[0];if(!r)fail(404,'NAO_ENCONTRADO','Agendamento não encontrado.');if(r.status_agendamento==='Cancelado'&&!newSlot)return this.booking(id,null,tx);if(!['Pendente','Confirmado'].includes(r.status_agendamento))fail(409,'STATUS_INVALIDO','Agendamento encerrado.');
  if((await tx.query("SELECT 1 FROM arrecadacao.recebimentos WHERE id_agendamento=$1 AND status='Confirmado' LIMIT 1",[id])).rows.length)fail(409,'ENTREGA_INICIADA','A ONG deve concluir ou corrigir os recebimentos.');
  if(newSlot){await this.lockSlot(tx,newSlot,id);await tx.query('UPDATE public.agendamentos SET data_hora_agendada=$1 WHERE id_agendamento=$2',[newSlot+'-03:00',id]);}else{await tx.query("UPDATE public.agendamentos SET status_agendamento='Cancelado' WHERE id_agendamento=$1",[id]);await tx.query("UPDATE public.itens_agendamento SET status_item='Cancelado' WHERE id_agendamento=$1",[id]);}return this.booking(id,null,tx);
 });}
 async bookings(f){
  const term=f.q??null;
  const pattern=term===null?null:`%${term.replace(/[\\%_]/g,'\\$&')}%`;
  const digits=term?.replace(/\D/g,'')||'';
  const code=term&&/^#?\s*\d+$/.test(term)&&BigInt(digits)<=2147483647n?Number(digits):null;
  const phone=term&&/^#?[\d\s()+.\-]+$/.test(term)&&digits.length>=4?`%${digits}%`:null;
  const textPattern=term&&/^#?[\d\s()+.\-]+$/.test(term)?null:pattern;
  const statuses=f.statuses??(f.status?[f.status]:null);
  const rows=(await this.db.query(`SELECT a.id_agendamento FROM public.agendamentos a
   JOIN public.doadores d USING(id_doador)
   WHERE ($1::date IS NULL OR (a.data_hora_agendada AT TIME ZONE 'America/Sao_Paulo')::date=$1)
    AND ($9::date IS NULL OR (a.data_hora_agendada AT TIME ZONE 'America/Sao_Paulo')::date >= $9)
    AND ($10::date IS NULL OR (a.data_hora_agendada AT TIME ZONE 'America/Sao_Paulo')::date <= $10)
    AND ($2::text[] IS NULL OR a.status_agendamento=ANY($2))
    AND ($3::text IS NULL OR a.id_agendamento=$4::int OR d.nome ILIKE $8 OR lower(btrim(d.email)) LIKE lower($8)
     OR ($5::text IS NOT NULL AND regexp_replace(d.telefone,'[^0-9]','','g') LIKE $5))
   ORDER BY a.data_hora_agendada DESC,a.id_agendamento DESC LIMIT $6 OFFSET $7`,
   [f.data||null,statuses,pattern,code,phone,f.limit,f.offset,textPattern,f.de??null,f.ate??null])).rows;
  return Promise.all(rows.map(r=>this.booking(r.id_agendamento,null,this.db,true)));
 }
 async claimReceipt(tx,key,hash,u){
  await tx.query('INSERT INTO api_apoio.requisicoes_recebimento(chave,request_hash,id_usuario) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[key,hash,u]);
  const saved=(await tx.query('SELECT * FROM api_apoio.requisicoes_recebimento WHERE chave=$1 FOR UPDATE',[key])).rows[0];
  if(saved.request_hash!==hash||saved.id_usuario!==u)fail(409,'CHAVE_REUTILIZADA','Operação usada com outros dados ou usuário.');
  return saved;
 }
 async receive(b,key,u){return this.db.transaction(async tx=>{
  const saved=await this.claimReceipt(tx,key,SEC.hash(JSON.stringify(b)),u);
  if(saved.id_recebimento)return{doacao:await this.donation(String(saved.id_recebimento),tx),repetido:true};
  return{doacao:await this.receiveInTransaction(tx,b,key,u),repetido:false};
 });}
 async receiveInTransaction(tx,b,key,u){
  let donor=b.id_doador;if(b.id_agendamento){const a=(await tx.query('SELECT id_doador,status_agendamento FROM public.agendamentos WHERE id_agendamento=$1 FOR UPDATE',[b.id_agendamento])).rows[0];if(!a)fail(404,'NAO_ENCONTRADO','Agendamento não encontrado.');if(!['Pendente','Confirmado'].includes(a.status_agendamento))fail(409,'STATUS_INVALIDO','Agendamento encerrado.');if(donor&&donor!==a.id_doador)fail(422,'DOADOR_INCOMPATIVEL','Doador não corresponde ao agendamento.');donor=a.id_doador;}
  const id=(await tx.query('INSERT INTO arrecadacao.recebimentos(chave_operacao,id_doador,id_agendamento,ocorrido_em,registrado_por) VALUES($1,$2,$3,$4,$5) RETURNING id_recebimento::text',[key,donor,b.id_agendamento,b.ocorrido_em,u])).rows[0].id_recebimento;
  for(const i of b.itens)await tx.query('INSERT INTO arrecadacao.itens_recebimento(id_recebimento,id_item,id_necessidade,quantidade_recebida) VALUES($1,$2,$3,$4)',[id,i.id_item,i.id_necessidade,i.quantidade_recebida]);
  await tx.query("UPDATE arrecadacao.recebimentos SET status='Confirmado',confirmado_por=$1 WHERE id_recebimento=$2",[u,id]);
  await tx.query('UPDATE api_apoio.requisicoes_recebimento SET id_recebimento=$1 WHERE chave=$2',[id,key]);
  return this.donation(id,tx);
 }
 async lockCurrentNeeds(tx,ids){
  // READ COMMITTED: separar a descoberta da trava permite reler após uma renovação.
  // WHERE apenas pelo ID na trava: uma meta encerrada durante a espera não pode sumir.
  for(let attempt=0;attempt<5;attempt++){
   const candidates=(await tx.query("SELECT id_item,id_necessidade::text FROM arrecadacao.necessidades WHERE id_item=ANY($1::int[]) AND status='Aberta' ORDER BY necessidades.id_necessidade",[ids])).rows;
   if(!candidates.length)return[];
   const locked=(await tx.query('SELECT id_item,id_necessidade::text,status FROM arrecadacao.necessidades WHERE id_necessidade=ANY($1::bigint[]) ORDER BY necessidades.id_necessidade FOR UPDATE',[candidates.map(n=>n.id_necessidade)])).rows;
   if(locked.length===candidates.length&&locked.every(n=>n.status==='Aberta'))return locked;
  }
  fail(409,'META_EM_ALTERACAO','As metas estão sendo alteradas. Tente novamente com a mesma chave; nenhum recebimento desta tentativa foi gravado.');
 }
 async receiveAndConclude(id,b,key,u,now=new Date()){
  // O hash inclui rota, agendamento e corpo; não pode ser reutilizado em POST /doacoes.
  const hash=SEC.hash(JSON.stringify({operacao:'receber-e-concluir',id,...b}));
  return this.db.transaction(async tx=>{
   const saved=await this.claimReceipt(tx,key,hash,u);
   const a=(await tx.query('SELECT status_agendamento FROM public.agendamentos WHERE id_agendamento=$1 FOR UPDATE',[id])).rows[0];
   if(!a)fail(404,'NAO_ENCONTRADO','Agendamento não encontrado.');
   if(saved.id_recebimento||a.status_agendamento==='Concluído')return{
    agendamento:await this.booking(id,null,tx,true),
    doacao:saved.id_recebimento?await this.donation(String(saved.id_recebimento),tx):null,repetido:true};
   if(!['Pendente','Confirmado'].includes(a.status_agendamento))fail(409,'STATUS_INVALIDO','Agendamento cancelado.');
   const booking=await this.booking(id,null,tx,true);
   const pending=booking.itens.filter(i=>i.status_item==='Agendado');
   const selected=b.itens??pending.map(i=>({id_item:i.id_item,quantidade_recebida:Math.max(0,i.quantidade_doada-i.quantidade_recebida)}));
   const quantities=[];
   for(const i of selected){
    const item=pending.find(p=>p.id_item===i.id_item);
    if(!item)fail(422,'ITEM_NAO_AGENDADO','O item não está pendente neste agendamento.');
    if(i.quantidade_recebida>Math.max(0,item.quantidade_doada-item.quantidade_recebida))fail(422,'QUANTIDADE_EXCEDENTE','Informe no máximo o que falta da promessa. Registre o excedente como doação avulsa.');
    if(i.quantidade_recebida>0)quantities.push(i);
   }
   let doacao=null;
   if(quantities.length){
    const ids=quantities.map(i=>i.id_item).sort((a,b)=>a-b);
    const products=(await tx.query('SELECT id_item,nome_item,ativo FROM public.itens_necessidades WHERE id_item=ANY($1::int[]) ORDER BY id_item FOR SHARE',[ids])).rows;
    for(const idItem of ids){const product=products.find(p=>p.id_item===idItem);if(!product?.ativo)fail(409,'PRODUTO_INATIVO',`O produto ${product?.nome_item||idItem} foi desativado. Revise o agendamento pelo fluxo detalhado.`);}
    const needs=await this.lockCurrentNeeds(tx,ids);
    const receipt={id_agendamento:id,id_doador:null,ocorrido_em:now.toISOString(),itens:quantities.map(i=>({...i,id_necessidade:needs.find(n=>n.id_item===i.id_item)?.id_necessidade??null}))};
    doacao=await this.receiveInTransaction(tx,receipt,key,u);
   }
   // Uma falha na conclusão desfaz também recebimento, totais e chave de idempotência.
   return{agendamento:await this.concludeInTransaction(tx,id,u,b.motivo_pendencias),doacao,repetido:false};
  });
 }
 async donation(id,tx=this.db){const r=(await tx.query('SELECT id_recebimento::text,id_recebimento::text AS id_doacao,chave_operacao,id_doador,id_agendamento,ocorrido_em,status,registrado_por,confirmado_por,estornado_por,motivo_estorno FROM arrecadacao.recebimentos WHERE id_recebimento=$1',[id])).rows[0];if(!r)fail(404,'NAO_ENCONTRADO','Recebimento não encontrado.');r.itens=(await tx.query('SELECT id_item,id_necessidade::text,quantidade_recebida,nome_item_registrado,unidade_registrada FROM arrecadacao.itens_recebimento WHERE id_recebimento=$1 ORDER BY id_item',[id])).rows;return r;}
 async donations(f){return Promise.all((await this.db.query('SELECT r.id_recebimento::text FROM arrecadacao.recebimentos r ORDER BY r.ocorrido_em DESC,r.id_recebimento DESC LIMIT $1 OFFSET $2',[f.limit,f.offset])).rows.map(r=>this.donation(r.id_recebimento)));}
 async reverse(id,u,reason){return this.db.transaction(async tx=>{const r=(await tx.query('SELECT status,motivo_estorno FROM arrecadacao.recebimentos WHERE id_recebimento=$1 FOR UPDATE',[id])).rows[0];if(!r)fail(404,'NAO_ENCONTRADO','Recebimento não encontrado.');if(r.status==='Estornado'){if(r.motivo_estorno!==reason)fail(409,'ESTORNO_DEFINITIVO','Estorno registrado com outro motivo.');return this.donation(id,tx);}if(r.status!=='Confirmado')fail(409,'STATUS_INVALIDO','Somente entregas confirmadas podem ser estornadas.');await tx.query("UPDATE arrecadacao.recebimentos SET status='Estornado',estornado_por=$1,motivo_estorno=$2 WHERE id_recebimento=$3",[u,reason,id]);return this.donation(id,tx);});}
 async conclude(id,u,reason){return this.db.transaction(tx=>this.concludeInTransaction(tx,id,u,reason));}
 async concludeInTransaction(tx,id,u,reason){
  const a=(await tx.query('SELECT status_agendamento FROM public.agendamentos WHERE id_agendamento=$1 FOR UPDATE',[id])).rows[0];if(!a)fail(404,'NAO_ENCONTRADO','Agendamento não encontrado.');if(a.status_agendamento==='Concluído')return this.booking(id,null,tx,true);if(!['Pendente','Confirmado'].includes(a.status_agendamento))fail(409,'STATUS_INVALIDO','Agendamento cancelado.');
  const rows=(await tx.query(`SELECT ia.id_item,ia.quantidade_doada,ia.status_item,COALESCE(sum(ir.quantidade_recebida) FILTER(WHERE r.status='Confirmado'),0)::text AS recebido FROM public.itens_agendamento ia LEFT JOIN arrecadacao.recebimentos r ON r.id_agendamento=ia.id_agendamento LEFT JOIN arrecadacao.itens_recebimento ir ON ir.id_recebimento=r.id_recebimento AND ir.id_item=ia.id_item WHERE ia.id_agendamento=$1 GROUP BY ia.id_item,ia.quantidade_doada,ia.status_item ORDER BY ia.id_item`,[id])).rows;
  if(!rows.length)fail(409,'SEM_ITENS','Agendamento sem itens.');if(rows.some(i=>i.status_item==='Agendado'&&BigInt(i.recebido)<BigInt(i.quantidade_doada))&&!reason)fail(409,'ENTREGA_PARCIAL','Informe motivo_pendencias para concluir com itens faltantes.');
  for(const i of rows)await tx.query('UPDATE public.itens_agendamento SET status_item=$1 WHERE id_agendamento=$2 AND id_item=$3',[BigInt(i.recebido)>=BigInt(i.quantidade_doada)?'Entregue':'Cancelado',id,i.id_item]);await tx.query("UPDATE public.agendamentos SET status_agendamento='Concluído',observacoes=concat_ws(E'\\n',observacoes,$1::text) WHERE id_agendamento=$2",[`Conclusão pela ONG #${u}${reason?': '+reason:''}`,id]);return this.booking(id,null,tx,true);
 }
}
module.exports={Store};
