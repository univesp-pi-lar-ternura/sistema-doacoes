# Sistema Integrado de Controle de Demanda e Agendamento de Doações

<div align="center">
  <strong>Projeto Integrador II — UNIVESP | Eixo de Computação</strong><br>
  PJI240-DRP14-A2026S2-T005 <br>
  Comunidade parceira: Lar Ternura
</div>

## Sobre
A instituição Lar Ternura, que abriga jovens e adultos com deficiência na região Oeste de São Paulo, enfrenta dificuldades na gestão de doações físicas. Atualmente, os doadores não sabem exatamente quais são as necessidades mais urgentes (como produtos de higiene específicos ou alimentos) e acabam doando itens em excesso que ficam no estoque, enquanto faltam outros essenciais. Além disso, a instituição não tem logística de recolhimento, exigindo organização prévia para o recebimento presencial.

Para solucionar este problema, o grupo do PI propos desenvolver uma plataforma web onde a ONG poderá atualizar um "termômetro" de necessidades em tempo real. O doador visualizará os itens urgentes, comprometendo-se com a doação e realizando o agendamento da entrega. O sistema terá um frontend responsivo e acessível, com backend estruturado e banco de dados relacional para gerenciar os agendamentos.

## Tecnologias
- Backend: Node.js
- Frontend: React 18, Vite 5 e Tailwind CSS 4
- Banco de dados: PostgreSQL (Neon)
- Hospedagem API: Render
- Hospedagem frontend: Cloudflare Workers Static Assets (configuração preparada)
- Testes: Node test runner com PGlite na API; Vitest no frontend; suíte adicional de concorrência em PostgreSQL local

## Como rodar localmente
Use Node.js 22.13 ou posterior da série 22 (versão de referência: 22.23.4), pnpm 11.25.0 no backend e npm com o lockfile no frontend.

1. Em `backend`, execute `pnpm install --frozen-lockfile` e configure um `.env` privado seguindo `.env.example`, com um banco de desenvolvimento já preparado. Consulte [a documentação da API](backend/README.md) antes de executar migrações.
2. Execute `pnpm start` no backend. `/health` verifica o processo; `/ready` também verifica acesso ao banco e compatibilidade da estrutura.
3. Em outro terminal, entre em `frontend`, execute `npm ci` e configure `.env.local` a partir de `.env.example`. Para integração local, use `VITE_API_URL=http://127.0.0.1:3000` e `VITE_USAR_MOCK=false`.
4. Inclua `http://127.0.0.1:5173` em `CORS_ORIGINS` do backend e execute `npm run dev` no frontend.

O modo `VITE_USAR_MOCK=true` permite demonstrar as telas com dados simulados no navegador, sem validar a API ou o banco. A conta de demonstração desse modo não é uma conta administrativa do sistema real.

## Verificação e publicação

- API: `cd backend` e `pnpm test`. Os testes padrão usam banco efêmero local, sem acessar o Neon.
- Frontend: `cd frontend` e `npm test`. Para conferir os arquivos de produção, execute `npm run check:cloudflare` com as variáveis de build reais.
- Concorrência PostgreSQL: consulte `backend/README.md` antes de executar `pnpm test:postgres`; o runner usa um cluster local próprio.
- [Guia de publicação da API e do frontend](docs/deploy.md).
- [Configuração do Cloudflare](docs/PUBLICACAO_CLOUDFLARE.md).

Não publique arquivos `.env`, credenciais ou dados pessoais nos logs e evidências. A preparação e os testes locais não comprovam publicação: registre o commit e confira os serviços depois do deploy.

## Estrutura de branches
- `main` — versão estável, só recebe merge via Pull Request
- `develop` — integração contínua do time
- `feature/nome-da-feature` — desenvolvimento individual

## Integrantes
| Nome | RA |
| --- | --- |
| Ademir Stefanski Junior | 25204658 |
| Anderson Mello Miranda Loureiro | 24212629 |
| Helena Mamede Ciorra | 25214576 |
| Vinicius Claudino Bica | 24217641 |
| Viviane Borba Barbosa | 24211505 |
