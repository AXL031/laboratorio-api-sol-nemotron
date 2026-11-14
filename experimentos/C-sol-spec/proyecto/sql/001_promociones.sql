-- SQL propio del laboratorio. Ejecutado en una transacción por herramientas/migrar.mjs.
CREATE FUNCTION lab_unique_strings(values_ text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT cardinality(values_) = count(DISTINCT v) AND count(*) = count(v)
  FROM unnest(values_) AS t(v)
$$;

CREATE TABLE lab_catalog_products (
  product_id text PRIMARY KEY,
  active boolean NOT NULL
);
CREATE TABLE lab_catalog_skus (
  sku text PRIMARY KEY,
  product_id text NOT NULL REFERENCES lab_catalog_products(product_id),
  active boolean NOT NULL
);
-- Fixture exacto de contrato/catalogo.json. No son datos de un servicio externo.
INSERT INTO lab_catalog_products VALUES ('PRD-LAB-001', true), ('PRD-LAB-INACTIVO', false);
INSERT INTO lab_catalog_skus VALUES
  ('SKU-LAB-001', 'PRD-LAB-001', true),
  ('SKU-LAB-002', 'PRD-LAB-001', true),
  ('SKU-LAB-INACTIVO', 'PRD-LAB-001', false);

CREATE TABLE promociones (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160 AND name ~ '[^[:space:]]'),
  discount_type text NOT NULL CHECK (discount_type IN ('PORCENTAJE','MONTO_FIJO')),
  discount_value double precision NOT NULL CHECK (discount_value > 0 AND discount_value < 'Infinity'::float8),
  modality text NOT NULL CHECK (modality IN ('AUTOMATICA','CUPON')),
  state text NOT NULL CHECK (state IN ('ACTIVO','INACTIVO')),
  valid_from timestamptz NOT NULL CHECK (isfinite(valid_from)),
  valid_until timestamptz NOT NULL CHECK (isfinite(valid_until)),
  priority numeric NOT NULL CHECK (priority >= 1 AND priority = trunc(priority) AND priority < 'Infinity'::numeric),
  enabled_channels text[] NOT NULL CHECK (
    cardinality(enabled_channels) > 0 AND lab_unique_strings(enabled_channels)
    AND enabled_channels <@ ARRAY['MARKETPLACE','CHATBOT','RETAIL','VENTAS']::text[]
  ),
  first_activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CHECK (valid_from < valid_until),
  CHECK (discount_type <> 'PORCENTAJE' OR discount_value <= 100),
  CHECK (state <> 'ACTIVO' OR first_activated_at IS NOT NULL),
  CHECK (deleted_at IS NULL OR state = 'INACTIVO')
);

CREATE FUNCTION lab_valid_scope(scope_ jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE k text; list_ jsonb; count_ integer := 0;
BEGIN
  IF jsonb_typeof(scope_) <> 'object' THEN RETURN false; END IF;
  FOR k, list_ IN SELECT * FROM jsonb_each(scope_) LOOP
    IF k NOT IN ('productIds','skus') OR jsonb_typeof(list_) <> 'array' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(list_) e WHERE jsonb_typeof(e) <> 'string' OR e = '""'::jsonb) THEN RETURN false; END IF;
    IF (SELECT count(*) <> count(DISTINCT e) FROM jsonb_array_elements(list_) e) THEN RETURN false; END IF;
    count_ := count_ + jsonb_array_length(list_);
  END LOOP;
  RETURN count_ > 0;
END $$;

CREATE FUNCTION lab_valid_policy(policy_ jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  IF jsonb_typeof(policy_) <> 'object' THEN RETURN false; END IF;
  RETURN (SELECT count(*) = 3 FROM jsonb_object_keys(policy_))
    AND jsonb_typeof(policy_->'ofertaPricing') IS NOT DISTINCT FROM 'boolean'
    AND jsonb_typeof(policy_->'promocionAutomatica') IS NOT DISTINCT FROM 'boolean'
    AND jsonb_typeof(policy_->'cupon') IS NOT DISTINCT FROM 'boolean';
END $$;

CREATE TABLE promocion_configuracion (
  promotion_id uuid PRIMARY KEY REFERENCES promociones(id) ON DELETE CASCADE,
  alcance jsonb NOT NULL CHECK (lab_valid_scope(alcance)),
  politica jsonb NOT NULL CHECK (lab_valid_policy(politica))
);

CREATE FUNCTION lab_check_catalog() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT lab_valid_scope(NEW.alcance) THEN
    RAISE EXCEPTION 'Alcance inválido' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(NEW.alcance->'productIds','[]'::jsonb)) AS x(id)
      WHERE NOT EXISTS (SELECT 1 FROM lab_catalog_products c WHERE c.product_id = x.id AND c.active))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(NEW.alcance->'skus','[]'::jsonb)) AS x(id)
      WHERE NOT EXISTS (SELECT 1 FROM lab_catalog_skus c WHERE c.sku = x.id AND c.active)) THEN
    RAISE EXCEPTION 'Referencia de catálogo inválida' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_catalog BEFORE INSERT OR UPDATE ON promocion_configuracion
  FOR EACH ROW EXECUTE FUNCTION lab_check_catalog();

CREATE FUNCTION lab_promotion_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Promoción eliminada' USING ERRCODE = '23514';
    END IF;
    IF NEW.modality IS DISTINCT FROM OLD.modality AND (OLD.state <> 'INACTIVO' OR OLD.first_activated_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Modalidad bloqueada' USING ERRCODE = '23514';
    END IF;
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
    NEW.first_activated_at := OLD.first_activated_at;
  ELSE
    NEW.first_activated_at := NULL;
    NEW.created_at := clock_timestamp();
  END IF;
  IF NEW.state = 'ACTIVO' AND NEW.first_activated_at IS NULL THEN
    NEW.first_activated_at := clock_timestamp();
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER promotion_history BEFORE INSERT OR UPDATE ON promociones
  FOR EACH ROW EXECUTE FUNCTION lab_promotion_history();

-- No se permite confirmar una promoción sin alcance/política asociados.
CREATE FUNCTION lab_require_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE id_ uuid;
BEGIN
  IF TG_TABLE_NAME = 'promociones' THEN id_ := NEW.id; ELSE id_ := OLD.promotion_id; END IF;
  IF EXISTS (SELECT 1 FROM promociones WHERE id = id_) AND
     NOT EXISTS (SELECT 1 FROM promocion_configuracion WHERE promotion_id = id_) THEN
    RAISE EXCEPTION 'Falta configuración de promoción' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER require_configuration AFTER INSERT OR UPDATE ON promociones
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_require_configuration();
CREATE CONSTRAINT TRIGGER preserve_configuration AFTER DELETE OR UPDATE ON promocion_configuracion
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_require_configuration();

CREATE INDEX promociones_admin_order ON promociones(created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX promociones_state_modality ON promociones(state, modality) WHERE deleted_at IS NULL;
CREATE INDEX promociones_channels ON promociones USING gin(enabled_channels) WHERE deleted_at IS NULL;
