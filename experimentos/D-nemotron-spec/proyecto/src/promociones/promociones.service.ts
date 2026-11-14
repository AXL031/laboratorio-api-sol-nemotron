import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { withTransaction } from '../db/pool.js';
import {
  insertarPromocion,
  obtenerPromocionPorId,
  bloquearPromocionParaActualizar,
  actualizarPromocion,
  eliminarLogicamente,
  existePromocionNoEliminada,
  listarPromocionesComerciales,
  listarPromocionesAdmin,
} from './promociones.repository.js';
import type {
  PromocionCreateInput,
  PromocionPatchInput,
  PromocionAdminOutput,
  PromocionResumenOutput,
} from '../common/validation.js';
import {
  validarReferenciasCatalogo,
  ErrorCode,
  ProblemError,
} from '../common/validation.js';
import * as fs from 'fs';
import * as path from 'path';

interface CatalogoProducto {
  productId: string;
  active: boolean;
}

interface CatalogoSku {
  sku: string;
  productId: string;
  active: boolean;
}

interface CatalogoData {
  products: CatalogoProducto[];
  skus: CatalogoSku[];
}

let catalogoCache: CatalogoData | null = null;

function cargarCatalogo(): CatalogoData {
  if (catalogoCache) return catalogoCache;
  const rutas = [
    path.join(process.cwd(), 'contrato', 'catalogo.json'),
    path.join(__dirname, '..', '..', 'contrato', 'catalogo.json'),
  ];
  let datos: CatalogoData;
  for (const ruta of rutas) {
    try {
      const contenido = fs.readFileSync(ruta, 'utf-8');
      datos = JSON.parse(contenido);
      catalogoCache = datos;
      return datos;
    } catch {
      // seguir probando
    }
  }
  throw new Error('No se pudo cargar contrato/catalogo.json');
}

function conjuntosCatalogo(catalogo: CatalogoData): {
  productosActivos: Set<string>;
  skusActivos: Set<string>;
} {
  const productosActivos = new Set<string>();
  for (const p of catalogo.products) {
    if (p.active) productosActivos.add(p.productId);
  }
  const skusActivos = new Set<string>();
  for (const s of catalogo.skus) {
    if (s.active) skusActivos.add(s.sku);
  }
  return { productosActivos, skusActivos };
}

function filaAdminARespuesta(
  fila: any,
  alcance: any[],
  politica: any,
): PromocionAdminOutput {
  const productIds: string[] = [];
  const skus: string[] = [];
  for (const a of alcance ?? []) {
    if (a.product_id) productIds.push(a.product_id);
    if (a.sku) skus.push(a.sku);
  }

  const puedeCambiarModalidad =
    fila.state === 'INACTIVO' &&
    fila.first_activated_at === null;

  return {
    promotionId: fila.id,
    nombre: fila.name,
    tipoDescuento: fila.discount_type as 'PORCENTAJE' | 'MONTO_FIJO',
    valor: Number(fila.discount_value),
    modalidad: fila.modality as 'AUTOMATICA' | 'CUPON',
    estado: fila.state as 'ACTIVO' | 'INACTIVO',
    validFrom: fila.valid_from.toISOString(),
    validUntil: fila.valid_until.toISOString(),
    alcance: {
      productIds: productIds.length > 0 ? productIds : undefined,
      skus: skus.length > 0 ? skus : undefined,
    },
    prioridad: fila.priority,
    canalesHabilitados: (fila.enabled_channels ?? []) as ('MARKETPLACE' | 'CHATBOT' | 'RETAIL' | 'VENTAS')[],
    politicaCombinacion: {
      ofertaPricing: !!politica?.oferta_pricing,
      promocionAutomatica: !!politica?.promocion_automatica,
      cupon: !!politica?.cupon,
    },
    puedeCambiarModalidad,
  };
}

function filaResumen(fila: any): PromocionResumenOutput {
  return {
    promotion_id: fila.id,
    name: fila.name,
    status: fila.state === 'ACTIVO' ? 'ACTIVA' : 'INACTIVA',
    valid_from: fila.valid_from.toISOString(),
    valid_until: fila.valid_until.toISOString(),
    channels: (fila.enabled_channels ?? []) as ('MARKETPLACE' | 'CHATBOT' | 'RETAIL' | 'VENTAS')[],
  };
}

