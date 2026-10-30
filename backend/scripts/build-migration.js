// Gera SQL autocontido; não conecta a banco e não executa a migração.
const {readFileSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const {validationSql}=require('../src/schema');
const root=join(__dirname,'..');
const start=readFileSync(join(root,'schema/base-check.sql'),'utf8');
const ddl=readFileSync(join(root,'schema/complemento.sql'),'utf8');
const sql=start+'\n-- Antes de qualquer DDL: recusar objetos existentes divergentes.\n'+validationSql(true)
 +'\n'+ddl+'\n-- Depois do DDL: exigir todas as garantias instaladas.\n'+validationSql(false)+'\nCOMMIT;\n';
writeFileSync(join(root,'migrations/002_compatibilidade_vinicius.sql'),sql);
console.log('Migração gerada, sem execução no banco.');
