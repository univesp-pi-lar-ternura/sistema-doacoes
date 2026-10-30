const {Pool}=require('pg');
function createDatabase(connectionString) {
  const pool=new Pool({connectionString,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
  pool.on('error',err=>console.error('Conexão ociosa do banco falhou:',err.code||'DB_ERROR'));
  return {
    query:(sql,params)=>pool.query(sql,params),
    async transaction(fn) {
      const client=await pool.connect();
      try {await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
      catch(err) {await client.query('ROLLBACK');throw err;}
      finally {client.release();}
    },
    close:()=>pool.end()
  };
}
module.exports={createDatabase};
