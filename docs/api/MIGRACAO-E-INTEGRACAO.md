# Compatibilização com o banco do Vinicius

Entrega da tarefa 8, preparada em 12/10/2026. API 2.0.0. Todos os ensaios foram locais. Nenhuma operação no Neon, publicação no GitHub ou implantação no Render foi realizada.

## Procedimento sobre o banco já instalado

**Não execute `00_RECRIAR_BANCO_COMPLETO.sql` para instalar esta API. Ele é destrutivo. Não execute a migração 001 da entrega anterior.**

1. Vinicius deve confirmar o projeto, branch, banco, conexão e estado atual da instalação. O PDF relata a instalação em `neondb`; não verificamos esse ambiente diretamente.
2. Preservar um backup/branch antes de qualquer alteração de estrutura no ambiente compartilhado. Conferir as nove tabelas e três views conforme `02_CONFERIR_INSTALACAO.sql`.
3. Usar Node.js 22 (22.13.0 ou posterior da série 22) e pnpm 11.25.0, instalar as dependências na pasta `backend` com `pnpm install --frozen-lockfile`.
4. Configurar `DATABASE_URL` em ambiente privado, com a conexão TLS fornecida pelo Neon. Não colocar a senha no código nem no Drive. Não desabilitar a verificação de certificado.
5. Executar `pnpm db:migrate`, com uma conexão de manutenção autorizada. Esse comando aplica **somente** `backend/migrations/002_compatibilidade_vinicius.sql`, dentro de transação. Não executa reset, seed, recriação, 00, 01 ou 05. Recusa modelo antigo/misto e preserva dados, triggers e views.
6. O complemento cria o schema `api_apoio` com cinco tabelas: sessões, vagas, idempotência de agendamentos, vínculo promessa/meta e idempotência de recebimentos. Acrescenta somente o hash de gestão em `public.agendamentos`. As nove tabelas de negócio e três views do Vinicius são preservadas.
7. Configurar uma role própria para a aplicação e conceder privilégios sobre o complemento e o banco base. Usar o exemplo abaixo como referência, após revisar o nome de uma role existente. As funções do Vinicius são `SECURITY INVOKER` e precisam das permissões da role chamadora.
8. Criar o administrador com `pnpm admin:create` usando conexão de manutenção e `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` privados. O hash é scrypt; não há conta padrão. Remover a senha do ambiente após o cadastro e trocar `DATABASE_URL` pela role limitada para executar o serviço.
9. Definir `BOOKING_TOKEN_SECRET` aleatório (mínimo 32 caracteres), `CORS_ORIGINS`, `DELIVERY_TIMES`, `SLOT_CAPACITY` e `TRUST_PROXY_HOPS` conforme hospedagem e regras aprovadas. São configuração de ambiente, não regras já validadas pela ONG.
10. Executar `pnpm start`. `/health` verifica o processo; `/ready` também verifica banco/esquema complementar. O serviço não inicia migrações automaticamente.

Exemplo de concessões a uma role existente chamada `lar_ternura_api`, a aplicar pelo responsável pelo banco:

```sql
GRANT USAGE ON SCHEMA public, arrecadacao, api_apoio TO lar_ternura_api;
GRANT SELECT ON public.categorias_urgencia, public.usuarios_ong TO lar_ternura_api;
GRANT SELECT, INSERT, UPDATE ON public.itens_necessidades,
  public.agendamentos, public.itens_agendamento TO lar_ternura_api;
GRANT SELECT, INSERT ON public.doadores TO lar_ternura_api;
GRANT SELECT, INSERT, UPDATE ON arrecadacao.necessidades,
  arrecadacao.recebimentos, arrecadacao.itens_recebimento TO lar_ternura_api;
GRANT SELECT ON arrecadacao.vw_termometro,
  arrecadacao.vw_historico_necessidades, arrecadacao.vw_arrecadacao_mensal TO lar_ternura_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api_apoio TO lar_ternura_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, arrecadacao TO lar_ternura_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA arrecadacao TO lar_ternura_api;
```

Esse exemplo não cria usuário, não define senha e não concede DELETE/TRUNCATE sobre o histórico. O processo de criação de administrador é de manutenção; a role de execução não recebe INSERT em `usuarios_ong`. O exemplo foi testado com role limitada no banco local: API e triggers funcionaram, e DELETE do histórico foi recusado. Privilégios reais no Neon ainda precisam ser verificados na integração.

## Contrato para o frontend do grupo

