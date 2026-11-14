-- Esquema de negocio para Promociones (caso B-nemotron-directo, enfoque directo)
-- La infraestructura común solo crea bases vacías; estas tablas son de negocio.
-- Ejecutar sobre la base de aplicación (lab_promociones) y la base de e2e (lab_promociones_test).

CREATE TABLE IF NOT EXISTS promociones (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PORCENTAJE','MONTO_FIJO')),
    discount_value NUMERIC(12,4) NOT NULL CHECK (discount_value > 0),
    modality VARCHAR(20) NOT NULL CHECK (modality IN ('AUTOMATICA','CUPON')),
    state VARCHAR(20) NOT NULL CHECK (state IN ('ACTIVO','INACTIVO')),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    priority INTEGER NOT NULL CHECK (priority >= 1),
    enabled_channels TEXT[] NOT NULL,
    first_activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS promocion_alcance_product_ids (
    promocion_id UUID NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (promocion_id, product_id)
);

CREATE TABLE IF NOT EXISTS promocion_alcance_skus (
    promocion_id UUID NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    sku VARCHAR(255) NOT NULL,
    PRIMARY KEY (promocion_id, sku)
);

CREATE TABLE IF NOT EXISTS promocion_politica_combinacion (
    promocion_id UUID NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    oferta_pricing BOOLEAN NOT NULL,
    promocion_automatica BOOLEAN NOT NULL,
    cupon BOOLEAN NOT NULL,
    PRIMARY KEY (promocion_id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_promociones_state_deleted ON promociones(state, deleted_at);
CREATE INDEX IF NOT EXISTS idx_promociones_created_at ON promociones(created_at, id);