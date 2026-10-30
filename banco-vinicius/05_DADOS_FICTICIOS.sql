-- LAR TERNURA | Dados persistentes de demonstração, todos FICTÍCIOS.
-- Execute INTEIRO em neondb, depois da instalação e do teste 04 com ROLLBACK.
-- Este arquivo termina em COMMIT: os dados ficam disponíveis para testar a aplicação.
-- Requer as tabelas de negócio vazias; recusa repetição ou mistura com dados existentes.
-- Não execute o 00 novamente. Não cria contas/senhas nem altera a estrutura do banco.
-- Datas relativas ao mês da execução em America/Sao_Paulo, sempre no passado/presente.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $verificar$
BEGIN
    IF current_database() <> 'neondb' THEN
        RAISE EXCEPTION 'Banco incorreto: selecione neondb. Atual: %.',current_database();
    END IF;
    IF to_regclass('arrecadacao.recebimentos') IS NULL THEN
        RAISE EXCEPTION 'Estrutura de arrecadação não encontrada. Confira a instalação antes de carregar dados.';
    END IF;
END $verificar$;
-- Evita duas cargas simultâneas ou gravações concorrentes durante a conferência.
LOCK TABLE public.categorias_urgencia,public.itens_necessidades,public.doadores,
    public.agendamentos,public.itens_agendamento,public.usuarios_ong,
    arrecadacao.necessidades,arrecadacao.recebimentos,arrecadacao.itens_recebimento
    IN SHARE ROW EXCLUSIVE MODE;
DO $vazio$
BEGIN
    IF EXISTS(SELECT 1 FROM public.itens_necessidades)
       OR EXISTS(SELECT 1 FROM public.doadores)
       OR EXISTS(SELECT 1 FROM public.agendamentos)
       OR EXISTS(SELECT 1 FROM public.itens_agendamento)
       OR EXISTS(SELECT 1 FROM public.usuarios_ong)
       OR EXISTS(SELECT 1 FROM arrecadacao.necessidades)
       OR EXISTS(SELECT 1 FROM arrecadacao.recebimentos)
       OR EXISTS(SELECT 1 FROM arrecadacao.itens_recebimento) THEN
        RAISE EXCEPTION 'Carga recusada: já existem dados. Demonstração exige tabelas vazias, exceto categorias. Nenhum dado foi alterado; não use reset para repetir a carga.';
    END IF;
END $vazio$;

CREATE TEMP TABLE demo_catalogo (
    chave text PRIMARY KEY, nome text, unidade text, grupo text,
    urgencia integer, meta integer, produto integer, necessidade bigint
) ON COMMIT DROP;
INSERT INTO demo_catalogo(chave,nome,unidade,grupo,urgencia,meta) VALUES
    ('leite','[DEMO] Leite em pó integral 400 g','latas','Alimentos',1,60),
    ('fralda','[DEMO] Fralda geriátrica G - pacote 8 unidades','pacotes','Higiene',1,120),
    ('arroz','[DEMO] Arroz tipo 1 - pacote 5 kg','pacotes','Alimentos',2,50),
    ('sabao','[DEMO] Sabão em pó 1 kg','caixas','Limpeza',2,40),
    ('sabonete','[DEMO] Sabonete neutro 90 g','unidades','Higiene',3,100),
    ('cobertor','[DEMO] Cobertor solteiro - item inativo','unidades','Vestuário',3,20);

DO $carga$
DECLARE
    p record; evento record; detalhe record;
    categoria integer; produto_id integer; necessidade_id bigint;
    maria integer; joao integer; mercado integer;
    parcial integer; completo integer; futuro integer; cancelado integer;
    recibo bigint;
    agora timestamptz := clock_timestamp();
    mes_local timestamp := date_trunc('month',clock_timestamp() AT TIME ZONE 'America/Sao_Paulo');
    data_anterior timestamptz;
    data_antiga timestamptz;
