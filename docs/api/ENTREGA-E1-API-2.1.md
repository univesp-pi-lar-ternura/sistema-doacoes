# E1 — API 2.1.0

Preparada em 23/10/2026 a partir da develop `8cebf7dcd40321fb882e701fec9af6f670d426f7` (PR #34 incorporado). Destino proposto: novo PR para develop. Esta preparação não publicou commits nem aplicou mudanças no Neon/Render.

## Comportamentos entregues

- `GET /admin/agendamentos`: ordem de data da entrega decrescente, desempate pelo código decrescente; filtros de `data`, `de`, `ate`, `q`, `status`, `limit` e `offset`. O período é inclusivo pela data da entrega em São Paulo; `de > ate` ou data inválida retorna 422. Status aceita um valor ou CSV, por exemplo `Pendente,Confirmado`.
- Busca por código com ou sem `#`; entrada numérica também consulta telefone quando tiver ao menos quatro dígitos, ignorando formatação. Entrada textual consulta nome/email sem diferenciar caixa. `%`, `_` e barra invertida são literais. Não foi adicionada busca sem acentos.
- `quantidade_recebida` em cada item do agendamento: soma de todos os recebimentos confirmados, excluindo estornos, independente da paginação de `/doacoes`. Retornado como inteiro seguro; não é estoque.
- `POST /admin/agendamentos/{id}/receber-e-concluir`: autenticação administrativa e UUID em `Idempotency-Key`. Registra o que chegou e conclui em uma única transação. Preserva as rotas antigas.
- Novos agendamentos são permitidos para meta atingida que permaneça aberta e com produto ativo, conforme resposta de Helena. Meta encerrada/cancelada/renovada e produto inativo continuam recusados. Promessas não alteram arrecadação.
- OpenAPI 2.1, Swagger local em `/docs` ou `/docs/` e contrato em `/openapi.json`. Assets Swagger são servidos pela API, sem CDN nem envio ao validador externo. Dependência `swagger-ui-dist` fixada no lockfile.
- Coleção Postman 2.1 em `lar-ternura-api-2.1.postman_collection.json`, cobrindo as 36 operações do contrato. Regenerar com `pnpm docs:postman` quando mudar o contrato.

## Conclusão integral e parcial

Corpo `{}` significa que chegou exatamente o restante da promessa dos itens ainda Agendado, descontando recebimentos confirmados anteriores. Se tudo já foi recebido, somente conclui; não cria recebimento vazio.

Para parcial:

```json
{
  "itens": [{ "id_item": 1, "quantidade_recebida": 3 }],
  "motivo_pendencias": "Trouxe somente parte da promessa"
}
```

Itens omitidos recebem zero nesta operação. Quantidade zero é aceita; array vazio com motivo conclui sem recebimento. Quantidades acima do restante da promessa são recusadas com 422; usar registro avulso para excedentes. Se faltar motivo para uma conclusão parcial, retorna 409 e desfaz recebimento, totais e chave da tentativa.

Ao confirmar, a API escolhe a necessidade aberta atual de cada produto. Uma meta antiga encerrada/renovada não impede a chegada atrasada; sem necessidade aberta, registra com `id_necessidade: null`, entrando no total mensal e não em outra meta por inferência. Produto desativado com quantidade a receber responde 409, sem gravação parcial.

Resposta HTTP 200:

```json
{
  "agendamento": { "id_agendamento": 1, "status_agendamento": "Concluído" },
  "doacao": { "id_recebimento": "1", "status": "Confirmado" },
  "repetido": false
}
```

Os objetos completos seguem o OpenAPI. `doacao` é null quando não houve novo recebimento. Mesma chave, corpo, agendamento e administrador recuperam a operação sem duplicação. Reutilização com outros dados/usuário ou em outra rota retorna 409. Um agendamento já concluído com outra chave retorna seu estado atual e não cria outra doação. Cancelado retorna 409, inexistente 404. Uma falha no banco desfaz a transação inteira.

## Integração com Helena: consulta e PDF

Não foi criada uma rota redundante: `/itens` e `/necessidades` já retornam os dados da consulta para necessidades abertas de produtos ativos, incluindo metas atingidas:

| Campo | Uso na tela |
| --- | --- |
| `id_necessidade` | Identificador da meta, string decimal |
| `id_item`, `nome_item`, `unidade_medida` | Produto e apresentação |
| `quantidade_meta` | Meta da necessidade |
| `quantidade_arrecadada` | Quantidade efetivamente recebida e confirmada |
| `quantidade_faltante` | Meta menos recebido, mínimo zero |
| `meta_atingida`, `percentual_atendimento` | Situação; percentual real pode ultrapassar 100 |

Paginar com `limit=100&offset=0`, depois offset 100, 200 etc. até página vazia. A API não devolve todas as necessidades em uma só página. Para metas encerradas/canceladas, usar `/admin/necessidades/historico` com sessão administrativa e paginação. Não somar quantidades com unidades diferentes. Montagem da tela e exportação PDF permanecem com Helena. O relatório mensal tem finalidade diferente.

O formato da nova conclusão corresponde ao adaptador `receberEConcluir` já existente no frontend. A busca e `quantidade_recebida` eliminam a necessidade de inferências no navegador, mas o frontend final não foi modificado por esta entrega.

## Como validar e usar

Na pasta backend, com Node.js 22 (22.13.0 ou posterior da série 22) e pnpm 11.25.0, fixado em packageManager:

```sh
pnpm install --frozen-lockfile
pnpm test
```

Os testes usam PGlite descartável, sem `DATABASE_URL` real. A E1 original possui 95 casos: 65 anteriores, 27 funcionais E1 e 3 de documentação/contrato. O complemento de 28/10 acrescenta 15 casos, totalizando 110 em `pnpm test`. Os nove casos PostgreSQL do PR #36 são executados separadamente por `pnpm test:postgres`. As 25 verificações SQL originais estão dentro de um caso anterior; não somá-las novamente. O comando de teste lista somente os arquivos `.test.js`, evitando contar módulos de apoio como testes extras. O checksum da fixture normaliza LF/CRLF; o SQL do banco não foi alterado.

Para abrir Swagger, iniciar a API com configuração de um banco de teste autorizado conforme README. `/docs` não executa migrações. Na coleção Postman, preencher `base_url`, credenciais administrativas privadas, data/horário futuros e IDs retornados pela API. O login preenche `ong_token`; o agendamento preenche `id` e `token_agendamento`. As variáveis `chave_*` são geradas uma vez por operação para permitir retry: limpar a variável ao iniciar outra operação. Executar os pedidos individualmente num ambiente de teste, pois a coleção inclui rotas de escrita.

## Limites e pendências do grupo

- Nenhuma mudança no SQL original, migração 002, grants, configurações de capacidade ou regra de feriados.
- Usuário master fica para evolução futura. A capacidade de dez vagas e o possível bloqueio de feriados dependem do alinhamento com Vinicius. O calendário desta entrega permanece informativo.
- Testes locais comprovam comportamento e rollback no PGlite, que serializa operações. Concorrência com conexões PostgreSQL independentes e deploy real continuam na validação da equipe.
- Frontend, PDF, migração no ambiente compartilhado e publicação permanecem com os responsáveis definidos pelo grupo.

## Correção de concorrência — 26/10/2026

A seleção da meta em receber-e-concluir agora relê após uma renovação concorrente. Novas tentativas que não estabilizam após cinco leituras/travas respondem 409 META_EM_ALTERACAO, com rollback integral e possibilidade de repetir a mesma chave. Guia e evidências: docs/api/CORRECAO-CONCORRENCIA-METAS-26-10-2026.md a partir da raiz do repositório. A suíte PostgreSQL local é executada com PG_BIN configurado e pnpm test:postgres; não usa DATABASE_URL ou Neon.
