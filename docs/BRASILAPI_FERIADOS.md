# Consulta informativa de calendário — BrasilAPI

Cliente da integração externa de Vinicius. Implementado sem dependências adicionais, para Node.js 20 ou superior, em `backend/src/integrations/brasilapi-feriados.js`. Consulta `GET https://brasilapi.com.br/api/feriados/v1/{ano}`. Não acessa o Neon nem recebe nome, e-mail, telefone ou dados do agendamento.

## Uso no backend

O backend cria uma instância na inicialização do processo para compartilhar o cache. O módulo foi incorporado à API entregue no PR #28, preservando seu servidor e as regras de agendamento.

```js
const { criarClienteFeriados } = require('./integrations/brasilapi-feriados');
const calendario = criarClienteFeriados();

// Exemplo dentro de uma função assíncrona:
const resultado = await calendario.consultarAno(2026);
if (resultado.status === 'disponivel') {
  const avisosDaData = resultado.feriados.filter(item => item.data === '2026-12-25');
  // Usar avisosDaData somente como informação complementar.
} else {
  // Mostrar "Informação de calendário indisponível no momento".
  // Continuar usando os horários e vagas da API de agendamentos.
}
```

`consultarAno` aceita um número inteiro de 1900 a 2199; argumentos inválidos provocam `RangeError` sem consulta externa. A rota valida e converte a entrada, respondendo HTTP 422 para ano inválido.

| Campo de saída | Significado |
| --- | --- |
| `status` | `disponivel` ou `indisponivel` |
| `fonte` | `BrasilAPI` |
| `ano` | Ano consultado |
| `consultado_em` | Momento da consulta em UTC; cache mantém esse instante |
| `feriados` | Lista de `{data, nome, tipo}`; `null` quando indisponível |
| `motivo` | Somente em falhas: `HTTP_<status>`, `FALHA_DE_REDE`, `TEMPO_LIMITE` ou `RESPOSTA_INVALIDA` |

O tempo limite é de cinco segundos, incluindo a leitura do JSON. Respostas são validadas: lista não vazia, datas existentes no ano solicitado e nome/tipo preenchidos. Um sucesso é reutilizado por 24 horas, uma falha por 30 segundos. Consultas simultâneas do mesmo ano compartilham uma requisição. Cache em memória limitado a oito anos; reiniciar o processo elimina o cache. Não retorna sucesso antigo depois de expirar e a fonte falhar. Não segue redirecionamentos ou faz tentativas automáticas repetidas.

## Uso da informação no formulário

- Exibir como informação da BrasilAPI; `tipo` é a classificação do provedor, não uma decisão sobre funcionamento da ONG.
- A data não deve ser bloqueada automaticamente. Disponibilidade e vagas continuam definidas pela API de agendamento.
- Ausência de uma data na lista não comprova que a ONG esteja aberta; datas locais e regras próprias podem não estar cobertas.
- Falha da consulta produz estado indisponível, nunca uma lista vazia interpretada como calendário sem feriados.
- Ao incorporar na interface, apresentar o aviso em texto, sem depender só de cor, e anunciar atualizações de forma acessível. Renderizar nomes como texto, não como HTML.

O cliente foi conectado à rota `GET /calendario/feriados/:ano` e à página funcional `/integracao/agendamento/`, servida pela própria API. A equipe aceitou o uso da BrasilAPI. A página é um ponto de integração para ensaio e futura incorporação ao frontend da equipe, que ainda não estava disponível na `develop` inspecionada. A consulta não integra `/ready` nem é pré-condição para confirmar um agendamento.

## Rota e página de integração

`GET /calendario/feriados/2026` retorna o objeto descrito acima. Um ano fora do intervalo/formato retorna HTTP 422 com `ANO_INVALIDO`. Uma falha do fornecedor retorna HTTP 200 com `status: indisponivel` e `feriados: null`: consumidores devem ler o estado, não inferir disponibilidade apenas do status HTTP. Contrato incluído em `docs/api/openapi.json`.

