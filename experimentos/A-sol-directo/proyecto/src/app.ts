import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express, { type Request, type Response, type NextFunction } from 'express';
import { Database } from './database.js';
import { Problem, ProblemFilter, sendProblem } from './problem.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({ controllers: [PromotionsController], providers: [Database, PromotionsService] })
export class AppModule {}

export async function createApp() {
  const admin = process.env.LAB_ADMIN_TOKEN, reader = process.env.LAB_READER_TOKEN;
  if (!admin || !reader || admin === reader) throw new Error('Se requieren dos tokens de laboratorio distintos');
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    const isAdmin = token === `Bearer ${admin}`, isReader = token === `Bearer ${reader}`;
    if (!isAdmin && !isReader) return sendProblem(res, new Problem(401, 'NO_AUTENTICADO', 'Autenticación requerida'));
    if (!isAdmin && req.method !== 'GET') return sendProblem(res, new Problem(403, 'NO_AUTORIZADO', 'Operación no autorizada'));
    next();
  });
  app.use(express.json({ strict: false, limit: '1mb' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Parser situado después de autenticación: incluso un JSON roto requiere autorización primero.
    if (error) sendProblem(res, new Problem(400, 'VALIDACION', 'JSON inválido'));
  });
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  await app.init();
  return app;
}
