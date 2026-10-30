-- LAR TERNURA | RECRIAÇÃO COMPLETA | PostgreSQL 15+
-- DESTRUTIVO: apaga TODOS os objetos/dados de public e arrecadacao e dependências.
-- Execute INTEIRO no SQL Editor, depois de selecionar projeto, branch e banco.
-- Banco alvo preenchido: neondb. Confira também o projeto e a branch no SQL Editor.
-- Não exclui o projeto Neon, a branch, roles nem o contêiner DATABASE.
-- Outros schemas de aplicação/extensões nestes schemas causam aborto para análise.
-- Qualquer erro: pare; execute ROLLBACK; na mesma sessão. Não execute trechos isolados.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $alvo$
DECLARE banco_alvo text := 'neondb'; outros text;
BEGIN
    IF banco_alvo IS DISTINCT FROM current_database() THEN
        RAISE EXCEPTION 'Banco incorreto. Esperado: %; conexão atual: %.',banco_alvo,current_database();
    END IF;
    IF current_setting('server_version_num')::integer < 150000 THEN
        RAISE EXCEPTION 'Requer PostgreSQL 15 ou superior.';
    END IF;
    SELECT string_agg(nspname,', ') INTO outros FROM pg_namespace
    WHERE nspname NOT IN ('public','arrecadacao','information_schema') AND nspname NOT LIKE 'pg\_%' ESCAPE '\';
    IF outros IS NOT NULL THEN
        RAISE EXCEPTION 'Existem outros schemas: %. Revise o escopo antes de recriar; nada foi apagado.',outros;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
               WHERE n.nspname IN ('public','arrecadacao')) THEN
        RAISE EXCEPTION 'Há extensões em public/arrecadacao. Revise antes de remover seus objetos; nada foi apagado.';
    END IF;
END
$alvo$;

DROP SCHEMA IF EXISTS arrecadacao CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

