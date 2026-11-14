import { describe, it, expect } from 'vitest';
import {
  validarPromocionCreate,
  validarPromocionPatch,
  validarLoteCreate,
  validarValorFinitoPositivo,
  validarNombreTexto,
  validarFechaHoraConZona,
  validarUuid,
  validarCanalesHabilitados,
  validarAlcance,
  validarPoliticaCombinacion,
} from '../../src/common/validation.js';
import { ProblemError } from '../../src/common/problem.js';

describe('Validación de entradas (R01-R07, R16)', () => {
  describe('validarValorFinitoPositivo', () => {
    it('acepta número válido > 0', () => {
      expect(validarValorFinitoPositivo(5)).toBe(5);
      expect(validarValorFinitoPositivo(0.01)).toBe(0.01);
    });
    it('rechaza 0', () => {
      expect(() => validarValorFinitoPositivo(0)).toThrow(ProblemError);
    });
    it('rechaza negativo', () => {
      expect(() => validarValorFinitoPositivo(-1)).toThrow(ProblemError);
    });
    it('rechaza NaN e Infinity', () => {
      expect(() => validarValorFinitoPositivo(NaN)).toThrow(ProblemError);
      expect(() => validarValorFinitoPositivo(Infinity)).toThrow(ProblemError);
    });
    it('rechaza string', () => {
      expect(() => validarValorFinitoPositivo('5' as any)).toThrow(ProblemError);
    });
  });

  describe('validarNombreTexto', () => {
    it('acepta nombre válido', () => {
      expect(validarNombreTexto('Promo de prueba')).toBe('Promo de prueba');
    });
    it('rechaza vacío', () => {
      expect(() => validarNombreTexto('')).toThrow(ProblemError);
    });
    it('rechaza solo espacios', () => {
      expect(() => validarNombreTexto('   ')).toThrow(ProblemError);
    });
    it('rechaza exceso de 160 caracteres', () => {
      const largo = 'a'.repeat(161);
      expect(() => validarNombreTexto(largo)).toThrow(ProblemError);
    });
    it('acepta exactamente 160 caracteres', () => {
      const exacto = 'a'.repeat(160);
      expect(validarNombreTexto(exacto)).toBe(exacto);
    });
  });

  describe('validarFechaHoraConZona', () => {
    it('acepta ISO 8601 con Z', () => {
      const d = validarFechaHoraConZona('2026-01-01T00:00:00Z');
      expect(d.getUTCFullYear()).toBe(2026);
    });
    it('acepta ISO 8601 con zona horaria', () => {
      const d = validarFechaHoraConZona('2026-12-31T23:59:59-05:00');
      expect(d.getFullYear()).toBe(2026);
    });
    it('rechaza sin zona horaria', () => {
      expect(() => validarFechaHoraConZona('2026-01-01T00:00:00')).toThrow(ProblemError);
    });
    it('rechaza inválida', () => {
      expect(() => validarFechaHoraConZona('no-es-una-fecha')).toThrow(ProblemError);
    });
    it('rechaza no-string', () => {
      expect(() => validarFechaHoraConZona(123 as any)).toThrow(ProblemError);
    });
  });

  describe('validarUuid', () => {
    it('acepta UUID válido', () => {
      expect(validarUuid('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
    it('rechaza UUID inválido', () => {
      expect(() => validarUuid('no-es-uuid')).toThrow(ProblemError);
      expect(() => validarUuid(123 as any)).toThrow(ProblemError);
    });
  });

  describe('validarCanalesHabilitados', () => {
    it('acepta canales válidos únicos', () => {
      expect(validarCanalesHabilitados(['MARKETPLACE', 'RETAIL'])).toEqual(['MARKETPLACE', 'RETAIL']);
    });
    it('rechaza vacío', () => {
      expect(() => validarCanalesHabilitados([])).toThrow(ProblemError);
    });
    it('rechaza duplicados', () => {
      expect(() => validarCanalesHabilitados(['MARKETPLACE', 'MARKETPLACE'])).toThrow(ProblemError);
    });
    it('rechaza canal inválido', () => {
      expect(() => validarCanalesHabilitados(['INVALIDO'] as any)).toThrow(ProblemError);
    });
    it('rechaza no arreglo', () => {
      expect(() => validarCanalesHabilitados('MARKETPLACE' as any)).toThrow(ProblemError);
    });
  });

  describe('validarAlcance', () => {
    it('acepta productIds', () => {
      const r = validarAlcance({ productIds: ['PRD-LAB-001'] });
      expect(r.productIds).toEqual(['PRD-LAB-001']);
    });
    it('acepta skus', () => {
      const r = validarAlcance({ skus: ['SKU-LAB-001'] });
      expect(r.skus).toEqual(['SKU-LAB-001']);
    });
    it('rechaza vacío (sin productIds ni skus)', () => {
      expect(() => validarAlcance({})).toThrow(ProblemError);
    });
    it('rechaza productIds vacío', () => {
      expect(() => validarAlcance({ productIds: [] })).toThrow(ProblemError);
    });
    it('rechaza duplicados', () => {
      expect(() => validarAlcance({ productIds: ['PRD-LAB-001', 'PRD-LAB-001'] })).toThrow(ProblemError);
    });
  });

  describe('validarPoliticaCombinacion', () => {
    it('acepta tres booleanos', () => {
      const r = validarPoliticaCombinacion({ ofertaPricing: true, promocionAutomatica: false, cupon: true });
      expect(r.ofertaPricing).toBe(true);
      expect(r.promocionAutomatica).toBe(false);
      expect(r.cupon).toBe(true);
    });
    it('rechaza booleano faltante', () => {
      expect(() => validarPoliticaCombinacion({ ofertaPricing: true, promocionAutomatica: false } as any)).toThrow(ProblemError);
    });
  });

  describe('validarPromocionCreate', () => {
    const base = {
      nombre: 'Promo válida',
      tipoDescuento: 'PORCENTAJE' as const,
      valor: 10,
      modalidad: 'AUTOMATICA' as const,
      estado: 'ACTIVO' as const,
      validFrom: '2026-01-01T00:00:00Z',
      validUntil: '2026-12-31T23:59:59Z',
      alcance: { productIds: ['PRD-LAB-001'] },
      prioridad: 1,
      canalesHabilitados: ['MARKETPLACE'] as const,
      politicaCombinacion: { ofertaPricing: false, promocionAutomatica: true, cupon: false },
    };

    it('acepta entrada válida', () => {
      const r = validarPromocionCreate(base);
      expect(r.nombre).toBe('Promo válida');
    });

    it('rechacha valor > 100 para PORCENTAJE', () => {
      expect(() => validarPromocionCreate({ ...base, valor: 150 })).toThrow(ProblemError);
    });

    it('acepta MONTO_FIJO con cualquier valor > 0', () => {
      const r = validarPromocionCreate({ ...base, tipoDescuento: 'MONTO_FIJO', valor: 500 });
      expect(r.valor).toBe(500);
    });

    it('rechacha fechas sin zona', () => {
      expect(() => validarPromocionCreate({ ...base, validFrom: '2026-01-01T00:00:00' })).toThrow(ProblemError);
    });

    it('rechacha validFrom >= validUntil', () => {
      expect(() => validarPromocionCreate({ ...base, validUntil: '2026-01-01T00:00:00Z' })).toThrow(ProblemError);
    });

    it('rechacha propiedad extra', () => {
      expect(() => validarPromocionCreate({ ...base, campoExtra: 'x' as any })).toThrow(ProblemError);
    });

    it('rechacha campos de solo lectura', () => {
      expect(() => validarPromocionCreate({ ...base, promotionId: 'abc' as any })).toThrow(ProblemError);
    });
  });

  describe('validarPromocionPatch', () => {
    it('acepta solo nombre', () => {
      const r = validarPromocionPatch({ nombre: 'Solo nombre' });
      expect(r.nombre).toBe('Solo nombre');
    });
    it('rechaza vacío', () => {
      expect(() => validarPromocionPatch({})).toThrow(ProblemError);
    });
    it('rechaza propiedad desconocida', () => {
      expect(() => validarPromocionPatch({ nombre: 'x', campoExtra: 1 as any })).toThrow(ProblemError);
    });
    it('rechaza campo de solo lectura', () => {
      expect(() => validarPromocionPatch({ promotionId: 'abc' as any })).toThrow(ProblemError);
      expect(() => validarPromocionPatch({ puedeCambiarModalidad: true as any })).toThrow(ProblemError);
    });
  });

  describe('validarLoteCreate', () => {
    const itemValido = {
      nombre: 'Lote item',
      tipoDescuento: 'PORCENTAJE' as const,
      valor: 5,
      modalidad: 'CUPON' as const,
      estado: 'ACTIVO' as const,
      validFrom: '2026-01-01T00:00:00Z',
      validUntil: '2026-12-31T23:59:59Z',
      alcance: { skus: ['SKU-LAB-001'] },
      prioridad: 2,
      canalesHabilitados: ['CHATBOT'] as const,
      politicaCombinacion: { ofertaPricing: true, promocionAutomatica: false, cupon: true },
    };

    it('acepta 1 item', () => {
      const r = validarLoteCreate({ items: [itemValido] });
      expect(r.length).toBe(1);
    });

    it('acepta 20 items', () => {
      const items = Array(20).fill(itemValido);
      const r = validarLoteCreate({ items });
      expect(r.length).toBe(20);
    });

    it('rechaza 0 items', () => {
      expect(() => validarLoteCreate({ items: [] })).toThrow(ProblemError);
    });

    it('rechaza 21 items', () => {
      const items = Array(21).fill(itemValido);
      expect(() => validarLoteCreate({ items })).toThrow(ProblemError);
    });
  });
});
