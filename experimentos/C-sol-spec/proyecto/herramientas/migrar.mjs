import { Database, migrate } from '../dist/database.js';

const test = process.argv.includes('--test');
const database = new Database((test ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL) ?? '', test);
try {
  const estado = await migrate(database);
  console.log(JSON.stringify({ migracion: '001_promociones.sql', base: test ? 'lab_promociones_test' : 'lab_promociones', estado }));
} catch {
  console.error('No se pudo aplicar la migración local; comprobar conexión y checksum de SQL');
  process.exitCode = 1;
} finally { await database.onModuleDestroy(); }
