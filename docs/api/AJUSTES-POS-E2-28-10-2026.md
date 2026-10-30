# Complemento da E1 após a E2 — 28/10/2026

## Finalidade e base

Atende aos três pedidos da Helena enviados em 27/10: ambiente de instalação, filtro de período nos agendamentos e ordenação dos recebimentos. A API permanece na versão 2.1.0; não há mudança nos corpos de resposta nem novas rotas.

Base: develop `4cc68c9ffebc1e57fc3a0eb2f6cfd2410511fb38` (E2/PR #37 integrada), acrescida dos arquivos do PR #36 no commit `021fbe2b72006ba22d898eb60e3277cdd349acd5`. A correção de concorrência é dependência deste complemento e foi preservada integralmente. Publicar o novo complemento depois da integração do PR #36, a partir da develop atualizada.

## 1. Instalação e ambiente

- `backend/package.json`: Node.js `>=22.13.0 <23`; `packageManager: pnpm@11.25.0` preservado, pois já estava fixado.
- `backend/pnpm-workspace.yaml`: decisão explícita `allowBuilds: { '@scarf/scarf': false }`. O pnpm continua verificando os scripts das demais dependências.
- O lockfile e as versões das dependências foram preservados. Não foi feita atualização de pacotes.
- Documentação ativa alinhada a Node 22 e pnpm 11.25.0. No Render, o responsável deve selecionar a série 22 e conferir se há `NODE_VERSION` ou outra configuração com precedência sobre `engines`.

Conferência local: Node 22.23.4 oficial para Windows x64, com SHA256 conferido contra o arquivo oficial SHASUMS256.txt; pnpm 11.25.0. Instalação completa com `--frozen-lockfile` e instalação separada com `--prod --offline --frozen-lockfile` aprovadas. A segunda reutilizou o cache preenchido pela primeira. Nenhuma configuração do Render foi alterada.

## 2. Período em GET /admin/agendamentos

Parâmetros opcionais `de` e `ate`, no formato AAAA-MM-DD, de 2000 a 2099, seguindo a validação de data que a API já utilizava.

| Uso | Resultado |
| --- | --- |
| Apenas `de` | Da data inicial em diante, incluindo todo o dia inicial. |
| Apenas `ate` | Até a data final, incluindo todo o dia final. |
| `de` e `ate` | Intervalo inclusivo. |
| Sem ambos | Comportamento anterior, sem recorte por período. |
| Com `data` | Interseção com o dia exato; se estiver fora do período, lista vazia. |
| Com `q`, `status`, `limit`, `offset` | Todos os filtros continuam aplicados em conjunto. |
| Data inválida, inexistente, vazia, repetida ou estruturada | HTTP 422 VALIDACAO. |
| `de` maior que `ate` | HTTP 422 VALIDACAO. |

A comparação usa `(data_hora_agendada AT TIME ZONE 'America/Sao_Paulo')::date`, antes da paginação. Uma entrega às 02:59 UTC pode pertencer ao dia anterior em São Paulo. A ordem continua sendo data/hora da entrega decrescente, depois código numérico decrescente.

Exemplo: `GET /admin/agendamentos?de=2026-10-01&ate=2026-10-31&status=Pendente,Confirmado&limit=100&offset=0`, com sessão administrativa.

O frontend da E2 já envia esses parâmetros e faz recorte local de compatibilidade. Não é necessário alterar o frontend para ativar o filtro no servidor.

## 3. Ordem de GET /doacoes

Ordenação por `ocorrido_em DESC`, com desempate por `id_recebimento` numérico DESC, antes de `limit` e `offset`.

A consulta anterior convertia o ID para texto no SELECT e usava o mesmo nome sem qualificação no ORDER BY, o que podia ordenar o desempate como texto. Agora o ORDER BY referencia explicitamente a coluna numérica da tabela. Para o mesmo instante, o ID 10 vem antes do ID 2. IDs continuam sendo strings decimais no JSON, preservando o contrato bigint.

Estornos continuam visíveis; não houve mudança em totais, status, recebimentos existentes ou regras de confirmação.

## Contratos e documentação

OpenAPI descreve os dois limites, fuso, inclusão das datas, combinação dos filtros, erro 422 e ordenação dos recebimentos. Swagger usa esse mesmo contrato. Coleção Postman regenerada a partir do OpenAPI, com variáveis opcionais `periodo_de` e `periodo_ate` inicialmente vazias e parâmetros desabilitados por padrão. As 36 operações existentes foram preservadas.

## Validação executada

- 110 testes HTTP/PGlite aprovados: 95 anteriores e 15 novos, sem falhas, cancelamentos ou testes ignorados.
- Os novos casos cobrem limites isolados, virada de dia UTC/São Paulo, fim do dia com milissegundos, combinação com busca/status/paginação/data, ausência de filtros, intervalos invertidos, datas inválidas/repetidas, ano bissexto, autenticação, ordem de recebimentos com IDs 2 e 10, estornos e contratos.
- Nove testes de concorrência aprovados em PostgreSQL 17.11 local, com conexões independentes e role limitada, preservando o PR #36. O cluster descartável foi encerrado.
- Instalação completa e instalação apenas de dependências de produção aprovadas com Node 22 e pnpm 11.25.0, lockfile congelado.

São 119 casos declarados entre as duas suítes; as instalações são verificações separadas, não testes adicionais. Os 40 testes da E2 são de responsabilidade da entrega do frontend e não foram somados a este resultado.

Comandos na pasta backend:

```sh
pnpm install --frozen-lockfile
pnpm test
```

Para repetir a suíte PostgreSQL local já entregue no PR #36: configurar `PG_BIN` com o diretório bin dos executáveis PostgreSQL 15+ locais e executar `pnpm test:postgres`. O comando cria seu próprio banco descartável e não usa DATABASE_URL.

Evidências desta rodada: `RESULTADO-AJUSTES-POS-E2.txt`, `RESULTADO-POSTGRES-POS-E2.txt` e `INSTALACAO-NODE22-PNPM11.txt`, nesta pasta.

## Escopo e publicação

Nenhuma alteração em frontend, SQL, migrations, triggers, grants, banco de dados existente, capacidade, feriados, credenciais ou ambiente publicado. Não foi feito push, merge ou criação de PR nesta preparação. Não foi acessado Neon para testar.

1. Revisar e integrar o PR #36 no repositório do grupo; a repetição dos testes no Neon isolado segue com Vinicius.
2. Sincronizar o fork e a cópia local da develop, confirmando que o PR #36 está incluído.
3. Criar uma branch para este complemento. Se o backend tiver recebido outras alterações após a base acima, revisar a compatibilidade antes de substituir arquivos inteiros.
4. Copiar somente as pastas backend e docs do pacote para a raiz do repositório, preservando as demais pastas.
5. Conferir o diff, instalar e testar. O diff do novo PR deve mostrar somente os três ajustes e suas evidências; a correção de concorrência já integrada não deve aparecer como novidade nem ser removida.
6. Fazer commit, publicar a branch no fork e abrir novo PR com destino à develop do grupo.

Sugestão de título: `Complementa E1: ambiente Node 22, filtro de período e ordem de doações`.

Para a E3, Vinicius ainda precisa confirmar acesso/administração do serviço, hospedagem do frontend, Node 22, SLOT_CAPACITY=10, VITE_USAR_MOCK=false e CORS_ORIGINS. Esses valores não foram aplicados por este pacote.

Referências de ambiente: https://pnpm.io/installation/#compatibility ; https://pnpm.io/blog/releases/11.0 ; https://render.com/docs/node-version .