BEGIN
    data_anterior := (mes_local - interval '1 month' + interval '9 days 14 hours') AT TIME ZONE 'America/Sao_Paulo';
    data_antiga := (mes_local - interval '2 months' + interval '9 days 14 hours') AT TIME ZONE 'America/Sao_Paulo';

    FOR p IN SELECT * FROM demo_catalogo ORDER BY chave LOOP
        SELECT id_categoria INTO STRICT categoria FROM public.categorias_urgencia WHERE nivel_ordem=p.urgencia;
        INSERT INTO public.itens_necessidades(nome_item,unidade_medida,categoria_suprimento,id_categoria)
        VALUES(p.nome,p.unidade,p.grupo,categoria) RETURNING id_item INTO produto_id;
        INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta)
        VALUES(produto_id,categoria,p.meta) RETURNING id_necessidade INTO necessidade_id;
        UPDATE demo_catalogo SET produto=produto_id,necessidade=necessidade_id WHERE chave=p.chave;
    END LOOP;

    INSERT INTO public.doadores(nome,email,telefone,tipo_doador)
    VALUES('[DEMO] Maria Oliveira - fictícia','maria.demo@example.com','(00) 00000-0001','PF') RETURNING id_doador INTO maria;
    INSERT INTO public.doadores(nome,email,telefone,tipo_doador)
    VALUES('[DEMO] João Santos - fictício','joao.demo@example.com','(00) 00000-0002','PF') RETURNING id_doador INTO joao;
    INSERT INTO public.doadores(nome,email,telefone,tipo_doador)
    VALUES('[DEMO] Mercado Aurora - fictício','mercado.demo@example.com','(00) 00000-0003','PJ') RETURNING id_doador INTO mercado;

    INSERT INTO public.agendamentos(id_doador,data_hora_agendada,status_agendamento,observacoes)
    VALUES(maria,data_anterior,'Confirmado','[DEMO] Entrega parcial: prometidos 40 leites e 60 pacotes de fralda; recebidos 22 e 30.')
    RETURNING id_agendamento INTO parcial;
    INSERT INTO public.itens_agendamento(id_agendamento,id_item,quantidade_doada)
    SELECT parcial,produto,CASE chave WHEN 'leite' THEN 40 ELSE 60 END FROM demo_catalogo WHERE chave IN ('leite','fralda');

    INSERT INTO public.agendamentos(id_doador,data_hora_agendada,status_agendamento,observacoes)
    VALUES(mercado,data_antiga,'Confirmado','[DEMO] Entrega integral de 50 pacotes de arroz; será concluída após confirmação.')
    RETURNING id_agendamento INTO completo;
    INSERT INTO public.itens_agendamento(id_agendamento,id_item,quantidade_doada)
    SELECT completo,produto,50 FROM demo_catalogo WHERE chave='arroz';

    INSERT INTO public.agendamentos(id_doador,data_hora_agendada,observacoes)
    VALUES(joao,agora+interval '3 days','[DEMO] Promessa futura de sabonetes; não conta no termômetro.') RETURNING id_agendamento INTO futuro;
    INSERT INTO public.itens_agendamento(id_agendamento,id_item,quantidade_doada)
    SELECT futuro,produto,30 FROM demo_catalogo WHERE chave='sabonete';

    INSERT INTO public.agendamentos(id_doador,data_hora_agendada,status_agendamento,observacoes)
    VALUES(maria,agora+interval '5 days','Cancelado','[DEMO] Doadora cancelou antes da entrega; nenhum recebimento.') RETURNING id_agendamento INTO cancelado;
    INSERT INTO public.itens_agendamento(id_agendamento,id_item,quantidade_doada,status_item)
    SELECT cancelado,produto,10,'Cancelado' FROM demo_catalogo WHERE chave='leite';

    -- Cada número abaixo identifica um cenário fictício, não um ID de tabela.
    -- UUIDs fixos permitem reconhecer as entregas de demonstração.
    FOR evento IN SELECT * FROM (VALUES
        (1,maria,parcial,data_anterior,'Confirmado'),
        (2,joao,NULL::integer,agora,'Confirmado'),
        (3,mercado,completo,data_antiga,'Confirmado'),
        (4,mercado,NULL::integer,agora,'Confirmado'),
        (5,maria,NULL::integer,data_anterior,'Estornado'),
        (6,joao,NULL::integer,agora,'Rascunho'),
        (7,NULL::integer,NULL::integer,data_anterior,'Confirmado'),
        (8,NULL::integer,NULL::integer,agora,'Confirmado')
    ) AS e(numero,doador,agenda,data_entrega,estado) LOOP
        INSERT INTO arrecadacao.recebimentos(chave_operacao,id_doador,id_agendamento,ocorrido_em)
        VALUES(('10000000-0000-4000-8000-'||lpad(evento.numero::text,12,'0'))::uuid,
            evento.doador,evento.agenda,evento.data_entrega)
        RETURNING id_recebimento INTO recibo;
        FOR detalhe IN SELECT * FROM (VALUES
            (1,'leite',22,true),(1,'fralda',30,true),
            (2,'fralda',30,true),(3,'arroz',50,true),(4,'sabao',50,true),
            (5,'leite',5,true),(6,'sabonete',15,true),(7,'cobertor',5,true),
            (8,'fralda',10,false)
        ) AS i(numero,chave,quantidade,vincula_meta) WHERE numero=evento.numero LOOP
            SELECT * INTO STRICT p FROM demo_catalogo WHERE chave=detalhe.chave;
            INSERT INTO arrecadacao.itens_recebimento(id_recebimento,id_item,id_necessidade,quantidade_recebida)
            VALUES(recibo,p.produto,CASE WHEN detalhe.vincula_meta THEN p.necessidade ELSE NULL END,detalhe.quantidade);
        END LOOP;
        IF evento.estado <> 'Rascunho' THEN
            UPDATE arrecadacao.recebimentos SET status='Confirmado' WHERE id_recebimento=recibo;
        END IF;
        IF evento.estado = 'Estornado' THEN
            UPDATE arrecadacao.recebimentos SET status='Estornado',motivo_estorno='[DEMO] Lançamento duplicado identificado na conferência; entrega já contabilizada.'
            WHERE id_recebimento=recibo;
        END IF;
    END LOOP;

    -- O encerramento do agendamento é uma ação administrativa explícita.
    UPDATE public.itens_agendamento SET status_item='Entregue' WHERE id_agendamento=completo;
    UPDATE public.agendamentos SET status_agendamento='Concluído' WHERE id_agendamento=completo;

    -- Arroz: meta antiga atendida, depois renovada em zero, preservando histórico.
    SELECT * INTO STRICT p FROM demo_catalogo WHERE chave='arroz';
    UPDATE arrecadacao.necessidades SET status='Encerrada' WHERE id_necessidade=p.necessidade;
    SELECT id_categoria INTO STRICT categoria FROM public.itens_necessidades WHERE id_item=p.produto;
    INSERT INTO arrecadacao.necessidades(id_item,id_categoria,quantidade_meta) VALUES(p.produto,categoria,50);

    -- Item inativo desaparece da vitrine, mas permanece nos relatórios históricos.
    UPDATE public.itens_necessidades SET ativo=false WHERE id_item=(SELECT produto FROM demo_catalogo WHERE chave='cobertor');
END $carga$;
COMMIT;

-- Esperado: 5 linhas públicas. Percentuais: leite 36,67; fralda 50;
-- arroz 0; sabão 125 (barra 100); sabonete 0. Cobertor não aparece.
SELECT nome_item,unidade_medida,quantidade_meta,quantidade_arrecadada,
       quantidade_faltante,percentual_atendimento,percentual_barra,urgencia
FROM arrecadacao.vw_termometro ORDER BY nivel_ordem,nome_item;
-- Arrecadação por mês inclui entregas sem meta e exclui rascunhos/estornos.
SELECT * FROM arrecadacao.vw_arrecadacao_mensal ORDER BY mes,nome_item;
SELECT status,count(*) AS quantidade FROM arrecadacao.recebimentos GROUP BY status ORDER BY status;
