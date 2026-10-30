# Correção de concorrência — renovação de meta e confirmação de entrega

Preparada em 26/10/2026 sobre a develop `e0bf27532af5e5cd7556a49abf0261b38e43c50f`, após o merge do PR #35. Contrato da API continua 2.1.0; novo erro recuperável usa HTTP 409. Nenhuma alteração em migrações, tabelas, triggers, permissões, frontend, capacidade ou feriados.

## Defeito confirmado

O relato de Vinicius foi reproduzido em PostgreSQL 17.11 local com duas conexões independentes e uma role limitada de aplicação. Uma terceira conexão de controle apenas instala os dados fictícios e observa `pg_blocking_pids`; não participa das operações de negócio.

Na versão anterior, quando a confirmação espera uma renovação na consulta `WHERE status='Aberta' ... FOR UPDATE`, o PostgreSQL em READ COMMITTED reavalia o estado da meta antiga após a espera. Como ela já foi encerrada, não retorna aquela linha. A meta substituta, inserida após o início da consulta, não pertence à mesma fotografia. A API interpretava esse resultado como ausência real de meta e gravava `id_necessidade: null`.

O teste anterior à correção falhou como esperado: vínculo obtido null, vínculo esperado na nova meta. Resultado em `REPRODUCAO-ANTES-DA-CORRECAO.txt`. Essa falha é a evidência do defeito original, não um resultado da versão corrigida.

## Ajuste

`Store.lockCurrentNeeds()` separa duas operações:

1. Descobrir os IDs das necessidades abertas dos produtos recebidos.
2. Travar esses IDs em ordem crescente, sem filtrar status na consulta de trava, e conferir se continuam abertos.

Uma meta encerrada durante a espera agora é retornada com o estado atualizado, em vez de desaparecer silenciosamente. Nesse caso a API repete a descoberta usando uma nova fotografia, encontra a substituta e a trava antes de gravar o recebimento. A trava permanece até o fim da transação de receber-e-concluir.

Se cinco tentativas seguidas não estabilizarem a seleção, a operação retorna 409 `META_EM_ALTERACAO`. Recebimento, conclusão e chave da tentativa são desfeitos. O cliente pode repetir com a mesma chave e o mesmo corpo. Não há retry de transação já confirmada nem duplicação de crédito.

O fluxo legítimo sem necessidade aberta permanece: somente uma descoberta realmente sem meta retorna ausência de vínculo. Se o encerramento sem substituta vencer a corrida, a entrega sem meta conta no total mensal. A correção não força um vínculo inventado.

## Ordem das operações e histórico

- Renovação concluída primeiro: recebimento vinculado à meta nova, com crédito no termômetro atual.
- Confirmação travada primeiro: renovação aguarda; recebimento permanece corretamente vinculado à meta anterior e ao seu histórico. A nova meta inicia sem esse crédito. Isso corresponde à ordem efetiva das operações, não a uma perda de arrecadação.
- Não foi alterado nem estornado automaticamente nenhum recebimento já existente sem vínculo. Caso haja dados de teste antigos ou dados reais a corrigir, precisam de análise separada; esta entrega previne o defeito em novas operações.

## Testes e reprodução

Os nove testes PostgreSQL usam barreiras e inspeção de bloqueios para forçar a sobreposição real; não dependem apenas de atrasos arbitrários. Cobrem:

1. Renovação da API vencendo a corrida, com vínculo e termômetro novos corretos.
2. Renovação equivalente por SQL direto, sem exigir mudança do procedimento de escrita do banco.
3. Vários produtos com somente uma das metas renovada.
4. Encerramento sem substituta e crédito mensal sem meta.
5. Confirmação vencendo a corrida, histórico anterior preservado e retry idempotente.
6. Renovações sucessivas, erro recuperável, rollback integral e recuperação com a mesma chave.
7. Duas conexões confirmando com a mesma chave, gerando somente um recebimento.
8. Cinco corridas controladas consecutivas, sem perda de vínculo.
9. IDs 2 e 10 travados em ordem numérica, compatível com a ordem dos triggers, evitando a ordenação textual de IDs retornados como strings.

As sessões de negócio usam a role limitada com os mesmos grants do exemplo da API. As verificações foram locais, não no Neon. A regressão PGlite da E1 é separada dessa validação e não deve ser apresentada como prova de concorrência PostgreSQL.

Na pasta backend:

```powershell
pnpm install --frozen-lockfile
pnpm test

# PostgreSQL 15+ instalado ou extraído localmente; ajustar o caminho real.
$env:PG_BIN = 'C:\Program Files\PostgreSQL\17\bin'
pnpm test:postgres
```

No Linux/macOS, definir PG_BIN para o diretório dos binários correspondentes e executar o mesmo comando. O runner foi executado no Windows nesta preparação; outros sistemas não foram ensaiados.

O runner cria um cluster novo numa pasta temporária, autenticação SCRAM com senha aleatória, porta local livre e banco `lt_concorrencia_*`. Não usa `DATABASE_URL`, não aponta a Neon e não instala serviço. Ao terminar encerra o servidor. Os arquivos temporários do cluster permanecem para diagnóstico. Os binários PostgreSQL não acompanham o ZIP.

O teste interno recusa conexões remotas, nomes de banco fora do prefixo de teste e ausência da confirmação de descarte configurada pelo runner. Não executar o SQL de recriação manualmente contra um banco existente. Apenas o runner cria o ambiente descartável para esses ensaios.

## Entrega ao grupo

Aplicar o pacote numa nova branch baseada na develop atualizada e abrir outro PR. Aguardar revisão e nova validação do Vinicius no Neon isolado antes da publicação. A API, banco e Render publicados não foram alterados por esta preparação.

Referência técnica: [PostgreSQL — Read Committed](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED).
