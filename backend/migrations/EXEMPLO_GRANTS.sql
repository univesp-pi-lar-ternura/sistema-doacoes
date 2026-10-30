-- REFERÊNCIA: aplicar somente depois de criar uma role própria e revisar o nome.
-- db:migrate NÃO executa este arquivo. Não cria role nem senha.
GRANT USAGE ON SCHEMA public, arrecadacao, api_apoio TO lar_ternura_api;
GRANT SELECT ON public.categorias_urgencia, public.usuarios_ong TO lar_ternura_api;
GRANT SELECT, INSERT, UPDATE ON public.itens_necessidades,
 public.agendamentos, public.itens_agendamento TO lar_ternura_api;
GRANT SELECT, INSERT ON public.doadores TO lar_ternura_api;
GRANT SELECT, INSERT, UPDATE ON arrecadacao.necessidades,
 arrecadacao.recebimentos, arrecadacao.itens_recebimento TO lar_ternura_api;
GRANT SELECT ON arrecadacao.vw_termometro,
 arrecadacao.vw_historico_necessidades, arrecadacao.vw_arrecadacao_mensal TO lar_ternura_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api_apoio TO lar_ternura_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, arrecadacao TO lar_ternura_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA arrecadacao TO lar_ternura_api;
