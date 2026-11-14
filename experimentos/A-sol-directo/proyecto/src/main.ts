import { createApp } from './app.js';

try {
  const app = await createApp();
  await app.listen(Number(process.env.PORT ?? 3301), '127.0.0.1');
  console.log(`API académico escuchando en http://127.0.0.1:${process.env.PORT ?? 3301}/api/v1`);
} catch {
  console.error('No se pudo iniciar el API. Revise el entorno local y aplique sql/001-promociones.sql.');
  process.exitCode = 1;
}
