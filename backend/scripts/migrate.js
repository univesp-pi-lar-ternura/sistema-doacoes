require('dotenv').config({quiet:true});
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createDatabase}=require('../src/db');
async function main() {
  if(!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
  const db=createDatabase(process.env.DATABASE_URL);
  try {await db.query(readFileSync(join(__dirname,'../migrations/002_compatibilidade_vinicius.sql'),'utf8'));console.log('Migração aplicada sem apagar dados.');}
  finally {await db.close();}
}
main().catch(err=>{console.error('Migração falhou:',err.code==='LT001' ? err.message+'\n'+err.detail : err.code||err.message);process.exitCode=1;});
