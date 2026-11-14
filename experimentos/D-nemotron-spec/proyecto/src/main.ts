import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { authMiddleware } from './auth/auth.middleware.js';
import { ProblemExceptionFilter } from './common/problem-exception.filter.js';

/**
 * Punto de entrada del API NestJS.
 * Carga .env mediante `node --env-file=.env` (script start).
 * Prefijo de rutas: /api/v1.
 * AuthMiddleware registrado globalmente: autentica antes del procesamiento de rutas.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  // Prefijo global de rutas: /api/v1 (según el contrato OpenAPI)
  app.setGlobalPrefix('api/v1');

  // Filtros globales de excepciones (R16: ProblemError → application/problem+json)
  app.useGlobalFilters(new ProblemExceptionFilter());

  // Middleware de autenticación global (R15): autenticar antes de procesar rutas.
  // Se ejecuta para todas las solicitudes entrantes.
  app.use(authMiddleware);

  // Habilitar CORS opcional para pruebas locales (no requerido por el contrato)
  // app.enableCors();

  await app.listen(process.env.PORT ?? 3304);
  console.log(`API Promociones escuchando en http://127.0.0.1:${process.env.PORT ?? 3304}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar la aplicación:', err);
  process.exit(1);
});
