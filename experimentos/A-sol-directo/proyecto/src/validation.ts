import { readFileSync } from 'node:fs';
import { invalid } from './problem.js';

export const CHANNELS = ['MARKETPLACE', 'CHATBOT', 'RETAIL', 'VENTAS'] as const;
export const STATES = ['ACTIVO', 'INACTIVO'] as const;
export const MODALITIES = ['AUTOMATICA', 'CUPON'] as const;
export type Channel = typeof CHANNELS[number];
export type State = typeof STATES[number];
export type Modality = typeof MODALITIES[number];
export interface PromotionInput {
  nombre: string;
  tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO';
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
export interface PromotionAdmin extends PromotionInput {
  promotionId: string;
  puedeCambiarModalidad: boolean;
}
const FIELDS = ['nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado', 'validFrom',
  'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion'];
const POLICY_FIELDS = ['ofertaPricing', 'promocionAutomatica', 'cupon'];
const catalog = JSON.parse(readFileSync(new URL('../contrato/catalogo.json', import.meta.url), 'utf8')) as {
  products: { productId: string; active: boolean }[];
  skus: { sku: string; active: boolean }[];
};
const activeProducts = new Set(catalog.products.filter(p => p.active).map(p => p.productId));
const activeSkus = new Set(catalog.skus.filter(p => p.active).map(p => p.sku));

export function object(value: unknown, fields: readonly string[], required: readonly string[], status = 422): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid('Se requiere un objeto JSON', status);
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !fields.includes(key))) invalid('Propiedad no admitida', status);
  if (required.some(key => !Object.hasOwn(data, key))) invalid('Faltan propiedades obligatorias', status);
  return data;
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string, status = 422): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(`${field} inválido`, status);
  return value as T;
}
function list(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || v.length === 0)
    || new Set(value).size !== value.length) invalid(`${field} debe ser una lista de cadenas sin duplicados`);
  return value as string[];
}
export function dateTime(value: unknown): string {
  if (typeof value !== 'string') invalid('Fecha ISO 8601 con zona obligatoria');
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.exec(value as string);
  if (!match) invalid('Fecha ISO 8601 con zona obligatoria');
  const [, year, month, day, hour, minute, second, zone] = match!;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23
    || Number(minute) > 59 || Number(second) > 59
    || (zone.length > 1 && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) invalid('Fecha inexistente');
  const timestamp = Date.parse(value as string);
  if (!Number.isFinite(timestamp)) invalid('Fecha inválida');
  return new Date(timestamp).toISOString();
}
export function validateInput(value: unknown): PromotionInput {
  const data = object(value, FIELDS, FIELDS);
  if (typeof data.nombre !== 'string' || !/\S/u.test(data.nombre) || [...data.nombre].length > 160) invalid('nombre inválido');
  enumValue(data.tipoDescuento, ['PORCENTAJE', 'MONTO_FIJO'], 'tipoDescuento');
  if (typeof data.valor !== 'number' || !Number.isFinite(data.valor) || data.valor <= 0
    || (data.tipoDescuento === 'PORCENTAJE' && data.valor > 100)) invalid('valor inválido');
  enumValue(data.modalidad, MODALITIES, 'modalidad');
  enumValue(data.estado, STATES, 'estado');
  const validFrom = dateTime(data.validFrom), validUntil = dateTime(data.validUntil);
  if (Date.parse(validFrom) >= Date.parse(validUntil)) invalid('validFrom debe ser anterior a validUntil');
  if (!Number.isSafeInteger(data.prioridad) || (data.prioridad as number) < 1) invalid('prioridad inválida');
  const channels = list(data.canalesHabilitados, 'canalesHabilitados');
  if (!channels.length) invalid('Se requiere al menos un canal');
  channels.forEach(c => enumValue(c, CHANNELS, 'canal'));
  const scope = object(data.alcance, ['productIds', 'skus'], []);
  let count = 0;
  for (const [key, references] of [['productIds', activeProducts], ['skus', activeSkus]] as const) {
    if (Object.hasOwn(scope, key)) {
      const values = list(scope[key], key);
      if (values.some(v => !references.has(v))) invalid('Referencia de catálogo inexistente o inactiva');
      count += values.length;
    }
  }
  if (count === 0) invalid('alcance requiere al menos una referencia activa');
  const policy = object(data.politicaCombinacion, POLICY_FIELDS, POLICY_FIELDS);
  if (POLICY_FIELDS.some(k => typeof policy[k] !== 'boolean')) invalid('La política requiere tres booleanos');
  return { ...data, validFrom, validUntil } as unknown as PromotionInput;
}
export function validatePatch(value: unknown): Partial<PromotionInput> {
  const data = object(value, FIELDS, []);
  if (Object.keys(data).length === 0) invalid('PATCH no puede estar vacío');
  return data as Partial<PromotionInput>;
}
export function validateBatch(value: unknown): PromotionInput[] {
  const data = object(value, ['items'], ['items']);
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 20) invalid('El lote admite de 1 a 20 promociones');
  return (data.items as unknown[]).map(validateInput);
}
export function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) invalid('UUID inválido', 400);
  return value;
}
function positiveQuery(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) invalid('Paginación inválida', 400);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) invalid('Paginación fuera de rango', 400);
  return n;
}
export function adminQuery(value: unknown) {
  const q = object(value, ['pagina', 'tamanio', 'estado', 'modalidad'], [], 400);
  return { pagina: positiveQuery(q.pagina, 1, Number.MAX_SAFE_INTEGER), tamanio: positiveQuery(q.tamanio, 20, 100),
    estado: q.estado === undefined ? undefined : enumValue(q.estado, STATES, 'estado', 400),
    modalidad: q.modalidad === undefined ? undefined : enumValue(q.modalidad, MODALITIES, 'modalidad', 400) };
}
export function commercialQuery(value: unknown) {
  const q = object(value, ['canal', 'vigentes', 'estado'], ['canal'], 400);
  if (q.vigentes !== undefined && q.vigentes !== 'true' && q.vigentes !== 'false') invalid('vigentes inválido', 400);
  return { canal: enumValue(q.canal, CHANNELS, 'canal', 400), vigentes: q.vigentes !== 'false',
    estado: q.estado === undefined ? 'ACTIVO' as State : enumValue(q.estado, STATES, 'estado', 400) };
}