CREATE TABLE public.categorias_urgencia (
    id_categoria integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_categoria varchar(50) NOT NULL UNIQUE CHECK (btrim(nome_categoria) <> ''),
    cor_indicador varchar(20) NOT NULL CHECK (cor_indicador ~ '^#[0-9A-Fa-f]{6}$'),
    descricao_prioridade text,
    nivel_ordem integer NOT NULL UNIQUE CHECK (nivel_ordem > 0)
);
CREATE TABLE public.itens_necessidades (
    id_item integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_item varchar(120) NOT NULL CHECK (btrim(nome_item) <> ''),
    unidade_medida varchar(20) NOT NULL CHECK (btrim(unidade_medida) <> ''),
    categoria_suprimento varchar(50) NOT NULL CHECK (btrim(categoria_suprimento) <> ''),
    id_categoria integer NOT NULL REFERENCES public.categorias_urgencia ON DELETE RESTRICT,
    ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE public.doadores (
    id_doador integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome varchar(120) NOT NULL CHECK (btrim(nome) <> ''),
    email varchar(120) NOT NULL CHECK (btrim(email) <> ''),
    telefone varchar(20) NOT NULL CHECK (btrim(telefone) <> ''),
    tipo_doador varchar(10) NOT NULL DEFAULT 'PF' CHECK (tipo_doador IN ('PF','PJ')),
    data_cadastro timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX doadores_email_unico ON public.doadores (lower(btrim(email)));
CREATE TABLE public.agendamentos (
    id_agendamento integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_doador integer NOT NULL REFERENCES public.doadores ON DELETE RESTRICT,
    data_hora_agendada timestamptz NOT NULL CHECK (isfinite(data_hora_agendada)),
    status_agendamento varchar(30) NOT NULL DEFAULT 'Pendente'
        CHECK (status_agendamento IN ('Pendente','Confirmado','Concluído','Cancelado')),
    observacoes text,
    data_criacao timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX agendamentos_doador ON public.agendamentos(id_doador);
CREATE INDEX agendamentos_data ON public.agendamentos(data_hora_agendada);
CREATE TABLE public.itens_agendamento (
    id_agendamento integer NOT NULL REFERENCES public.agendamentos ON DELETE RESTRICT,
    id_item integer NOT NULL REFERENCES public.itens_necessidades ON DELETE RESTRICT,
    quantidade_doada integer NOT NULL CHECK (quantidade_doada > 0),
    status_item varchar(30) NOT NULL DEFAULT 'Agendado' CHECK (status_item IN ('Agendado','Entregue','Cancelado')),
    PRIMARY KEY (id_agendamento,id_item)
);
CREATE INDEX itens_agendamento_produto ON public.itens_agendamento(id_item);
CREATE TABLE public.usuarios_ong (
    id_usuario integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome varchar(120) NOT NULL CHECK (btrim(nome) <> ''),
    email varchar(120) NOT NULL CHECK (btrim(email) <> ''),
    senha_hash varchar(255) NOT NULL CHECK (btrim(senha_hash) <> ''),
    cargo varchar(50) NOT NULL DEFAULT 'Administrador' CHECK (btrim(cargo) <> ''),
    ativo boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX usuarios_email_unico ON public.usuarios_ong (lower(btrim(email)));

INSERT INTO public.categorias_urgencia(nome_categoria,cor_indicador,nivel_ordem) VALUES
    ('Alta/Crítica','#EF4444',1),('Média','#F59E0B',2),('Baixa','#10B981',3);
COMMENT ON TABLE public.itens_necessidades IS 'Catálogo de produtos. Metas ficam em arrecadacao.necessidades; não representa estoque físico.';
COMMENT ON COLUMN public.itens_necessidades.id_categoria IS 'Sugestão inicial de urgência do catálogo. Cada necessidade registra sua própria classificação.';
COMMENT ON COLUMN public.itens_agendamento.quantidade_doada IS 'Quantidade PROMETIDA. Entregas efetivas ficam em arrecadacao.itens_recebimento.';
COMMENT ON COLUMN public.usuarios_ong.senha_hash IS 'Hash gerado pelo backend; nunca inserir senha em texto puro. Autenticação não implementada pelo DDL.';
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- As três tabelas de arrecadação, regras e views são incluídas abaixo.

CREATE SCHEMA arrecadacao;
REVOKE ALL ON SCHEMA arrecadacao FROM PUBLIC;
COMMENT ON SCHEMA arrecadacao IS
    'Lar Ternura v1: necessidades sem calendário obrigatório e recebimentos efetivos; sem controle de estoque físico.';

CREATE TABLE arrecadacao.necessidades (
    id_necessidade bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_item integer NOT NULL REFERENCES public.itens_necessidades(id_item) ON DELETE RESTRICT,
    id_categoria integer NOT NULL REFERENCES public.categorias_urgencia(id_categoria) ON DELETE RESTRICT,
    nome_item_registrado text NOT NULL,
    unidade_registrada text NOT NULL CHECK (btrim(unidade_registrada) <> ''),
    quantidade_meta integer NOT NULL CHECK (quantidade_meta > 0),
    status text NOT NULL DEFAULT 'Aberta' CHECK (status IN ('Aberta','Encerrada','Cancelada')),
    criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
    criada_por integer REFERENCES public.usuarios_ong(id_usuario) ON DELETE RESTRICT,
    criada_por_banco text NOT NULL DEFAULT current_user,
    encerrada_em timestamptz,
    encerrada_por integer REFERENCES public.usuarios_ong(id_usuario) ON DELETE RESTRICT,
    encerrada_por_banco text,
    UNIQUE (id_necessidade,id_item),
    CHECK ((status = 'Aberta' AND encerrada_em IS NULL AND encerrada_por IS NULL AND encerrada_por_banco IS NULL)
        OR (status <> 'Aberta' AND encerrada_em IS NOT NULL AND encerrada_por_banco IS NOT NULL))
);
CREATE UNIQUE INDEX uma_necessidade_aberta_por_item
    ON arrecadacao.necessidades(id_item) WHERE status = 'Aberta';

CREATE TABLE arrecadacao.recebimentos (
    id_recebimento bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave_operacao uuid NOT NULL UNIQUE,
    id_doador integer REFERENCES public.doadores(id_doador) ON DELETE RESTRICT,
    id_agendamento integer REFERENCES public.agendamentos(id_agendamento) ON DELETE RESTRICT,
    ocorrido_em timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho','Confirmado','Estornado')),
    registrado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
    registrado_por integer REFERENCES public.usuarios_ong(id_usuario) ON DELETE RESTRICT,
    registrado_por_banco text NOT NULL DEFAULT current_user,
    confirmado_em timestamptz,
    confirmado_por integer REFERENCES public.usuarios_ong(id_usuario) ON DELETE RESTRICT,
    confirmado_por_banco text,
    estornado_em timestamptz,
    estornado_por integer REFERENCES public.usuarios_ong(id_usuario) ON DELETE RESTRICT,
    estornado_por_banco text,
    motivo_estorno text,
    CHECK (id_agendamento IS NULL OR id_doador IS NOT NULL),
    CHECK (
        (status = 'Rascunho' AND confirmado_em IS NULL AND confirmado_por IS NULL
            AND confirmado_por_banco IS NULL AND estornado_em IS NULL
            AND estornado_por IS NULL AND estornado_por_banco IS NULL AND motivo_estorno IS NULL)
        OR (status = 'Confirmado' AND confirmado_em IS NOT NULL AND confirmado_por_banco IS NOT NULL
            AND estornado_em IS NULL AND estornado_por IS NULL AND estornado_por_banco IS NULL AND motivo_estorno IS NULL)
        OR (status = 'Estornado' AND confirmado_em IS NOT NULL AND confirmado_por_banco IS NOT NULL
            AND estornado_em IS NOT NULL AND estornado_por_banco IS NOT NULL
            AND motivo_estorno IS NOT NULL AND btrim(motivo_estorno) <> '')
    )
);

CREATE TABLE arrecadacao.itens_recebimento (
    id_recebimento bigint NOT NULL REFERENCES arrecadacao.recebimentos(id_recebimento) ON DELETE RESTRICT,
    id_item integer NOT NULL REFERENCES public.itens_necessidades(id_item) ON DELETE RESTRICT,
    id_necessidade bigint,
    quantidade_recebida integer NOT NULL CHECK (quantidade_recebida > 0),
    nome_item_registrado text NOT NULL,
    unidade_registrada text NOT NULL CHECK (btrim(unidade_registrada) <> ''),
    PRIMARY KEY (id_recebimento,id_item),
    FOREIGN KEY (id_necessidade,id_item)
        REFERENCES arrecadacao.necessidades(id_necessidade,id_item) ON DELETE RESTRICT
);

CREATE INDEX recebimentos_confirmados_data ON arrecadacao.recebimentos(ocorrido_em)
    WHERE status = 'Confirmado';
CREATE INDEX recebimentos_agendamento ON arrecadacao.recebimentos(id_agendamento)
    WHERE id_agendamento IS NOT NULL;
CREATE INDEX recebimentos_doador ON arrecadacao.recebimentos(id_doador) WHERE id_doador IS NOT NULL;
CREATE INDEX itens_recebimento_necessidade ON arrecadacao.itens_recebimento(id_necessidade,id_item)
    WHERE id_necessidade IS NOT NULL;
CREATE INDEX itens_recebimento_produto ON arrecadacao.itens_recebimento(id_item);

-- Autoria de aplicação não substitui autenticação. NULL permite uso do SQL Editor
-- pelo responsável pelo banco. A aplicação futura deve fornecer o usuário autenticado.
CREATE FUNCTION arrecadacao.validar_usuario(p_id integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
BEGIN
    IF p_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.usuarios_ong WHERE id_usuario = p_id AND ativo IS TRUE
    ) THEN
        RAISE EXCEPTION 'Usuário da ONG inexistente ou inativo.';
    END IF;
END
$fn$;

CREATE FUNCTION arrecadacao.proteger_necessidade() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE v_item record;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Preserve o histórico: encerre ou cancele a necessidade.';
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'Aberta' THEN RAISE EXCEPTION 'Uma necessidade deve iniciar Aberta.'; END IF;
        SELECT nome_item,unidade_medida,ativo INTO v_item
            FROM public.itens_necessidades WHERE id_item = NEW.id_item FOR SHARE;
        IF NOT FOUND OR v_item.ativo IS NOT TRUE THEN RAISE EXCEPTION 'Produto inexistente ou inativo.'; END IF;
        PERFORM arrecadacao.validar_usuario(NEW.criada_por);
        NEW.nome_item_registrado := v_item.nome_item;
        NEW.unidade_registrada := v_item.unidade_medida;
        NEW.criada_em := clock_timestamp();
        NEW.criada_por_banco := current_user;
    ELSE
        IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
        IF OLD.status <> 'Aberta' OR NEW.status NOT IN ('Encerrada','Cancelada') THEN
            RAISE EXCEPTION 'Encerre a necessidade e crie outra para renovar ou corrigir a meta.';
        END IF;
        IF (to_jsonb(NEW) - ARRAY['status','encerrada_por']) IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['status','encerrada_por']) THEN
            RAISE EXCEPTION 'Produto, meta e histórico da necessidade são imutáveis.';
        END IF;
        PERFORM arrecadacao.validar_usuario(NEW.encerrada_por);
        NEW.encerrada_em := clock_timestamp();
        NEW.encerrada_por_banco := current_user;
    END IF;
    RETURN NEW;
END
$fn$;
CREATE TRIGGER proteger_necessidade BEFORE INSERT OR UPDATE OR DELETE ON arrecadacao.necessidades
    FOR EACH ROW EXECUTE FUNCTION arrecadacao.proteger_necessidade();

CREATE FUNCTION arrecadacao.validar_agendamento(p_agendamento integer,p_doador integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE v_ag record;
BEGIN
    IF p_agendamento IS NULL THEN RETURN; END IF;
    SELECT id_doador,status_agendamento INTO v_ag FROM public.agendamentos
        WHERE id_agendamento = p_agendamento FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento inexistente.'; END IF;
    IF v_ag.id_doador IS DISTINCT FROM p_doador THEN RAISE EXCEPTION 'Doador não corresponde ao agendamento.'; END IF;
    IF (v_ag.status_agendamento IN ('Pendente','Confirmado')) IS NOT TRUE THEN
        RAISE EXCEPTION 'Agendamento cancelado/concluído não pode receber novo crédito neste fluxo.';
    END IF;
END
$fn$;

CREATE FUNCTION arrecadacao.proteger_recebimento() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Recebimentos não são apagados: estorne com motivo.'; END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'Rascunho' THEN RAISE EXCEPTION 'Inicie como Rascunho, adicione itens e confirme.'; END IF;
        PERFORM arrecadacao.validar_usuario(NEW.registrado_por);
        NEW.registrado_em := clock_timestamp();
        NEW.registrado_por_banco := current_user;
    ELSE
        IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
        IF OLD.status = 'Estornado' THEN RAISE EXCEPTION 'Estorno é definitivo; registre um novo recebimento correto.'; END IF;
        IF OLD.status = 'Confirmado' THEN
            IF NEW.status <> 'Estornado' OR
               (to_jsonb(NEW) - ARRAY['status','estornado_por','motivo_estorno']) IS DISTINCT FROM
               (to_jsonb(OLD) - ARRAY['status','estornado_por','motivo_estorno']) THEN
                RAISE EXCEPTION 'Recebimento confirmado é imutável; somente estorno com motivo é permitido.';
            END IF;
            PERFORM arrecadacao.validar_usuario(NEW.estornado_por);
            NEW.estornado_em := clock_timestamp();
            NEW.estornado_por_banco := current_user;
            RETURN NEW;
        END IF;
        IF NEW.status NOT IN ('Rascunho','Confirmado') THEN RAISE EXCEPTION 'Transição de recebimento inválida.'; END IF;
        IF (to_jsonb(NEW) - ARRAY['id_doador','id_agendamento','ocorrido_em','status','confirmado_por']) IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['id_doador','id_agendamento','ocorrido_em','status','confirmado_por']) THEN
            RAISE EXCEPTION 'Não altere identidade, chave da operação ou autoria de registro.';
        END IF;
    END IF;
    IF NOT isfinite(NEW.ocorrido_em) OR NEW.ocorrido_em > clock_timestamp() THEN
        RAISE EXCEPTION 'Informe a data real de uma entrega já ocorrida, com fuso horário.';
    END IF;
    PERFORM arrecadacao.validar_agendamento(NEW.id_agendamento,NEW.id_doador);
    IF NEW.status = 'Confirmado' THEN
        PERFORM arrecadacao.validar_usuario(NEW.confirmado_por);
        IF NOT EXISTS (SELECT 1 FROM arrecadacao.itens_recebimento WHERE id_recebimento = NEW.id_recebimento) THEN
            RAISE EXCEPTION 'Não é possível confirmar um recebimento sem itens.';
        END IF;
        PERFORM i.id_item FROM public.itens_necessidades i
            JOIN arrecadacao.itens_recebimento ir ON ir.id_item = i.id_item
            WHERE ir.id_recebimento = NEW.id_recebimento ORDER BY i.id_item FOR SHARE OF i;
        IF EXISTS (
            SELECT 1 FROM arrecadacao.itens_recebimento ir
            JOIN public.itens_necessidades i ON i.id_item = ir.id_item
            WHERE ir.id_recebimento = NEW.id_recebimento
              AND (i.ativo IS NOT TRUE OR i.unidade_medida IS DISTINCT FROM ir.unidade_registrada)
        ) THEN RAISE EXCEPTION 'Produto foi desativado ou sua unidade mudou; revise o rascunho.'; END IF;
        -- Mesma ordem de travas para confirmar vários itens; fechamento aguarda.
        PERFORM n.id_necessidade FROM arrecadacao.necessidades n
            JOIN arrecadacao.itens_recebimento ir ON ir.id_necessidade = n.id_necessidade
            WHERE ir.id_recebimento = NEW.id_recebimento ORDER BY n.id_necessidade FOR UPDATE OF n;
        IF EXISTS (
            SELECT 1 FROM arrecadacao.itens_recebimento ir
            JOIN arrecadacao.necessidades n ON n.id_necessidade = ir.id_necessidade
            WHERE ir.id_recebimento = NEW.id_recebimento
              AND (n.status = 'Cancelada' OR (n.status = 'Encerrada' AND NEW.ocorrido_em > n.encerrada_em))
        ) THEN RAISE EXCEPTION 'Necessidade cancelada ou entrega posterior ao encerramento. Revise o rascunho.'; END IF;
        IF NEW.id_agendamento IS NOT NULL AND EXISTS (
            SELECT 1 FROM arrecadacao.itens_recebimento ir
            WHERE ir.id_recebimento = NEW.id_recebimento AND NOT EXISTS (
                SELECT 1 FROM public.itens_agendamento ia WHERE ia.id_agendamento = NEW.id_agendamento
                    AND ia.id_item = ir.id_item AND ia.status_item = 'Agendado'
            )
        ) THEN RAISE EXCEPTION 'Produto não prometido, cancelado ou já entregue no agendamento legado.'; END IF;
        NEW.confirmado_em := clock_timestamp();
        NEW.confirmado_por_banco := current_user;
    END IF;
    RETURN NEW;
END
$fn$;
CREATE TRIGGER proteger_recebimento BEFORE INSERT OR UPDATE OR DELETE ON arrecadacao.recebimentos
    FOR EACH ROW EXECUTE FUNCTION arrecadacao.proteger_recebimento();

CREATE FUNCTION arrecadacao.proteger_item_recebimento() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE v_recebimento record; v_produto record; v_necessidade record; v_id bigint;
BEGIN
    IF TG_OP = 'DELETE' THEN v_id := OLD.id_recebimento; ELSE v_id := NEW.id_recebimento; END IF;
    IF TG_OP = 'UPDATE' AND (NEW.id_recebimento,NEW.id_item) IS DISTINCT FROM (OLD.id_recebimento,OLD.id_item) THEN
        RAISE EXCEPTION 'Para trocar produto em rascunho, remova o item e adicione o produto correto.';
    END IF;
    SELECT status,id_agendamento,id_doador,ocorrido_em INTO v_recebimento FROM arrecadacao.recebimentos
        WHERE id_recebimento = v_id FOR UPDATE;
    IF NOT FOUND OR v_recebimento.status <> 'Rascunho' THEN
        RAISE EXCEPTION 'Somente itens de recebimento em Rascunho podem ser alterados.';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    PERFORM arrecadacao.validar_agendamento(v_recebimento.id_agendamento,v_recebimento.id_doador);
    SELECT nome_item,unidade_medida,ativo INTO v_produto FROM public.itens_necessidades
        WHERE id_item = NEW.id_item FOR SHARE;
    IF NOT FOUND OR v_produto.ativo IS NOT TRUE THEN RAISE EXCEPTION 'Produto inexistente ou inativo.'; END IF;
    IF NEW.id_necessidade IS NOT NULL THEN
        SELECT id_item,status,unidade_registrada,encerrada_em INTO v_necessidade FROM arrecadacao.necessidades
            WHERE id_necessidade = NEW.id_necessidade FOR UPDATE;
        IF NOT FOUND OR v_necessidade.id_item <> NEW.id_item OR v_necessidade.status = 'Cancelada'
           OR (v_necessidade.status = 'Encerrada' AND v_recebimento.ocorrido_em > v_necessidade.encerrada_em) THEN
            RAISE EXCEPTION 'Necessidade incompatível, cancelada ou entrega posterior ao encerramento.';
        END IF;
        IF v_necessidade.unidade_registrada IS DISTINCT FROM v_produto.unidade_medida THEN
            RAISE EXCEPTION 'A unidade do catálogo mudou; não misture unidades na mesma necessidade.';
        END IF;
    END IF;
    IF v_recebimento.id_agendamento IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.itens_agendamento WHERE id_agendamento = v_recebimento.id_agendamento
            AND id_item = NEW.id_item AND status_item = 'Agendado'
    ) THEN RAISE EXCEPTION 'Produto não disponível para recebimento neste agendamento.'; END IF;
    NEW.nome_item_registrado := v_produto.nome_item;
    NEW.unidade_registrada := v_produto.unidade_medida;
    RETURN NEW;
END
$fn$;
CREATE TRIGGER proteger_item_recebimento BEFORE INSERT OR UPDATE OR DELETE ON arrecadacao.itens_recebimento
    FOR EACH ROW EXECUTE FUNCTION arrecadacao.proteger_item_recebimento();

CREATE FUNCTION arrecadacao.impedir_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'Limpeza em massa bloqueada: preserve o histórico de arrecadação.'; END
$fn$;
CREATE TRIGGER impedir_truncate BEFORE TRUNCATE ON arrecadacao.necessidades
    FOR EACH STATEMENT EXECUTE FUNCTION arrecadacao.impedir_truncate();
CREATE TRIGGER impedir_truncate BEFORE TRUNCATE ON arrecadacao.recebimentos
    FOR EACH STATEMENT EXECUTE FUNCTION arrecadacao.impedir_truncate();
CREATE TRIGGER impedir_truncate BEFORE TRUNCATE ON arrecadacao.itens_recebimento
    FOR EACH STATEMENT EXECUTE FUNCTION arrecadacao.impedir_truncate();

-- Histórico de todas as necessidades; meta cumprida é calculada, encerramento é manual.
CREATE VIEW arrecadacao.vw_historico_necessidades AS
WITH totais AS (
    SELECT ir.id_necessidade,SUM(ir.quantidade_recebida)::numeric AS total
    FROM arrecadacao.itens_recebimento ir
    JOIN arrecadacao.recebimentos r USING (id_recebimento)
    WHERE r.status = 'Confirmado' AND ir.id_necessidade IS NOT NULL GROUP BY ir.id_necessidade
)
SELECT n.id_necessidade,n.id_item,n.nome_item_registrado AS nome_item,n.unidade_registrada AS unidade_medida,
       n.quantidade_meta,COALESCE(t.total,0) AS quantidade_arrecadada,
       GREATEST(n.quantidade_meta - COALESCE(t.total,0),0) AS quantidade_faltante,
       ROUND(COALESCE(t.total,0)*100/n.quantidade_meta,2) AS percentual_atendimento,
       LEAST(ROUND(COALESCE(t.total,0)*100/n.quantidade_meta,2),100) AS percentual_barra,
       n.status,COALESCE(t.total,0) >= n.quantidade_meta AS meta_atingida,
       c.nome_categoria AS urgencia,c.cor_indicador,c.nivel_ordem,n.criada_em,n.encerrada_em
FROM arrecadacao.necessidades n
JOIN public.categorias_urgencia c USING (id_categoria)
LEFT JOIN totais t USING (id_necessidade);

-- Termômetro de arrecadação. Consumidor deve ordenar explicitamente.
CREATE VIEW arrecadacao.vw_termometro AS
SELECT h.* FROM arrecadacao.vw_historico_necessidades h
JOIN public.itens_necessidades i USING (id_item)
WHERE h.status = 'Aberta' AND i.ativo IS TRUE;

-- Um produto/nome registrado/unidade por mês civil de São Paulo.
-- Renomear o catálogo não reescreve os nomes das entregas anteriores.
CREATE VIEW arrecadacao.vw_arrecadacao_mensal AS
SELECT date_trunc('month',r.ocorrido_em AT TIME ZONE 'America/Sao_Paulo')::date AS mes,
       ir.id_item,ir.nome_item_registrado AS nome_item,ir.unidade_registrada AS unidade_medida,
       SUM(ir.quantidade_recebida) AS quantidade_arrecadada,
       COUNT(DISTINCT r.id_recebimento) AS entregas
FROM arrecadacao.recebimentos r
JOIN arrecadacao.itens_recebimento ir USING (id_recebimento)
WHERE r.status = 'Confirmado'
GROUP BY 1,ir.id_item,ir.nome_item_registrado,ir.unidade_registrada;

COMMENT ON TABLE arrecadacao.necessidades IS 'Cada linha é uma necessidade/meta independente; renovar cria outra linha, sem zerar estoque.';
COMMENT ON TABLE arrecadacao.recebimentos IS 'Entrega física com data efetiva, chave da operação e autoria. Rascunho não arrecada; estorno preserva histórico.';
COMMENT ON TABLE arrecadacao.itens_recebimento IS 'Quantidade inteira realmente recebida; unidade e nome preservados no registro.';
COMMENT ON COLUMN arrecadacao.itens_recebimento.id_necessidade IS 'Opcional: sem vínculo conta no mês, mas não preenche automaticamente qualquer meta.';
COMMENT ON COLUMN arrecadacao.recebimentos.chave_operacao IS 'UUID gerado uma vez por operação; repetir a mesma chave falha em vez de duplicar arrecadação.';
COMMENT ON VIEW arrecadacao.vw_arrecadacao_mensal IS 'Total líquido por data da entrega em São Paulo; estorno recalcula o mês original. Não soma unidades diferentes.';

-- Nada é publicado automaticamente para roles genéricas ou browser.
REVOKE ALL ON ALL TABLES IN SCHEMA arrecadacao FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA arrecadacao FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA arrecadacao FROM PUBLIC;


COMMIT;

-- Deve listar nove tabelas e três views. Confira também se houve qualquer ERROR.
SELECT table_schema,table_name,table_type FROM information_schema.tables
WHERE table_schema IN ('public','arrecadacao') ORDER BY table_schema,table_type,table_name;
