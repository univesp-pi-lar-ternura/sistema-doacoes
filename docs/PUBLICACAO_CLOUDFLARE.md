# Publicação do frontend no Cloudflare

Hospedagem escolhida: **Workers Static Assets**, plano gratuito. O frontend React/Vite gera arquivos em `frontend/dist`; a API continua no Render e o PostgreSQL no Neon. Não há código de servidor Worker nesta configuração.

Endereços definidos para a publicação: API `https://lar-ternura-api.onrender.com`; frontend `https://lar-ternura-frontend.lar-ternura.workers.dev`. O subdomínio Cloudflare foi confirmado em 29/10/2026; a definição desses endereços não significa que o site ou a versão atual da API já foram publicados. Configurar a origem exata do frontend em `CORS_ORIGINS` no Render e preservar o nome `lar-ternura-frontend` no Wrangler.

## Antes de publicar

- Ter acesso à conta Cloudflare responsável pelo projeto.
- Confirmar com Helena a URL HTTPS da API e a versão do backend preparada para publicação.
- Incorporar esta configuração à versão aprovada para lançamento. A branch `main` também dispara a publicação da API no Render, conforme o fluxo combinado pela equipe; coordenar a liberação.
- Definir `VITE_API_URL` com a URL real da API, sem barra final, e `VITE_USAR_MOCK=false`.
- Depois de conhecer a URL do frontend, Helena deve incluí-la em `CORS_ORIGINS` no Render (somente a origem HTTPS, sem caminhos).

Variáveis `VITE_*` ficam visíveis no JavaScript entregue ao navegador. Nunca inserir `DATABASE_URL`, senhas de administrador, chave do Neon ou `BOOKING_TOKEN_SECRET` no frontend.

## Configuração do Workers Builds

Conectar o repositório `univesp-pi-lar-ternura/sistema-doacoes` pelo painel Cloudflare, depois de os arquivos estarem na branch escolhida.

| Campo | Valor |
| --- | --- |
| Nome do Worker | `lar-ternura-frontend` (igual ao `wrangler.jsonc`) |
| Diretório raiz | `frontend` |
| Branch de produção | `main`, quando a versão de lançamento estiver pronta |
| Node.js | `22.23.4`, indicado em `.node-version` |
| Build | `npm ci && npm run build:cloudflare` |
| Deploy | `npx wrangler deploy` |
| Variável de build `VITE_API_URL` | URL HTTPS real fornecida por Helena |
| Variável de build `VITE_USAR_MOCK` | `false` |

As variáveis devem ser configuradas no **build**, pois o Vite as incorpora ao gerar os arquivos. Alterar uma variável exige novo build. A primeira publicação pode usar o endereço gratuito `workers.dev`; o endereço exato será informado pela Cloudflare.

Manter a publicação de branches de prévia desativada inicialmente. Se habilitada depois, usar API e banco de teste próprios: uma prévia do frontend apontada à API de produção também altera dados de produção.

## Validação e publicação pelo computador

Dentro de `frontend`, com Node 22 e as duas variáveis configuradas:

```sh
npm ci
npm test
npm run check:cloudflare
```

`check:cloudflare` gera o build e executa `wrangler deploy --dry-run`, sem publicar. A conferência recusa mock ativado/indefinido, URL ausente, HTTP, localhost e endereços reservados de exemplo. Ela não comprova que a API está disponível ou que o CORS está correto.

Para publicar efetivamente, após confirmar API, CORS e versão de lançamento:

```sh
npx wrangler login
npm run deploy:cloudflare
```

O login é realizado pelo titular no navegador, sem compartilhar senha. O comando de deploy refaz o build antes do envio. Não executar `npx wrangler deploy` manualmente sobre um `dist` antigo.

## Conferência após publicação

1. Abrir `/`, `/doar`, `/agendar` e `/admin/entrar` diretamente e atualizar a página. O fallback SPA do `wrangler.jsonc` entrega `index.html` para as rotas do React.
2. Conferir no navegador que as consultas usam a URL HTTPS correta, sem erros de CORS ou faixa de modo simulado.
3. Testar login e logout administrativos; conferir que as rotas protegidas exigem sessão.
4. Validar o fluxo completo de agendamento e recebimento em ambiente de teste. Na publicação final, usar somente registros de conferência previamente combinados com a equipe.
5. Registrar URL pública, commit publicado e resultado da conferência. Um build aprovado não significa que a integração com a API já foi validada.

Para reverter o frontend, selecionar uma versão anteriormente validada no painel Cloudflare ou republicar o commit anterior com suas variáveis correspondentes. Isso não reverte API nem banco.

## Referências

- [Rotas de aplicação SPA](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Configuração de builds e variáveis](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Limites de arquivos estáticos](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Limites de builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
