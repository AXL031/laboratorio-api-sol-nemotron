import { describe, expect, it } from 'vitest';
import { adminQuery, commercialQuery, dateTime, uuid, validateBatch, validateInput, validatePatch } from '../src/validation.js';
import { Problem } from '../src/problem.js';
import { canChangeModality } from '../src/promotions.service.js';
import { fixture } from './fixture.js';

describe('reglas de entrada', () => {
  it('conserva ambas identidades y admite nombres repetidos', () => {
    const result = validateInput(fixture());
    expect(result.alcance).toEqual({ productIds: ['PRD-LAB-001'], skus: ['SKU-LAB-001'] });
    expect(validateBatch({ items: [fixture(), fixture()] })).toHaveLength(2);
  });
  it('normaliza una fecha con desfase y acepta un día bisiesto real', () => {
    expect(dateTime('2024-02-29T13:00:00-05:00')).toBe('2024-02-29T18:00:00.000Z');
  });
  it.each([
    { nombre: '' }, { nombre: ' \t\n' }, { nombre: 'x'.repeat(161) }, { nombre: null },
    { tipoDescuento: 'FIJO' }, { valor: 0 }, { valor: -1 }, { valor: 101 }, { valor: NaN },
    { valor: Infinity }, { valor: -Infinity }, { valor: '10' },
    { modalidad: 'OTRA' }, { estado: 'ACTIVA' }, { prioridad: 0 }, { prioridad: 1.5 },
    { validFrom: '2026-01-01' }, { validFrom: '2026-01-01T00:00:00' },
    { validFrom: '2023-02-29T00:00:00Z' }, { validFrom: '2026-04-31T00:00:00Z' },
    { validFrom: '2026-13-01T00:00:00Z' }, { validFrom: '2026-01-01T24:00:00Z' },
    { validFrom: '2026-01-01T00:60:00Z' }, { validFrom: '2026-01-01T00:00:00+24:00' },
    { validUntil: '2020-01-01T00:00:00Z' }, { validUntil: '2019-01-01T00:00:00Z' },
    { alcance: {} }, { alcance: { productIds: [] } }, { alcance: { skus: [''] } },
    { alcance: { productIds: ['PRD-LAB-INACTIVO'] } }, { alcance: { skus: ['SKU-LAB-INACTIVO'] } },
    { alcance: { skus: ['NO-EXISTE'] } }, { alcance: { productIds: ['PRD-LAB-001', 'PRD-LAB-001'] } },
    { alcance: { skus: ['SKU-LAB-001', 'SKU-LAB-001'] } }, { alcance: { extra: true, skus: ['SKU-LAB-001'] } },
    { canalesHabilitados: [] }, { canalesHabilitados: ['RETAIL', 'RETAIL'] }, { canalesHabilitados: ['OTRO'] },
    { politicaCombinacion: { cupon: true } },
    { politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: 'false' } },
    { politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false, extra: true } },
    { promotionId: 'cualquier-id' }, { puedeCambiarModalidad: true }, { created_at: '2026-01-01' },
  ])('rechaza creación inválida %#', change => {
    expect(() => validateInput(fixture(change))).toThrowError(Problem);
    try { validateInput(fixture(change)); } catch (error) { expect((error as Problem).status).toBe(422); }
  });
  it('acepta monto fijo superior a 100 y los límites válidos', () => {
    expect(validateInput(fixture({ tipoDescuento: 'MONTO_FIJO', valor: 1000, nombre: 'x'.repeat(160) })).valor).toBe(1000);
    expect(validateInput(fixture({ valor: 100, alcance: { skus: ['SKU-LAB-002'] } })).valor).toBe(100);
  });
  it.each([null, [], 3, 'texto', true, {}])('rechaza cuerpos no completos: %j', value => {
    expect(() => validateInput(value)).toThrowError(Problem);
  });
  it.each([{}, null, [], { promotionId: 'x' }, { updated_at: 'x' }, { desconocido: 1 }])('PATCH inválido: %j', value => {
    expect(() => validatePatch(value)).toThrowError(Problem);
  });
  it('PATCH es parcial, sin rellenar propiedades omitidas', () => {
    expect(validatePatch({ nombre: 'nuevo' })).toEqual({ nombre: 'nuevo' });
  });
  it.each([{}, { items: [] }, { items: Array.from({ length: 21 }, () => fixture()) },
    { items: [fixture(), fixture({ valor: 0 })] }, { items: [fixture()], extra: 1 }])('lote inválido %#', value => {
    expect(() => validateBatch(value)).toThrowError(Problem);
  });
  it('lote acepta los límites 1 y 20', () => {
    expect(validateBatch({ items: [fixture()] })).toHaveLength(1);
    expect(validateBatch({ items: Array.from({ length: 20 }, () => fixture()) })).toHaveLength(20);
  });
});
describe('query y UUID (400)', () => {
  it('aplica los defaults', () => {
    expect(adminQuery({})).toEqual({ pagina: 1, tamanio: 20, estado: undefined, modalidad: undefined });
    expect(commercialQuery({ canal: 'VENTAS' })).toEqual({ canal: 'VENTAS', vigentes: true, estado: 'ACTIVO' });
  });
  it.each([{ pagina: '0' }, { pagina: '-1' }, { pagina: '1.5' }, { pagina: '1e2' }, { tamanio: '101' },
    { tamanio: '0' }, { pagina: ['1', '2'] }, { estado: 'ACTIVA' }, { modalidad: 'otro' }, { extra: '1' }])('query admin inválida %#', q => {
    expect(() => adminQuery(q)).toThrowError(expect.objectContaining({ status: 400, code: 'VALIDACION' }));
  });
  it.each([{}, { canal: 'otro' }, { canal: ['RETAIL', 'VENTAS'] }, { canal: 'RETAIL', vigentes: '1' },
    { canal: 'RETAIL', estado: 'ACTIVA' }])('query comercial inválida %#', q => {
    expect(() => commercialQuery(q)).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it('acepta UUID y rechaza identificadores abreviados', () => {
    expect(uuid('00000000-0000-4000-8000-000000000001')).toBeTruthy();
    expect(() => uuid('1234')).toThrowError(expect.objectContaining({ status: 400 }));
  });
});
describe('antecedente de activación', () => {
  it.each([
    ['INACTIVO', null, true], ['ACTIVO', null, false], ['INACTIVO', new Date(), false], ['ACTIVO', new Date(), false],
  ] as const)('%s / %s => %s', (state, first_activated_at, expected) => {
    expect(canChangeModality({ state, first_activated_at })).toBe(expected);
  });
});
