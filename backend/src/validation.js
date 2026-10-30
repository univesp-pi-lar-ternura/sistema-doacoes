const {fail}=require('./errors');
const MAX_INT=2147483647;
function object(v,allowed) {
  if(!v || typeof v!=='object' || Array.isArray(v)) fail(422,'VALIDACAO','Envie um objeto JSON.');
  if(Object.keys(v).some(k=>!allowed.includes(k))) fail(422,'VALIDACAO','Há campos não permitidos na requisição.');
  return v;
}
function string(v,label,max,min=1) {
  if(typeof v!=='string' || v.trim().length<min || v.trim().length>max) fail(422,'VALIDACAO',label+': tamanho inválido.');
  return v.trim();
}
function integer(v,label,min=1,max=MAX_INT) {
  if(!Number.isInteger(v) || v<min || v>max) fail(422,'VALIDACAO',label+': informe um inteiro de '+min+' a '+max+'.');
  return v;
}
function id(v) {
  if(typeof v!=='string' || !/^[1-9]\d*$/.test(v)) fail(422,'VALIDACAO','Identificador inválido.');
  return integer(Number(v),'Identificador');
}
function email(v) {
  const out=string(v,'E-mail',100).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out)) fail(422,'VALIDACAO','E-mail inválido.');
  return out;
}
function date(v,optional=false) {
  if(optional && (v===null || v===undefined || v==='')) return null;
  if(typeof v!=='string' || !/^20\d{2}-\d{2}-\d{2}$/.test(v)) fail(422,'VALIDACAO','Data inválida. Use AAAA-MM-DD, entre 2000 e 2099.');
  const d=new Date(v+'T12:00:00Z');
  if(Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==v) fail(422,'VALIDACAO','Data inexistente.');
  return v;
}
function localTime(now) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return values.year+'-'+values.month+'-'+values.day+' '+values.hour+':'+values.minute+':'+values.second;
}
function slotInput(body) {
  const day=date(body.data),time=body.horario;
  if(typeof time!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(422,'HORARIO_INVALIDO','Informe um horário válido no formato HH:MM.');
  return day+' '+time+':00';
}
function validateSlot(out,config,now=new Date()) {
  if(!config.times.includes(out.slice(11,16))) fail(422,'HORARIO_INVALIDO','Escolha um horário de entrega disponível.');
  if(out<=localTime(now)) fail(422,'DATA_PASSADA','Escolha uma data e um horário futuros.');
  return out;
}
function slot(body,config,now=new Date()) {
  return validateSlot(slotInput(body),config,now);
}
function donor(v) {
  object(v,['nome','email','telefone','tipo_doador']);
  const telefone=string(v.telefone,'Telefone',20);
  if(!/^\+?[\d\s().-]{8,20}$/.test(telefone) || telefone.replace(/\D/g,'').length<8) fail(422,'VALIDACAO','Telefone inválido.');
  const tipo_doador=v.tipo_doador??'PF';
  if(!['PF','PJ'].includes(tipo_doador))fail(422,'VALIDACAO','Tipo de doador deve ser PF ou PJ.');
  return {nome:string(v.nome,'Nome',100,2),email:email(v.email),telefone,tipo_doador};
}
function booking(v) {
  object(v,['doador','data','horario','itens']);
  if(!Array.isArray(v.itens)||v.itens.length<1||v.itens.length>100) fail(422,'VALIDACAO','Selecione de 1 a 100 itens.');
  const seen=new Set();
  const itens=v.itens.map(i=>{
    object(i,['id_item','id_necessidade','quantidade_doada']);
    const id_item=integer(i.id_item,'Item');
    if(seen.has(id_item)) fail(422,'VALIDACAO','O mesmo item não pode aparecer duas vezes.');
    seen.add(id_item);return {id_item,id_necessidade:bigId(i.id_necessidade),quantidade_doada:integer(i.quantidade_doada,'Quantidade')};
  }).sort((a,b)=>a.id_item-b.id_item);
  return {doador:donor(v.doador),data_hora_agendada:slotInput(v),itens};
}
function item(v) {
 object(v,['nome_item','unidade_medida','categoria_suprimento','id_categoria']);
 return {nome_item:string(v.nome_item,'Nome do item',120,2),unidade_medida:string(v.unidade_medida,'Unidade',20),
 categoria_suprimento:string(v.categoria_suprimento,'Categoria de suprimento',50),id_categoria:integer(v.id_categoria,'Categoria')};
}
function bigId(v){
 if(typeof v!=='string'||!/^([1-9]\d{0,18})$/.test(v)||BigInt(v)>9223372036854775807n)fail(422,'VALIDACAO','ID bigint deve ser uma string decimal positiva.');return v;
}
function need(v,renew=false){object(v,renew?['id_categoria','quantidade_meta']:['id_item','id_categoria','quantidade_meta']);
 return {...(renew?{}:{id_item:integer(v.id_item,'Item')}),id_categoria:integer(v.id_categoria,'Categoria'),quantidade_meta:integer(v.quantidade_meta,'Meta')};}
function receipt(v){
 object(v,['id_agendamento','id_doador','ocorrido_em','itens']);
 if(typeof v.ocorrido_em!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v.ocorrido_em)||!Number.isFinite(Date.parse(v.ocorrido_em)))fail(422,'VALIDACAO','Informe ocorrido_em com data, hora e fuso.');
 date(v.ocorrido_em.slice(0,10));
 if(new Date(v.ocorrido_em)>new Date())fail(422,'VALIDACAO','Entrega deve ter ocorrido.');
 if(!Array.isArray(v.itens)||v.itens.length<1||v.itens.length>100)fail(422,'VALIDACAO','Recebimento exige de 1 a 100 itens.');
 const seen=new Set();const itens=v.itens.map(i=>{object(i,['id_item','id_necessidade','quantidade_recebida']);const id_item=integer(i.id_item,'Item');if(seen.has(id_item))fail(422,'VALIDACAO','Produto repetido.');seen.add(id_item);return{id_item,id_necessidade:i.id_necessidade===null?null:bigId(i.id_necessidade),quantidade_recebida:integer(i.quantidade_recebida,'Quantidade recebida')};}).sort((a,b)=>a.id_item-b.id_item);
 return{id_agendamento:v.id_agendamento==null?null:integer(v.id_agendamento,'Agendamento'),id_doador:v.id_doador==null?null:integer(v.id_doador,'Doador'),ocorrido_em:new Date(v.ocorrido_em).toISOString(),itens};
}
function uuid(v){if(typeof v!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i).test(v))fail(422,'CHAVE_OBRIGATORIA','Envie Idempotency-Key como UUID.');return v.toLowerCase();}
function bookingFilters(q){
 const data=q.data===undefined?null:date(q.data);
 const de=q.de===undefined?null:date(q.de),ate=q.ate===undefined?null:date(q.ate);
 if(de!==null&&ate!==null&&de>ate)fail(422,'VALIDACAO','O início do período não pode ser maior que o fim.');
 let statuses=null;
 if(q.status!==undefined){
  if(typeof q.status!=='string')fail(422,'VALIDACAO','Status inválido.');
  statuses=q.status.split(',').map(s=>s.trim());
  if(statuses.length>4||statuses.some(s=>!['Pendente','Confirmado','Concluído','Cancelado'].includes(s)))fail(422,'VALIDACAO','Status inválido.');
  statuses=[...new Set(statuses)];
 }
 return{...pagination(q),data,de,ate,statuses,q:q.q===undefined?null:string(q.q,'Busca',100)};
}
function receiveCompletion(v){
 object(v,['itens','motivo_pendencias']);
 const motivo_pendencias=v.motivo_pendencias===undefined?null:string(v.motivo_pendencias,'Motivo das pendências',500);
 if(v.itens===undefined)return{motivo_pendencias};
 if(!Array.isArray(v.itens)||v.itens.length>100)fail(422,'VALIDACAO','Informe até 100 itens.');
 const seen=new Set();
 const itens=v.itens.map(i=>{object(i,['id_item','quantidade_recebida']);const id_item=integer(i.id_item,'Item');
  if(seen.has(id_item))fail(422,'VALIDACAO','Produto repetido.');seen.add(id_item);
  return{id_item,quantidade_recebida:integer(i.quantidade_recebida,'Quantidade recebida',0)};
 }).sort((a,b)=>a.id_item-b.id_item);
 return{itens,motivo_pendencias};
}
function pagination(q) {
  for(const k of ['limit','offset']) if(q[k]!==undefined && (typeof q[k]!=='string'||!/^\d+$/.test(q[k]))) fail(422,'VALIDACAO','Paginação inválida.');
  return {limit:integer(Number(q.limit??50),'Limite',1,100),offset:integer(Number(q.offset??0),'Deslocamento',0,1000000)};
}
module.exports={bookingFilters,receiveCompletion,object,string,integer,id,bigId,need,receipt,uuid,email,date,localTime,slot,validateSlot,booking,item,pagination};
