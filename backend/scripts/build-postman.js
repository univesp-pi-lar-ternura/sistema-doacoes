// Exporta a coleção a partir do OpenAPI versionado; não realiza requisições.
const {readFileSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const spec=JSON.parse(readFileSync(join(__dirname,'../../docs/api/openapi.json'),'utf8'));
function sample(schema,name=''){
 if(schema.$ref)return sample(spec.components.schemas[schema.$ref.split('/').pop()],name);
 if(schema.example!==undefined)return schema.example;
 if(schema.enum)return schema.enum[0];
 if(schema.type==='object')return Object.fromEntries((schema.required??Object.keys(schema.properties??{})).map(k=>[k,sample(schema.properties[k],k)]));
 if(schema.type==='array')return[sample(schema.items,name)];
 if(schema.type==='integer'||schema.type==='number')return schema.minimum??1;
 if(schema.type==='boolean')return false;
 if(name==='email')return'{{ong_email}}';if(name==='senha')return'{{ong_senha}}';
 if(name==='id_necessidade')return'{{id_necessidade}}';
 if(name==='telefone')return'11999999999';if(name==='nome')return'Pessoa fictícia';
 if(name==='horario')return'{{horario}}';if(name==='data')return'{{data_agendamento}}';
 if(name==='ocorrido_em')return'{{ocorrido_em}}';
 if(name.startsWith('motivo'))return'Justificativa registrada pela equipe';
 return'exemplo';
}
const groups=new Map();
for(const [path,operations] of Object.entries(spec.paths))for(const [method,op] of Object.entries(operations)){
 const tag=op.tags?.[0]??'API';if(!groups.has(tag))groups.set(tag,[]);
 const parameters=op.parameters??[];
 const urlPath=path.replace(/\{([^}]+)\}/g,(_,key)=>`{{${key}}}`);
 const request={method:method.toUpperCase(),description:op.description??op.summary,header:[],url:{raw:'{{base_url}}'+urlPath,host:['{{base_url}}'],path:urlPath.slice(1).split('/')}};
 const query=parameters.filter(p=>p.in==='query').map(p=>({key:p.name,value:p.name==='status'?'Pendente,Confirmado':p.name==='q'?'Maria':p.name==='mes'?'{{mes}}':p.name==='data'?'{{data_agendamento}}':p.name==='de'?'{{periodo_de}}':p.name==='ate'?'{{periodo_ate}}':String(p.schema?.default??''),disabled:true}));
 if(query.length)request.url.query=query;
 if(op.security?.length){const session=Object.keys(op.security[0])[0];request.auth={type:'bearer',bearer:[{key:'token',value:session==='SessaoONG'?'{{ong_token}}':'{{token_agendamento}}',type:'string'}]};}
 const events=[];
 if(parameters.some(p=>p.name==='Idempotency-Key')){
  const variable='chave_'+op.operationId;
  request.header.push({key:'Idempotency-Key',value:'{{'+variable+'}}'});
  events.push({listen:'prerequest',script:{type:'text/javascript',exec:[`if (!pm.collectionVariables.get('${variable}')) pm.collectionVariables.set('${variable}', pm.variables.replaceIn('{{$guid}}'));`]}});
 }
 const bodySchema=op.requestBody?.content?.['application/json']?.schema;
 if(bodySchema){
  let body=sample(bodySchema);
  if(path.endsWith('/receber-e-concluir'))body={};
  if(path==='/agendamentos')body={doador:{nome:'Pessoa fictícia',email:'doador@example.test',telefone:'11999999999',tipo_doador:'PF'},data:'{{data_agendamento}}',horario:'{{horario}}',itens:[{id_item:1,id_necessidade:'{{id_necessidade}}',quantidade_doada:2}]};
  request.header.push({key:'Content-Type',value:'application/json'});request.body={mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}};
 }
 if(path==='/auth/login')events.push({listen:'test',script:{type:'text/javascript',exec:["if (pm.response.code === 200) pm.collectionVariables.set('ong_token', pm.response.json().token);"]}});
 if(path==='/agendamentos')events.push({listen:'test',script:{type:'text/javascript',exec:["if ([200,201].includes(pm.response.code)) { const b=pm.response.json(); pm.collectionVariables.set('id', String(b.agendamento.id_agendamento)); pm.collectionVariables.set('token_agendamento', b.token_acesso); }"]}});
 groups.get(tag).push({name:request.method+' '+path+' — '+op.summary,request,...(events.length?{event:events}:{})});
}
const variables={base_url:'http://127.0.0.1:3000',ong_email:'',ong_senha:'',ong_token:'',token_agendamento:'',id:'1',ano:'2026',mes:'2026-10',id_necessidade:'1',data_agendamento:'',periodo_de:'',periodo_ate:'',horario:'14:00',ocorrido_em:''};
const collection={info:{name:'Lar Ternura — API '+spec.info.version,schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:'Coleção gerada do OpenAPI. Use somente ambiente autorizado. Configure data/IDs retornados pela API e credenciais privadas. Chaves de idempotência são geradas uma vez por operação e mantidas para retry: apague a variável chave_* ao iniciar outra operação. Não execute Run collection indiscriminadamente: há rotas de escrita. O token do agendamento é diferente da sessão ONG.'},variable:Object.entries(variables).map(([key,value])=>({key,value,type:'string'})),item:[...groups].map(([name,item])=>({name,item}))};
writeFileSync(join(__dirname,'../../docs/api/lar-ternura-api-2.1.postman_collection.json'),JSON.stringify(collection,null,2)+'\n');
console.log('Coleção Postman exportada, sem executar requisições.');
