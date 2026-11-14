import { describe, it, expect } from 'vitest';
import {
  validatePromocionCreate,
  validatePromocionPatch,
  validateAlcance,
  validatePoliticaCombinacion,
  validateNombre,
  validateTipoDescuentoField,
  validateValor,
  validateModalidad,
  validateEstado,
  validatePrioridad,
  validateCanalesHabilitados,
  isValidUuid,
  isValidIsoDateTime,
} from '../common/validators.js';
import { ProblemException } from '../common/problem.exception.js';

describe('validadores de entrada', () => {
  describe('validateNombre', () => {
    it('acepta nombre válido', () => {
      expect(validateNombre('Promoción Verano')).toBe('Promoción Verano');
    });
    it('rechaza nombre vacío', () => {
      expect(() => validateNombre('')).toThrow(ProblemException);
    });
    it('rechaza nombre solo espacios', () => {
      expect(() => validateNombre('   ')).toThrow(ProblemException);
    });
    it('rechaza nombre > 160 chars', () => {
      expect(() => validateNombre('a'.repeat(161))).toThrow(ProblemException);
    });
    it('acepta nombre de exactamente 160 chars', () => {
      expect(validateNombre('a'.repeat(160))).toHaveLength(160);
    });
  });

  describe('validateValor', () => {
    it('acepta valor positivo para MONTO_FIJO', () => {
      expect(validateValor(50, 'MONTO_FIJO')).toBe(50);
    });
    it('acepta valor <= 100 para PORCENTAJE', () => {
      expect(validateValor(100, 'PORCENTAJE')).toBe(100);
      expect(validateValor(50, 'PORCENTAJE')).toBe(50);
    });
    it('rechaza valor > 100 para PORCENTAJE', () => {
      expect(() => validateValor(101, 'PORCENTAJE')).toThrow(ProblemException);
    });
    it('rechaza valor <= 0', () => {
      expect(() => validateValor(0, 'MONTO_FIJO')).toThrow(ProblemException);
      expect(() => validateValor(-5, 'MONTO_FIJO')).toThrow(ProblemException);
    });
    it('rechaza NaN e Infinity', () => {
      expect(() => validateValor(NaN, 'MONTO_FIJO')).toThrow(ProblemException);
      expect(() => validateValor(Infinity, 'MONTO_FIJO')).toThrow(ProblemException);
    });
    it('rechaza string en lugar de número', () => {
      expect(() => validateValor('50' as unknown as number, 'MONTO_FIJO')).toThrow(ProblemException);
    });
  });

  describe('validateAlcance', () => {
    it('acepta productIds válidos', () => {
      const r = validateAlcance({ productIds: ['PRD-LAB-001'] });
      expect(r.productIds).toEqual(['PRD-LAB-001']);
    });
    it('acepta skus válidos', () => {
      const r = validateAlcance({ skus: ['SKU-LAB-001'] });
      expect(r.skus).toEqual(['SKU-LAB-001']);
    });
    it('acepta ambos', () => {
      const r = validateAlcance({ productIds: ['PRD-LAB-001'], skus: ['SKU-LAB-001', 'SKU-LAB-002'] });
      expect(r.productIds).toEqual(['PRD-LAB-001']);
      expect(r.skus).toEqual(['SKU-LAB-001', 'SKU-LAB-002']);
    });
    it('rechaza alcance vacío', () => {
      expect(() => validateAlcance({})).toThrow(ProblemException);
      expect(() => validateAlcance({ productIds: [], skus: [] })).toThrow(ProblemException);
    });
    it('rechaza productId inactivo', () => {
      expect(() => validateAlcance({ productIds: ['PRD-LAB-INACTIVO'] })).toThrow(ProblemException);
    });
    it('rechaza sku inactivo', () => {
      expect(() => validateAlcance({ skus: ['SKU-LAB-INACTIVO'] })).toThrow(ProblemException);
    });
    it('rechaza productId inexistente', () => {
      expect(() => validateAlcance({ productIds: ['PRD-INEXISTENTE'] })).toThrow(ProblemException);
    });
    it('rechaza duplicados', () => {
      expect(() => validateAlcance({ productIds: ['PRD-LAB-001', 'PRD-LAB-001'] })).toThrow(ProblemException);
      expect(() => validateAlcance({ skus: ['SKU-LAB-001', 'SKU-LAB-001'] })).toThrow(ProblemException);
    });
  });

  describe('validatePoliticaCombinacion', () => {
    it('acepta política válida', () => {
      const r = validatePoliticaCombinacion({ ofertaPricing: true, promocionAutomatica: false, cupon: true });
      expect(r.ofertaPricing).toBe(true);
      expect(r.promocionAutomatica).toBe(false);
      expect(r.cupon).toBe(true);
    });
    it('rechaza booleans faltantes', () => {
      expect(() => validatePoliticaCombinacion({ ofertaPricing: true })).toThrow(ProblemException);
    });
    it('rechaza propiedades adicionales', () => {
      expect(() => validatePoliticaCombinacion({ ofertaPricing: true, promocionAutomatica: false, cupon: true, extra: 1 })).toThrow(ProblemException);
    });
  });

  describe('validateCanalesHabilitados', () => {
    it('acepta canales válidos', () => {
      expect(validateCanalesHabilitados(['MARKETPLACE', 'CHATBOT'])).toEqual(['MARKETPLACE', 'CHATBOT']);
    });
    it('rechaza arreglo vacío', () => {
      expect(() => validateCanalesHabilitados([])).toThrow(ProblemException);
    });
    it('rechaza canal inválido', () => {
      expect(() => validateCanalesHabilitados(['INVALIDO'])).toThrow(ProblemException);
    });
    it('rechaza duplicados', () => {
      expect(() => validateCanalesHabilitados(['MARKETPLACE', 'MARKETPLACE'])).toThrow(ProblemException);
    });
  });

  describe('isValidUuid', () => {
    it('acepta UUID válido', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });
    it('rechaza UUID inválido', () => {
      expect(isValidUuid('no-es-un-uuid')).toBe(false);
      expect(isValidUuid('123')).toBe(false);
    });
  });

  describe('isValidIsoDateTime', () => {
    it('acepta ISO 8601 con Z', () => {
      expect(isValidIsoDateTime('2026-01-15T10:00:00Z')).toBe(true);
    });
    it('acepta ISO 8601 con offset', () => {
      expect(isValidIsoDateTime('2026-01-15T10:00:00-05:00')).toBe(true);
    });
    it('rechaza sin zona horaria', () => {
      expect(isValidIsoDateTime('2026-01-15T10:00:00')).toBe(false);
    });
    it('rechaza string inválida', () => {
      expect(isValidIsoDateTime('no-fecha')).toBe(false);
    });
  });

  describe('validatePromocionCreate', () => {
    const base = {
      nombre: 'Promo Test',
      tipoDescuento: 'PORCENTAJE',
      valor: 20,
      modalidad: 'AUTOMATICA',
      estado: 'ACTIVO',
      validFrom: '2026-01-01T00:00:00Z',
      validUntil: '2026-12-31T23:59:59Z',
      alcance: { productIds: ['PRD-LAB-001'] },
      prioridad: 1,
      canalesHabilitados: ['MARKETPLACE'],
      politicaCombinacion: { ofertaPricing: true, promocionAutomatica: true, cupon: false },
    };

    it('acepta creación válida', () => {
      const r = validatePromocionCreate(base);
      expect(r.nombre).toBe('Promo Test');
      expect(r.valor).toBe(20);
    });

    it('rechaza propiedades adicionales', () => {
      expect(() => validatePromocionCreate({ ...base, extra: 1 })).toThrow(ProblemException);
    });

    it('rechaza campo requerido ausente', () => {
      const { nombre, ...rest } = base;
      expect(() => validatePromocionCreate(rest)).toThrow(ProblemException);
    });

    it('rechaza validFrom >= validUntil', () => {
      expect(() => validatePromocionCreate({ ...base, validFrom: '2026-12-31T23:59:59Z', validUntil: '2026-01-01T00:00:00Z' })).toThrow(ProblemException);
    });
  });

  describe('validatePromocionPatch', () => {
    it('acepta PATCH parcial válido', () => {
      const r = validatePromocionPatch({ nombre: 'Nuevo Nombre' });
      expect(r.nombre).toBe('Nuevo Nombre');
    });
    it('rechaza PATCH vacío', () => {
      expect(() => validatePromocionPatch({})).toThrow(ProblemException);
    });
    it('rechaza propiedad desconocida', () => {
      expect(() => validatePromocionPatch({ campoInexistente: 1 })).toThrow(ProblemException);
    });
  });
});