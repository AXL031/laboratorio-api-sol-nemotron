-- SQL inicial para la API académica de Promociones (caso D-nemotron-spec)
-- Base de datos vacía: lab_promociones (app) y lab_promociones_test (e2e)
-- Ejecutar sobre cada base antes de arrancar/probar la API.

-- Tabla principal: 14 columnas físicas (13 originales + deleted_at académica)
CREATE TABLE IF NOT EXISTS promociones (
  id UUID PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PORCENTAJE', 'MONTO_FIJO')),
  discount_value NUMERIC(12,4) NOT NULL CHECK (discount_value > 0),
  modality VARCHAR(20) NOT NULL CHECK (modality IN ('AUTOMATICA', 'CUPON')),
  state VARCHAR(20) NOT NULL CHECK (state IN ('ACTIVO', 'INACTIVO')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  priority INTEGER NOT NULL CHECK (priority >= 1),
  enabled_channels TEXT[] NOT NULL,
  first_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (valid_from < valid_until)
);

-- Alcance: product_id y sku son identidades separadas, al menos una requerida
CREATE TABLE IF NOT EXISTS promocion_alcance (
  id SERIAL PRIMARY KEY,
  promocion_id UUID NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
  product_id VARCHAR(80),
  sku VARCHAR(80),
  CHECK ((product_id IS NOT NULL) OR (sku IS NOT NULL))
);

-- Política de combinación: tres booleanos obligatorios
CREATE TABLE IF NOT EXISTS promocion_politica_combinacion (
  promocion_id UUID PRIMARY KEY REFERENCES promociones(id) ON DELETE CASCADE,
  oferta_pricing BOOLEAN NOT NULL,
  promocion_automatica BOOLEAN NOT NULL,
  cupon BOOLEAN NOT NULL
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_promociones_deleted_at ON promociones(deleted_at);
CREATE INDEX IF NOT EXISTS idx_promociones_state ON promociones(state);
CREATE INDEX IF NOT EXISTS idx_promociones_enabled_channels ON promociones USING GIN(enabled_channels);
CREATE INDEX IF NOT EXISTS idx_promocion_alcance_promocion_id ON promocion_alcance(promocion_id);
