-- Exemplos de OPERAÇÃO REAL. As escritas estão comentadas de propósito.
-- Execute apenas o bloco desejado, após preencher os valores e retirar /* ... */.
-- Não executar estes exemplos como seed. Para testes use 04_TESTES_NEON.sql.
SELECT id_categoria,nome_categoria,nivel_ordem FROM public.categorias_urgencia ORDER BY nivel_ordem;
SELECT id_item,nome_item,unidade_medida,ativo FROM public.itens_necessidades ORDER BY id_item;
SELECT * FROM arrecadacao.vw_termometro ORDER BY nivel_ordem,nome_item;

-- A. Cadastrar produto e abrir uma necessidade (substitua os valores de exemplo).
/*
BEGIN;
DO $operacao$
DECLARE produto integer; categoria integer;
BEGIN
    SELECT id_categoria INTO STRICT categoria FROM public.categorias_urgencia WHERE nivel_ordem=1;
    INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria)
    VALUES ('PREENCHER nome e tamanho do produto','latas','Alimentos',categoria)
    RETURNING id_item INTO produto;
    INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta)
    VALUES (produto,categoria,60);
END $operacao$;
COMMIT;
*/

-- B. Registrar uma entrega espontânea e confirmar na MESMA transação.
-- Gere a chave uma vez com SELECT gen_random_uuid(); copie o UUID para operacao.
-- Em uma repetição após falha de conexão, reutilize a MESMA chave, não gere outra.
-- Preencha IDs reais consultados acima. Sem necessidade: deixar necessidade NULL.
-- Doador e agendamento omitidos neste exemplo; para vínculo, informar ambos.
/*
BEGIN;
DO $entrega$
DECLARE
    produto integer := NULL;       -- ID real do produto
    necessidade bigint := NULL;    -- ID real da necessidade, se houver
    quantidade integer := NULL;    -- número inteiro de unidades do catálogo
    data_entrega timestamptz := NULL; -- exemplo de formato: '2026-10-10 14:00:00-03'
    operacao uuid := NULL;          -- UUID fixo desta operação
    recebimento bigint;
BEGIN
    IF produto IS NULL OR quantidade IS NULL OR data_entrega IS NULL OR operacao IS NULL THEN
        RAISE EXCEPTION 'Preencha produto, quantidade, data_entrega e operacao antes de executar.';
    END IF;
    INSERT INTO arrecadacao.recebimentos(chave_operacao,ocorrido_em)
    VALUES(operacao,data_entrega) RETURNING id_recebimento INTO recebimento;
    INSERT INTO arrecadacao.itens_recebimento(id_recebimento,id_item,id_necessidade,quantidade_recebida)
    VALUES(recebimento,produto,necessidade,quantidade);
    UPDATE arrecadacao.recebimentos SET status='Confirmado' WHERE id_recebimento=recebimento;
END $entrega$;
COMMIT;
*/

-- C. Renovar uma necessidade sem apagar a anterior.
/*
BEGIN;
DO $renovacao$
DECLARE anterior bigint := NULL; nova_meta integer := NULL; n record;
BEGIN
    IF anterior IS NULL OR nova_meta IS NULL THEN RAISE EXCEPTION 'Preencha anterior e nova_meta.'; END IF;
    SELECT * INTO STRICT n FROM arrecadacao.necessidades WHERE id_necessidade=anterior FOR UPDATE;
    IF n.status <> 'Aberta' THEN RAISE EXCEPTION 'A necessidade já foi encerrada/cancelada.'; END IF;
    UPDATE arrecadacao.necessidades SET status='Encerrada' WHERE id_necessidade=anterior;
    INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta)
    VALUES(n.id_item,n.id_categoria,nova_meta);
END $renovacao$;
COMMIT;
*/

-- D. Estornar uma entrega incorreta. Estorna TODOS os itens desse recebimento.
-- Se só um item estava errado, registre uma entrega substituta com todos os itens
-- corretos e a data efetiva original. Use uma nova chave nessa correção.
/*
BEGIN;
DO $estorno$
DECLARE recebimento bigint := NULL; motivo text := NULL;
BEGIN
    IF recebimento IS NULL OR motivo IS NULL OR btrim(motivo)='' THEN
        RAISE EXCEPTION 'Preencha recebimento e motivo.';
    END IF;
    UPDATE arrecadacao.recebimentos SET status='Estornado',motivo_estorno=motivo
    WHERE id_recebimento=recebimento AND status='Confirmado';
    IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado ou não confirmado.'; END IF;
END $estorno$;
COMMIT;
*/

-- E. Histórico mensal: quantidades de PRODUTOS, não dinheiro e não estoque.
SELECT mes,id_item,nome_item,unidade_medida,quantidade_arrecadada,entregas
FROM arrecadacao.vw_arrecadacao_mensal ORDER BY mes DESC,nome_item;
-- Nome é o registrado na entrega. Se houve renomeação no mesmo mês, pode haver
-- mais de uma linha do mesmo id_item. Para total independente do nome:
SELECT mes,id_item,unidade_medida,sum(quantidade_arrecadada) AS quantidade_arrecadada
FROM arrecadacao.vw_arrecadacao_mensal GROUP BY mes,id_item,unidade_medida ORDER BY mes DESC,id_item;
-- Não some a coluna entregas dessa view para obter entregas globais:
-- uma entrega pode conter vários produtos. Conte os cabeçalhos diretamente.
SELECT date_trunc('month',ocorrido_em AT TIME ZONE 'America/Sao_Paulo')::date AS mes,count(*) AS entregas
FROM arrecadacao.recebimentos WHERE status='Confirmado' GROUP BY 1 ORDER BY 1 DESC;
