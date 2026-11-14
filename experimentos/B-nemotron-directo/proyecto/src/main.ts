import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ProblemExceptionFilter } from './common/problem-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ProblemExceptionFilter());

  const port = Number(process.env.PORT) || 3303;
  await app.listen(port, '127.0.0.1');
  console.log(`API Promociones escuchando en http://127.0.0.1:${port}/api/v1`);
}

bootstrap().catch((error) => {
  console.error('Error al iniciar la aplicación:', error);
  process.exit(1);
});