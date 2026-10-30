-- Conferência somente de leitura. Compartilhada pela migração e pelo /ready.
DO $estrutura_api$
DECLARE
 permitir_ausentes boolean := __ALLOW_MISSING__;
 contrato jsonb := '__CONTRACT__'::jsonb;
 spec jsonb; col record; att record; obj record; fk jsonb;
 relation_oid oid; expected_keys text[]; expected_ref_keys text[];
 problemas text[] := ARRAY[]::text[]; nome text; tipo text;
BEGIN
 FOR spec IN SELECT value FROM pg_catalog.jsonb_array_elements(contrato) LOOP
  nome := spec->>'name'; relation_oid := pg_catalog.to_regclass(nome);
  IF relation_oid IS NULL THEN
   IF NOT permitir_ausentes THEN problemas:=pg_catalog.array_append(problemas,nome || ': tabela ausente'); END IF;
   CONTINUE;
  END IF;
  SELECT relkind,relpersistence INTO obj FROM pg_catalog.pg_class WHERE oid=relation_oid;
  IF obj.relkind <> 'r' OR obj.relpersistence <> 'p' THEN
   problemas:=pg_catalog.array_append(problemas,nome || ': requer tabela comum persistente');
   CONTINUE;
  END IF;
  FOR col IN SELECT key,value FROM pg_catalog.jsonb_each(spec->'columns') LOOP
   SELECT pg_catalog.format_type(atttypid,atttypmod) AS tipo,attnotnull,atthasdef,attidentity,attgenerated
    INTO att FROM pg_catalog.pg_attribute
    WHERE attrelid=relation_oid AND attname=col.key AND attnum>0 AND NOT attisdropped;
   IF NOT FOUND THEN
    IF NOT (permitir_ausentes AND COALESCE((spec->>'partial')::boolean,false)) THEN
     problemas:=pg_catalog.array_append(problemas,nome || '.' || col.key || ': coluna ausente');
    END IF;
    CONTINUE;
   END IF;
   IF att.tipo <> col.value->>'type' THEN
    problemas:=pg_catalog.array_append(problemas,nome || '.' || col.key || ': tipo ' || att.tipo || ', esperado ' || (col.value->>'type'));
   END IF;
   IF att.attnotnull IS DISTINCT FROM (col.value->>'notNull')::boolean THEN
    problemas:=pg_catalog.array_append(problemas,nome || '.' || col.key || ': nulabilidade incompatível');
   END IF;
   IF att.atthasdef OR att.attidentity<>'' OR att.attgenerated<>'' THEN
    problemas:=pg_catalog.array_append(problemas,nome || '.' || col.key || ': default/geração não previstos no contrato');
   END IF;
  END LOOP;
  IF COALESCE((spec->>'partial')::boolean,false) THEN
   -- A migração pode criar o índice do token; o /ready exige a garantia já instalada.
   IF permitir_ausentes THEN CONTINUE; END IF;
  ELSE
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=relation_oid
      AND a.attnum>0 AND NOT a.attisdropped AND NOT (spec->'columns' ? a.attname::text)) THEN
    problemas:=pg_catalog.array_append(problemas,nome || ': colunas adicionais fora do contrato do complemento');
   END IF;
   expected_keys:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(spec->'primary'));
   IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_index i ON i.indexrelid=c.conindid
    WHERE c.conrelid=relation_oid AND c.contype='p' AND c.convalidated AND NOT c.condeferrable
     AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate
     AND (pg_catalog.to_jsonb(c)->>'conenforced') IS DISTINCT FROM 'false'
     AND ARRAY(SELECT a.attname::text FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY k(n,ord)
       JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.ord)=expected_keys
   ) THEN problemas:=pg_catalog.array_append(problemas,nome || ': chave primária ausente ou incompatível'); END IF;
  END IF;
  FOR fk IN SELECT value FROM pg_catalog.jsonb_array_elements(spec->'unique') LOOP
   expected_keys:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(fk));
   IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid=relation_oid AND i.indisunique
     AND i.indisvalid AND i.indisready AND i.indislive AND i.indimmediate
     AND NOT i.indnullsnotdistinct AND i.indpred IS NULL AND i.indexprs IS NULL
     AND ARRAY(SELECT a.attname::text FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY k(n,ord)
       JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.n
       WHERE k.ord<=i.indnkeyatts ORDER BY k.ord)=expected_keys
   ) THEN problemas:=pg_catalog.array_append(problemas,nome || ': unicidade válida e integral ausente em ' || pg_catalog.array_to_string(expected_keys,',')); END IF;
  END LOOP;
  FOR fk IN SELECT value FROM pg_catalog.jsonb_array_elements(spec->'foreign') LOOP
   expected_keys:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(fk->'columns'));
   expected_ref_keys:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(fk->'references'));
   IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=relation_oid AND c.contype='f'
     AND c.confrelid=pg_catalog.to_regclass(fk->>'table') AND c.convalidated
     AND NOT c.condeferrable AND NOT c.condeferred AND c.confdeltype='r' AND c.confupdtype='a' AND c.confmatchtype='s'
     AND (pg_catalog.to_jsonb(c)->>'conenforced') IS DISTINCT FROM 'false'
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgconstraint=c.oid AND t.tgenabled NOT IN ('O','A'))
     AND ARRAY(SELECT a.attname::text FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY k(n,ord)
       JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.ord)=expected_keys
     AND ARRAY(SELECT a.attname::text FROM pg_catalog.unnest(c.confkey) WITH ORDINALITY k(n,ord)
       JOIN pg_catalog.pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY k.ord)=expected_ref_keys
   ) THEN problemas:=pg_catalog.array_append(problemas,nome || ': FK ausente/incompatível em ' || pg_catalog.array_to_string(expected_keys,',')); END IF;
  END LOOP;
 END LOOP;
 IF pg_catalog.array_length(problemas,1) IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='LT001',MESSAGE='Estrutura do complemento incompatível. Revise antes de continuar.',
   DETAIL=pg_catalog.array_to_string(problemas,E'\n');
 END IF;
END
$estrutura_api$;
