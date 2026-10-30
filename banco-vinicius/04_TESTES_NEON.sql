-- Execute INTEIRO depois de 00_RECRIAR_BANCO_COMPLETO.sql.
-- Dados fictícios são desfeitos no ROLLBACK final. IDs consumidos não são recuperados.
-- Resultado esperado: todas as linhas com resultado OK e nenhum ERROR.
-- Se falhar antes do final: execute ROLLBACK; na mesma sessão.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE resultados_teste (ordem integer GENERATED ALWAYS AS IDENTITY, teste text, resultado text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.verificar(nome text, condicao boolean) RETURNS void
LANGUAGE plpgsql AS $f$
BEGIN
    IF condicao IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %',nome; END IF;
    INSERT INTO resultados_teste(teste,resultado) VALUES (nome,'OK');
END $f$;
CREATE FUNCTION pg_temp.esperar_erro(nome text, comando text, trecho text) RETURNS void
LANGUAGE plpgsql AS $f$
DECLARE falhou boolean := false;
BEGIN
    BEGIN
        EXECUTE comando;
    EXCEPTION WHEN OTHERS THEN
        -- Constraints usam SQLSTATE, estável mesmo se as mensagens forem traduzidas.
        IF trecho ~ '^[0-9A-Z]{5}$' THEN
            IF SQLSTATE <> trecho THEN RAISE; END IF;
        ELSIF position(trecho IN SQLERRM) = 0 THEN RAISE;
        END IF;
        falhou := true;
    END;
    PERFORM pg_temp.verificar(nome,falhou);
END $f$;

DO $teste$
DECLARE c integer; p integer; p2 integer; n bigint; n2 bigint;
    r bigint; r2 bigint; vazio bigint; d integer; ag integer;
    operacao uuid := gen_random_uuid(); inicio_mes date;
    entrega timestamptz := '2025-11-01 01:30:00+00'; v record;
BEGIN
    SELECT id_categoria INTO STRICT c FROM public.categorias_urgencia WHERE nivel_ordem=1;
    INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria)
    VALUES ('TESTE Leite 400g','latas','TESTE',c) RETURNING id_item INTO p;
    INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria)
    VALUES ('TESTE Fralda G','pacotes','TESTE',c) RETURNING id_item INTO p2;
    INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta)
    VALUES(p,c,60) RETURNING id_necessidade INTO n;
    PERFORM pg_temp.verificar('01 Necessidade inicia em zero',
        (SELECT quantidade_arrecadada=0 FROM arrecadacao.vw_termometro WHERE id_necessidade=n));
    PERFORM pg_temp.esperar_erro('02 Uma necessidade aberta por produto',
        format('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta) VALUES(%s,%s,20)',p,c),'23505');
    PERFORM pg_temp.esperar_erro('03 Meta precisa ser positiva',
        format('INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta) VALUES(%s,%s,0)',p2,c),'23514');

    INSERT INTO public.doadores(nome,email,telefone) VALUES ('TESTE',operacao::text||'@example.com','TESTE') RETURNING id_doador INTO d;
    INSERT INTO public.agendamentos(id_doador,data_hora_agendada) VALUES(d,entrega) RETURNING id_agendamento INTO ag;
    INSERT INTO public.itens_agendamento(id_agendamento,id_item,quantidade_doada) VALUES(ag,p,22);
    PERFORM pg_temp.verificar('04 Promessa não aumenta arrecadação',
        (SELECT quantidade_arrecadada=0 FROM arrecadacao.vw_termometro WHERE id_necessidade=n));

    INSERT INTO arrecadacao.recebimentos(chave_operacao,ocorrido_em) VALUES(gen_random_uuid(),entrega) RETURNING id_recebimento INTO vazio;
    PERFORM pg_temp.esperar_erro('05 Não confirmar sem itens',
        format('UPDATE arrecadacao.recebimentos SET status=''Confirmado'' WHERE id_recebimento=%s',vazio),'sem itens');
    INSERT INTO arrecadacao.recebimentos(chave_operacao,ocorrido_em,id_agendamento,id_doador)
    VALUES(operacao,entrega,ag,d) RETURNING id_recebimento INTO r;
    INSERT INTO arrecadacao.itens_recebimento(id_recebimento,id_item,id_necessidade,quantidade_recebida) VALUES(r,p,n,22);
    PERFORM pg_temp.verificar('06 Rascunho não aumenta arrecadação',
        (SELECT quantidade_arrecadada=0 FROM arrecadacao.vw_termometro WHERE id_necessidade=n));
    PERFORM pg_temp.esperar_erro('07 Quantidade recebida positiva',
        format('UPDATE arrecadacao.itens_recebimento SET quantidade_recebida=0 WHERE id_recebimento=%s',r),'23514');
    UPDATE arrecadacao.recebimentos SET status='Confirmado' WHERE id_recebimento=r;
    SELECT * INTO STRICT v FROM arrecadacao.vw_termometro WHERE id_necessidade=n;
    PERFORM pg_temp.verificar('08 Recebimento: 22/60 = 36,67%',v.quantidade_arrecadada=22 AND v.percentual_atendimento=36.67 AND v.quantidade_faltante=38);
    UPDATE arrecadacao.recebimentos SET status='Confirmado' WHERE id_recebimento=r;
    PERFORM pg_temp.verificar('09 Repetir confirmação não duplica',
        (SELECT quantidade_arrecadada=22 FROM arrecadacao.vw_termometro WHERE id_necessidade=n));
    PERFORM pg_temp.esperar_erro('10 UUID repetido recusado',
        format('INSERT INTO arrecadacao.recebimentos(chave_operacao,ocorrido_em) VALUES(%L,%L)',operacao,entrega),'23505');
    PERFORM pg_temp.esperar_erro('11 Itens confirmados são imutáveis',
        format('UPDATE arrecadacao.itens_recebimento SET quantidade_recebida=23 WHERE id_recebimento=%s',r),'Rascunho');
    PERFORM pg_temp.esperar_erro('12 Cabeçalho confirmado é imutável',
        format('UPDATE arrecadacao.recebimentos SET ocorrido_em=''2025-10-01 12:00:00-03'' WHERE id_recebimento=%s',r),'imutável');
    PERFORM pg_temp.verificar('13 Mês usa São Paulo, não UTC',
        (SELECT mes=DATE '2025-10-01' AND quantidade_arrecadada=22 FROM arrecadacao.vw_arrecadacao_mensal WHERE id_item=p));
    UPDATE public.itens_necessidades SET nome_item='TESTE Leite renomeado' WHERE id_item=p;
    PERFORM pg_temp.verificar('14 Renomear catálogo preserva nome histórico',
        (SELECT nome_item='TESTE Leite 400g' FROM arrecadacao.vw_arrecadacao_mensal WHERE id_item=p));

    INSERT INTO arrecadacao.recebimentos(chave_operacao,ocorrido_em) VALUES(gen_random_uuid(),'2025-11-15 12:00:00-03') RETURNING id_recebimento INTO r2;
    PERFORM pg_temp.esperar_erro('15 Necessidade deve corresponder ao produto',
        format('INSERT INTO arrecadacao.itens_recebimento(id_recebimento,id_item,id_necessidade,quantidade_recebida) VALUES(%s,%s,%s,1)',r2,p2,n),'incompatível');
    INSERT INTO arrecadacao.itens_recebimento(id_recebimento,id_item,id_necessidade,quantidade_recebida) VALUES(r2,p,n,50);
    UPDATE arrecadacao.recebimentos SET status='Confirmado' WHERE id_recebimento=r2;
    SELECT * INTO STRICT v FROM arrecadacao.vw_termometro WHERE id_necessidade=n;
    PERFORM pg_temp.verificar('16 Excedente: 120% e barra limitada a 100%',v.quantidade_arrecadada=72 AND v.percentual_atendimento=120 AND v.percentual_barra=100 AND v.quantidade_faltante=0);
    PERFORM pg_temp.verificar('17 Histórico mensal independe da duração da meta',
        (SELECT count(*)=2 AND sum(quantidade_arrecadada)=72 FROM arrecadacao.vw_arrecadacao_mensal WHERE id_item=p));
    PERFORM pg_temp.esperar_erro('18 Estorno exige motivo',
        format('UPDATE arrecadacao.recebimentos SET status=''Estornado'' WHERE id_recebimento=%s',r),'23514');
    UPDATE arrecadacao.recebimentos SET status='Estornado',motivo_estorno='Correção de teste' WHERE id_recebimento=r;
    PERFORM pg_temp.verificar('19 Estorno corrige mês original e preserva registro',
        (SELECT quantidade_arrecadada=50 FROM arrecadacao.vw_termometro WHERE id_necessidade=n)
        AND EXISTS(SELECT 1 FROM arrecadacao.recebimentos WHERE id_recebimento=r AND status='Estornado')
        AND NOT EXISTS(SELECT 1 FROM arrecadacao.vw_arrecadacao_mensal WHERE id_item=p AND mes=DATE '2025-10-01'));
    PERFORM pg_temp.esperar_erro('20 Histórico não pode ser apagado',
        format('DELETE FROM arrecadacao.recebimentos WHERE id_recebimento=%s',r),'não são apagados');
    UPDATE arrecadacao.necessidades SET status='Encerrada' WHERE id_necessidade=n;
    INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta) VALUES(p,c,60) RETURNING id_necessidade INTO n2;
    PERFORM pg_temp.verificar('21 Renovação inicia em zero e mantém meta anterior',
        (SELECT quantidade_arrecadada=0 FROM arrecadacao.vw_termometro WHERE id_necessidade=n2)
        AND (SELECT quantidade_arrecadada=50 FROM arrecadacao.vw_historico_necessidades WHERE id_necessidade=n));
    PERFORM pg_temp.esperar_erro('22 Data futura recusada',
        format('INSERT INTO arrecadacao.recebimentos(chave_operacao,ocorrido_em) VALUES(%L,%L)',gen_random_uuid(),clock_timestamp()+interval '1 day'),'já ocorrida');
    PERFORM pg_temp.esperar_erro('23 Agendamento com status nulo recusado',
        format('UPDATE public.agendamentos SET status_agendamento=NULL WHERE id_agendamento=%s',ag),'23502');
    PERFORM pg_temp.esperar_erro('24 Truncate do histórico recusado',
        'TRUNCATE arrecadacao.itens_recebimento','bloqueada');
    PERFORM pg_temp.verificar('25 Autoria SQL registrada',
        (SELECT registrado_por_banco=current_user AND confirmado_por_banco=current_user FROM arrecadacao.recebimentos WHERE id_recebimento=r2));
END
$teste$;
SELECT ordem,teste,resultado FROM resultados_teste ORDER BY ordem;
-- NÃO trocar por COMMIT: os dados acima são exclusivamente de teste.
ROLLBACK;
