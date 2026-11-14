import { Injectable } from '@nestjs/common';
import { ProblemException } from '../common/problem.exception.js';
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
  ValidatedPromocionCreate,
  ValidatedPromocionPatch,
} from '../common/validators.js';
import {
  PromocionesRepository,
  PromocionCompleta,
  PromocionResumenRow,
  PaginaResult,
} from './promociones.repository.js';

export interface PromocionAdminResponse {
  promotionId: string;
  nombre: string;
  tipoDescuento: string;
  valor: number;
  modalidad: string;
  estado: string;
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
  puedeCambiarModalidad: boolean;
}

@Injectable()
export class PromocionesService {
  constructor(private readonly repository: PromocionesRepository) {}

  private mapToAdminResponse(row: PromocionCompleta): PromocionAdminResponse {
    const puedeCambiarModalidad =
      row.state === 'INACTIVO' && row.first_activated_at === null;

    return {
      promotionId: row.id,
      nombre: row.name,
      tipoDescuento: row.discount_type,
      valor: Number(row.discount_value),
      modalidad: row.modality,
      estado: row.state,
      validFrom: row.valid_from.toISOString(),
      validUntil: row.valid_until.toISOString(),
      alcance: {
        ...(row.alcance.productIds.length > 0 ? { productIds: row.alcance.productIds } : {}),
        ...(row.alcance.skus.length > 0 ? { skus: row.alcance.skus } : {}),
      },
      prioridad: row.priority,
      canalesHabilitados: row.enabled_channels,
      politicaCombinacion: {
        ofertaPricing: row.politicaCombinacion.ofertaPricing,
        promocionAutomatica: row.politicaCombinacion.promocionAutomatica,
        cupon: row.politicaCombinacion.cupon,
      },
      puedeCambiarModalidad,
    };
  }

  async crearPromocion(
    body: unknown,
    actorRole: 'ADMIN' | 'LECTOR_O_ADMIN',
  ): Promise<PromocionAdminResponse> {
    if (actorRole !== 'ADMIN') {
      throw new ProblemException(
        403,
        'NO_AUTORIZADO',
        'No autorizado',
        'Se requiere rol ADMIN para crear promociones',
      );
    }

    const validated = validatePromocionCreate(body);

    const id = crypto.randomUUID();
    const now = new Date();
    const firstActivatedAt =
      validated.estado === 'ACTIVO' ? now : null;

    const created = await this.repository.createPromocion({
      id,
      nombre: validated.nombre,
      tipoDescuento: validated.tipoDescuento,
      valor: validated.valor,
      modalidad: validated.modalidad,
      estado: validated.estado,
      validFrom: validated.validFrom,
      validUntil: validated.validUntil,
      alcance: validated.alcance,
      prioridad: validated.prioridad,
      canalesHabilitados: validated.canalesHabilitados,
      politicaCombinacion: validated.politicaCombinacion,
      firstActivatedAt,
    });

    return this.mapToAdminResponse(created);
  }

