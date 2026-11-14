import { ProblemException } from './problem.exception.js';

export const VALID_CHANNELS = [
  'MARKETPLACE',
  'CHATBOT',
  'RETAIL',
  'VENTAS',
] as const;

export type Channel = (typeof VALID_CHANNELS)[number];

export const CATALOGO = {
  products: [
    { productId: 'PRD-LAB-001', active: true },
    { productId: 'PRD-LAB-INACTIVO', active: false },
  ],
  skus: [
    { sku: 'SKU-LAB-001', productId: 'PRD-LAB-001', active: true },
    { sku: 'SKU-LAB-002', productId: 'PRD-LAB-001', active: true },
    { sku: 'SKU-LAB-INACTIVO', productId: 'PRD-LAB-001', active: false },
  ],
};

const activeProductIds = new Set(
  CATALOGO.products.filter((p) => p.active).map((p) => p.productId),
);
const allProductIds = new Set(CATALOGO.products.map((p) => p.productId));
const activeSkus = new Set(CATALOGO.skus.filter((s) => s.active).map((s) => s.sku));
const allSkus = new Set(CATALOGO.skus.map((s) => s.sku));

export function isValidUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(value);
}

export function isValidIsoDateTime(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const isoWithZoneRegex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  if (!isoWithZoneRegex.test(value)) {
    return false;
  }
  const d = new Date(value);
  return !isNaN(d.getTime());
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function validateNombre(
  value: unknown,
  field = 'nombre',
): string {
  if (typeof value !== 'string') {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      `${field} debe ser una cadena de texto`,
    );
  }
  if (value.length < 1 || value.length > 160) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      `${field} debe tener entre 1 y 160 caracteres`,
    );
  }
  if (!/\S/.test(value)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      `${field} no puede estar vacío ni solo espacios`,
    );
  }
  return value;
}

export function validateTipoDescuentoField(
  value: unknown,
): 'PORCENTAJE' | 'MONTO_FIJO' {
  if (value !== 'PORCENTAJE' && value !== 'MONTO_FIJO') {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'tipoDescuento debe ser PORCENTAJE o MONTO_FIJO',
    );
  }
  return value as 'PORCENTAJE' | 'MONTO_FIJO';
}

export function validateValor(
  value: unknown,
  tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO',
): number {
  if (!isFiniteNumber(value)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'valor debe ser un número finito',
    );
  }
  if (value <= 0) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'valor debe ser mayor a 0',
    );
  }
  if (tipoDescuento === 'PORCENTAJE' && value > 100) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'valor no puede exceder 100 para tipoDescuento PORCENTAJE',
    );
  }
  return value;
}

export function validateModalidad(
  value: unknown,
): 'AUTOMATICA' | 'CUPON' {
  if (value !== 'AUTOMATICA' && value !== 'CUPON') {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'modalidad debe ser AUTOMATICA o CUPON',
    );
  }
  return value as 'AUTOMATICA' | 'CUPON';
}

export function validateEstado(
  value: unknown,
): 'ACTIVO' | 'INACTIVO' {
  if (value !== 'ACTIVO' && value !== 'INACTIVO') {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'estado debe ser ACTIVO o INACTIVO',
    );
  }
  return value as 'ACTIVO' | 'INACTIVO';
}

export function validatePrioridad(value: unknown): number {
  if (!isInteger(value)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'prioridad debe ser un entero',
    );
  }
  if (value < 1) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'prioridad debe ser mayor o igual a 1',
    );
  }
  return value;
}

export function validateCanalesHabilitados(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'canalesHabilitados debe ser un arreglo',
    );
  }
  if (value.length < 1) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'canalesHabilitados no puede estar vacío',
    );
  }
  const seen = new Set<string>();
  for (const ch of value) {
    if (typeof ch !== 'string' || !VALID_CHANNELS.includes(ch as Channel)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `Canal no válido: ${String(ch)}`,
      );
    }
    if (seen.has(ch)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `Canal duplicado: ${ch}`,
      );
    }
    seen.add(ch);
  }
  return value as string[];
}

export function validatePoliticaCombinacion(
  value: unknown,
): {
  ofertaPricing: boolean;
  promocionAutomatica: boolean;
  cupon: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'politicaCombinacion debe ser un objeto',
    );
  }
  const p = value as Record<string, unknown>;
  if (
    typeof p.ofertaPricing !== 'boolean' ||
    typeof p.promocionAutomatica !== 'boolean' ||
    typeof p.cupon !== 'boolean'
  ) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'politicaCombinacion debe contener ofertaPricing, promocionAutomatica y cupon como booleanos',
    );
  }
  const allowed = new Set([
    'ofertaPricing',
    'promocionAutomatica',
    'cupon',
  ]);
  for (const key of Object.keys(p)) {
    if (!allowed.has(key)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `Propiedad no permitida en politicaCombinacion: ${key}`,
      );
    }
  }
  return {
    ofertaPricing: p.ofertaPricing as boolean,
    promocionAutomatica: p.promocionAutomatica as boolean,
    cupon: p.cupon as boolean,
  };
}

