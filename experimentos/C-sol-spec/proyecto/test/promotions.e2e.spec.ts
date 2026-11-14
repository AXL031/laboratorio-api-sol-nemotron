import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApplication } from '../src/app.js';
import { Database, assertLocalDatabase, migrate } from '../src/database.js';
import { PromotionsRepository } from '../src/promotions.repository.js';
import { promotion } from './fixtures.js';
import { conforms } from './contract.js';

const base = '/api/v1/promociones';
const idPath = '/promociones/{promocionId}';
const admin = process.env.LAB_ADMIN_TOKEN ?? '';
const reader = process.env.LAB_READER_TOKEN ?? '';
let app: NestExpressApplication;
let database: Database;
const http = () => request(app.getHttpServer());
const auth = (req: request.Test, token = admin) => req.set('Authorization', `Bearer ${token}`);
async function create(overrides = {}) {
  const response = await auth(http().post(base)).send(promotion(overrides));
  expect(response.status).toBe(201);
  conforms('/promociones', 'post', response);
  return response.body;
}
async function counts() {
  const result = await database.pool.query('SELECT (SELECT count(*)::int FROM promociones) AS principal, (SELECT count(*)::int FROM promocion_configuracion) AS configuracion');
  return result.rows[0];
}
function problem(response: request.Response, status: number, code: string, path: string, method: string) {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({ status, code, title: expect.any(String) });
  expect(JSON.stringify(response.body)).not.toContain(admin);
  expect(JSON.stringify(response.body)).not.toContain(reader);
  conforms(path, method, response);
}

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL ?? '';
  assertLocalDatabase(url, true);
  const applicationUrl = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')).DATABASE_URL;
  if (process.env.LAB_ALLOW_E2E_RESET !== 'SI_SOLO_BASE_DE_PRUEBAS' || new URL(url).pathname === new URL(applicationUrl).pathname) throw new Error('Se prohíbe limpiar una base que no sea la e2e separada');
  database = new Database(url, true);
  await migrate(database);
  app = await createApplication({ databaseUrl: url, adminToken: admin, readerToken: reader, test: true });
});
beforeEach(async () => { await database.pool.query('TRUNCATE promociones CASCADE'); });
afterAll(async () => { if (app) await app.close(); if (database) await database.onModuleDestroy(); });

describe('R15–R16 autenticación previa y errores contractuales', () => {
  it('401 precede a JSON malformado e ID inválido; lector obtiene 403', async () => {
    for (const token of [undefined, 'incorrecto', reader]) {
      let req = http().patch(`${base}/uuid-invalido`).set('Content-Type', 'application/json');
      if (token) req = auth(req, token);
      const response = await req.send('{malformado');
      problem(response, token === reader ? 403 : 401, token === reader ? 'NO_AUTORIZADO' : 'NO_AUTENTICADO', idPath, 'patch');
    }
    const invalidBody = await auth(http().post(base)).set('Content-Type', 'application/json').send('{malformado');
    problem(invalidBody, 400, 'VALIDACION', '/promociones', 'post');
  });
  it.each(['post', 'patch', 'delete'] as const)('lector no puede %s', async method => {
    const path = method === 'post' ? base : `${base}/${randomUUID()}`;
    const response = await auth(http()[method](path), reader).send({});
    problem(response, 403, 'NO_AUTORIZADO', method === 'post' ? '/promociones' : idPath, method);
  });
  it('admin y lector acceden a las tres consultas', async () => {
    const p = await create();
    for (const token of [reader, admin]) {
      for (const [url, path] of [[`${base}?canal=MARKETPLACE`, '/promociones'], [`${base}/administracion`, '/promociones/administracion'], [`${base}/${p.promotionId}`, idPath]]) {
        const response = await auth(http().get(url), token);
        expect(response.status).toBe(200); conforms(path, 'get', response);
      }
    }
  });
  it.each(['get', 'patch', 'delete'] as const)('%s valida UUID y ausencia', async method => {
    for (const id of ['inválido', randomUUID()]) {
      let req = auth(http()[method](`${base}/${id}`));
      if (method === 'patch') req = req.send({ nombre: 'X' });
      const response = await req;
      problem(response, id === 'inválido' ? 400 : 404, id === 'inválido' ? 'VALIDACION' : 'PROMOCION_NO_ENCONTRADA', idPath, method);
    }
  });
  it.each(['null', '5', '[]', '"texto"'])('JSON válido %s es 422', async body => {
    problem(await auth(http().post(base)).set('Content-Type', 'application/json').send(body), 422, 'VALIDACION', '/promociones', 'post');
  });
});

