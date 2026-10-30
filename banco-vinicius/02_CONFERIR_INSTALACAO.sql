-- Somente leitura. Execute depois da recriação e novamente depois dos testes.
SELECT current_database() AS banco,current_user AS usuario,version() AS versao;
SELECT table_schema,table_name,table_type FROM information_schema.tables
WHERE table_schema IN ('public','arrecadacao') ORDER BY table_schema,table_type,table_name;
-- Banco recém-recriado: categorias=3, todas as demais=0 (também após os testes).
-- Após carregar o 05, use as contagens de DADOS_FICTICIOS.md: a demonstração fica gravada.
SELECT 'categorias_urgencia' AS tabela,count(*) AS registros FROM public.categorias_urgencia
UNION ALL SELECT 'itens_necessidades',count(*) FROM public.itens_necessidades
UNION ALL SELECT 'doadores',count(*) FROM public.doadores
UNION ALL SELECT 'agendamentos',count(*) FROM public.agendamentos
UNION ALL SELECT 'itens_agendamento',count(*) FROM public.itens_agendamento
UNION ALL SELECT 'usuarios_ong',count(*) FROM public.usuarios_ong
UNION ALL SELECT 'necessidades',count(*) FROM arrecadacao.necessidades
UNION ALL SELECT 'recebimentos',count(*) FROM arrecadacao.recebimentos
UNION ALL SELECT 'itens_recebimento',count(*) FROM arrecadacao.itens_recebimento;
SELECT * FROM arrecadacao.vw_termometro ORDER BY nivel_ordem,percentual_atendimento,nome_item;
SELECT * FROM arrecadacao.vw_arrecadacao_mensal ORDER BY mes DESC,nome_item;
SELECT * FROM arrecadacao.vw_historico_necessidades ORDER BY id_necessidade DESC;