export function validateAlcance(
  value: unknown,
): {
  productIds?: string[];
  skus?: string[];
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'alcance debe ser un objeto',
    );
  }
  const a = value as Record<string, unknown>;
  const productIds: string[] = [];
  const skus: string[] = [];

  if (a.productIds !== undefined) {
    if (!Array.isArray(a.productIds)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'alcance.productIds debe ser un arreglo',
      );
    }
    const seen = new Set<string>();
    for (const pid of a.productIds) {
      if (typeof pid !== 'string' || pid.length < 1) {
        throw new ProblemException(
          422,
          'VALIDACION',
          'Validación fallida',
          'productIds deben ser strings no vacíos',
        );
      }
      if (seen.has(pid)) {
        throw new ProblemException(
          422,
          'VALIDACION',
          'Validación fallida',
          `productId duplicado: ${pid}`,
        );
      }
      seen.add(pid);
      productIds.push(pid);
    }
  }

  if (a.skus !== undefined) {
    if (!Array.isArray(a.skus)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'alcance.skus debe ser un arreglo',
      );
    }
    const seen = new Set<string>();
    for (const sku of a.skus) {
      if (typeof sku !== 'string' || sku.length < 1) {
        throw new ProblemException(
          422,
          'VALIDACION',
          'Validación fallida',
          'skus deben ser strings no vacíos',
        );
      }
      if (seen.has(sku)) {
        throw new ProblemException(
          422,
          'VALIDACION',
          'Validación fallida',
          `sku duplicado: ${sku}`,
        );
      }
      seen.add(sku);
      skus.push(sku);
    }
  }

  if (productIds.length === 0 && skus.length === 0) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'alcance debe contener al menos un productId o sku activo',
    );
  }

  for (const pid of productIds) {
    if (!allProductIds.has(pid)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `productId inexistente en catálogo: ${pid}`,
      );
    }
    if (!activeProductIds.has(pid)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `productId inactivo en catálogo: ${pid}`,
      );
    }
  }
  for (const sku of skus) {
    if (!allSkus.has(sku)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `sku inexistente en catálogo: ${sku}`,
      );
    }
    if (!activeSkus.has(sku)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `sku inactivo en catálogo: ${sku}`,
      );
    }
  }

  const result: { productIds?: string[]; skus?: string[] } = {};
  if (productIds.length > 0) result.productIds = productIds;
  if (skus.length > 0) result.skus = skus;
  return result;
}

export interface ValidatedPromocionCreate {
  nombre: string;
  tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO';
  valor: number;
  modalidad: 'AUTOMATICA' | 'CUPON';
  estado: 'ACTIVO' | 'INACTIVO';
  validFrom: string;
  validUntil: string;
  alcance: { productIds?: string[]; skus?: string[] };
  prioridad: number;
  canalesHabilitados: string[];
  politicaCombinacion: {
    ofertaPricing: boolean;
    promocionAutomatica: boolean;
    cupon: boolean;
  };
}

export function validatePromocionCreate(
  body: unknown,
): ValidatedPromocionCreate {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'Cuerpo de la solicitud debe ser un objeto JSON',
    );
  }
  const b = body as Record<string, unknown>;

  const allowedCreate = new Set([
    'nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado', 'validFrom',
    'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion',
  ]);
  for (const key of Object.keys(b)) {
    if (!allowedCreate.has(key)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `Propiedad no permitida: ${key}`,
      );
    }
  }

  const requiredCreate = [
    'nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado', 'validFrom',
    'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion',
  ];
  for (const key of requiredCreate) {
    if (b[key] === undefined) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `Campo requerido ausente: ${key}`,
      );
    }
  }

  const nombre = validateNombre(b.nombre);
  const tipoDescuento = validateTipoDescuentoField(b.tipoDescuento);
  const valor = validateValor(b.valor, tipoDescuento);
  const modalidad = validateModalidad(b.modalidad);
  const estado = validateEstado(b.estado);
  if (!isValidIsoDateTime(b.validFrom)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'validFrom debe ser ISO 8601 con zona horaria',
    );
  }
  if (!isValidIsoDateTime(b.validUntil)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'validUntil debe ser ISO 8601 con zona horaria',
    );
  }
  if (new Date(String(b.validFrom)) >= new Date(String(b.validUntil))) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'validFrom debe ser anterior a validUntil',
    );
  }
  const alcance = validateAlcance(b.alcance);
  const prioridad = validatePrioridad(b.prioridad);
  const canalesHabilitados = validateCanalesHabilitados(b.canalesHabilitados);
  const politicaCombinacion = validatePoliticaCombinacion(b.politicaCombinacion);

  return {
    nombre,
    tipoDescuento,
    valor,
    modalidad,
    estado,
    validFrom: String(b.validFrom),
    validUntil: String(b.validUntil),
    alcance,
    prioridad,
    canalesHabilitados,
    politicaCombinacion,
  };
}

