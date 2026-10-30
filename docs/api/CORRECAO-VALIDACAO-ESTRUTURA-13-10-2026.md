# Tarefa 8 — correção após revisão de Vinicius

Preparada em 13/10/2026 para atualizar o PR #28, na branch `feature/anderson-tarefa-08-api`, com destino a `develop`.

## Problema e resultado

A migração usava `CREATE TABLE IF NOT EXISTS`, que preservava uma tabela de apoio já existente mesmo quando sua estrutura não atendia à API. O `/ready` consultava poucas colunas e podia indicar sucesso nesse cenário.

Agora a migração confere os objetos existentes antes do DDL e repete a conferência completa antes do commit. Estrutura incompatível gera erro `LT001` com diagnóstico no comando de manutenção. O erro interrompe a migração; nenhuma tentativa de apagar dados ou corrigir tabelas automaticamente é feita. Objetos ausentes na primeira instalação podem ser criados, mas precisam passar na conferência final.

O `/ready` usa o mesmo contrato e validador em cada consulta. Incompatibilidade retorna HTTP 503, código `ESTRUTURA_INCOMPATIVEL`, com mensagem pública sem detalhes internos. A inicialização do servidor já chama essa verificação antes de abrir a porta. `/health` continua verificando apenas se o processo responde.

## Escopo da conferência

As cinco tabelas de `api_apoio` são conferidas quanto a presença, natureza persistente, colunas, tipos e tamanhos, nulabilidade, defaults/geração, chaves primárias, FKs e unicidade exigidas. FKs devem estar validadas, sem adiamento, com ações compatíveis; os índices obrigatórios devem estar válidos e não podem ser parciais. Em `public.agendamentos`, a conferência se limita ao campo e à unicidade do token adicionados pela API. As verificações anteriores do modelo de negócio permanecem na migração.

O contrato está em `backend/schema/contract.json` e o validador em `backend/schema/validator-template.sql`. `node scripts/build-migration.js` gera a migração SQL autocontida, sem conexão ao banco. Ao alterar o contrato/validador, regenerar o SQL antes de testar e entregar. Um teste verifica que o SQL distribuído usa o mesmo validador do `/ready`.

Não é uma auditoria completa do esquema de negócio, das permissões de produção ou de todas as customizações possíveis do PostgreSQL. O complemento não modifica as regras de arrecadação entregues por Vinicius.

## Validação local

Foram mantidos os 31 testes anteriores e acrescentados 20 casos de regressão. Incluem coluna/tamanho/tipo incorretos, nulabilidade, coluna extra, default, timestamp sem fuso, PK/FK ausentes, FK em cascata/não validada/adiada, índice parcial, view no lugar de tabela e token incompatível. Também verificam primeira instalação, rollback, preservação de dados e resposta HTTP 503 sem detalhes internos. Resultado integral em `RESULTADO-TESTES-LOCAIS.txt`.

Todos os testes usam PGlite descartável. Não usam `DATABASE_URL` de produção. O teste anterior da role limitada e as 25 verificações SQL originais do Vinicius continuam na suíte. A integração real com Neon em ambiente separado será validada pela equipe; a divisão dos testes com Viviane permanece preservada.

## Como atualizar o mesmo PR

1. No GitHub Desktop, selecionar `sistema-doacoes` e a branch `feature/anderson-tarefa-08-api`.
2. Extrair o ZIP de correção. Copiar as pastas `backend` e `docs` para a raiz da cópia local do repositório, permitindo substituir os arquivos de mesmo nome. Preservar os demais arquivos, inclusive `banco-vinicius`. Copiar também todos os arquivos novos da pasta `backend/schema`.
3. Conferir as alterações e, na pasta backend, executar `pnpm test` após instalar dependências se necessário.
4. Fazer commit com a mensagem `Corrige validação da estrutura da migração e do ready` e clicar em `Push origin`. O PR #28 será atualizado pela mesma branch.

Não criar um novo PR nem aplicar migrações no Neon nesse procedimento. Esta preparação salvou os arquivos da correção no Drive; não publicou commits, comentários ou alterações no GitHub.
