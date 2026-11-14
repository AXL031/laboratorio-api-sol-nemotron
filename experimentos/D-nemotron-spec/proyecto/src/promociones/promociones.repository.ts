import { PoolClient, type QueryResult } from 'pg';
import { pool, withTransaction } from '../db/pool.js';
import type {
  PromocionRow,
  PromocionAlcanceRow,
  PromocionPoliticaRow,
} from './entities/promocion.entity.js';
import { ErrorCode } from '../common/problem.js';

const CANALES_SQL = "ARRAY['MARKETPLACE','CHATBOT','RETAIL','VENTAS']::text[]";

/**
 * Valida que las referencias de alcance existan y estén activas en catalogo.json.
 * Este método se llama desde el servicio, que carga catalogo.json.
 */
export function validarReferenciasCatalogoEnDb(
  alcance: { productIds?: string[]; skus?: string[] },
  productosActivos: Set<string>,
  skusActivos: Set<string>,
): void {
  if (alcance.productIds) {
    for (const pid of alcance.productIds) {
      if (!productosActivos.has(pid)) {
        const err: any = new Error(`productId no encontrado o inactivo: ${pid}`);
        err.code = ErrorCode.VALIDACION;
        err.status = 422;
        throw err;
      }
    }
  }
  if (alcance.skus) {
    for (const sku of alcance.skus) {
      if (!skusActivos.has(sku)) {
        const err: any = new Error(`SKU no encontrado o inactivo: ${sku}`);
        err.code = ErrorCode.VALIDACION;
        err.status = 422;
        throw err;
      }
    }
  }
}

/**
 * Inserta una promoción completa (fila principal + alcance + política) en una transacción.
 * Retorna la fila insertada.
 */
export async function insertarPromocion(
  client: PoolClient,
  datos: {
    id: string;
    nombre: string;
    tipoDescuento: string;
    valor: number;
    modalidad: string;
    estado: string;
    validFrom: string;
    validUntil: string;
    prioridad: number;
    canales: string[];
    firstActivatedAt: Date | null;
    alcance: { productIds?: string[]; skus?: string[] };
    politica: { ofertaPricing: boolean; promocionAutomatica: boolean; cupon: boolean };
  },
): Promise<PromocionRow> {
  const {
    id, nombre, tipoDescuento, valor, modalidad, estado,
    validFrom, validUntil, prioridad, canales, firstActivatedAt,
    alcance, politica,
  } = datos;

  const insertPromo = `
    INSERT INTO promociones (
      id, name, discount_type, discount_value, modality, state,
      valid_from, valid_until, priority, enabled_channels,
      first_activated_at, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING id, name, discount_type, discount_value, modality, state,
      valid_from, valid_until, priority, enabled_channels,
      first_activated_at, created_at, updated_at, deleted_at
  `;

  const promoResult: QueryResult<PromocionRow> = await client.query(insertPromo, [
    id,
    nombre,
    tipoDescuento,
    valor,
    modalidad,
    estado,
    validFrom,
    validUntil,
    prioridad,
    canales,
    firstActivatedAt,
  ]);

  const promocion = promoResult.rows[0];

  // Insertar alcance
  if (alcance.productIds) {
    for (const pid of alcance.productIds) {
      await client.query(
        'INSERT INTO promocion_alcance (promocion_id, product_id, sku) VALUES ($1, $2, NULL)',
        [id, pid],
      );
    }
  }
  if (alcance.skus) {
    for (const sku of alcance.skus) {
      await client.query(
        'INSERT INTO promocion_alcance (promocion_id, product_id, sku) VALUES ($1, NULL, $2)',
        [id, sku],
      );
    }
  }

  // Insertar política
  await client.query(
    'INSERT INTO promocion_politica_combinacion (promocion_id, oferta_pricing, promocion_automatica, cupon) VALUES ($1, $2, $3, $4)',
    [id, politica.ofertaPricing, politica.promocionAutomatica, politica.cupon],
  );

  return promocion;
}

/**
 * Obtiene una promoción por ID con su alcance y política.
 * Retorna null si no existe o está eliminada (deleted_at no null).
 */
