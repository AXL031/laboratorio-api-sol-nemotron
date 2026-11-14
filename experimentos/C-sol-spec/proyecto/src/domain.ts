import { readFileSync } from 'node:fs';
import { invalid, Problem } from './problem.js';

export const channels = ['MARKETPLACE', 'CHATBOT', 'RETAIL', 'VENTAS'] as const;
export const states = ['ACTIVO', 'INACTIVO'] as const;
export const modalities = ['AUTOMATICA', 'CUPON'] as const;
export const discountTypes = ['PORCENTAJE', 'MONTO_FIJO'] as const;
export type Channel = typeof channels[number];
export type State = typeof states[number];
export type Modality = typeof modalities[number];
export interface Promotion {
  nombre: string;
  tipoDescuento: typeof discountTypes[number];
  valor: number;
  modalidad: Modality;
  estado: State;
  validFrom: string;
  validUntil: string;
  alcance: { productIds?: string[]; skus?: string[] };
  prioridad: number;
  canalesHabilitados: Channel[];
  politicaCombinacion: { ofertaPricing: boolean; promocionAutomatica: boolean; cupon: boolean };
}
export interface StoredPromotion {
  promotionId: string;
  data: Promotion;
  firstActivatedAt: Date | null;
}
export type AdminPromotion = Promotion & { promotionId: string; puedeCambiarModalidad: boolean };
const keys = ['nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado', 'validFrom', 'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion'];
const catalog = JSON.parse(readFileSync(new URL('../contrato/catalogo.json', import.meta.url), 'utf8')) as {
  products: { productId: string; active: boolean }[];
  skus: { sku: string; active: boolean }[];
};
const products = new Set(catalog.products.filter(p => p.active).map(p => p.productId));
const skus = new Set(catalog.skus.filter(s => s.active).map(s => s.sku));

export function object(value: unknown, allowed: readonly string[], status = 422): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid('Se requiere un objeto JSON', status);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !allowed.includes(key))) invalid('Propiedad desconocida o de solo lectura', status);
  return record;
}
function enumValue<T extends string>(value: unknown, values: readonly T[], field: string, status = 422): T {
  if (typeof value !== 'string' || !values.includes(value as T)) invalid(`${field} no válido`, status);
  return value as T;
}
function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some(x => typeof x !== 'string' || !x.length) || new Set(value).size !== value.length) invalid(`${field} debe ser una lista de cadenas únicas`);
  return value as string[];
}

// Comprobar el calendario explícitamente: Date.parse normaliza, por ejemplo, 30 de febrero.
export function timestamp(value: unknown): number {
  if (typeof value !== 'string') invalid('Fecha ISO 8601 con zona requerida');
  const m = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) invalid('Fecha ISO 8601 con zona requerida');
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) invalid('Fecha de calendario inválida');
  if (m[8].toUpperCase() !== 'Z') {
    const [h, min] = m[8].slice(1).split(':').map(Number);
    if (h > 23 || min > 59) invalid('Zona horaria inválida');
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) invalid('Fecha inválida');
  return time;
}

export function validatePromotion(input: unknown): Promotion {
  const p = object(input, keys);
  if (keys.some(key => !Object.hasOwn(p, key))) invalid('Faltan campos obligatorios');
  if (typeof p.nombre !== 'string' || !p.nombre.trim() || [...p.nombre].length > 160) invalid('nombre debe tener contenido y hasta 160 caracteres');
  enumValue(p.tipoDescuento, discountTypes, 'tipoDescuento');
  if (typeof p.valor !== 'number' || !Number.isFinite(p.valor) || p.valor <= 0 || (p.tipoDescuento === 'PORCENTAJE' && p.valor > 100)) invalid('valor fuera de rango');
  enumValue(p.modalidad, modalities, 'modalidad');
  enumValue(p.estado, states, 'estado');
  if (timestamp(p.validFrom) >= timestamp(p.validUntil)) invalid('validFrom debe ser anterior a validUntil');
  if (typeof p.prioridad !== 'number' || !Number.isInteger(p.prioridad) || p.prioridad < 1) invalid('prioridad debe ser entero positivo');
  const enabled = stringList(p.canalesHabilitados, 'canalesHabilitados');
  if (!enabled.length) invalid('Se requiere al menos un canal');
  enabled.forEach(c => enumValue(c, channels, 'canal'));
  const scope = object(p.alcance, ['productIds', 'skus']);
  let count = 0;
  for (const [field, eligible] of [['productIds', products], ['skus', skus]] as const) {
    if (Object.hasOwn(scope, field)) {
      const values = stringList(scope[field], field);
      if (values.some(x => !eligible.has(x))) invalid(`${field} contiene referencias inexistentes o inactivas`);
      count += values.length;
    }
  }
  if (!count) invalid('alcance debe incluir referencias activas');
  const policy = object(p.politicaCombinacion, ['ofertaPricing', 'promocionAutomatica', 'cupon']);
  if (['ofertaPricing', 'promocionAutomatica', 'cupon'].some(k => typeof policy[k] !== 'boolean')) invalid('La política requiere sus tres booleanos');
  return structuredClone(p) as unknown as Promotion;
}

