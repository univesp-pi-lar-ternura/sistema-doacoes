const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const folder=join(__dirname,'../schema');
const template=readFileSync(join(folder,'validator-template.sql'),'utf8');
const contract=JSON.parse(readFileSync(join(folder,'contract.json'),'utf8'));
function validationSql(allowMissing=false){
 return template.replace('__ALLOW_MISSING__',allowMissing?'true':'false')
  .replace('__CONTRACT__',JSON.stringify(contract).replaceAll("'","''"));
}
async function assertSchema(db){await db.query(validationSql(false));}
module.exports={validationSql,assertSchema};
