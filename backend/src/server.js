require('dotenv').config({ quiet:true });
const { loadConfig }=require('./config');
const { createDatabase }=require('./db');
const { Store }=require('./store');
const { createApp }=require('./app');
async function start() {
  const config=loadConfig();const db=createDatabase(config.databaseUrl);
  const store=new Store(db,config);
  try { await store.ready(); } catch(error) { await db.close(); throw error; }
  const app=createApp({ store,config });
  const server=app.listen(config.port,'0.0.0.0',()=>console.log(`API rodando na porta ${config.port}`));
  let closing=false;
  const close=()=> {
    if (closing) return;closing=true;
    const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
    server.close(async()=> { await db.close();clearTimeout(timer);process.exit(0); });
  };
  process.on('SIGTERM',close);process.on('SIGINT',close);
}
start().catch(err=> { console.error('Não foi possível iniciar a API:',err.message);process.exitCode=1; });