  async crearPromocionesLote(
    body: unknown,
    actorRole: 'ADMIN' | 'LECTOR_O_ADMIN',
  ): Promise<{ items: PromocionAdminResponse[] }> {
    if (actorRole !== 'ADMIN') {
      throw new ProblemException(
        403,
        'NO_AUTORIZADO',
        'No autorizado',
        'Se requiere rol ADMIN para crear promociones en lote',
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'Cuerpo de la solicitud debe ser un objeto JSON',
      );
    }
    const b = body as Record<string, unknown>;
    if (!b.items || !Array.isArray(b.items)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'items es requerido y debe ser un arreglo',
      );
    }
    if (b.items.length < 1 || b.items.length > 20) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'items debe tener entre 1 y 20 elementos',
      );
    }

    const allowedLote = new Set(['items']);
    for (const key of Object.keys(b)) {
      if (!allowedLote.has(key)) {
        throw new ProblemException(
          422,
          'VALIDACION',
          'Validación fallida',
          `Propiedad no permitida: ${key}`,
        );
      }
    }

    const now = new Date();
    const creaciones: PromocionCreateInput[] = [];

    for (const item of b.items) {
      const validated = validatePromocionCreate(item);
      const firstActivatedAt =
        validated.estado === 'ACTIVO' ? now : null;
      creaciones.push({
        id: crypto.randomUUID(),
        nombre: validated.nombre,
        tipoDescuento: validated.tipoDescuento,
        valor: validated.valor,
        modalidad: validated.modalidad,
        estado: validated.estado,
        validFrom: validated.validFrom,
        validUntil: validated.validUntil,
        alcance: validated.alcance,
        prioridad: validated.prioridad,
        canalesHabilitados: validated.canalesHabilitados,
        politicaCombinacion: validated.politicaCombinacion,
        firstActivatedAt,
      });
    }

    const creados = await this.repository.createPromocionesLote(creaciones);
    return { items: creados.map((c) => this.mapToAdminResponse(c)) };
  }

  async listarPromocionesComerciales(
    canal: string,
    vigentes: boolean,
    estado: 'ACTIVO' | 'INACTIVO',
    actorRole: 'ADMIN' | 'LECTOR_O_ADMIN',
  ): Promise<{ items: Array<{
    promotion_id: string;
    name: string;
    status: string;
    valid_from: string;
    valid_until: string;
    channels: string[];
  }> }> {
    if (actorRole !== 'ADMIN' && actorRole !== 'LECTOR_O_ADMIN') {
      throw new ProblemException(401, 'NO_AUTENTICADO', 'No autenticado');
    }

    const rows = await this.repository.listComercial(canal, vigentes, estado);
    return {
      items: rows.map((r) => ({
        promotion_id: r.promotion_id,
        name: r.name,
        status: r.status,
        valid_from: r.valid_from.toISOString(),
        valid_until: r.valid_until.toISOString(),
        channels: r.channels,
      })),
    };
  }

  async listarPromocionesAdmin(
    pagina: number,
    tamanio: number,
    estado?: 'ACTIVO' | 'INACTIVO',
    modalidad?: 'AUTOMATICA' | 'CUPON',
    actorRole: 'ADMIN' | 'LECTOR_O_ADMIN' = 'LECTOR_O_ADMIN',
  ): Promise<{
    items: PromocionAdminResponse[];
    meta: { pagina: number; tamanio: number; total: number; totalPaginas: number };
  }> {
    if (actorRole !== 'ADMIN' && actorRole !== 'LECTOR_O_ADMIN') {
      throw new ProblemException(401, 'NO_AUTENTICADO', 'No autenticado');
    }

    const result: PaginaResult = await this.repository.listAdmin(
      pagina, tamanio, estado, modalidad,
    );

    return {
      items: result.items.map((r) => this.mapToAdminResponse(r)),
      meta: {
        pagina: result.pagina,
        tamanio: result.tamanio,
        total: result.total,
        totalPaginas: result.totalPaginas,
      },
    };
  }

  async obtenerPromocionAdmin(
    promocionId: string,
    actorRole: 'ADMIN' | 'LECTOR_O_ADMIN',
  ): Promise<PromocionAdminResponse> {
    if (actorRole !== 'ADMIN' && actorRole !== 'LECTOR_O_ADMIN') {
      throw new ProblemException(401, 'NO_AUTENTICADO', 'No autenticado');
    }

    if (!isValidUuid(promocionId)) {
      throw new ProblemException(
        400,
        'VALIDACION',
        'Validación fallida',
        'promocionId debe ser un UUID válido',
      );
    }

    const row = await this.repository.findById(promocionId);
    if (!row) {
      throw new ProblemException(
        404,
        'PROMOCION_NO_ENCONTRADA',
        'Promoción no encontrada',
      );
    }

    return this.mapToAdminResponse(row);
  }

  async actualizarPromocion(
    promocionId: string,
    body: unknown,
    actorRole: 'ADMIN' | 'LECTOR_O_ADMIN',
  ): Promise<PromocionAdminResponse> {
    if (actorRole !== 'ADMIN') {
      throw new ProblemException(
        403,
        'NO_AUTORIZADO',
        'No autorizado',
        'Se requiere rol ADMIN para actualizar promociones',
      );
    }

    if (!isValidUuid(promocionId)) {
      throw new ProblemException(
        400,
        'VALIDACION',
        'Validación fallida',
        'promocionId debe ser un UUID válido',
      );
    }

    const validated = validatePromocionPatch(body);

    const existing = await this.repository.findById(promocionId);
    if (!existing) {
      throw new ProblemException(
        404,
        'PROMOCION_NO_ENCONTRADA',
        'Promoción no encontrada',
      );
    }

    const mergedNombre = validated.nombre ?? existing.name;
    const mergedTipoDescuento = validated.tipoDescuento ?? existing.discount_type;
    const mergedValor = validated.valor ?? Number(existing.discount_value);
    const mergedModalidad = validated.modalidad ?? existing.modality;
    const mergedEstado = validated.estado ?? existing.state;
    const mergedValidFrom = validated.validFrom ?? existing.valid_from.toISOString();
    const mergedValidUntil = validated.validUntil ?? existing.valid_until.toISOString();
    const mergedAlcance = validated.alcance ?? {
      productIds: existing.alcance.productIds,
      skus: existing.alcance.skus,
    };
    const mergedPrioridad = validated.prioridad ?? existing.priority;
    const mergedCanales = validated.canalesHabilitados ?? existing.enabled_channels;
    const mergedPolitica = validated.politicaCombinacion ?? {
      ofertaPricing: existing.politicaCombinacion.ofertaPricing,
      promocionAutomatica: existing.politicaCombinacion.promocionAutomatica,
      cupon: existing.politicaCombinacion.cupon,
    };

    validateNombre(mergedNombre);
    validateTipoDescuentoField(mergedTipoDescuento as 'PORCENTAJE' | 'MONTO_FIJO');
    validateValor(mergedValor, mergedTipoDescuento as 'PORCENTAJE' | 'MONTO_FIJO');
    validateModalidad(mergedModalidad);
    validateEstado(mergedEstado);
    if (!isValidIsoDateTime(mergedValidFrom)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'validFrom debe ser ISO 8601 con zona horaria',
      );
    }
    if (!isValidIsoDateTime(mergedValidUntil)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'validUntil debe ser ISO 8601 con zona horaria',
      );
    }
    if (new Date(mergedValidFrom) >= new Date(mergedValidUntil)) {
      throw new ProblemException(
        422,
        'VALIDACION',
        'Validación fallida',
        'validFrom debe ser anterior a validUntil',
      );
    }
    validateAlcance(mergedAlcance);
    validatePrioridad(mergedPrioridad);
    validateCanalesHabilitados(mergedCanales);
    validatePoliticaCombinacion(mergedPolitica);

    const puedeCambiarModalidad =
      existing.state === 'INACTIVO' && existing.first_activated_at === null;

    if (
      validated.modalidad !== undefined &&
      validated.modalidad !== existing.modality &&
      !puedeCambiarModalidad
    ) {
      throw new ProblemException(
        409,
        'MODALIDAD_BLOQUEADA',
        'Modalidad bloqueada',
        'No se puede cambiar la modalidad: la promoción ya fue activada o está ACTIVA',
      );
    }

    let firstActivatedAt = existing.first_activated_at;
    if (mergedEstado === 'ACTIVO' && existing.state !== 'ACTIVO' && !existing.first_activated_at) {
      firstActivatedAt = new Date();
    }

    const updated = await this.repository.updatePromocion(promocionId, {
      nombre: validated.nombre !== undefined ? mergedNombre : undefined,
      tipoDescuento: validated.tipoDescuento !== undefined ? mergedTipoDescuento : undefined,
      valor: validated.valor !== undefined ? mergedValor : undefined,
      modalidad: validated.modalidad !== undefined ? mergedModalidad : undefined,
      estado: validated.estado !== undefined ? mergedEstado : undefined,
      validFrom: validated.validFrom !== undefined ? mergedValidFrom : undefined,
      validUntil: validated.validUntil !== undefined ? mergedValidUntil : undefined,
      alcance: validated.alcance !== undefined ? mergedAlcance : undefined,
      prioridad: validated.prioridad !== undefined ? mergedPrioridad : undefined,
      canalesHabilitados: validated.canalesHabilitados !== undefined ? mergedCanales : undefined,
      politicaCombinacion: validated.politicaCombinacion !== undefined ? mergedPolitica : undefined,
      firstActivatedAt,
    });

    if (!updated) {
      throw new ProblemException(
        404,
        'PROMOCION_NO_ENCONTRADA',
        'Promoción no encontrada',
      );
    }

    return this.mapToAdminResponse(updated);
  }

  async eliminarPromocion(
    promocionId: string,
    actorRole: 'ADMIN' | 'LECTOR_O_ADMIN',
  ): Promise<void> {
    if (actorRole !== 'ADMIN') {
      throw new ProblemException(
        403,
        'NO_AUTORIZADO',
        'No autorizado',
        'Se requiere rol ADMIN para eliminar promociones',
      );
    }

    if (!isValidUuid(promocionId)) {
      throw new ProblemException(
        400,
        'VALIDACION',
        'Validación fallida',
        'promocionId debe ser un UUID válido',
      );
    }

    const deletedInfo = await this.repository.findDeletedById(promocionId);
    if (!deletedInfo || deletedInfo.deleted_at !== null) {
      throw new ProblemException(
        404,
        'PROMOCION_NO_ENCONTRADA',
        'Promoción no encontrada',
      );
    }

    const deleted = await this.repository.softDelete(promocionId);
    if (!deleted) {
      throw new ProblemException(
        404,
        'PROMOCION_NO_ENCONTRADA',
        'Promoción no encontrada',
      );
    }
  }
}

interface PromocionCreateInput {
  id: string;
  nombre: string;
  tipoDescuento: string;
  valor: number;
  modalidad: string;
  estado: string;
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
  firstActivatedAt: Date | null;
}