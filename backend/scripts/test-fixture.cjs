// Somente testes locais. Nunca usa DATABASE_URL nem executa SQL em Neon.
const {PGlite}=require('@electric-sql/pglite');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const root=join(__dirname,'../..');
const original=readFileSync(join(root,'banco-vinicius/00_RECRIAR_BANCO_COMPLETO.sql'),'utf8');
// O Git pode converter CRLF/LF no checkout; conferir o conteúdo normalizado, sem alterar o SQL.
if(createHash('sha256').update(original.replace(/\r\n/g,'\n')).digest('hex')!=='771b9ebf60db92a34947d3c09bc39d4ef387698dac16b782e827c4ae0a989e04')throw Error('SQL original não confere com o PDF.');
const ddl=original.replace("banco_alvo text := 'neondb'","banco_alvo text := current_database()");
const migration=readFileSync(join(root,'backend/migrations/002_compatibilidade_vinicius.sql'),'utf8');
async function fixture(){const pg=new PGlite();await pg.waitReady;return{pg,db:{query:(sql,p)=>pg.query(sql,p),transaction:fn=>pg.transaction(tx=>fn({query:(sql,p)=>tx.query(sql,p)}))}};}
async function reset(pg){await pg.exec('DROP SCHEMA IF EXISTS api_apoio CASCADE');await pg.exec(ddl);await pg.exec(migration);}
module.exports={fixture,reset,ddl,migration,root};