/**
 * Servicio de negocio de Promociones.
 * Implementa las 7 operaciones con PostgreSQL real y reglas del contrato.
 */
@Injectable()
export class PromocionesService {
  /**
   * O01: Crear una promoción (ADMIN).
   * Genera UUID nuevo, registra first_activated_at si estado es ACTIVO.
   */
  async crearPromocion(input: PromocionCreateInput): Promise<PromocionAdminOutput> {
    const catalogo = cargarCatalogo();
    const { productosActivos, skusActivos } = conjuntosCatalogo(catalogo);
    validarReferenciasCatalogo(input.alcance, productosActivos, skusActivos);

    const id = crypto.randomUUID();
    const now = new Date();
    const firstActivatedAt = input.estado === 'ACTIVO' ? now : null;
    const puedeCambiarModalidad = input.estado === 'INACTIVO';

    return withTransaction(async (client) => {
      const fila = await insertarPromocion(client, {
        id,
        nombre: input.nombre,
        tipoDescuento: input.tipoDescuento,
        valor: input.valor,
        modalidad: input.modalidad,
        estado: input.estado,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        prioridad: input.prioridad,
        canales: input.canalesHabilitados,
        firstActivatedAt,
        alcance: input.alcance,
        politica: input.politicaCombinacion,
      });

      // Construir respuesta directamente desde los datos insertados (evita re-consulta fuera de la transacción)
      return {
        promotionId: fila.id,
        nombre: fila.name,
        tipoDescuento: fila.discount_type as 'PORCENTAJE' | 'MONTO_FIJO',
        valor: Number(fila.discount_value),
        modalidad: fila.modality as 'AUTOMATICA' | 'CUPON',
        estado: fila.state as 'ACTIVO' | 'INACTIVO',
        validFrom: fila.valid_from.toISOString(),
        validUntil: fila.valid_until.toISOString(),
        alcance: {
          productIds: input.alcance.productIds,
          skus: input.alcance.skus,
        },
        prioridad: fila.priority,
        canalesHabilitados: (fila.enabled_channels ?? []) as ('MARKETPLACE' | 'CHATBOT' | 'RETAIL' | 'VENTAS')[],
        politicaCombinacion: {
          ofertaPricing: input.politicaCombinacion.ofertaPricing,
          promocionAutomatica: input.politicaCombinacion.promocionAutomatica,
          cupon: input.politicaCombinacion.cupon,
        },
        puedeCambiarModalidad,
      };
    });
  }

  /**
   * O02: Crear promociones por lote (ADMIN).
   * 1-20 elementos, todos o ninguno en una transacción real, orden preservado.
   */
  async crearPromocionesLote(
    items: PromocionCreateInput[],
  ): Promise<PromocionAdminOutput[]> {
    const catalogo = cargarCatalogo();
    const { productosActivos, skusActivos } = conjuntosCatalogo(catalogo);

    // Validar referencias de catálogo para todos los items antes de la transacción
    for (const item of items) {
      validarReferenciasCatalogo(item.alcance, productosActivos, skusActivos);
    }

    return withTransaction(async (client) => {
      const resultados: PromocionAdminOutput[] = [];
      for (const input of items) {
        const id = crypto.randomUUID();
        const now = new Date();
        const firstActivatedAt = input.estado === 'ACTIVO' ? now : null;
        const puedeCambiarModalidad = input.estado === 'INACTIVO';

        const fila = await insertarPromocion(client, {
          id,
          nombre: input.nombre,
          tipoDescuento: input.tipoDescuento,
          valor: input.valor,
          modalidad: input.modalidad,
          estado: input.estado,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          prioridad: input.prioridad,
          canales: input.canalesHabilitados,
          firstActivatedAt,
          alcance: input.alcance,
          politica: input.politicaCombinacion,
        });

        resultados.push({
          promotionId: fila.id,
          nombre: fila.name,
          tipoDescuento: fila.discount_type as 'PORCENTAJE' | 'MONTO_FIJO',
          valor: Number(fila.discount_value),
          modalidad: fila.modality as 'AUTOMATICA' | 'CUPON',
          estado: fila.state as 'ACTIVO' | 'INACTIVO',
          validFrom: fila.valid_from.toISOString(),
          validUntil: fila.valid_until.toISOString(),
          alcance: {
            productIds: input.alcance.productIds,
            skus: input.alcance.skus,
          },
          prioridad: fila.priority,
          canalesHabilitados: (fila.enabled_channels ?? []) as ('MARKETPLACE' | 'CHATBOT' | 'RETAIL' | 'VENTAS')[],
          politicaCombinacion: {
            ofertaPricing: input.politicaCombinacion.ofertaPricing,
            promocionAutomatica: input.politicaCombinacion.promocionAutomatica,
            cupon: input.politicaCombinacion.cupon,
          },
          puedeCambiarModalidad,
        });
      }
      return resultados;
    });
  }

