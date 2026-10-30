# API 2.1.0 — contrato de integração

Contrato completo: `openapi.json`. URL local: `http://localhost:3000`. Nenhuma URL pública foi criada.

## Agendamento

Consultar `GET /itens` para obter produto e meta atuais. Campos `quantidade_atual`/`quantidade_necessaria` são aliases do total arrecadado/meta, sem colunas antigas no catálogo.

Enviar `POST /agendamentos` com cabeçalho `Idempotency-Key` aleatório de 16–128 caracteres e preservar corpo/chave até confirmação:

```json
{
  "doador": {"nome":"Pessoa fictícia","email":"teste@example.com","telefone":"11999999999","tipo_doador":"PF"},
  "data":"2030-02-20", "horario":"14:00",
  "itens":[{"id_item":1,"id_necessidade":"1","quantidade_doada":2}]
}
```

IDs e data acima são exemplos fictícios: usar valores reais retornados pela API e horários futuros autorizados. Sucesso novo: 201; repetição do mesmo corpo/chave: 200 com o mesmo agendamento/código. 409 para vaga lotada, meta alterada ou chave reutilizada com outro corpo. O código privado só autoriza aquele agendamento e não permite operar rotas ONG.

## Produtos e metas

Administrador ativo autentica em `POST /auth/login`; enviar o token em `Authorization: Bearer ...`. `POST/PUT /itens` recebe nome, unidade, categoria de suprimento e ID de urgência. Não recebe meta ou quantidade atual.

`POST /admin/necessidades` recebe `{ "id_item": 1, "id_categoria": 1, "quantidade_meta": 60 }`. Para renovar: `POST /admin/necessidades/{id}/renovar` com categoria/meta novas. O fechamento e a nova meta são atômicos; histórico não é apagado. Há rotas para encerrar/cancelar e listar o histórico.

## Recebimentos efetivos

`POST /doacoes` exige token ONG e `Idempotency-Key` em formato UUID. Informar a data REAL da entrega com fuso, produtos e quantidades efetivamente recebidas:

```json
{
  "id_agendamento":1,
  "ocorrido_em":"2026-10-12T14:00:00-03:00",
  "itens":[{"id_item":1,"id_necessidade":"1","quantidade_recebida":2}]
}
```

Recebimento pode ser parcial. Para uma entrega espontânea, omitir agendamento/doador ou enviar null. `id_necessidade` é obrigatório em cada item: enviar uma string para vincular ou null para contar somente no histórico mensal. A API não escolhe silenciosamente a meta. As regras do banco impedem produto/meta incompatíveis, produto inativo, entrega futura e vínculo cancelado.

Corpo/UUID/usuário idênticos retornam o recebimento original, sem somar novamente. Outro corpo ou outro administrador com a mesma chave retorna 409. O corpo antigo apenas com `id_agendamento` não é aceito. Autoria é derivada da sessão, nunca aceita do cliente.

`PATCH /doacoes/{id}/estornar` recebe `{ "motivo": "Correção do lançamento" }`. Preserva o registro, remove sua contribuição do total e corrige o mês original. `PATCH /admin/agendamentos/{id}/concluir` recebe `{}` se tudo foi entregue, ou `{ "motivo_pendencias": "Doador encerrou entrega parcial" }` se faltarem itens. Não há conclusão automática ao confirmar recebimento.

## Relatórios e privacidade

`GET /admin/arrecadacao/mensal?mes=2026-10` retorna arrecadação confirmada por produto/nome/unidade e mês civil de São Paulo, com totais como strings. Não sumarizar unidades diferentes. Histórico de metas: `GET /admin/necessidades/historico`. Ambos são privados.

IDs bigint de meta/recebimento são strings decimais; produto/agendamento continuam inteiros. Agendamento retorna hora local sem sufixo Z, acompanhada de `fuso_horario`. Datas de recebimentos são timestamps com fuso. Quantidades do corpo são inteiros positivos, sem frações.

`GET /ready` exige banco e complemento instalados. Falhas de negócio retornam envelope `{erro:{codigo,mensagem},request_id}`; não expõem SQL, credenciais nem contatos em rotas públicas. Sessões são revogáveis; desativar usuário bloqueia sua sessão existente. Limites de tentativas em memória não substituem proteção distribuída da hospedagem.

## Pendências de ambiente

Aplicar complemento/grants por responsável autorizado, confirmar dados persistentes e administrador, configurar CORS/TLS/segredos, publicar API e configurar frontend. Nenhuma migração é executada ao iniciar servidor. Concorrência multi-instância e permissões reais devem ser testadas pela equipe. Regras de horário, encerramento parcial e renovação dependem do aceite da ONG.

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
