import { describe, expect, it } from 'vitest';
import { adminQuery, assertModalityChange, canChangeModality, commercialQuery, mergePromotion, timestamp, toAdmin, toSummary, uuid, validateBatch, validatePatch, validatePromotion, type StoredPromotion } from '../src/domain.js';
import { assertLocalDatabase } from '../src/database.js';
import { Problem } from '../src/problem.js';
import { promotion } from './fixtures.js';

describe('R01–R07: entidad y fragmentos', () => {
  it('acepta ambos tipos, porcentaje 100 y devuelve una copia', () => {
    const p = promotion({ valor: 100 });
    expect(validatePromotion(p)).toEqual(p);
    expect(validatePromotion(p)).not.toBe(p);
    expect(validatePromotion(promotion({ tipoDescuento: 'MONTO_FIJO', valor: 1000 })).valor).toBe(1000);
  });
  const invalidCases: [string, Record<string, unknown>][] = [
    ['nombre vacío', { nombre: '' }], ['nombre espacios', { nombre: ' \t\n' }], ['nombre largo', { nombre: 'a'.repeat(161) }],
    ['valor cero', { valor: 0 }], ['valor negativo', { valor: -1 }], ['NaN', { valor: NaN }], ['infinito', { valor: Infinity }],
    ['porcentaje >100', { valor: 100.1 }], ['número como cadena', { valor: '1' }],
    ['descuento enum', { tipoDescuento: 'FIJO' }], ['estado enum', { estado: 'activo' }], ['modalidad enum', { modalidad: 'OTRA' }],
    ['prioridad cero', { prioridad: 0 }], ['prioridad decimal', { prioridad: 1.5 }], ['prioridad cadena', { prioridad: '1' }],
    ['sin zona', { validFrom: '2020-01-01T01:00:00' }], ['calendario imposible', { validFrom: '2025-02-29T00:00:00Z' }],
    ['mes imposible', { validFrom: '2020-13-01T00:00:00Z' }], ['día imposible', { validFrom: '2020-04-31T00:00:00Z' }],
    ['hora 24', { validFrom: '2020-01-01T24:00:00Z' }], ['zona imposible', { validFrom: '2020-01-01T00:00:00+24:00' }],
    ['fechas iguales', { validUntil: '2020-01-01T00:00:00Z' }], ['fechas invertidas', { validUntil: '2019-01-01T00:00:00Z' }],
    ['alcance vacío', { alcance: {} }], ['listas vacías', { alcance: { productIds: [], skus: [] } }],
    ['producto inactivo', { alcance: { productIds: ['PRD-LAB-INACTIVO'] } }], ['producto inexistente', { alcance: { productIds: ['PRD-X'] } }],
    ['SKU inactivo', { alcance: { skus: ['SKU-LAB-INACTIVO'] } }], ['SKU inexistente', { alcance: { skus: ['SKU-X'] } }],
    ['producto duplicado', { alcance: { productIds: ['PRD-LAB-001', 'PRD-LAB-001'] } }],
    ['SKU duplicado', { alcance: { skus: ['SKU-LAB-001', 'SKU-LAB-001'] } }], ['lista nula', { alcance: { skus: null } }],
    ['alcance extra', { alcance: { productIds: ['PRD-LAB-001'], extra: true } }],
    ['canales vacíos', { canalesHabilitados: [] }], ['canal inválido', { canalesHabilitados: ['WEB'] }],
    ['canal repetido', { canalesHabilitados: ['VENTAS', 'VENTAS'] }], ['canales nulos', { canalesHabilitados: null }],
    ['política incompleta', { politicaCombinacion: { cupon: true } }],
    ['booleano coercionado', { politicaCombinacion: { cupon: 'false', ofertaPricing: false, promocionAutomatica: false } }],
    ['política extra', { politicaCombinacion: { cupon: false, ofertaPricing: false, promocionAutomatica: false, extra: true } }],
    ['campo extra', { desconocido: true }], ['solo lectura', { puedeCambiarModalidad: true }], ['auditoría', { first_activated_at: null }],
  ];
  it.each(invalidCases)('rechaza %s con 422', (_name, input) => {
    expect(() => validatePromotion({ ...promotion(), ...input })).toThrow(expect.objectContaining({ status: 422, code: 'VALIDACION' }));
  });
  it.each([null, [], 5, 'texto', {}, { nombre: 'x' }])('rechaza estructura o campos faltantes: %j', input => {
    expect(() => validatePromotion(input)).toThrow(Problem);
  });
  it('admite alcance solo productos, solo SKU y ambos sin convertir identidades', () => {
    for (const alcance of [{ productIds: ['PRD-LAB-001'] }, { skus: ['SKU-LAB-002'] }, { productIds: [], skus: ['SKU-LAB-001'] }]) {
      expect(validatePromotion(promotion({ alcance })).alcance).toEqual(alcance);
    }
  });
  it('valida bisiesto, fracciones y equivalencia con offset', () => {
    expect(timestamp('2024-02-29T00:00:00.123Z')).toBe(Date.parse('2024-02-29T00:00:00.123Z'));
    expect(timestamp('2024-02-28T19:00:00-05:00')).toBe(timestamp('2024-02-29T00:00:00Z'));
  });
  it('cuenta caracteres Unicode como el esquema', () => { expect(validatePromotion(promotion({ nombre: '🚀'.repeat(160) })).nombre).toHaveLength(320); });
  it('fusiona sin mutar y sustituye objetos/listas presentes', () => {
    const p = promotion();
    const changed = mergePromotion(p, { nombre: 'Otro', alcance: { skus: ['SKU-LAB-002'] }, canalesHabilitados: ['VENTAS'] });
    expect(changed).toEqual({ ...p, nombre: 'Otro', alcance: { skus: ['SKU-LAB-002'] }, canalesHabilitados: ['VENTAS'] });
    expect(p.alcance.productIds).toEqual(['PRD-LAB-001']);
  });
  it('valida tipo/valor en la entidad fusionada', () => {
    const p = promotion({ tipoDescuento: 'MONTO_FIJO', valor: 250 });
    expect(() => mergePromotion(p, { tipoDescuento: 'PORCENTAJE' })).toThrow(Problem);
    expect(mergePromotion(p, { tipoDescuento: 'PORCENTAJE', valor: 90 }).valor).toBe(90);
  });
  it.each([{}, null, [], { promotionId: 'x' }, { puedeCambiarModalidad: true }, { created_at: 'x' }])('rechaza fragmento %j', input => {
    expect(() => validatePatch(input)).toThrow(Problem);
  });
  it('no completa política parcial ni combina alcance parcial', () => {
    expect(() => mergePromotion(promotion(), { politicaCombinacion: { cupon: true } })).toThrow(Problem);
    expect(() => mergePromotion(promotion(), { alcance: { productIds: [] } })).toThrow(Problem);
  });
});