O frontend deve consultar GET /itens e preservar id_necessidade como string na seleção e em POST /agendamentos. A API espera nome, e-mail, telefone e tipo PF/PJ. Este pacote não inclui a aplicação React; consultar openapi.json e README.md desta pasta para os contratos e exemplos. A integração das telas continua sob responsabilidade da equipe.

## Mudanças incompatíveis em relação à versão anterior

- Produto e meta agora são criados separadamente. `POST/PUT /itens` recebe apenas dados do catálogo. `POST /admin/necessidades` abre uma meta; renovar encerra a antiga e cria outra em uma transação. Meta não é atualizada por PUT.
- `quantidade_atual` e `quantidade_necessaria` são aliases JSON de arrecadado/meta para os cartões. Não são colunas do banco nem representam saldo de estoque físico. O histórico usa entregas efetivas confirmadas.
- `POST /agendamentos` exige `id_necessidade` como string em cada item. Uma seleção de meta encerrada, renovada, cancelada ou produto inativo recebe 409. O retry de uma reserva já gravada continua sendo recuperado mesmo após fechamento da meta.
- `POST /doacoes` exige UUID em `Idempotency-Key`, data efetiva com fuso e quantidades realmente recebidas. O corpo antigo apenas com `id_agendamento` foi descontinuado. Sem vínculo com meta, enviar `id_necessidade: null` explicitamente: conta no mês, mas não no termômetro.
- Recebimentos parciais não concluem automaticamente o agendamento. `PATCH /admin/agendamentos/{id}/concluir` exige `motivo_pendencias` se faltarem quantidades. Itens completos ficam Entregue; incompletos ficam Cancelado, preservando os recebimentos parciais.
- Estornar mantém o registro e recalcula a arrecadação do mês original. Estorno de agendamento concluído não o reabre; uma nova entrega exige novo planejamento administrativo.
- Cancelar/remarcar após recebimento confirmado é bloqueado. A ONG deve concluir ou estornar antes de corrigir o planejamento.
- IDs de necessidade/recebimento são strings, inclusive acima de `Number.MAX_SAFE_INTEGER`. Relatórios retornam totais como strings; cartões públicos aceitam totais inteiros representáveis com segurança e falham explicitamente fora desse limite.
- Um mesmo e-mail de doador não tem seus contatos sobrescritos por uma requisição pública; mudanças cadastrais exigem fluxo autenticado futuro. Não há recuperação de código por e-mail.

## Arquivos de referência

`banco-vinicius/` contém os cinco scripts SQL originais extraídos do PDF, preservados byte a byte e conferidos por SHA-256. O 00 serve exclusivamente de referência e de instalação do banco descartável nos testes. Em PGlite, apenas a conferência do nome da conexão é adaptada em memória; nenhuma alteração foi feita nas tabelas/regras originais.

## O que ainda depende da equipe

- Aplicação do complemento, grants, administrador e configuração reais no Neon.
- Implantação da API, URL HTTPS, origem autorizada e configuração do frontend no ambiente definitivo.
- Integração ao frontend da tarefa 13 e execução do plano de testes integrado da tarefa 18.
- Validação com a ONG de capacidade/horários, metas/renovação, entregas incompletas e contatos indispensáveis.
- Testes com conexões PostgreSQL independentes, concorrência/deadlocks, permissões de produção e acessibilidade com usuários reais. PGlite serializa as operações locais e não comprova concorrência distribuída.
- Integração de API externa da tarefa 9; essa compatibilização não acrescenta esse requisito.
- A ficha da tarefa 20 continua com vídeo pendente; ao atualizar a narrativa, usar “arrecadação confirmada” em vez de “estoque”.

Não marcar as tarefas como entregues em produção somente com base nestes testes locais.

## Correção de estrutura — 13/10/2026

A migração e o `/ready` agora compartilham a validação estrutural das tabelas de apoio. Incompatibilidades interrompem a migração e retornam 503 no `/ready`. Ver `docs/api/CORRECAO-VALIDACAO-ESTRUTURA-13-10-2026.md` (a partir da raiz do repositório). Para regenerar a migração após mudar o contrato, executar `node scripts/build-migration.js` na pasta backend; esse comando não acessa o banco.

## Atualização E1 — 23/10/2026

A API 2.1 permite agendar meta atingida que permaneça aberta. A nova conclusão recebe e encerra em transação única, escolhendo a meta aberta atual. Nenhuma migração nova foi introduzida; a instalação 002 e seus privilégios permanecem os mesmos. Swagger, Postman e guia E1 estão na documentação. Publicação e regras de feriados/capacidade permanecem com a equipe.
