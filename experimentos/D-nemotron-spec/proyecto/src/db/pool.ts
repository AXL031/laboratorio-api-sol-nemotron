import { Pool, type PoolClient } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en el entorno');
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Máximo de conexiones para evitar agotamiento en pruebas locales
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

/**
 * Ejecuta una función dentro de una transacción real de PostgreSQL.
 * Garantiza rollback ante error y liberación del cliente aunque falle.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackErr) => {
      console.error('Error haciendo rollback:', rollbackErr);
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: unknown[]): Promise<unknown> {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