describe('R08–R14: historia, representaciones y lote', () => {
  function stored(overrides: Partial<StoredPromotion> = {}): StoredPromotion { return { promotionId: '00000000-0000-4000-8000-000000000001', data: promotion(), firstActivatedAt: null, ...overrides }; }
  it('solo permite modalidad para inactiva nunca activada', () => {
    expect(canChangeModality(stored())).toBe(true);
    for (const current of [stored({ firstActivatedAt: new Date() }), stored({ data: promotion({ estado: 'ACTIVO' }) })]) {
      expect(canChangeModality(current)).toBe(false);
      expect(() => assertModalityChange(current, promotion({ modalidad: 'CUPON' }))).toThrow(expect.objectContaining({ status: 409, code: 'MODALIDAD_BLOQUEADA' }));
      expect(() => assertModalityChange(current, promotion())).not.toThrow();
    }
  });
  it('mapea admin sin historia/auditoría y comercial con seis campos exactos', () => {
    const p = stored();
    expect(Object.keys(toAdmin(p)).sort()).toEqual([...Object.keys(p.data), 'promotionId', 'puedeCambiarModalidad'].sort());
    expect(toSummary(p)).toEqual({ promotion_id: p.promotionId, name: p.data.nombre, status: 'INACTIVA', valid_from: p.data.validFrom, valid_until: p.data.validUntil, channels: p.data.canalesHabilitados });
    expect(toSummary(stored({ data: promotion({ estado: 'ACTIVO' }) })).status).toBe('ACTIVA');
  });
  it('acepta 1 y 20 elementos en orden', () => {
    expect(validateBatch({ items: [promotion()] })).toHaveLength(1);
    expect(validateBatch({ items: Array.from({ length: 20 }, (_, i) => promotion({ nombre: String(i) })) }).map(p => p.nombre)).toEqual(Array.from({ length: 20 }, (_, i) => String(i)));
  });
  it.each([{}, { items: [] }, { items: Array.from({ length: 21 }, () => promotion()) }, { items: [promotion(), promotion({ valor: 0 })] }, { items: [promotion()], extra: true }])('rechaza lote inválido', input => {
    expect(() => validateBatch(input)).toThrow(expect.objectContaining({ status: 422 }));
  });
});

describe('R13–R16: path, query, Problems y aislamiento', () => {
  it('aplica defaults exactos', () => {
    expect(adminQuery({})).toEqual({ pagina: 1, tamanio: 20 });
    expect(commercialQuery({ canal: 'VENTAS' })).toEqual({ canal: 'VENTAS', estado: 'ACTIVO', vigentes: true });
    expect(commercialQuery({ canal: 'RETAIL', vigentes: 'false', estado: 'INACTIVO' }).vigentes).toBe(false);
  });
  it.each([{ pagina: '0' }, { tamanio: '101' }, { pagina: '1.1' }, { pagina: '1e2' }, { tamanio: ['1', '2'] }, { pagina: '' }, { estado: 'ACTIVA' }, { modalidad: 'x' }, { extra: 'x' }])('rechaza query administrativa %j', q => {
    expect(() => adminQuery(q)).toThrow(expect.objectContaining({ status: 400 }));
  });
  it.each([{}, { canal: 'WEB' }, { canal: ['VENTAS', 'RETAIL'] }, { canal: 'VENTAS', vigentes: '1' }, { canal: 'VENTAS', vigentes: 'TRUE' }, { canal: 'VENTAS', estado: '' }])('rechaza query comercial %j', q => {
    expect(() => commercialQuery(q)).toThrow(expect.objectContaining({ status: 400 }));
  });
  it.each(['x', '', '00000000-0000-4000-8000-00000000000Z'])('UUID inválido %s', id => { expect(() => uuid(id)).toThrow(expect.objectContaining({ status: 400 })); });
  it('acepta UUID y serializa solo los campos de Problem', () => {
    expect(uuid('00000000-0000-4000-8000-000000000001')).toHaveLength(36);
    expect(JSON.parse(JSON.stringify(new Problem(422, 'VALIDACION', 'Entrada inválida', 'Campo inválido')))).toEqual({ status: 422, code: 'VALIDACION', title: 'Entrada inválida', detail: 'Campo inválido' });
  });
  it('restringe las conexiones a las bases locales asignadas', () => {
    expect(() => assertLocalDatabase('postgres://u:p@127.0.0.1:55435/lab_promociones')).not.toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@127.0.0.1:55435/lab_promociones_test', true)).not.toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@example.com:55435/lab_promociones')).toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@127.0.0.1:55435/lab_promociones', true)).toThrow();
  });
});
