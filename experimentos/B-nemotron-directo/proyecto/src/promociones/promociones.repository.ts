import { Pool } from 'pg';
import { ProblemException } from '../common/problem.exception.js';

export interface PromocionRow {
  id: string;
  name: string;
  discount_type: string;
  discount_value: string;
  modality: string;
  state: string;
  valid_from: Date;
  valid_until: Date;
  priority: number;
  enabled_channels: string[];
  first_activated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface PromocionAlcance {
  productIds: string[];
  skus: string[];
}

export interface PromocionPolitica {
  ofertaPricing: boolean;
  promocionAutomatica: boolean;
  cupon: boolean;
}

export interface PromocionCompleta extends PromocionRow {
  alcance: PromocionAlcance;
  politicaCombinacion: PromocionPolitica;
}

export interface PromocionResumenRow {
  promotion_id: string;
  name: string;
  status: string;
  valid_from: Date;
  valid_until: Date;
  channels: string[];
}

export interface PaginaResult {
  items: PromocionCompleta[];
  total: number;
  pagina: number;
  tamanio: number;
  totalPaginas: number;
}

export interface PromocionCreateInput {
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

export class PromocionesRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async createPromocion(data: PromocionCreateInput): Promise<PromocionCompleta> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const {
        id, nombre, tipoDescuento, valor, modalidad, estado,
        validFrom, validUntil, prioridad, canalesHabilitados,
        politicaCombinacion, firstActivatedAt,
      } = data;

      await client.query(
        `INSERT INTO promociones (
          id, name, discount_type, discount_value, modality, state,
          valid_from, valid_until, priority, enabled_channels,
          first_activated_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        [
          id, nombre, tipoDescuento, valor, modalidad, estado,
          validFrom, validUntil, prioridad, canalesHabilitados,
          firstActivatedAt,
        ],
      );

      if (data.alcance.productIds && data.alcance.productIds.length > 0) {
        for (const pid of data.alcance.productIds) {
          await client.query(
            'INSERT INTO promocion_alcance_product_ids (promocion_id, product_id) VALUES ($1,$2)',
            [id, pid],
          );
        }
      }
      if (data.alcance.skus && data.alcance.skus.length > 0) {
        for (const sku of data.alcance.skus) {
          await client.query(
            'INSERT INTO promocion_alcance_skus (promocion_id, sku) VALUES ($1,$2)',
            [id, sku],
          );
        }
      }

      await client.query(
        `INSERT INTO promocion_politica_combinacion (
          promocion_id, oferta_pricing, promocion_automatica, cupon
        ) VALUES ($1,$2,$3,$4)`,
        [id, politicaCombinacion.ofertaPricing, politicaCombinacion.promocionAutomatica, politicaCombinacion.cupon],
      );

      await client.query('COMMIT');
      const result = await this.findByIdInClient(client, id);
      if (!result) {
        throw new Error('No se pudo leer la promoción recién creada');
      }
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async createPromocionesLote(items: PromocionCreateInput[]): Promise<PromocionCompleta[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const resultados: PromocionCompleta[] = [];

      for (const data of items) {
        const {
          id, nombre, tipoDescuento, valor, modalidad, estado,
          validFrom, validUntil, prioridad, canalesHabilitados,
          politicaCombinacion, firstActivatedAt,
        } = data;

        await client.query(
          `INSERT INTO promociones (
            id, name, discount_type, discount_value, modality, state,
            valid_from, valid_until, priority, enabled_channels,
            first_activated_at, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
          [
            id, nombre, tipoDescuento, valor, modalidad, estado,
            validFrom, validUntil, prioridad, canalesHabilitados,
            firstActivatedAt,
          ],
        );

        if (data.alcance.productIds && data.alcance.productIds.length > 0) {
          for (const pid of data.alcance.productIds) {
            await client.query(
              'INSERT INTO promocion_alcance_product_ids (promocion_id, product_id) VALUES ($1,$2)',
              [id, pid],
            );
          }
        }
        if (data.alcance.skus && data.alcance.skus.length > 0) {
          for (const sku of data.alcance.skus) {
            await client.query(
              'INSERT INTO promocion_alcance_skus (promocion_id, sku) VALUES ($1,$2)',
              [id, sku],
            );
          }
        }

        await client.query(
          `INSERT INTO promocion_politica_combinacion (
            promocion_id, oferta_pricing, promocion_automatica, cupon
          ) VALUES ($1,$2,$3,$4)`,
          [id, politicaCombinacion.ofertaPricing, politicaCombinacion.promocionAutomatica, politicaCombinacion.cupon],
        );

        const creado = await this.findByIdInClient(client, id);
        if (!creado) {
          throw new Error(`No se pudo leer la promoción ${id} recién creada`);
        }
        resultados.push(creado);
      }