describe('O01 / O02: altas, catálogo y transacción PostgreSQL', () => {
  it('crea nombres repetidos con UUID distintos, 14 columnas y datos asociados persistidos', async () => {
    const a = await create(); const b = await create();
    expect(a.promotionId).not.toBe(b.promotionId);
    expect(a.puedeCambiarModalidad).toBe(true);
    expect(a.alcance).toEqual(promotion().alcance);
    expect(await counts()).toEqual({ principal: 2, configuracion: 2 });
    const columns = await database.pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='promociones'");
    expect(columns.rows).toHaveLength(14);
  });
  it.each([
    { nombre: '  ' }, { valor: 0 }, { valor: 101 }, { valor: '5' }, { validFrom: '2025-02-30T00:00:00Z' },
    { validUntil: '2010-01-01T00:00:00Z' }, { validFrom: '2020-01-01T00:00:00' },
    { alcance: {} }, { alcance: { productIds: ['PRD-LAB-INACTIVO'] } }, { alcance: { skus: ['SKU-LAB-INACTIVO'] } },
    { alcance: { skus: ['NO-EXISTE'] } }, { alcance: { skus: ['SKU-LAB-001', 'SKU-LAB-001'] } },
    { canalesHabilitados: [] }, { canalesHabilitados: ['VENTAS', 'VENTAS'] }, { canalesHabilitados: ['WEB'] },
    { prioridad: 1.5 }, { politicaCombinacion: { cupon: true } }, { promotionId: randomUUID() }, { extra: 'x' },
  ])('rechaza entidad inválida sin filas parciales: %j', async overrides => {
    const response = await auth(http().post(base)).send({ ...promotion(), ...overrides });
    problem(response, 422, 'VALIDACION', '/promociones', 'post');
    expect(await counts()).toEqual({ principal: 0, configuracion: 0 });
  });
  it('lote de 20 mantiene orden y asociaciones', async () => {
    const items = Array.from({ length: 20 }, (_, i) => promotion({ nombre: `Lote ${i}` }));
    const response = await auth(http().post(`${base}/lote`)).send({ items });
    expect(response.status).toBe(201); conforms('/promociones/lote', 'post', response);
    expect(response.body.items.map((p: any) => p.nombre)).toEqual(items.map(p => p.nombre));
    expect(new Set(response.body.items.map((p: any) => p.promotionId)).size).toBe(20);
    expect(await counts()).toEqual({ principal: 20, configuracion: 20 });
  });
  it.each([0, 21])('rechaza lote de %s elementos', async length => {
    problem(await auth(http().post(`${base}/lote`)).send({ items: Array.from({ length }, () => promotion()) }), 422, 'VALIDACION', '/promociones/lote', 'post');
  });
  it('segundo elemento inválido revierte/no inserta ninguno por HTTP', async () => {
    const response = await auth(http().post(`${base}/lote`)).send({ items: [promotion(), promotion({ valor: 101 })] });
    problem(response, 422, 'VALIDACION', '/promociones/lote', 'post');
    expect(await counts()).toEqual({ principal: 0, configuracion: 0 });
  });
  it('fallo SQL real en la segunda asociación revierte también la primera alta', async () => {
    // Se salta deliberadamente la validación HTTP para demostrar rollback del driver.
    const repository = new PromotionsRepository(database);
    await expect(repository.createBatch([promotion(), promotion({ alcance: { skus: ['INEXISTENTE'] } })])).rejects.toMatchObject({ code: '23514' });
    expect(await counts()).toEqual({ principal: 0, configuracion: 0 });
    // La conexión sigue utilizable después del rollback y release.
    await create(); expect(await counts()).toEqual({ principal: 1, configuracion: 1 });
  });
  it('restricciones SQL rechazan un porcentaje inválido y promoción sin asociación', async () => {
    const p = await create();
    await expect(database.pool.query('UPDATE promociones SET discount_value=101 WHERE id=$1', [p.promotionId])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query('DELETE FROM promocion_configuracion WHERE promotion_id=$1', [p.promotionId])).rejects.toMatchObject({ code: '23514' });
    expect(await counts()).toEqual({ principal: 1, configuracion: 1 });
  });
});

