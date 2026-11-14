import type { Promotion } from '../src/domain.js';
export function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    nombre: 'Promoción académica', tipoDescuento: 'PORCENTAJE', valor: 15,
    modalidad: 'AUTOMATICA', estado: 'INACTIVO', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z',
    alcance: { productIds: ['PRD-LAB-001'], skus: ['SKU-LAB-001'] }, prioridad: 1,
    canalesHabilitados: ['MARKETPLACE', 'CHATBOT'],
    politicaCombinacion: { ofertaPricing: false, promocionAutomatica: true, cupon: false }, ...overrides,
  };
}
