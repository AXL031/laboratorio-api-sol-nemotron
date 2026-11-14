import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { Database } from './database.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsRepository } from './promotions.repository.js';
import { Problem, ProblemFilter, sendProblem } from './problem.js';

export interface AppConfig { databaseUrl: string; adminToken: string; readerToken: string; test?: boolean }
function sameToken(given: string, expected: string) {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function authentication(adminToken: string, readerToken: string): RequestHandler {
  return (request, response, next) => {
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer ([^\s]+)$/i.exec(header) : null;
    const token = match?.[1] ?? '';
    const admin = sameToken(token, adminToken);
    const reader = sameToken(token, readerToken);
    if (!admin && !reader) return sendProblem(response, new Problem(401, 'NO_AUTENTICADO', 'Autenticación requerida'));
    if (!admin && request.method !== 'GET') return sendProblem(response, new Problem(403, 'NO_AUTORIZADO', 'Operación no autorizada'));
    next();
  };
}

export async function createApplication(config: AppConfig) {
  if (!config.adminToken || !config.readerToken || config.adminToken === config.readerToken || /\s/.test(config.adminToken + config.readerToken)) {
    throw new Error('Configurar dos tokens locales distintos y sin espacios');
  }
  const database = new Database(config.databaseUrl, config.test);
  @Module({
    controllers: [PromotionsController],
    providers: [
      { provide: Database, useValue: database },
      { provide: PromotionsRepository, useFactory: (db: Database) => new PromotionsRepository(db), inject: [Database] },
    ],
  })
  class AppModule {}
  try {
    // bodyParser:false evita que Nest/Express analice JSON antes de autenticar.
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: false });
    app.setGlobalPrefix('api/v1');
    app.disable('x-powered-by');
    app.use(authentication(config.adminToken, config.readerToken));
    app.use(express.json({ strict: false, limit: '1mb' }));
    const parserError: ErrorRequestHandler = (_error, _request, response, _next) => {
      sendProblem(response, new Problem(400, 'VALIDACION', 'JSON inválido'));
    };
    app.use(parserError);
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
    return app;
  } catch (error) {
    await database.onModuleDestroy();
    throw error;
  }
}