export async function obtenerPromocionPorId(
  id: string,
): Promise<{ promocion: PromocionRow; alcance: PromocionAlcanceRow[]; politica: PromocionPoliticaRow } | null> {
  const promoResult = await pool.query<PromocionRow>(
    `SELECT id, name, discount_type, discount_value, modality, state,
      valid_from, valid_until, priority, enabled_channels,
      first_activated_at, created_at, updated_at, deleted_at
     FROM promociones WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );

  if (promoResult.rows.length === 0) {
    return null;
  }

  const alcanceResult = await pool.query<PromocionAlcanceRow>(
    'SELECT promocion_id, product_id, sku FROM promocion_alcance WHERE promocion_id = $1',
    [id],
  );

  const politicaResult = await pool.query<PromocionPoliticaRow>(
    'SELECT promocion_id, oferta_pricing, promocion_automatica, cupon FROM promocion_politica_combinacion WHERE promocion_id = $1',
    [id],
  );

  return {
    promocion: promoResult.rows[0],
    alcance: alcanceResult.rows,
    politica: politicaResult.rows[0],
  };
}

/**
 * Bloquea una promoción para actualización (SELECT FOR UPDATE).
 * Retorna null si no existe, está eliminada, o no se pudo bloquear.
 */
export async function bloquearPromocionParaActualizar(id: string): Promise<PromocionRow | null> {
  const result = await pool.query<PromocionRow>(
    `SELECT id, name, discount_type, discount_value, modality, state,
      valid_from, valid_until, priority, enabled_channels,
      first_activated_at, created_at, updated_at, deleted_at
     FROM promociones WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [id],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

/**
 * Actualiza una promoción completa (fila principal + alcance + política) en una transacción.
 * Los campos enviados reemplazan completamente los objetos/listas; los omitidos se conservan.
 * first_activated_at se mantiene si ya existe.
 */
export async function actualizarPromocion(
  client: PoolClient,
  id: string,
  datos: {
    nombre?: string;
    tipoDescuento?: string;
    valor?: number;
    modalidad?: string;
    estado?: string;
    validFrom?: string;
    validUntil?: string;
    prioridad?: number;
    canales?: string[];
    alcance?: { productIds?: string[]; skus?: string[] };
    politica?: { ofertaPricing: boolean; promocionAutomatica: boolean; cupon: boolean };
  },
): Promise<PromocionRow> {
  // Construir SET dinámicamente para los campos enviados
  const sets: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  const campos: Record<string, unknown> = {};
  if (datos.nombre !== undefined) { campos.name = datos.nombre; }
  if (datos.tipoDescuento !== undefined) { campos.discount_type = datos.tipoDescuento; }
  if (datos.valor !== undefined) { campos.discount_value = datos.valor; }
  if (datos.modalidad !== undefined) { campos.modality = datos.modalidad; }
  if (datos.estado !== undefined) { campos.state = datos.estado; }
  if (datos.validFrom !== undefined) { campos.valid_from = datos.validFrom; }
  if (datos.validUntil !== undefined) { campos.valid_until = datos.validUntil; }
  if (datos.prioridad !== undefined) { campos.priority = datos.prioridad; }
  if (datos.canales !== undefined) { campos.enabled_channels = datos.canales; }

  for (const [col, val] of Object.entries(campos)) {
    sets.push(`${col} = $${paramIndex++}`);
    params.push(val);
  }

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const sql = `
    UPDATE promociones
    SET ${sets.join(', ')}
    WHERE id = $${paramIndex} AND deleted_at IS NULL
    RETURNING id, name, discount_type, discount_value, modality, state,
      valid_from, valid_until, priority, enabled_channels,
      first_activated_at, created_at, updated_at, deleted_at
  `;

  const result = await client.query<PromocionRow>(sql, params);
  if (result.rows.length === 0) {
    const err: any = new Error('Promoción no encontrada');
    err.code = ErrorCode.PROMOCION_NO_ENCONTRADA;
    err.status = 404;
    throw err;
  }

  const promocion = result.rows[0];

  // Reemplazar alcance si se envió
  if (datos.alcance !== undefined) {
    await client.query('DELETE FROM promocion_alcance WHERE promocion_id = $1', [id]);
    if (datos.alcance.productIds) {
      for (const pid of datos.alcance.productIds) {
        await client.query(
          'INSERT INTO promocion_alcance (promocion_id, product_id, sku) VALUES ($1, $2, NULL)',
          [id, pid],
        );
      }
    }
    if (datos.alcance.skus) {
      for (const sku of datos.alcance.skus) {
        await client.query(
          'INSERT INTO promocion_alcance (promocion_id, product_id, sku) VALUES ($1, NULL, $2)',
          [id, sku],
        );
      }
    }
  }

  // Reemplazar política si se envió
  if (datos.politica !== undefined) {
    await client.query(
      'UPDATE promocion_politica_combinacion SET oferta_pricing = $2, promocion_automatica = $3, cupon = $4 WHERE promocion_id = $1',
      [id, datos.politica.ofertaPricing, datos.politica.promocionAutomatica, datos.politica.cupon],
    );
  }

  return promocion;
}

/**
 * Eliminación lógica (R12): marca deleted_at y pasa a INACTIVO.
 * Conserva first_activated_at. Retorna false si ya estaba eliminada o no existe.
 */
export async function eliminarLogicamente(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE promociones
     SET state = 'INACTIVO', deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return result.rows.length > 0;
}

/**
 * Verifica si una promoción existe y no está eliminada.
 */
export async function existePromocionNoEliminada(id: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM promociones WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
  return result.rows.length > 0;
}

/**
 * Consulta comercial: filtra por canal, estado y vigencia.
 * Retorna filas para mapear a PromocionResumen.
 */
export async function listarPromocionesComerciales({
  canal,
  vigentes,
  estado,
}: {
  canal: string;
  vigentes: boolean;
  estado: 'ACTIVO' | 'INACTIVO';
}): Promise<PromocionRow[]> {
  const params: unknown[] = [canal, estado];
  let paramIndex = 3;

  let sql = `
    SELECT DISTINCT p.id, p.name, p.discount_type, p.discount_value, p.modality, p.state,
      p.valid_from, p.valid_until, p.priority, p.enabled_channels,
      p.first_activated_at, p.created_at, p.updated_at, p.deleted_at
    FROM promociones p
    WHERE p.deleted_at IS NULL
      AND p.state = $${paramIndex - 1}
      AND $${paramIndex - 2} = ANY(p.enabled_channels)
  `;

  if (vigentes) {
    const ahora = new Date().toISOString();
    sql += ` AND p.valid_from <= $${paramIndex} AND p.valid_until > $${paramIndex}`;
    params.push(ahora);
    paramIndex++;
  }

  sql += ' ORDER BY p.created_at ASC, p.id ASC';

  const result = await pool.query<PromocionRow>(sql, params);
  return result.rows;
}

/**
 * Consulta administrativa paginada (R13).
 * Filtros exactos de estado/modalidad, conteo antes de paginar, orden estable.
 */
export async function listarPromocionesAdmin({
  pagina,
  tamanio,
  estado,
  modalidad,
}: {
  pagina: number;
  tamanio: number;
  estado?: 'ACTIVO' | 'INACTIVO';
  modalidad?: 'AUTOMATICA' | 'CUPON';
}): Promise<{ items: PromocionRow[]; total: number; totalPaginas: number }> {
  const params: unknown[] = [];
  let paramIndex = 1;

  let sql = `
    FROM promociones p
    WHERE p.deleted_at IS NULL
  `;

  if (estado) {
    sql += ` AND p.state = $${paramIndex++}`;
    params.push(estado);
  }

  if (modalidad) {
    sql += ` AND p.modality = $${paramIndex++}`;
    params.push(modalidad);
  }

  // Conteo total antes de paginar
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count ${sql}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const totalPaginas = total === 0 ? 0 : Math.ceil(total / tamanio);

  // Consulta paginada con orden estable
  const offset = (pagina - 1) * tamanio;
  const sqlItems = `
    SELECT p.id, p.name, p.discount_type, p.discount_value, p.modality, p.state,
      p.valid_from, p.valid_until, p.priority, p.enabled_channels,
      p.first_activated_at, p.created_at, p.updated_at, p.deleted_at
    ${sql}
    ORDER BY p.created_at ASC, p.id ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const itemsResult = await pool.query<PromocionRow>(sqlItems, [...params, tamanio, offset]);
  return { items: itemsResult.rows, total, totalPaginas };
}