  /**
   * O03: PATCH modificar parcialmente (ADMIN).
   * Fusiona con lo persistido, valida la entidad completa.
   * Usa SELECT FOR UPDATE para serializar cambios de modalidad.
   * puedeCambiarModalidad solo true si INACTIVO y nunca activada.
   * Cambio real de modalidad bloqueado: 409 MODALIDAD_BLOQUEADA.
   */
  async actualizarPromocion(
    promocionId: string,
    patch: PromocionPatchInput,
  ): Promise<PromocionAdminOutput> {
    return withTransaction(async (client) => {
      // Bloquear fila para evitar carreras de estado/modalidad (R08)
      const existente = await bloquearPromocionParaActualizar(promocionId);
      if (!existente) {
        throw new ProblemError(
          404,
          ErrorCode.PROMOCION_NO_ENCONTRADA,
          'Promoción no encontrada',
          'La promoción no existe o ha sido eliminada lógicamente',
        );
      }

      // Construir entidad fusionada a partir de lo persistido
      const fusionada: PromocionCreateInput = {
        nombre: patch.nombre ?? existente.name,
        tipoDescuento: (patch.tipoDescuento ?? existente.discount_type) as 'PORCENTAJE' | 'MONTO_FIJO',
        valor: patch.valor !== undefined ? patch.valor : Number(existente.discount_value),
        modalidad: (patch.modalidad ?? existente.modality) as 'AUTOMATICA' | 'CUPON',
        estado: (patch.estado ?? existente.state) as 'ACTIVO' | 'INACTIVO',
        validFrom: patch.validFrom ?? existente.valid_from.toISOString(),
        validUntil: patch.validUntil ?? existente.valid_until.toISOString(),
        prioridad: patch.prioridad ?? existente.priority,
        canalesHabilitados: (patch.canalesHabilitados ?? (existente.enabled_channels ?? [])) as ('MARKETPLACE' | 'CHATBOT' | 'RETAIL' | 'VENTAS')[],
        politicaCombinacion: patch.politicaCombinacion ?? {
          ofertaPricing: false,
          promocionAutomatica: false,
          cupon: false,
        },
        alcance: { productIds: undefined, skus: undefined },
      };

      // Rellenar alcance desde la fila persistente si no se envía en el PATCH
      if (!patch.alcance) {
        const alcanceRes = await client.query(
          'SELECT product_id, sku FROM promocion_alcance WHERE promocion_id = $1',
          [promocionId],
        );
        const productIds: string[] = [];
        const skus: string[] = [];
        for (const a of alcanceRes.rows) {
          if (a.product_id) productIds.push(a.product_id);
          if (a.sku) skus.push(a.sku);
        }
        fusionada.alcance = {
          productIds: productIds.length > 0 ? productIds : undefined,
          skus: skus.length > 0 ? skus : undefined,
        };
      } else {
        fusionada.alcance = patch.alcance;
      }

      // Política: si no se envía, leer de BD
      if (!patch.politicaCombinacion) {
        const politicaRes = await client.query(
          'SELECT oferta_pricing, promocion_automatica, cupon FROM promocion_politica_combinacion WHERE promocion_id = $1',
          [promocionId],
        );
        const pol = politicaRes.rows[0];
        if (pol) {
          fusionada.politicaCombinacion = {
            ofertaPricing: pol.oferta_pricing,
            promocionAutomatica: pol.promocion_automatica,
            cupon: pol.cupon,
          };
        }
      }

      // Validar la entidad fusionada completa (R07)
      const catalogo = cargarCatalogo();
      const { productosActivos, skusActivos } = conjuntosCatalogo(catalogo);
      validarReferenciasCatalogo(fusionada.alcance, productosActivos, skusActivos);

      if (fusionada.tipoDescuento === 'PORCENTAJE' && fusionada.valor > 100) {
        throw new ProblemError(
          422,
          ErrorCode.VALIDACION,
          'valor no puede exceder 100 para tipoDescuento PORCENTAJE en la entidad fusionada',
        );
      }
      if (new Date(fusionada.validFrom).getTime() >= new Date(fusionada.validUntil).getTime()) {
        throw new ProblemError(
          422,
          ErrorCode.VALIDACION,
          'validFrom debe ser anterior a validUntil en la entidad fusionada',
        );
      }

      // R08: puedeCambiarModalidad solo si INACTIVO y nunca activada
      // Cambio real de modalidad incumpliendo esto -> 409
      const cambiaModalidad =
        patch.modalidad !== undefined && patch.modalidad !== existente.modality;

      if (cambiaModalidad) {
        const yaActivada = existente.first_activated_at !== null;
        const estaActivo = existente.state === 'ACTIVO';
        // R09: no hay cupones ni usos históricos en este entorno
        const sinCuponesNiUsos = true;

        if (estaActivo || yaActivada || !sinCuponesNiUsos) {
          throw new ProblemError(
            409,
            ErrorCode.MODALIDAD_BLOQUEADA,
            'No se puede cambiar la modalidad',
            'La promoción está ACTIVA o ya fue activada previamente; la modalidad solo puede cambiarse si está INACTIVO y nunca se activó',
          );
        }
      }

      // Si se pasa a ACTIVO y no tenía first_activated_at, registrarlo una sola vez (R08)
      let firstActivatedAt = existente.first_activated_at;
      if (fusionada.estado === 'ACTIVO' && !existente.first_activated_at) {
        firstActivatedAt = new Date();
      }

      // Actualizar fila principal
      const filaActualizada = await actualizarPromocion(client, promocionId, {
        nombre: patch.nombre !== undefined ? fusionada.nombre : undefined,
        tipoDescuento: patch.tipoDescuento !== undefined ? fusionada.tipoDescuento : undefined,
        valor: patch.valor !== undefined ? fusionada.valor : undefined,
        modalidad: patch.modalidad !== undefined ? fusionada.modalidad : undefined,
        estado: patch.estado !== undefined ? fusionada.estado : undefined,
        validFrom: patch.validFrom !== undefined ? fusionada.validFrom : undefined,
        validUntil: patch.validUntil !== undefined ? fusionada.validUntil : undefined,
        prioridad: patch.prioridad !== undefined ? fusionada.prioridad : undefined,
        canales: patch.canalesHabilitados !== undefined ? fusionada.canalesHabilitados : undefined,
        alcance: patch.alcance !== undefined ? fusionada.alcance : undefined,
        politica: patch.politicaCombinacion !== undefined ? fusionada.politicaCombinacion : undefined,
      });

      // Si se activó por primera vez, actualizar first_activated_at
      if (fusionada.estado === 'ACTIVO' && !existente.first_activated_at) {
        await client.query(
          'UPDATE promociones SET first_activated_at = $1 WHERE id = $2',
          [firstActivatedAt, promocionId],
        );
        filaActualizada.first_activated_at = firstActivatedAt;
      }

      // Consultar alcance y política dentro de la misma transacción para ver datos confirmados
      const alcanceRes = await client.query(
        'SELECT product_id, sku FROM promocion_alcance WHERE promocion_id = $1',
        [promocionId],
      );
      const politicaRes = await client.query(
        'SELECT oferta_pricing, promocion_automatica, cupon FROM promocion_politica_combinacion WHERE promocion_id = $1',
        [promocionId],
      );
      const alcanceRows: any[] = alcanceRes.rows;
      const politicaRow: any = politicaRes.rows[0];

      const productIds: string[] = [];
      const skus: string[] = [];
      for (const a of alcanceRows) {
        if (a.product_id) productIds.push(a.product_id);
        if (a.sku) skus.push(a.sku);
      }

      const puedeCambiarModalidad =
        filaActualizada.state === 'INACTIVO' &&
        (filaActualizada.first_activated_at ?? null) === null;

      return {
        promotionId: filaActualizada.id,
        nombre: filaActualizada.name,
        tipoDescuento: filaActualizada.discount_type as 'PORCENTAJE' | 'MONTO_FIJO',
        valor: Number(filaActualizada.discount_value),
        modalidad: filaActualizada.modality as 'AUTOMATICA' | 'CUPON',
        estado: filaActualizada.state as 'ACTIVO' | 'INACTIVO',
        validFrom: filaActualizada.valid_from.toISOString(),
        validUntil: filaActualizada.valid_until.toISOString(),
        alcance: {
          productIds: productIds.length > 0 ? productIds : undefined,
          skus: skus.length > 0 ? skus : undefined,
        },
        prioridad: filaActualizada.priority,
        canalesHabilitados: (filaActualizada.enabled_channels ?? []) as ('MARKETPLACE' | 'CHATBOT' | 'RETAIL' | 'VENTAS')[],
        politicaCombinacion: {
          ofertaPricing: !!politicaRow?.oferta_pricing,
          promocionAutomatica: !!politicaRow?.promocion_automatica,
          cupon: !!politicaRow?.cupon,
        },
        puedeCambiarModalidad,
      };
    });
  }