export function validatePatch(input: unknown): Partial<Promotion> {
  const patch = object(input, keys);
  if (!Object.keys(patch).length) invalid('PATCH no puede estar vacío');
  return patch as Partial<Promotion>;
}
export function mergePromotion(current: Promotion, patch: unknown): Promotion {
  return validatePromotion({ ...current, ...validatePatch(patch) });
}
export function canChangeModality(p: StoredPromotion): boolean {
  // No hay operaciones de cupones/usos en este laboratorio (R09).
  return p.data.estado === 'INACTIVO' && p.firstActivatedAt === null;
}
export function assertModalityChange(current: StoredPromotion, next: Promotion) {
  if (current.data.modalidad !== next.modalidad && !canChangeModality(current)) {
    throw new Problem(409, 'MODALIDAD_BLOQUEADA', 'La modalidad está bloqueada');
  }
}
export function toAdmin(p: StoredPromotion): AdminPromotion {
  return { promotionId: p.promotionId, ...p.data, puedeCambiarModalidad: canChangeModality(p) };
}
export function toSummary(p: StoredPromotion) {
  return { promotion_id: p.promotionId, name: p.data.nombre, status: p.data.estado === 'ACTIVO' ? 'ACTIVA' : 'INACTIVA', valid_from: p.data.validFrom, valid_until: p.data.validUntil, channels: p.data.canalesHabilitados };
}
export function uuid(input: unknown): string {
  if (typeof input !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) invalid('UUID inválido', 400);
  return input;
}
export interface AdminQuery { pagina: number; tamanio: number; estado?: State; modalidad?: Modality }
export interface CommercialQuery { canal: Channel; estado: State; vigentes: boolean }
function positiveQuery(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) invalid('Paginación inválida', 400);
  return Number(value);
}
export function adminQuery(input: unknown): AdminQuery {
  const q = object(input, ['pagina', 'tamanio', 'estado', 'modalidad'], 400);
  const pagina = positiveQuery(q.pagina, 1);
  const tamanio = positiveQuery(q.tamanio, 20, 100);
  if (!Number.isSafeInteger((pagina - 1) * tamanio)) invalid('Paginación inválida', 400);
  return { pagina, tamanio, ...(q.estado !== undefined ? { estado: enumValue(q.estado, states, 'estado', 400) } : {}), ...(q.modalidad !== undefined ? { modalidad: enumValue(q.modalidad, modalities, 'modalidad', 400) } : {}) };
}
export function commercialQuery(input: unknown): CommercialQuery {
  const q = object(input, ['canal', 'estado', 'vigentes'], 400);
  if (q.vigentes !== undefined && q.vigentes !== 'true' && q.vigentes !== 'false') invalid('vigentes debe ser true o false', 400);
  return { canal: enumValue(q.canal, channels, 'canal', 400), estado: q.estado === undefined ? 'ACTIVO' : enumValue(q.estado, states, 'estado', 400), vigentes: q.vigentes !== 'false' };
}
export function validateBatch(input: unknown): Promotion[] {
  const body = object(input, ['items']);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) invalid('items debe contener de 1 a 20 promociones');
  return body.items.map(validatePromotion);
}
