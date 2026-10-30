# Publicação do Lar Ternura

O navegador acessa o frontend no Cloudflare, que chama a API no Render. Somente a API se conecta ao PostgreSQL no Neon. Este guia descreve a configuração de lançamento; não comprova que o deploy já ocorreu.

## Versão e preparação

- Node.js de referência: **22.23.4**, dentro da faixa `>=22.13.0 <23` do backend.
- Backend: **pnpm 11.25.0**, fixado em `backend/package.json`, com `pnpm-lock.yaml` e `pnpm-workspace.yaml`.
- Frontend: `npm ci`, usando `frontend/package-lock.json`.
- Integrar os ajustes de API e a configuração de publicação à versão revisada. A liberação para `main` deve ser coordenada: o serviço Render foi informado pela equipe como configurado para deploy automático dessa branch.
- Conferir o banco, a conta limitada da API e o administrador inicial antes da liberação. Migração e criação de administrador são operações separadas do deploy, executadas somente quando necessárias por quem administra o banco. Consultar [migração e integração](api/MIGRACAO-E-INTEGRACAO.md).

Não executar os scripts de recriação ou dados fictícios contra produção. Não adicionar migrações ou criação de administrador ao comando de inicialização. A conta de execução da API não deve ser proprietária do banco.

## API no Render

| Campo | Configuração |
| --- | --- |
| Branch de produção | `main`, após a liberação coordenada |
| Runtime | Node |
| Root Directory | Vazio, mantendo a raiz completa do repositório |
| Build Command | `cd backend && corepack enable && pnpm install --frozen-lockfile` |
| Start Command | `cd backend && pnpm start` |
| Health Check Path | `/ready` |
| Pre-Deploy Command | Vazio neste procedimento |

A raiz completa é necessária porque `backend/src/documentation.js` carrega `docs/api/openapi.json`. Arquivos fora do diretório raiz selecionado ficam indisponíveis no Render. [Documentação oficial de monorepos](https://render.com/docs/monorepo-support).

| Variável do backend | Valor ou origem |
| --- | --- |
| `NODE_VERSION` | `22.23.4` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Conexão privada com pooling e conta limitada da API |
| `BOOKING_TOKEN_SECRET` | Segredo privado estável, com pelo menos 32 caracteres |
| `CORS_ORIGINS` | `https://lar-ternura-frontend.lar-ternura.workers.dev` |
| `SLOT_CAPACITY` | `10` |
| `DELIVERY_TIMES` | `09:00,10:00,14:00,15:00`, conforme agenda acordada |
| `SESSION_HOURS` | `8` |
| `TRUST_PROXY_HOPS` | Definir conforme a cadeia de proxies efetivamente usada; não adivinhar |
| `PORT` | Usar a variável fornecida pelo Render |

`SLOT_CAPACITY` precisa ser configurada explicitamente: o padrão atual do código e do `.env.example` é 3. `NODE_VERSION` tem precedência sobre arquivos de versão e `engines`; conferir o valor no serviço e no log do build. [Documentação oficial de Node no Render](https://render.com/docs/node-version).

Não incluir senhas de administradores ou variáveis `ADMIN_*` no serviço da API. Não expor a conexão do banco ou o segredo dos agendamentos em variáveis do frontend.

## Frontend no Cloudflare

Configuração detalhada em [PUBLICACAO_CLOUDFLARE.md](PUBLICACAO_CLOUDFLARE.md).

| Item | Valor |
| --- | --- |
| Worker | `lar-ternura-frontend` |
| Origem planejada | `https://lar-ternura-frontend.lar-ternura.workers.dev` |
| API | `https://lar-ternura-api.onrender.com` |
| `VITE_API_URL` | `https://lar-ternura-api.onrender.com` |
| `VITE_USAR_MOCK` | `false` |

As duas variáveis `VITE_*` devem existir no ambiente de build. Alterá-las exige gerar e publicar novos arquivos. A reserva do subdomínio não publica o site.

Em `frontend`, executar `npm ci`, `npm test` e `npm run check:cloudflare`. O último comando faz build e dry-run, sem publicação. Com API pronta, CORS conferido e versão liberada, `npm run deploy:cloudflare` refaz o build e publica os arquivos. Preservar o nome do Worker para manter a origem cadastrada no CORS.

## Conferência da publicação

1. Registrar o commit aprovado, o commit implantado no Render e a versão do Worker.
2. Verificar `/health` e `/ready` na API. `/ready` deve retornar 200; `/health` isolado não comprova conexão com banco.
3. Conferir `/docs` e as respostas de CORS para a origem exata do frontend.
4. Abrir diretamente `/`, `/doar`, `/agendar` e `/admin/entrar`; atualizar as páginas para conferir o fallback SPA.
5. Conferir mock desligado, consulta real de necessidades, login/logout e proteção das rotas administrativas.
6. Executar o fluxo agendar → receber/concluir → consultar totais/PDF com dados de teste identificados e previamente combinados. Agendamento não aumenta o total recebido. Testes de volume e concorrência pertencem ao ambiente isolado.
7. Registrar resultado e limitações. Testes locais, testes publicados pelo autor e testes da produção são evidências diferentes.

## Recuperação

Se o backend falhar, consultar o log do deploy, confirmar Node, diretório raiz, comandos e variáveis. Manter segredos fora das capturas. Reimplantar uma versão anterior somente depois de conferir sua compatibilidade com a estrutura atual do banco.

Para o frontend, restaurar uma versão validada do Worker ou reconstruir a versão anterior com as variáveis correspondentes. Reverter código não reverte dados: restauração de banco exige decisão e procedimento próprios.

## Registro da entrega

Preencher depois da publicação: data e responsável; commit API/frontend; versão Node/pnpm; identificação do deploy/Worker; resultados de `/ready`, CORS e fluxo funcional; limitações e correções pendentes. Não registrar credenciais ou contatos reais nesse relatório.