      await client.query('COMMIT');
      return resultados;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<PromocionCompleta | null> {
    const client = await this.pool.connect();
    try {
      return this.findByIdInClient(client, id);
    } finally {
      client.release();
    }
  }

  private async findByIdInClient(client: any, id: string): Promise<PromocionCompleta | null> {
    const result = await client.query(
      `SELECT id, name, discount_type, discount_value, modality, state,
              valid_from, valid_until, priority, enabled_channels,
              first_activated_at, created_at, updated_at, deleted_at
       FROM promociones
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const alcance = await this.getAlcanceInClient(client, id);
    const politica = await this.getPoliticaInClient(client, id);

    return {
      ...row,
      alcance,
      politicaCombinacion: politica,
    };
  }

  async findDeletedById(id: string): Promise<{ deleted_at: Date | null } | null> {
    const result = await this.pool.query(
      `SELECT deleted_at FROM promociones WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return { deleted_at: result.rows[0].deleted_at };
  }

  private async getAlcanceInClient(client: any, promocionId: string): Promise<PromocionAlcance> {
    const prodResult = await client.query(
      'SELECT product_id FROM promocion_alcance_product_ids WHERE promocion_id = $1 ORDER BY product_id',
      [promocionId],
    );
    const skuResult = await client.query(
      'SELECT sku FROM promocion_alcance_skus WHERE promocion_id = $1 ORDER BY sku',
      [promocionId],
    );
    return {
      productIds: prodResult.rows.map((r: { product_id: string }) => r.product_id),
      skus: skuResult.rows.map((r: { sku: string }) => r.sku),
    };
  }

  private async getPoliticaInClient(client: any, promocionId: string): Promise<PromocionPolitica> {
    const result = await client.query(
      'SELECT oferta_pricing, promocion_automatica, cupon FROM promocion_politica_combinacion WHERE promocion_id = $1',
      [promocionId],
    );
    if (result.rows.length === 0) {
      return { ofertaPricing: false, promocionAutomatica: false, cupon: false };
    }
    const r = result.rows[0];
    return {
      ofertaPricing: r.oferta_pricing,
      promocionAutomatica: r.promocion_automatica,
      cupon: r.cupon,
    };
  }

  async listComercial(
    canal: string,
    vigentes: boolean,
    estado: 'ACTIVO' | 'INACTIVO',
  ): Promise<PromocionResumenRow[]> {
    const now = new Date();
    let query = `
      SELECT p.id AS promotion_id, p.name, p.state AS status,
             p.valid_from, p.valid_until, p.enabled_channels AS channels
      FROM promociones p
      WHERE p.deleted_at IS NULL
        AND $1 = ANY(p.enabled_channels)
        AND p.state = $2
    `;
    const params: unknown[] = [canal, estado];

    if (vigentes) {
      query += ` AND p.valid_from <= $3 AND p.valid_until > $3`;
      params.push(now);
    }

    query += ` ORDER BY p.created_at ASC, p.id ASC`;

    const result = await this.pool.query(query, params);
    return result.rows.map((r: any) => ({
      promotion_id: r.promotion_id,
      name: r.name,
      status: r.status === 'ACTIVO' ? 'ACTIVA' : 'INACTIVA',
      valid_from: r.valid_from,
      valid_until: r.valid_until,
      channels: r.channels || [],
    }));
  }

  async listAdmin(
    pagina: number,
    tamanio: number,
    estado?: 'ACTIVO' | 'INACTIVO',
    modalidad?: 'AUTOMATICA' | 'CUPON',
  ): Promise<PaginaResult> {
    let query = `
      SELECT p.id, p.name, p.discount_type, p.discount_value, p.modality, p.state,
             p.valid_from, p.valid_until, p.priority, p.enabled_channels,
             p.first_activated_at, p.created_at, p.updated_at, p.deleted_at
      FROM promociones p
      WHERE p.deleted_at IS NULL
    `;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (estado) {
      query += ` AND p.state = $${paramIdx++}`;
      params.push(estado);
    }
    if (modalidad) {
      query += ` AND p.modality = $${paramIdx++}`;
      params.push(modalidad);
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) AS sub`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(String(countResult.rows[0].count), 10);

    const offset = (pagina - 1) * tamanio;
    query += ` ORDER BY p.created_at ASC, p.id ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(tamanio, offset);

    const result = await this.pool.query(query, params);
    const totalPaginas = total === 0 ? 0 : Math.ceil(total / tamanio);

    const items: PromocionCompleta[] = [];
    for (const row of result.rows) {
      const alcance = await this.getAlcance(row.id);
      const politica = await this.getPolitica(row.id);
      items.push({
        ...row,
        alcance,
        politicaCombinacion: politica,
      });
    }

    return { items, total, pagina, tamanio, totalPaginas };
  }

  async updatePromocion(id: string, updates: {
    nombre?: string;
    tipoDescuento?: string;
    valor?: number;
    modalidad?: string;
    estado?: string;
    validFrom?: string;
    validUntil?: string;
    alcance?: { productIds?: string[]; skus?: string[] };
    prioridad?: number;
    canalesHabilitados?: string[];
    politicaCombinacion?: { ofertaPricing: boolean; promocionAutomatica: boolean; cupon: boolean };
    firstActivatedAt?: Date | null;
  }): Promise<PromocionCompleta | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await this.findByIdInClient(client, id);
      if (!existing) {
        throw new ProblemException(404, 'PROMOCION_NO_ENCONTRADA', 'Promoción no encontrada');
      }

      const setParts: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (updates.nombre !== undefined) {
        setParts.push(`name = $${paramIdx++}`);
        params.push(updates.nombre);
      }
      if (updates.tipoDescuento !== undefined) {
        setParts.push(`discount_type = $${paramIdx++}`);
        params.push(updates.tipoDescuento);
      }
      if (updates.valor !== undefined) {
        setParts.push(`discount_value = $${paramIdx++}`);
        params.push(updates.valor);
      }
      if (updates.modalidad !== undefined) {
        setParts.push(`modality = $${paramIdx++}`);
        params.push(updates.modalidad);
      }
      if (updates.estado !== undefined) {
        setParts.push(`state = $${paramIdx++}`);
        params.push(updates.estado);
      }
      if (updates.validFrom !== undefined) {
        setParts.push(`valid_from = $${paramIdx++}`);
        params.push(updates.validFrom);
      }
      if (updates.validUntil !== undefined) {
        setParts.push(`valid_until = $${paramIdx++}`);
        params.push(updates.validUntil);
      }
      if (updates.prioridad !== undefined) {
        setParts.push(`priority = $${paramIdx++}`);
        params.push(updates.prioridad);
      }
      if (updates.canalesHabilitados !== undefined) {
        setParts.push(`enabled_channels = $${paramIdx++}`);
        params.push(updates.canalesHabilitados);
      }
      if (updates.firstActivatedAt !== undefined) {
        setParts.push(`first_activated_at = $${paramIdx++}`);
        params.push(updates.firstActivatedAt);
      }

      setParts.push(`updated_at = NOW()`);

      if (setParts.length > 1) {
        const sql = `UPDATE promociones SET ${setParts.join(', ')} WHERE id = $${paramIdx++}`;
        params.push(id);
        await client.query(sql, params);
      }

      if (updates.alcance !== undefined) {
        await client.query(
          'DELETE FROM promocion_alcance_product_ids WHERE promocion_id = $1',
          [id],
        );
        await client.query(
          'DELETE FROM promocion_alcance_skus WHERE promocion_id = $1',
          [id],
        );
        if (updates.alcance.productIds && updates.alcance.productIds.length > 0) {
          for (const pid of updates.alcance.productIds) {
            await client.query(
              'INSERT INTO promocion_alcance_product_ids (promocion_id, product_id) VALUES ($1,$2)',
              [id, pid],
            );
          }
        }
        if (updates.alcance.skus && updates.alcance.skus.length > 0) {
          for (const sku of updates.alcance.skus) {
            await client.query(
              'INSERT INTO promocion_alcance_skus (promocion_id, sku) VALUES ($1,$2)',
              [id, sku],
            );
          }
        }
      }

      if (updates.politicaCombinacion !== undefined) {
        await client.query(
          `UPDATE promocion_politica_combinacion
           SET oferta_pricing = $2, promocion_automatica = $3, cupon = $4
           WHERE promocion_id = $1`,
          [id, updates.politicaCombinacion.ofertaPricing,
            updates.politicaCombinacion.promocionAutomatica,
            updates.politicaCombinacion.cupon],
        );
      }

      await client.query('COMMIT');
      return this.findByIdInClient(client, id);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE promociones
       SET state = 'INACTIVO', deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async getAlcance(promocionId: string): Promise<PromocionAlcance> {
    const client = await this.pool.connect();
    try {
      return this.getAlcanceInClient(client, promocionId);
    } finally {
      client.release();
    }
  }

  private async getPolitica(promocionId: string): Promise<PromocionPolitica> {
    const client = await this.pool.connect();
    try {
      return this.getPoliticaInClient(client, promocionId);
    } finally {
      client.release();
    }
  }
}