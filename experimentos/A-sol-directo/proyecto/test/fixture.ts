import type { PromotionInput } from '../src/validation.js';

export function fixture(overrides: Record<string, unknown> = {}): PromotionInput {
  return { nombre: 'Promoción de laboratorio', tipoDescuento: 'PORCENTAJE', valor: 15,
    modalidad: 'AUTOMATICA', estado: 'INACTIVO',
    validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z',
    alcance: { productIds: ['PRD-LAB-001'], skus: ['SKU-LAB-001'] }, prioridad: 1,
    canalesHabilitados: ['MARKETPLACE', 'CHATBOT'],
    politicaCombinacion: { ofertaPricing: false, promocionAutomatica: true, cupon: false },
    ...overrides } as PromotionInput;
}
