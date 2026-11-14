import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obligatoria; usar --env-file=.env o .env.test');
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  || !['/lab_promociones', '/lab_promociones_test'].includes(url.pathname)) {
  throw new Error('Migración restringida a las dos bases locales del laboratorio');
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await pool.query(await readFile(new URL('../sql/001-promociones.sql', import.meta.url), 'utf8'));
  const result = await pool.query(`SELECT current_database() AS base,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions') AS columnas,
    (SELECT count(*)::int FROM promotions) AS promociones`);
  console.log(JSON.stringify({ migracion: '001-promociones', resultado: result.rows[0] }, null, 2));
} finally { await pool.end(); }
