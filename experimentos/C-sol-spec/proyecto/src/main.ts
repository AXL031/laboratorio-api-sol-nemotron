import { createApplication } from './app.js';

async function main() {
  const port = Number(process.env.PORT ?? '3302');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
  const app = await createApplication({
    databaseUrl: process.env.DATABASE_URL ?? '',
    adminToken: process.env.LAB_ADMIN_TOKEN ?? '',
    readerToken: process.env.LAB_READER_TOKEN ?? '',
  });
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.log(`API académico escuchando en http://127.0.0.1:${port}/api/v1`);
}
main().catch(() => { console.error('No se pudo iniciar el API; revisar configuración y PostgreSQL local'); process.exitCode = 1; });
