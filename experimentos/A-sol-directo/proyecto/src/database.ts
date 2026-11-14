import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';

@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: Pool;
  constructor() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria');
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    // Evita una excepción de proceso si se corta una conexión ociosa. Las consultas activas propagan el error.
    this.pool.on('error', () => console.error('Se perdió una conexión ociosa a PostgreSQL local'));
  }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
