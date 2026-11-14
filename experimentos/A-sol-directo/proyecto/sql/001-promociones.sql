-- Migración de negocio idempotente. Ejecutar en cada base local mediante herramientas/migrar.mjs.
BEGIN;
SELECT pg_advisory_xact_lock(913764021);
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY,
  name varchar(160) NOT NULL CHECK (name ~ '\S'),
  discount_type text NOT NULL CHECK (discount_type IN ('PORCENTAJE', 'MONTO_FIJO')),
  discount_value double precision NOT NULL CHECK (
    discount_value > 0 AND discount_value < 'Infinity'::float8
    AND (discount_type <> 'PORCENTAJE' OR discount_value <= 100)),
  modality text NOT NULL CHECK (modality IN ('AUTOMATICA', 'CUPON')),
  state text NOT NULL CHECK (state IN ('ACTIVO', 'INACTIVO')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > valid_from),
  priority bigint NOT NULL CHECK (priority >= 1 AND priority <= 9007199254740991),
  enabled_channels text[] NOT NULL CHECK (
    cardinality(enabled_channels) > 0 AND array_position(enabled_channels, NULL) IS NULL
    AND enabled_channels <@ ARRAY['MARKETPLACE','CHATBOT','RETAIL','VENTAS']::text[]),
  first_activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CHECK (state <> 'ACTIVO' OR first_activated_at IS NOT NULL),
  CHECK (deleted_at IS NULL OR state = 'INACTIVO')
);
CREATE TABLE IF NOT EXISTS promotion_configuration (
  promotion_id uuid PRIMARY KEY REFERENCES promotions(id) ON DELETE CASCADE,
  scope jsonb NOT NULL CHECK (jsonb_typeof(scope) = 'object'),
  combination_policy jsonb NOT NULL CHECK (
    jsonb_typeof(combination_policy) = 'object'
    AND combination_policy ?& ARRAY['ofertaPricing','promocionAutomatica','cupon']
    AND jsonb_typeof(combination_policy->'ofertaPricing') = 'boolean'
    AND jsonb_typeof(combination_policy->'promocionAutomatica') = 'boolean'
    AND jsonb_typeof(combination_policy->'cupon') = 'boolean')
);
CREATE INDEX IF NOT EXISTS promotions_live_order ON promotions(created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS promotions_live_filters ON promotions(state, modality) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS promotions_channels ON promotions USING gin(enabled_channels) WHERE deleted_at IS NULL;
COMMIT;
