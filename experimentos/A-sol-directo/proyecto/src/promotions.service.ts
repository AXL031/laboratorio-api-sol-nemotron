import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { Database } from './database.js';
import { missing, Problem } from './problem.js';
import { validateInput, validatePatch, type PromotionInput, type PromotionAdmin,
  type adminQuery, type commercialQuery } from './validation.js';

const SELECT = `SELECT p.*, c.scope, c.combination_policy FROM promotions p
  JOIN promotion_configuration c ON c.promotion_id=p.id`;
export function canChangeModality(row: { state: string; first_activated_at: Date | null }): boolean {
  // En este laboratorio no existen cupones ni usos (R09). Ambos antecedentes están ausentes.
  return row.state === 'INACTIVO' && row.first_activated_at === null;
}
function toAdmin(row: QueryResultRow): PromotionAdmin {
  return { promotionId: row.id, nombre: row.name, tipoDescuento: row.discount_type,
    valor: row.discount_value, modalidad: row.modality, estado: row.state,
    validFrom: row.valid_from.toISOString(), validUntil: row.valid_until.toISOString(),
    alcance: row.scope, prioridad: Number(row.priority), canalesHabilitados: row.enabled_channels,
    politicaCombinacion: row.combination_policy, puedeCambiarModalidad: canChangeModality(row as { state: string; first_activated_at: Date | null }) };
}
@Injectable()
export class PromotionsService {
  constructor(@Inject(Database) private readonly database: Database) {}
  private async insert(client: PoolClient, value: PromotionInput): Promise<PromotionAdmin> {
    const id = randomUUID();
    await client.query(`INSERT INTO promotions(id,name,discount_type,discount_value,modality,state,
      valid_from,valid_until,priority,enabled_channels,first_activated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $6='ACTIVO' THEN clock_timestamp() END)`,
    [id, value.nombre, value.tipoDescuento, value.valor, value.modalidad, value.estado,
      value.validFrom, value.validUntil, value.prioridad, value.canalesHabilitados]);
    await client.query(`INSERT INTO promotion_configuration(promotion_id,scope,combination_policy) VALUES($1,$2,$3)`,
      [id, JSON.stringify(value.alcance), JSON.stringify(value.politicaCombinacion)]);
    const result = await client.query(`${SELECT} WHERE p.id=$1`, [id]);
    return toAdmin(result.rows[0]);
  }
  create(value: PromotionInput) { return this.database.transaction(client => this.insert(client, value)); }
  batch(values: PromotionInput[]) {
    return this.database.transaction(async client => {
      const items: PromotionAdmin[] = [];
      for (const value of values) items.push(await this.insert(client, value));
      return { items };
    });
  }
  async get(id: string) {
    const result = await this.database.pool.query(`${SELECT} WHERE p.id=$1 AND p.deleted_at IS NULL`, [id]);
    if (!result.rows.length) missing();
    return toAdmin(result.rows[0]);
  }
  patch(id: string, body: unknown) {
    const patch = validatePatch(body);
    return this.database.transaction(async client => {
      const result = await client.query(`${SELECT} WHERE p.id=$1 AND p.deleted_at IS NULL FOR UPDATE OF p`, [id]);
      if (!result.rows.length) missing();
      const row = result.rows[0], current = toAdmin(row);
      const { promotionId: _id, puedeCambiarModalidad: _can, ...input } = current;
      const merged = validateInput({ ...input, ...patch });
      if (merged.modalidad !== current.modalidad && !canChangeModality(row as { state: string; first_activated_at: Date | null })) {
        throw new Problem(409, 'MODALIDAD_BLOQUEADA', 'No se puede cambiar la modalidad');
      }
      await client.query(`UPDATE promotions SET name=$2,discount_type=$3,discount_value=$4,modality=$5,state=$6,
        valid_from=$7,valid_until=$8,priority=$9,enabled_channels=$10,
        first_activated_at=CASE WHEN $6='ACTIVO' THEN COALESCE(first_activated_at,clock_timestamp()) ELSE first_activated_at END,
        updated_at=clock_timestamp() WHERE id=$1`, [id, merged.nombre, merged.tipoDescuento, merged.valor,
        merged.modalidad, merged.estado, merged.validFrom, merged.validUntil, merged.prioridad, merged.canalesHabilitados]);
      await client.query(`UPDATE promotion_configuration SET scope=$2,combination_policy=$3 WHERE promotion_id=$1`,
        [id, JSON.stringify(merged.alcance), JSON.stringify(merged.politicaCombinacion)]);
      const updated = await client.query(`${SELECT} WHERE p.id=$1`, [id]);
      return toAdmin(updated.rows[0]);
    });
  }
  async remove(id: string) {
    const result = await this.database.pool.query(`UPDATE promotions SET deleted_at=clock_timestamp(),state='INACTIVO',
      updated_at=clock_timestamp() WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [id]);
    if (!result.rowCount) missing();
  }
  async admin(q: ReturnType<typeof adminQuery>) {
    // Una sola sentencia: total e items comparten el mismo snapshot incluso con escrituras concurrentes.
    const result = await this.database.pool.query(`WITH filtered AS MATERIALIZED (
      ${SELECT} WHERE p.deleted_at IS NULL AND ($1::text IS NULL OR p.state=$1)
        AND ($2::text IS NULL OR p.modality=$2)
    ), page AS (SELECT * FROM filtered ORDER BY created_at ASC,id ASC LIMIT $3 OFFSET $4)
    SELECT (SELECT count(*)::integer FROM filtered) AS total,
      COALESCE((SELECT json_agg(page ORDER BY created_at ASC,id ASC) FROM page),'[]'::json) AS items`,
    [q.estado ?? null, q.modalidad ?? null, q.tamanio, (BigInt(q.pagina) - 1n) * BigInt(q.tamanio)]);
    const { total, items } = result.rows[0];
    return { items: (items as QueryResultRow[]).map(row => toAdmin({ ...row,
      valid_from: new Date(row.valid_from), valid_until: new Date(row.valid_until) })),
      meta: { pagina: q.pagina, tamanio: q.tamanio, total, totalPaginas: Math.ceil(total / q.tamanio) } };
  }
  async commercial(q: ReturnType<typeof commercialQuery>) {
    const result = await this.database.pool.query(`SELECT id,name,state,valid_from,valid_until,enabled_channels
      FROM promotions WHERE deleted_at IS NULL AND enabled_channels @> ARRAY[$1]::text[] AND state=$2
        AND (NOT $3::boolean OR (valid_from <= statement_timestamp() AND statement_timestamp() < valid_until))
      ORDER BY created_at ASC,id ASC`, [q.canal, q.estado, q.vigentes]);
    return { items: result.rows.map(row => ({ promotion_id: row.id, name: row.name,
      status: row.state === 'ACTIVO' ? 'ACTIVA' : 'INACTIVA', valid_from: row.valid_from.toISOString(),
      valid_until: row.valid_until.toISOString(), channels: row.enabled_channels })) };
  }
}
