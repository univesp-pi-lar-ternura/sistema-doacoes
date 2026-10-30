# Validação da API 2.1 — E1

Executada em 23/10/2026 na cópia local da develop 8cebf7dcd40321fb882e701fec9af6f670d426f7, com as alterações E1.

95 testes declarados aprovados, sem falhas: 65 anteriores (31 de compatibilidade, 20 de estrutura, dez do cliente BrasilAPI, quatro HTTP de calendário), 27 novos funcionais E1 e três de documentação/contrato.

Os testes E1 cobrem busca, filtros/status, ordem/paginação, conclusão integral e parcial, rollback após falha na conclusão, meta renovada, ausência de meta, produto inativo, chaves idempotentes, preservação de autoria, role limitada e total recebido além de 100 registros. Também confirmam que meta atingida aceita promessa sem alterar arrecadação, enquanto metas fechadas e produtos inativos permanecem bloqueados.

Swagger em /docs e /docs/, assets locais e contrato em /openapi.json foram testados por HTTP; a renderização foi conferida no navegador. A coleção Postman cobre as 36 operações do contrato e não contém credenciais preenchidas. O pacote foi instalado com lockfile congelado e dependências locais.

Resultado integral: RESULTADO-TESTES-E1.txt. Banco PGlite descartável; nenhuma conexão de teste usa DATABASE_URL real. As 25 verificações SQL originais fazem parte de um dos testes anteriores, não são 25 testes adicionais. O comando explícito evita contar módulos de apoio como casos.

Não comprova concorrência com conexões PostgreSQL independentes, produção, leitor de tela ou implantação. Não houve publicação no GitHub, migração no Neon, alteração no Render nem mudança do frontend final.

## Complemento de 26/10/2026

A correção de concorrência preservou os 95 testes anteriores. Além deles, nove casos de concorrência passaram em PostgreSQL 17.11 local, com sessões independentes, READ COMMITTED e role limitada (104 casos entre as duas suítes). A falha original foi reproduzida no código anterior. Os novos testes cobrem as duas ordens de execução, SQL direto, múltiplos produtos, ausência real de meta, repetição idempotente, rollback e ordem numérica de travas. Resultados: RESULTADO-REGRESSAO-CONCORRENCIA.txt e RESULTADO-POSTGRES-CONCORRENCIA.txt. O teste anterior em REPRODUCAO-ANTES-DA-CORRECAO.txt falha intencionalmente para demonstrar o defeito. Nenhuma validação nova foi feita no Neon nesta preparação.

## Complemento após a E2 — 28/10/2026

Ambiente alinhado a Node.js 22 (22.13.0 ou posterior da série 22) e pnpm 11.25.0. O campo packageManager já estava fixado e foi preservado. O arquivo backend/pnpm-workspace.yaml registra allowBuilds com @scarf/scarf: false, sem desativar globalmente a verificação de scripts de dependências.

GET /admin/agendamentos aceita de e ate opcionais e inclusivos pela data da entrega em America/Sao_Paulo. Mantém data, q, status CSV, limit e offset; filtros simultâneos usam interseção. Formato inválido, data inexistente ou de maior que ate retorna 422. GET /doacoes mantém ocorrido_em decrescente e agora desempata pelo ID numérico decrescente, antes da paginação.

Guia e evidências: docs/api/AJUSTES-POS-E2-28-10-2026.md. Este complemento pressupõe a integração do PR #36 e preserva sua correção de concorrência. Nenhuma alteração em frontend, SQL, migrations, dados, capacidade, feriados ou ambiente publicado.
