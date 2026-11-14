import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import type { OnModuleDestroy } from '@nestjs/common';

export function assertLocalDatabase(connectionString: string, test = false) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== '55435' || url.pathname !== (test ? '/lab_promociones_test' : '/lab_promociones')) {
    throw new Error('Se requiere la base PostgreSQL local exclusiva de este laboratorio');
  }
}
export class Database implements OnModuleDestroy {
  readonly pool: Pool;
  constructor(connectionString: string, test = false) {
    assertLocalDatabase(connectionString, test);
    this.pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
    this.pool.on('error', () => { console.error('Error en conexión PostgreSQL inactiva'); });
  }
  async onModuleDestroy() { await this.pool.end(); }
  async transaction<T>(work: (client: PoolClient) => Promise<T>, repeatableRead = false): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(repeatableRead ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
export async function migrate(database: Database) {
  const sql = await readFile(new URL('../sql/001_promociones.sql', import.meta.url), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  return database.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(6101001)');
    await client.query('CREATE TABLE IF NOT EXISTS lab_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
    const applied = await client.query('SELECT checksum FROM lab_schema_migrations WHERE name = $1', ['001_promociones.sql']);
    if (applied.rows.length) {
      if (applied.rows[0].checksum !== checksum) throw new Error('La migración aplicada difiere del SQL; no se modifica una migración ya aplicada');
      return 'ya aplicada';
    }
    await client.query(sql);
    await client.query('INSERT INTO lab_schema_migrations(name, checksum) VALUES ($1,$2)', ['001_promociones.sql', checksum]);
    return 'aplicada';
  });
}