export interface ValidatedPromocionPatch {
  nombre?: string;
  tipoDescuento?: 'PORCENTAJE' | 'MONTO_FIJO';
  valor?: number;
  modalidad?: 'AUTOMATICA' | 'CUPON';
  estado?: 'ACTIVO' | 'INACTIVO';
  validFrom?: string;
  validUntil?: string;
  alcance?: { productIds?: string[]; skus?: string[] };
  prioridad?: number;
  canalesHabilitados?: string[];
  politicaCombinacion?: {
    ofertaPricing: boolean;
    promocionAutomatica: boolean;
    cupon: boolean;
  };
}

export function validatePromocionPatch(
  body: unknown,
): ValidatedPromocionPatch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'Cuerpo de la solicitud debe ser un objeto JSON',
    );
  }
  const b = body as Record<string, unknown>;

  const keys = Object.keys(b);
  if (keys.length < 1) {
    throw new ProblemException(
      422,
      'VALIDACION',
      'Validación fallida',
      'El cuerpo PATCH debe contener al menos una propiedad',
    );
  }

  const allowedPatch = new Set([
    'nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado', 'validFrom',
    'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion',
  ]);
  for (const key of keys) {
    if (!allowedPatch.has(key)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        `Propiedad no permitida: ${key}`,
      );
    }
  }

  const result: ValidatedPromocionPatch = {};

  if (b.nombre !== undefined) {
    result.nombre = validateNombre(b.nombre);
  }
  if (b.tipoDescuento !== undefined) {
    result.tipoDescuento = validateTipoDescuentoField(b.tipoDescuento);
  }
  if (b.valor !== undefined) {
    const td = result.tipoDescuento;
    result.valor = validateValor(b.valor, td as 'PORCENTAJE' | 'MONTO_FIJO');
  }
  if (b.modalidad !== undefined) {
    result.modalidad = validateModalidad(b.modalidad);
  }
  if (b.estado !== undefined) {
    result.estado = validateEstado(b.estado);
  }
  if (b.validFrom !== undefined) {
    if (!isValidIsoDateTime(b.validFrom)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'validFrom debe ser ISO 8601 con zona horaria',
      );
    }
    result.validFrom = String(b.validFrom);
  }
  if (b.validUntil !== undefined) {
    if (!isValidIsoDateTime(b.validUntil)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'validUntil debe ser ISO 8601 con zona horaria',
      );
    }
    result.validUntil = String(b.validUntil);
  }
  if (b.alcance !== undefined) {
    result.alcance = validateAlcance(b.alcance);
  }
  if (b.prioridad !== undefined) {
    result.prioridad = validatePrioridad(b.prioridad);
  }
  if (b.canalesHabilitados !== undefined) {
    result.canalesHabilitados = validateCanalesHabilitados(b.canalesHabilitados);
  }
  if (b.politicaCombinacion !== undefined) {
    result.politicaCombinacion = validatePoliticaCombinacion(b.politicaCombinacion);
  }

  const mergedValidFrom = result.validFrom;
  const mergedValidUntil = result.validUntil;
  if (mergedValidFrom !== undefined && mergedValidUntil !== undefined) {
    if (new Date(mergedValidFrom) >= new Date(mergedValidUntil)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'validFrom debe ser anterior a validUntil',
      );
    }
  }

  return result;
}

export function validateQueryCanal(value: unknown): string {
  if (typeof value !== 'string' || !VALID_CHANNELS.includes(value as Channel)) {
    throw new ProblemException(
      400,
      'VALIDACION',
      'Validación fallida',
      'canal es requerido y debe ser MARKETPLACE, CHATBOT, RETAIL o VENTAS',
    );
  }
  return value;
}

export function parseBooleanQuery(
  value: unknown,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    throw new ProblemException(
      400,
      'VALIDACION',
      'Validación fallida',
      'Parámetro booleano inválido',
    );
  }
  throw new ProblemException(
    400,
    'VALIDACION',
    'Validación fallida',
    'Parámetro booleano inválido',
  );
}

export function parseIntegerQuery(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new ProblemException(
      400,
      'VALIDACION',
      'Validación fallida',
      'Parámetro entero inválido',
    );
  }
  return num;
}

export function validateEstadoQuery(
  value: unknown,
): 'ACTIVO' | 'INACTIVO' | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value !== 'ACTIVO' && value !== 'INACTIVO') {
    throw new ProblemException(
      400,
      'VALIDACION',
      'Validación fallida',
      'estado debe ser ACTIVO o INACTIVO',
    );
  }
  return value as 'ACTIVO' | 'INACTIVO';
}

export function validateModalidadQuery(
  value: unknown,
): 'AUTOMATICA' | 'CUPON' | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value !== 'AUTOMATICA' && value !== 'CUPON') {
    throw new ProblemException(
      400,
      'VALIDACION',
      'Validación fallida',
      'modalidad debe ser AUTOMATICA o CUPON',
    );
  }
  return value as 'AUTOMATICA' | 'CUPON';
}