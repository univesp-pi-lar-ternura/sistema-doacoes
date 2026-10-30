const express=require('express');
const {join}=require('node:path');
const specification=require('../../docs/api/openapi.json');
function installDocumentation(app){
 const assets=require('swagger-ui-dist').absolutePath();
 app.get('/openapi.json',(req,res)=>res.json(specification));
 app.get('/docs/',(req,res)=>res.type('html').send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lar Ternura — API 2.1</title><link rel="stylesheet" href="/docs/assets/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="/docs/assets/swagger-ui-bundle.js"></script><script src="/docs/init.js"></script></body></html>`));
 app.get('/docs/init.js',(req,res)=>res.type('application/javascript').send(`window.ui=SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',deepLinking:true,validatorUrl:null,persistAuthorization:false});`));
 // Somente os dois arquivos usados pela página; sem dependência de CDN ou validador externo.
 for(const file of ['swagger-ui.css','swagger-ui-bundle.js'])app.get('/docs/assets/'+file,(req,res)=>res.sendFile(join(assets,file)));
}
module.exports={installDocumentation};