  /**
   * O04: Eliminación lógica (ADMIN).
   * Marca deleted_at, pasa a INACTIVO, conserva first_activated_at. 204 sin cuerpo.
   * Repetir o acceder después da 404.
   */
  async eliminarPromocion(promocionId: string): Promise<void> {
    const existe = await existePromocionNoEliminada(promocionId);
    if (!existe) {
      throw new ProblemError(
        404,
        ErrorCode.PROMOCION_NO_ENCONTRADA,
        'Promoción no encontrada',
        'La promoción no existe o ya fue eliminada lógicamente',
      );
    }

    const eliminado = await eliminarLogicamente(promocionId);
    if (!eliminado) {
      throw new ProblemError(
        404,
        ErrorCode.PROMOCION_NO_ENCONTRADA,
        'Promoción no encontrada',
        'La promoción ya fue eliminada lógicamente',
      );
    }
  }

  /**
   * O05: Consulta comercial (LECTOR_O_ADMIN).
   * Exige canal; filtra por canal y estado; vigentes=true por defecto (R02).
   * Devuelve PromocionResumen con snake_case.
   */
  async listarPromocionesComerciales({
    canal,
    vigentes,
    estado,
  }: {
    canal: string;
    vigentes: boolean;
    estado: 'ACTIVO' | 'INACTIVO';
  }): Promise<PromocionResumenOutput[]> {
    const filas = await listarPromocionesComerciales({ canal, vigentes, estado });
    return filas.map(filaResumen);
  }

