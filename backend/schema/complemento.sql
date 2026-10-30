CREATE SCHEMA IF NOT EXISTS api_apoio;
REVOKE ALL ON SCHEMA api_apoio FROM PUBLIC;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS token_gestao_hash varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS api_token_gestao ON public.agendamentos(token_gestao_hash);
CREATE TABLE IF NOT EXISTS api_apoio.sessoes_ong (
  token_hash varchar(64) PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios_ong ON DELETE RESTRICT,
  expira_em timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS api_apoio.slots_entrega (data_hora timestamptz PRIMARY KEY);
CREATE TABLE IF NOT EXISTS api_apoio.requisicoes_agendamento (
  chave varchar(128) PRIMARY KEY, request_hash varchar(64) NOT NULL,
  id_agendamento integer REFERENCES public.agendamentos ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS api_apoio.itens_agendamento_necessidade (
  id_agendamento integer NOT NULL, id_item integer NOT NULL, id_necessidade bigint NOT NULL,
  PRIMARY KEY(id_agendamento,id_item),
  FOREIGN KEY(id_agendamento,id_item) REFERENCES public.itens_agendamento ON DELETE RESTRICT,
  FOREIGN KEY(id_necessidade,id_item) REFERENCES arrecadacao.necessidades(id_necessidade,id_item) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS api_apoio.requisicoes_recebimento (
  chave uuid PRIMARY KEY, request_hash varchar(64) NOT NULL,
  id_usuario integer NOT NULL REFERENCES public.usuarios_ong ON DELETE RESTRICT,
  id_recebimento bigint UNIQUE REFERENCES arrecadacao.recebimentos ON DELETE RESTRICT
);
REVOKE ALL ON ALL TABLES IN SCHEMA api_apoio FROM PUBLIC;
COMMENT ON SCHEMA api_apoio IS 'Complemento HTTP: sessões, capacidade, idempotência e vínculo da promessa à meta selecionada. Sem totais de estoque.';