Com o servidor iniciado e configurado para o banco autorizado, abrir `http://localhost:3000/integracao/agendamento/` (ajustar a porta conforme `PORT`). A página consulta as necessidades da API, mostra o aviso da BrasilAPI ao escolher a data e envia um agendamento com uma seleção de item. O cliente de agendamento é baseado no cliente de referência entregue no PR #28, mantendo IDs bigint como texto e a chave de idempotência nas repetições após falha de rede.

Comportamentos implementados:

- Horários e calendário são consultados independentemente. Falha do calendário não bloqueia envio; falha da consulta de vagas impede enviar até recuperar os horários.
- Trocar a data cancela consultas anteriores e ignora respostas atrasadas.
- Textos externos são apresentados como texto, sem interpretação de HTML. Avisos usam região `aria-live`, campos têm rótulos e foco visível; layout adapta-se a telas pequenas.
- Uma resposta perdida após a gravação mantém a chave do pedido e bloqueia edição até confirmar/repetir a mesma tentativa, evitando duplicação.
- O código privado fica mascarado e apenas em memória; a página não salva contatos ou tokens no armazenamento do navegador.
- A API permite a origem da própria página e mantém a lista configurada para outras origens. Uma interface hospedada em outro domínio continua exigindo `CORS_ORIGINS`.

Não há servidor em execução permanente por esta entrega. Não executar o formulário contra `production` para ensaio. As credenciais temporárias usadas no teste real foram desativadas ao terminar; uma nova sessão interativa requer configurar uma credencial de teste válida.

## Verificações

Dentro da pasta `backend`:

```powershell
# Dez testes determinísticos, sem rede, banco ou credenciais:
node --test test/brasilapi-feriados.test.js

# Opcional/manual: uma consulta real de calendário, sem dados pessoais:
node scripts/conferir-brasilapi.cjs 2026
```

Em 14/10/2026, os dez testes passaram: contrato, datas inválidas, ano inválido, cache e isolamento entre consumidores, concorrência, HTTP 404/429/500, rede, JSON inválido, tempo limite e recuperação. Uma consulta real às 10h51, horário de São Paulo, retornou 14 datas para 2026. Essa é evidência pontual; não garante disponibilidade permanente do fornecedor. Não foram feitos testes de carga ou provocadas falhas no serviço externo: as falhas foram simuladas localmente.

Depois de incorporar rota e página, foram executados mais quatro testes HTTP e a regressão original do backend, totalizando 65 casos declarados. O teste de normalização de LF/CRLF usa a correção de Anderson publicada no PR #30; esse commit foi incorporado à branch de integração preservando a autoria, sem modificar migrations.

```powershell
# Suíte completa de casos declarados, com dependências do lockfile instaladas:
node --test test/brasilapi-feriados.test.js test/calendario-http.test.js test/compatibilidade.test.js test/estrutura.test.js
```

No navegador Edge isolado foram validados cinco fluxos: data com aviso e gravação; indisponibilidade do calendário; troca rápida de data; resposta perdida seguida de repetição sem duplicação; falha e recuperação da consulta de vagas. A verificação automatizada axe das regras WCAG 2 A/AA e 2.1 A/AA não apontou violações nos três estados examinados (formulário desktop, formulário mobile e confirmação). Isso não substitui avaliação manual de leitor de tela nem certifica conformidade integral.

Também foi executado o fluxo real da página até a BrasilAPI e o PostgreSQL da branch de ensaio, com conta limitada. A informação de Natal foi exibida e o agendamento foi gravado sem alterar o total arrecadado. O pedido fictício foi cancelado ao final. Não foi aplicada migração no banco compartilhado.

Fonte do contrato: [documentação oficial BrasilAPI](https://brasilapi.com.br/docs#tag/Feriados-Nacionais). A integração não exige chave de API na consulta realizada.
