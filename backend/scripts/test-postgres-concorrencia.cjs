// Cria um cluster PostgreSQL local descartável. Nunca usa DATABASE_URL.
const {mkdtempSync,writeFileSync,unlinkSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {randomBytes}=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const net=require('node:net');
const {Client}=require('pg');
async function main(){
 if(!process.env.PG_BIN)throw Error('Informe PG_BIN com a pasta bin de uma instalação PostgreSQL 15+ local. Não use conexão Neon.');
 const bin=resolve(process.env.PG_BIN),ext=process.platform==='win32'?'.exe':'';
 const work=mkdtempSync(join(tmpdir(),'lt-pg-concorrencia-')),data=join(work,'data'),log=join(work,'postgres.log'),pwfile=join(work,'pw');
 const password=randomBytes(24).toString('hex');writeFileSync(pwfile,password,{mode:0o600});
 const pgctl=join(bin,'pg_ctl'+ext);let started=false,initialized=false;
 const command=(name,args)=>execFileSync(join(bin,name+ext),args,{windowsHide:true,stdio:'ignore',timeout:60000});
 try{
  command('initdb',['-D',data,'-U','lt_qa_owner','--encoding=UTF8','--locale=C','--auth=scram-sha-256','--pwfile='+pwfile]);initialized=true;unlinkSync(pwfile);
  const probe=net.createServer();await new Promise((r,j)=>probe.once('error',j).listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  command('pg_ctl',['-D',data,'-l',log,'-o',`-h 127.0.0.1 -p ${port} -c max_connections=10 -c fsync=off`,'-w','start']);started=true;
  const db='lt_concorrencia_'+randomBytes(5).toString('hex');
  const owner=new Client({host:'127.0.0.1',port,user:'lt_qa_owner',password,database:'postgres'});await owner.connect();
  try{await owner.query('CREATE DATABASE '+db);console.log('PostgreSQL local:',(await owner.query('SHOW server_version')).rows[0].server_version);}finally{await owner.end();}
  const reference=process.argv.indexOf('--reference');
  const env={...process.env,TEST_PG_URL:`postgresql://lt_qa_owner:${password}@127.0.0.1:${port}/${db}`,TEST_PG_ALLOW_RESET:'SIM_BANCO_DESCARTAVEL'};
  if(reference>=0)env.TEST_PG_STORE_MODULE=resolve(process.argv[reference+1]);else delete env.TEST_PG_STORE_MODULE;
  const args=['--test'];if(reference>=0)args.push('--test-name-pattern=renovação ganha');
  args.push(join(__dirname,'../test/postgres/concorrencia.test.cjs'));
  const result=spawnSync(process.execPath,args,{env,stdio:'inherit',windowsHide:true,timeout:180000});
  if(result.error)throw result.error;process.exitCode=result.status??1;
 }finally{
  if(initialized){
   try{execFileSync(pgctl,['-D',data,'-m','fast','-w','stop'],{windowsHide:true,stdio:'ignore',timeout:30000});console.log('Cluster de teste encerrado. Sem serviço instalado.');}
   catch(error){if(started)throw error;}
  }
 }
}
main().catch(error=>{console.error('Validação local falhou:',error.message);process.exitCode=1;});
