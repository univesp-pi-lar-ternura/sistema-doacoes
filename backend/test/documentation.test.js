const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createApp}=require('../src/app');
const spec=require('../../docs/api/openapi.json');
const collection=require('../../docs/api/lar-ternura-api-2.1.postman_collection.json');
test('Swagger é servido localmente com contrato 2.1 e assets sem CDN',async()=>{
 const server=createApp({store:{},config:{origins:[]}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const html=await fetch(base+'/docs/');assert.equal(html.status,200);const page=await html.text();assert.ok(page.includes('swagger-ui-bundle.js'));assert.ok(!page.includes('https://'));
  const css=await fetch(base+'/docs/assets/swagger-ui.css');assert.equal(css.status,200);assert.ok((await css.text()).length>10000);
  const js=await fetch(base+'/docs/assets/swagger-ui-bundle.js');assert.equal(js.status,200);assert.ok((await js.text()).length>100000);
  const init=await (await fetch(base+'/docs/init.js')).text();assert.ok(init.includes('validatorUrl:null'));assert.ok(init.includes('persistAuthorization:false'));
  const response=await fetch(base+'/openapi.json');assert.equal(response.status,200);assert.deepEqual(await response.json(),spec);
  assert.equal((await fetch(base+'/docs/assets/package.json')).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('OpenAPI possui referências resolvidas e descreve as operações E1',()=>{
 assert.equal(spec.info.version,'2.1.0');
 function walk(value){if(!value||typeof value!=='object')return;if(value.$ref){let target=spec;for(const key of value.$ref.split('/').slice(1))target=target?.[key];assert.ok(target,value.$ref);}for(const v of Object.values(value))walk(v);}
 walk(spec);
 const listing=spec.paths['/admin/agendamentos'].get;
 assert.ok(listing.parameters.some(p=>p.name==='q'));assert.equal(listing.parameters.find(p=>p.name==='status').explode,false);
 assert.ok(spec.paths['/admin/agendamentos/{id}/receber-e-concluir'].post.security.length);
 assert.ok(spec.components.schemas.Agendamento.properties.itens.items.properties.quantidade_recebida);
});
test('Postman cobre todas as operações e não contém credenciais ou tokens reais',()=>{
 const requests=collection.item.flatMap(g=>g.item);
 const operations=Object.entries(spec.paths).flatMap(([path,ops])=>Object.keys(ops).map(method=>({path,method:method.toUpperCase()})));
 assert.equal(requests.length,operations.length);
 for(const {path,method} of operations){const url='{{base_url}}'+path.replace(/\{([^}]+)\}/g,'{{$1}}');assert.ok(requests.some(r=>r.request.method===method&&r.request.url.raw===url),method+' '+path);}
 for(const variable of collection.variable.filter(v=>/senha|token|email/.test(v.key)))assert.equal(variable.value,'');
 const generator=readFileSync(join(__dirname,'../scripts/build-postman.js'),'utf8');assert.ok(generator.includes('sem executar requisições'));
});
