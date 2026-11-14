import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { Database } from './database.js';
import { assertModalityChange, mergePromotion, toAdmin, toSummary, type AdminQuery, type CommercialQuery, type Promotion, type StoredPromotion } from './domain.js';
import { missing } from './problem.js';

const select = `SELECT p.*, c.alcance, c.politica FROM promociones p
  JOIN promocion_configuracion c ON c.promotion_id = p.id`;
export function fromRow(row: QueryResultRow): StoredPromotion {
  return {
    promotionId: row.id,
    firstActivatedAt: row.first_activated_at,
    data: {
      nombre: row.name, tipoDescuento: row.discount_type, valor: Number(row.discount_value),
      modalidad: row.modality, estado: row.state,
      validFrom: row.valid_from.toISOString(), validUntil: row.valid_until.toISOString(),
      prioridad: Number(row.priority), canalesHabilitados: row.enabled_channels,
      alcance: row.alcance, politicaCombinacion: row.politica,
    },
  };
}
export class PromotionsRepository {
  constructor(private readonly db: Database) {}
  private async find(client: PoolClient, id: string, lock = false) {
    if (lock) {
      const locked = await client.query('SELECT p.id FROM promociones p WHERE p.id=$1 AND p.deleted_at IS NULL FOR UPDATE OF p', [id]);
      if (!locked.rows.length) missing();
    }
    // Leer los asociados en una nueva sentencia DESPUÉS de adquirir el bloqueo.
    // Un JOIN bajo el snapshot anterior a la espera puede devolver configuración antigua.
    const result = await client.query(`${select} WHERE p.id = $1 AND p.deleted_at IS NULL`, [id]);
    if (!result.rows.length) missing();
    return fromRow(result.rows[0]);
  }
  private values(p: Promotion) {
    return [p.nombre, p.tipoDescuento, p.valor, p.modalidad, p.estado, p.validFrom, p.validUntil, p.prioridad, p.canalesHabilitados];
  }
  private async insert(client: PoolClient, promotion: Promotion) {
    const id = randomUUID();
    await client.query(`INSERT INTO promociones (id,name,discount_type,discount_value,modality,state,valid_from,valid_until,priority,enabled_channels)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, ...this.values(promotion)]);
    await client.query('INSERT INTO promocion_configuracion(promotion_id,alcance,politica) VALUES ($1,$2,$3)', [id, JSON.stringify(promotion.alcance), JSON.stringify(promotion.politicaCombinacion)]);
    return toAdmin(await this.find(client, id));
  }
  async create(promotion: Promotion) {
    return this.db.transaction(client => this.insert(client, promotion));
  }
  async createBatch(promotions: Promotion[]) {
    return this.db.transaction(async client => {
      const items = [];
      for (const promotion of promotions) items.push(await this.insert(client, promotion));
      return { items };
    });
  }
  async get(id: string) {
    return this.db.transaction(async client => toAdmin(await this.find(client, id)));
  }
  async patch(id: string, patch: unknown) {
    return this.db.transaction(async client => {
      // Leer, fusionar y guardar bajo el mismo bloqueo; DELETE obtiene el mismo bloqueo.
      const current = await this.find(client, id, true);
      const merged = mergePromotion(current.data, patch);
      assertModalityChange(current, merged);
      await client.query(`UPDATE promociones SET name=$2,discount_type=$3,discount_value=$4,modality=$5,state=$6,
        valid_from=$7,valid_until=$8,priority=$9,enabled_channels=$10 WHERE id=$1`, [id, ...this.values(merged)]);
      await client.query('UPDATE promocion_configuracion SET alcance=$2,politica=$3 WHERE promotion_id=$1', [id, JSON.stringify(merged.alcance), JSON.stringify(merged.politicaCombinacion)]);
      return toAdmin(await this.find(client, id));
    });
  }
  async remove(id: string) {
    await this.db.transaction(async client => {
      await this.find(client, id, true);
      await client.query("UPDATE promociones SET state='INACTIVO',deleted_at=clock_timestamp() WHERE id=$1", [id]);
    });
  }
  async listAdmin(query: AdminQuery) {
    // El conteo y la página comparten snapshot, incluso con altas concurrentes.
    return this.db.transaction(async client => {
      const params: unknown[] = [];
      const conditions = ['p.deleted_at IS NULL'];
      for (const [key, column] of [['estado', 'state'], ['modalidad', 'modality']] as const) {
        if (query[key]) { params.push(query[key]); conditions.push(`p.${column} = $${params.length}`); }
      }
      const where = `WHERE ${conditions.join(' AND ')}`;
      const count = await client.query(`SELECT count(*) AS total FROM promociones p ${where}`, params);
      const total = Number(count.rows[0].total);
      const result = await client.query(`${select} ${where} ORDER BY p.created_at ASC, p.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, query.tamanio, (query.pagina - 1) * query.tamanio]);
      return { items: result.rows.map(row => toAdmin(fromRow(row))), meta: { pagina: query.pagina, tamanio: query.tamanio, total, totalPaginas: Math.ceil(total / query.tamanio) } };
    }, true);
  }
  async listCommercial(query: CommercialQuery) {
    const result = await this.db.pool.query(`${select} WHERE p.deleted_at IS NULL AND $1 = ANY(p.enabled_channels) AND p.state=$2
      ${query.vigentes ? 'AND p.valid_from <= CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP < p.valid_until' : ''}
      ORDER BY p.created_at ASC, p.id ASC`, [query.canal, query.estado]);
    return { items: result.rows.map(row => toSummary(fromRow(row))) };
  }
}
