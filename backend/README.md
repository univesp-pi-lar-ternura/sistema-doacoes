# Tarefa 8 — API REST Lar Ternura

API 2.1.0, compatibilizada com o banco do Vinicius e validada localmente. Este pacote contém somente o backend e sua documentação; não publica ou substitui o frontend da tarefa 13/14.

Atualização da integração externa: esta branch acrescenta calendário informativo da BrasilAPI e uma página de integração em `/integracao/agendamento/`. Ela permite conferir o fluxo no navegador e não substitui o frontend definitivo da equipe. Instruções em [BRASILAPI_FERIADOS.md](../docs/BRASILAPI_FERIADOS.md).

## Executar

Na pasta backend, instalar dependências com `pnpm install --frozen-lockfile` e executar `pnpm test`. Os testes criam banco PGlite descartável e não usam DATABASE_URL de produção. Os cinco SQL originais em ../banco-vinicius são dependências desses testes e referências da entrega do Vinicius.

Para executar a API, configurar variáveis privadas conforme .env.example, aplicar apenas a migração complementar 002 no ambiente autorizado e iniciar com `pnpm start`. Ler ../docs/api/MIGRACAO-E-INTEGRACAO.md antes de instalar. Não executar 00_RECRIAR_BANCO_COMPLETO.sql no banco já preparado: ele é destrutivo e está incluído como referência de testes locais.

## Documentação e escopo

Contratos OpenAPI: ../docs/api/openapi.json. São 35 operações HTTP em 31 caminhos, incluindo a consulta de calendário. A modelagem do banco pertence ao Vinicius; a aplicação do complemento no ambiente compartilhado deve seguir a conferência de destino e o alinhamento da equipe.

Os testes incluem um cliente HTTP de referência em test/fixtures/cliente-agendamento.mjs para conferir o contrato e o retry. Esse arquivo é um apoio ao teste, não uma implementação ou publicação de tela do frontend.

Ainda falta configurar e aplicar o complemento no Neon autorizado, criar administrador, publicar a API com HTTPS e integrar ao frontend do grupo. Nenhuma migração ou seed é executada ao iniciar servidor; não houve alteração de Neon ou GitHub nesta preparação.

## Correção de estrutura — 13/10/2026

A migração e o `/ready` agora compartilham a validação estrutural das tabelas de apoio. Incompatibilidades interrompem a migração e retornam 503 no `/ready`. Ver `docs/api/CORRECAO-VALIDACAO-ESTRUTURA-13-10-2026.md` (a partir da raiz do repositório). Para regenerar a migração após mudar o contrato, executar `node scripts/build-migration.js` na pasta backend; esse comando não acessa o banco.

## Entrega E1 — 23/10/2026

Ler `docs/api/ENTREGA-E1-API-2.1.md` a partir da raiz do projeto. Swagger em `/docs/`, contrato em `/openapi.json` e coleção `docs/api/lar-ternura-api-2.1.postman_collection.json`. A busca administrativa aceita q e múltiplos status; a rota receber-e-concluir é atômica. Metas atingidas continuam aceitando promessas enquanto abertas e com produto ativo.

## Correção de concorrência — 26/10/2026

A seleção da meta em receber-e-concluir agora relê após uma renovação concorrente. Novas tentativas que não estabilizam após cinco leituras/travas respondem 409 META_EM_ALTERACAO, com rollback integral e possibilidade de repetir a mesma chave. Guia e evidências: docs/api/CORRECAO-CONCORRENCIA-METAS-26-10-2026.md a partir da raiz do repositório. A suíte PostgreSQL local é executada com PG_BIN configurado e pnpm test:postgres; não usa DATABASE_URL ou Neon.

## Complemento após a E2 — 28/10/2026

Ambiente alinhado a Node.js 22 (22.13.0 ou posterior da série 22) e pnpm 11.25.0. O campo packageManager já estava fixado e foi preservado. O arquivo backend/pnpm-workspace.yaml registra allowBuilds com @scarf/scarf: false, sem desativar globalmente a verificação de scripts de dependências.

GET /admin/agendamentos aceita de e ate opcionais e inclusivos pela data da entrega em America/Sao_Paulo. Mantém data, q, status CSV, limit e offset; filtros simultâneos usam interseção. Formato inválido, data inexistente ou de maior que ate retorna 422. GET /doacoes mantém ocorrido_em decrescente e agora desempata pelo ID numérico decrescente, antes da paginação.

Guia e evidências: docs/api/AJUSTES-POS-E2-28-10-2026.md. Este complemento pressupõe a integração do PR #36 e preserva sua correção de concorrência. Nenhuma alteração em frontend, SQL, migrations, dados, capacidade, feriados ou ambiente publicado.
