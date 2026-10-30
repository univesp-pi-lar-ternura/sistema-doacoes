require('dotenv').config({quiet:true});
const {createDatabase}=require('../src/db');
const {hashPassword}=require('../src/security');
const V=require('../src/validation');
async function main() {
  if(!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
  const nome=V.string(process.env.ADMIN_NAME,'ADMIN_NAME',100,2),email=V.email(process.env.ADMIN_EMAIL);
  const senha=V.string(process.env.ADMIN_PASSWORD,'ADMIN_PASSWORD',128,12);
  const db=createDatabase(process.env.DATABASE_URL);
  try {await db.query('INSERT INTO usuarios_ong(nome,email,senha_hash) VALUES($1,$2,$3)',[nome,email,await hashPassword(senha)]);console.log('Administrador criado. Remova ADMIN_PASSWORD do ambiente após o cadastro.');}
  finally {await db.close();}
}
main().catch(err=>{console.error('Cadastro falhou:',err.code||err.message);process.exitCode=1;});