describe('O03: fusión, modalidad e historia sin carreras', () => {
  it('PATCH nombre conserva todo lo demás; sustituye alcance y canales', async () => {
    const original = await create();
    const renamed = await auth(http().patch(`${base}/${original.promotionId}`)).send({ nombre: 'Renombrada' });
    expect(renamed.status).toBe(200); conforms(idPath, 'patch', renamed);
    expect(renamed.body).toEqual({ ...original, nombre: 'Renombrada' });
    const scoped = await auth(http().patch(`${base}/${original.promotionId}`)).send({ alcance: { skus: ['SKU-LAB-002'] }, canalesHabilitados: ['RETAIL'] });
    expect(scoped.status).toBe(200);
    expect(scoped.body.alcance).toEqual({ skus: ['SKU-LAB-002'] });
    expect(scoped.body.canalesHabilitados).toEqual(['RETAIL']);
  });
  it('valida la entidad fusionada y conserva la fila cuando falla', async () => {
    const original = await create({ tipoDescuento: 'MONTO_FIJO', valor: 250 });
    const failed = await auth(http().patch(`${base}/${original.promotionId}`)).send({ tipoDescuento: 'PORCENTAJE' });
    problem(failed, 422, 'VALIDACION', idPath, 'patch');
    const read = await auth(http().get(`${base}/${original.promotionId}`));
    expect(read.body).toEqual(original);
  });
  it.each([{}, { puedeCambiarModalidad: true }, { first_activated_at: null }, { alcance: { productIds: [] } }, { politicaCombinacion: { cupon: true } }])('rechaza PATCH %j', async patch => {
    const p = await create();
    problem(await auth(http().patch(`${base}/${p.promotionId}`)).send(patch), 422, 'VALIDACION', idPath, 'patch');
    expect((await auth(http().get(`${base}/${p.promotionId}`))).body).toEqual(p);
  });
  it('cambia modalidad nunca activada, activa una sola vez y conserva historia al desactivar', async () => {
    const p = await create(); const url = `${base}/${p.promotionId}`;
    const change = await auth(http().patch(url)).send({ modalidad: 'CUPON' }); expect(change.status).toBe(200);
    const active = await auth(http().patch(url)).send({ estado: 'ACTIVO' }); expect(active.body.puedeCambiarModalidad).toBe(false);
    const first = (await database.pool.query('SELECT first_activated_at FROM promociones WHERE id=$1', [p.promotionId])).rows[0].first_activated_at;
    expect(first).toBeInstanceOf(Date);
    await auth(http().patch(url)).send({ estado: 'INACTIVO' }).expect(200);
    problem(await auth(http().patch(url)).send({ modalidad: 'AUTOMATICA' }), 409, 'MODALIDAD_BLOQUEADA', idPath, 'patch');
    await auth(http().patch(url)).send({ modalidad: 'CUPON' }).expect(200);
    await auth(http().patch(url)).send({ estado: 'ACTIVO' }).expect(200);
    const again = (await database.pool.query('SELECT first_activated_at FROM promociones WHERE id=$1', [p.promotionId])).rows[0].first_activated_at;
    expect(again).toEqual(first);
  });
  it('crear ACTIVO registra antecedente; desactivar y cambiar modalidad sigue bloqueado', async () => {
    const p = await create({ estado: 'ACTIVO' });
    expect(p.puedeCambiarModalidad).toBe(false);
    const off = await auth(http().patch(`${base}/${p.promotionId}`)).send({ estado: 'INACTIVO', modalidad: 'CUPON' });
    problem(off, 409, 'MODALIDAD_BLOQUEADA', idPath, 'patch');
    expect((await auth(http().get(`${base}/${p.promotionId}`))).body.estado).toBe('ACTIVO');
  });
  it('dos PATCH concurrentes conservan campos e historia', async () => {
    const p = await create(); const url = `${base}/${p.promotionId}`;
    const results = await Promise.all([
      auth(http().patch(url)).send({ estado: 'ACTIVO' }),
      auth(http().patch(url)).send({ nombre: 'Concurrente' }),
    ]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    const read = await auth(http().get(url));
    expect(read.body).toMatchObject({ nombre: 'Concurrente', estado: 'ACTIVO', puedeCambiarModalidad: false });
    await auth(http().patch(url)).send({ estado: 'INACTIVO' }).expect(200);
    problem(await auth(http().patch(url)).send({ modalidad: 'CUPON' }), 409, 'MODALIDAD_BLOQUEADA', idPath, 'patch');
  });
  it('espera el bloqueo de activación y rechaza un cambio basado en una lectura antigua', async () => {
    const p = await create();
    const lock = await database.pool.connect();
    let pending: Promise<request.Response> | undefined;
    try {
      await lock.query('BEGIN');
      await lock.query("UPDATE promociones SET state='ACTIVO' WHERE id=$1", [p.promotionId]);
      pending = auth(http().patch(`${base}/${p.promotionId}`)).send({ modalidad: 'CUPON' }).then(r => r);
      // Consultar pg_stat_activity confirma que el PATCH alcanzó y espera el bloqueo real.
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const result = await database.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF p%'");
        if (result.rows[0].n > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      await lock.query('COMMIT');
      problem(await pending, 409, 'MODALIDAD_BLOQUEADA', idPath, 'patch');
    } finally { await lock.query('ROLLBACK'); lock.release(); if (pending) await pending; }
  });
  it('un PATCH que espera un bloqueo conserva la configuración asociada recién confirmada', async () => {
    const p = await create();
    const lock = await database.pool.connect();
    let pending: Promise<request.Response> | undefined;
    const scope = { skus: ['SKU-LAB-002'] };
    const policy = { cupon: true, ofertaPricing: true, promocionAutomatica: false };
    try {
      await lock.query('BEGIN');
      await lock.query("UPDATE promociones SET name='Primera escritura' WHERE id=$1", [p.promotionId]);
      await lock.query('UPDATE promocion_configuracion SET alcance=$2, politica=$3 WHERE promotion_id=$1', [p.promotionId, JSON.stringify(scope), JSON.stringify(policy)]);
      pending = auth(http().patch(`${base}/${p.promotionId}`)).send({ nombre: 'Segunda escritura' }).then(r => r);
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const result = await database.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF p%'");
        if (result.rows[0].n > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      await lock.query('COMMIT');
      const response = await pending;
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ nombre: 'Segunda escritura', alcance: scope, politicaCombinacion: policy });
      const read = await auth(http().get(`${base}/${p.promotionId}`));
      expect(read.body).toMatchObject({ alcance: scope, politicaCombinacion: policy });
    } finally { await lock.query('ROLLBACK'); lock.release(); if (pending) await pending; }
  });
});

describe('O05–O07: consultas, filtros y orden', () => {
  it('comercial usa defaults, canal y resumen exacto; false omite solo el tiempo', async () => {
    const active = await create({ estado: 'ACTIVO' });
    const expired = await create({ estado: 'ACTIVO', validFrom: '2010-01-01T00:00:00Z', validUntil: '2011-01-01T00:00:00Z' });
    const inactive = await create();
    await create({ estado: 'ACTIVO', canalesHabilitados: ['RETAIL'] });
    const current = await auth(http().get(`${base}?canal=MARKETPLACE`), reader);
    expect(current.status).toBe(200); conforms('/promociones', 'get', current);
    expect(current.body.items.map((p: any) => p.promotion_id)).toEqual([active.promotionId]);
    expect(Object.keys(current.body.items[0]).sort()).toEqual(['promotion_id', 'name', 'status', 'valid_from', 'valid_until', 'channels'].sort());
    const allTime = await auth(http().get(`${base}?canal=MARKETPLACE&vigentes=false`));
    expect(allTime.body.items.map((p: any) => p.promotion_id)).toEqual([active.promotionId, expired.promotionId]);
    const off = await auth(http().get(`${base}?canal=MARKETPLACE&estado=INACTIVO&vigentes=false`));
    expect(off.body.items.map((p: any) => p.promotion_id)).toEqual([inactive.promotionId]);
    expect(off.body.items[0].status).toBe('INACTIVA');
  });
  it('vigencia incluye inicio y excluye fin con el mismo instante PostgreSQL', async () => {
    const from = await create({ estado: 'ACTIVO' }); const until = await create({ estado: 'ACTIVO' });
    await database.transaction(async client => {
      await client.query("UPDATE promociones SET valid_from=CURRENT_TIMESTAMP, valid_until=CURRENT_TIMESTAMP+interval '1 day' WHERE id=$1", [from.promotionId]);
      await client.query("UPDATE promociones SET valid_from=CURRENT_TIMESTAMP-interval '1 day', valid_until=CURRENT_TIMESTAMP WHERE id=$1", [until.promotionId]);
      const result = await client.query('SELECT id FROM promociones WHERE valid_from <= CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP < valid_until ORDER BY id');
      expect(result.rows.map(r => r.id)).toEqual([from.promotionId]);
    });
    const response = await auth(http().get(`${base}?canal=MARKETPLACE`));
    expect(response.body.items.map((p: any) => p.promotion_id)).toEqual([from.promotionId]);
  });
  it('admin pagina y cuenta antes de paginar; defaults y página fuera del rango', async () => {
    const a = await create(); const b = await create(); await create({ estado: 'ACTIVO', modalidad: 'CUPON' });
    const defaultPage = await auth(http().get(`${base}/administracion`));
    expect(defaultPage.body.meta).toEqual({ pagina: 1, tamanio: 20, total: 3, totalPaginas: 1 });
    const page = await auth(http().get(`${base}/administracion?pagina=2&tamanio=1&estado=INACTIVO&modalidad=AUTOMATICA`));
    conforms('/promociones/administracion', 'get', page);
    expect(page.body.meta).toEqual({ pagina: 2, tamanio: 1, total: 2, totalPaginas: 2 });
    expect(page.body.items[0].promotionId).toBe(b.promotionId);
    expect(defaultPage.body.items.map((p: any) => p.promotionId)).toEqual([a.promotionId, b.promotionId, defaultPage.body.items[2].promotionId]);
    const beyond = await auth(http().get(`${base}/administracion?pagina=20&tamanio=1`));
    expect(beyond.body.items).toEqual([]); expect(beyond.body.meta.total).toBe(3);
  });
  it('sin resultados devuelve totalPaginas 0', async () => {
    const response = await auth(http().get(`${base}/administracion`));
    expect(response.body).toEqual({ items: [], meta: { pagina: 1, tamanio: 20, total: 0, totalPaginas: 0 } });
    conforms('/promociones/administracion', 'get', response);
  });
  it.each(['', '?canal=WEB', '?canal=VENTAS&canal=RETAIL', '?canal=VENTAS&vigentes=1', '?canal=VENTAS&extra=x'])('query comercial inválida %s', async query => {
    problem(await auth(http().get(`${base}${query}`)), 400, 'VALIDACION', '/promociones', 'get');
  });
  it.each(['?pagina=0', '?tamanio=101', '?pagina=1.5', '?estado=ACTIVA', '?modalidad=x', '?pagina=1&pagina=2'])('query admin inválida %s', async query => {
    problem(await auth(http().get(`${base}/administracion${query}`)), 400, 'VALIDACION', '/promociones/administracion', 'get');
  });
});

describe('O04 / R12 / R17: eliminación y reinicio de aplicación', () => {
  it('204 vacío, no expone borrados y las siguientes operaciones devuelven 404', async () => {
    const p = await create({ estado: 'ACTIVO' }); const url = `${base}/${p.promotionId}`;
    const first = (await database.pool.query('SELECT first_activated_at FROM promociones WHERE id=$1', [p.promotionId])).rows[0].first_activated_at;
    const response = await auth(http().delete(url));
    expect(response.status).toBe(204); conforms(idPath, 'delete', response);
    for (const method of ['get', 'patch', 'delete'] as const) {
      let req = auth(http()[method](url)); if (method === 'patch') req = req.send({ nombre: 'X' });
      problem(await req, 404, 'PROMOCION_NO_ENCONTRADA', idPath, method);
    }
    expect((await auth(http().get(`${base}/administracion`))).body.meta.total).toBe(0);
    expect((await auth(http().get(`${base}?canal=MARKETPLACE&estado=INACTIVO&vigentes=false`))).body.items).toEqual([]);
    const row = (await database.pool.query('SELECT state, deleted_at, first_activated_at FROM promociones WHERE id=$1', [p.promotionId])).rows[0];
    expect(row.state).toBe('INACTIVO'); expect(row.deleted_at).toBeInstanceOf(Date); expect(row.first_activated_at).toEqual(first);
  });
  it('PATCH y DELETE concurrentes no resucitan una promoción', async () => {
    const p = await create(); const url = `${base}/${p.promotionId}`;
    const [patch, removed] = await Promise.all([auth(http().patch(url)).send({ nombre: 'En carrera' }), auth(http().delete(url))]);
    expect([200, 404]).toContain(patch.status); expect(removed.status).toBe(204);
    problem(await auth(http().get(url)), 404, 'PROMOCION_NO_ENCONTRADA', idPath, 'get');
  });
  it('cerrar Nest/pool y crear una nueva instancia conserva datos, asociaciones e historia', async () => {
    const p = await create({ estado: 'ACTIVO' }); const url = `${base}/${p.promotionId}`;
    await auth(http().patch(url)).send({ estado: 'INACTIVO' }).expect(200);
    const before = await auth(http().get(url));
    const first = (await database.pool.query('SELECT first_activated_at FROM promociones WHERE id=$1', [p.promotionId])).rows[0].first_activated_at;
    await app.close();
    app = await createApplication({ databaseUrl: process.env.TEST_DATABASE_URL!, adminToken: admin, readerToken: reader, test: true });
    const after = await auth(http().get(url));
    expect(after.body).toEqual(before.body);
    expect((await database.pool.query('SELECT first_activated_at FROM promociones WHERE id=$1', [p.promotionId])).rows[0].first_activated_at).toEqual(first);
    problem(await auth(http().patch(url)).send({ modalidad: 'CUPON' }), 409, 'MODALIDAD_BLOQUEADA', idPath, 'patch');
  });
});