  /**
   * O06: Consulta administrativa paginada (LECTOR_O_ADMIN).
   * Filtros exactos, conteo antes de paginar, orden estable created_at ASC, id ASC.
   */
  async listarPromocionesAdmin({
    pagina,
    tamanio,
    estado,
    modalidad,
  }: {
    pagina: number;
    tamanio: number;
    estado?: 'ACTIVO' | 'INACTIVO';
    modalidad?: 'AUTOMATICA' | 'CUPON';
  }): Promise<{
    items: PromocionAdminOutput[];
    total: number;
    totalPaginas: number;
  }> {
    const resultado = await listarPromocionesAdmin({ pagina, tamanio, estado, modalidad });
    const catalogo = cargarCatalogo();
    const itemsConDetalle: PromocionAdminOutput[] = [];

    for (const fila of resultado.items) {
      const detalle = await obtenerPromocionPorId(fila.id);
      if (detalle) {
        itemsConDetalle.push(filaAdminARespuesta(fila, detalle.alcance, detalle.politica));
      }
    }

    return {
      items: itemsConDetalle,
      total: resultado.total,
      totalPaginas: resultado.totalPaginas,
    };
  }

  /**
   * O07: Obtener detalle administrativo (LECTOR_O_ADMIN).
   * Devuelve PromocionAdmin con puedeCambiarModalidad calculado.
   */
  async obtenerPromocionAdmin(promocionId: string): Promise<PromocionAdminOutput> {
    const detalle = await obtenerPromocionPorId(promocionId);
    if (!detalle) {
      throw new ProblemError(
        404,
        ErrorCode.PROMOCION_NO_ENCONTRADA,
        'Promoción no encontrada',
        'La promoción no existe o ha sido eliminada lógicamente',
      );
    }
    return filaAdminARespuesta(detalle.promocion, detalle.alcance, detalle.politica);
  }
}
