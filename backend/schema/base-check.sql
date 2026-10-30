-- Complemento da API sobre o banco de Vinicius. Não executa reset nem importa saldos antigos.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $verificar$
BEGIN
  IF to_regclass('arrecadacao.vw_termometro') IS NULL
     OR to_regclass('arrecadacao.recebimentos') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
       AND table_name='doadores' AND column_name='tipo_doador') THEN
    RAISE EXCEPTION 'Instale e confira o modelo do Vinicius antes deste complemento. Nenhum reset será executado.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
     AND table_name='itens_necessidades' AND column_name IN ('quantidade_atual','quantidade_necessaria')) THEN
    RAISE EXCEPTION 'Modelo misto/antigo detectado. Revise a instalação sem apagar dados.';
  END IF;
END $verificar$;
