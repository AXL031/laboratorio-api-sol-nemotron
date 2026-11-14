import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import request, { type Response as TestResponse } from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { fixture } from './fixture.js';

const root = '/api/v1/promociones';
const admin = `Bearer ${process.env.LAB_ADMIN_TOKEN}`;
const reader = `Bearer ${process.env.LAB_READER_TOKEN}`;
let app: INestApplication, sql: Pool;
const http = () => request(app.getHttpServer());
const post = (data: unknown = fixture()) => http().post(root).set('Authorization', admin).send(data as object);
const get = (id: string) => http().get(`${root}/${id}`).set('Authorization', reader);
const patch = (id: string, data: object) => http().patch(`${root}/${id}`).set('Authorization', admin).send(data);
const list = (query = '') => http().get(`${root}/administracion${query}`).set('Authorization', reader);
function problem(response: TestResponse, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  expect(response.body).toMatchObject({ status, code, title: expect.any(String) });
  expect(Object.keys(response.body).every(key => ['status', 'code', 'title', 'detail'].includes(key))).toBe(true);
  expect(JSON.stringify(response.body)).not.toMatch(/stack|postgresql:|lab-local-only|INSERT INTO/);
}
function adminShape(body: Record<string, unknown>) {
  expect(Object.keys(body).sort()).toEqual(['promotionId', 'nombre', 'tipoDescuento', 'valor', 'modalidad', 'estado',
    'validFrom', 'validUntil', 'alcance', 'prioridad', 'canalesHabilitados', 'politicaCombinacion', 'puedeCambiarModalidad'].sort());
  expect(body.promotionId).toMatch(/^[0-9a-f-]{36}$/);
}
beforeAll(async () => {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'http://invalid');
  const appEnv = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const appUrl = /^DATABASE_URL=(.*)$/m.exec(appEnv)?.[1].trim();
  if (process.env.LAB_ALLOW_E2E_RESET !== 'SI_SOLO_BASE_DE_PRUEBAS'
    || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    || process.env.DATABASE_URL === appUrl || url.pathname !== '/lab_promociones_test'
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Se niega reset: solo se permite la base e2e local separada con autorización explícita');
  }
  sql = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 });
  await sql.query(readFileSync(new URL('../sql/001-promociones.sql', import.meta.url), 'utf8'));
  app = await createApp();
});
beforeEach(async () => { await sql.query('TRUNCATE promotion_configuration, promotions'); });
afterAll(async () => { if (app) await app.close(); if (sql) await sql.end(); });

describe('autenticación previa al procesamiento', () => {
  const routes = [['post', root], ['post', `${root}/lote`], ['get', root],
    ['get', `${root}/administracion`], ['get', `${root}/no-uuid`], ['patch', `${root}/no-uuid`], ['delete', `${root}/no-uuid`]] as const;
  it.each(routes)('sin token: %s %s', async (method, path) => {
    const response = await http()[method](path).set('Content-Type', 'application/json').send('{malformado');
    problem(response, 401, 'NO_AUTENTICADO');
  });
  it('token incorrecto devuelve 401', async () => {
    problem(await http().get(root).set('Authorization', 'Bearer falso'), 401, 'NO_AUTENTICADO');
  });
  it.each(routes.filter(([method]) => method !== 'get'))('lector no puede escribir: %s %s', async (method, path) => {
    problem(await http()[method](path).set('Authorization', reader).set('Content-Type', 'application/json').send('{roto'), 403, 'NO_AUTORIZADO');
  });
  it('JSON malformado autorizado devuelve 400', async () => {
    problem(await http().post(root).set('Authorization', admin).set('Content-Type', 'application/json').send('{roto'), 400, 'VALIDACION');
  });
});
describe('creación y lecturas', () => {
  it('POST + GET conservan configuración, UUID, 14 columnas y auditoría privada', async () => {
    const created = await post();
    expect(created.status).toBe(201);
    adminShape(created.body);
    expect(created.body).toMatchObject({ ...fixture(), validFrom: '2020-01-01T00:00:00.000Z',
      validUntil: '2099-01-01T00:00:00.000Z', puedeCambiarModalidad: true });
    expect((await get(created.body.promotionId)).body).toEqual(created.body);
    const columns = await sql.query("SELECT column_name FROM information_schema.columns WHERE table_name='promotions' AND table_schema='public'");
    expect(columns.rows).toHaveLength(14);
    const row = (await sql.query('SELECT * FROM promotions WHERE id=$1', [created.body.promotionId])).rows[0];
    expect(row.first_activated_at).toBeNull();
    expect(row.created_at).toBeInstanceOf(Date);
  });
  it('nombres repetidos generan UUID diferentes', async () => {
    const a = await post(), b = await post();
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect(a.body.promotionId).not.toBe(b.body.promotionId);
    expect((await list()).body.meta.total).toBe(2);
  });
  it.each([null, [], 'texto', true, 10, {}, { ...fixture(), promotionId: 'x' }, fixture({ valor: 1e309 }),
    fixture({ alcance: { productIds: ['PRD-LAB-INACTIVO'] } }), fixture({ alcance: { skus: ['SKU-LAB-INACTIVO'] } }),
    fixture({ validFrom: '2026-02-30T00:00:00Z' }), fixture({ canalesHabilitados: ['RETAIL', 'RETAIL'] })])('POST inválido %# produce 422 sin insertar', async body => {
    const response = await http().post(root).set('Authorization', admin).set('Content-Type', 'application/json').send(JSON.stringify(body));
    problem(response, 422, 'VALIDACION');
    expect((await list()).body.meta.total).toBe(0);
  });
  it('UUID inválido es 400; UUID ausente es 404 para GET/PATCH/DELETE', async () => {
    for (const method of ['get', 'patch', 'delete'] as const) {
      problem(await http()[method](`${root}/roto`).set('Authorization', admin).send({ nombre: 'x' }), 400, 'VALIDACION');
      problem(await http()[method](`${root}/00000000-0000-4000-8000-000000000000`).set('Authorization', admin).send({ nombre: 'x' }), 404, 'PROMOCION_NO_ENCONTRADA');
    }
  });
});
describe('PATCH y modalidad histórica', () => {
  it('fusiona valores omitidos y sustituye objetos/listas completos', async () => {
    const created = (await post()).body;
    const changed = await patch(created.promotionId, { nombre: 'Renombrada', alcance: { skus: ['SKU-LAB-002'] }, canalesHabilitados: ['RETAIL'] });
    expect(changed.status).toBe(200);
    expect(changed.body).toEqual({ ...created, nombre: 'Renombrada', alcance: { skus: ['SKU-LAB-002'] }, canalesHabilitados: ['RETAIL'] });
    expect((await get(created.promotionId)).body).toEqual(changed.body);
    problem(await patch(created.promotionId, { politicaCombinacion: { cupon: true } }), 422, 'VALIDACION');
  });
  it('valida la entidad fusionada: porcentaje y fechas', async () => {
    const id = (await post(fixture({ tipoDescuento: 'MONTO_FIJO', valor: 150 }))).body.promotionId;
    problem(await patch(id, { tipoDescuento: 'PORCENTAJE' }), 422, 'VALIDACION');
    problem(await patch(id, { validFrom: '2100-01-01T00:00:00Z' }), 422, 'VALIDACION');
    expect((await get(id)).body.valor).toBe(150);
    expect((await patch(id, { tipoDescuento: 'PORCENTAJE', valor: 100 })).status).toBe(200);
  });
  it.each([{}, { puedeCambiarModalidad: true }, { promotionId: 'x' }, { updated_at: 'x' }, { alcance: null }])('PATCH inválido %#', async body => {
    const id = (await post()).body.promotionId;
    problem(await patch(id, body), 422, 'VALIDACION');
  });
  it('permite cambiar modalidad solo antes de la primera activación; conserva antecedente al reactivar y borrar', async () => {
    const id = (await post()).body.promotionId;
    expect((await patch(id, { modalidad: 'CUPON' })).body.puedeCambiarModalidad).toBe(true);
    expect((await patch(id, { estado: 'ACTIVO' })).body.puedeCambiarModalidad).toBe(false);
    const first = (await sql.query('SELECT first_activated_at FROM promotions WHERE id=$1', [id])).rows[0].first_activated_at;
    expect(first).toBeInstanceOf(Date);
    problem(await patch(id, { modalidad: 'AUTOMATICA' }), 409, 'MODALIDAD_BLOQUEADA');
    expect((await patch(id, { modalidad: 'CUPON' })).status).toBe(200);
    expect((await patch(id, { estado: 'INACTIVO' })).body.puedeCambiarModalidad).toBe(false);
    problem(await patch(id, { modalidad: 'AUTOMATICA' }), 409, 'MODALIDAD_BLOQUEADA');
    await patch(id, { estado: 'ACTIVO' });
    await http().delete(`${root}/${id}`).set('Authorization', admin).expect(204);
    const row = (await sql.query('SELECT * FROM promotions WHERE id=$1', [id])).rows[0];
    expect(row.first_activated_at).toEqual(first);
    expect(row.state).toBe('INACTIVO'); expect(row.deleted_at).toBeInstanceOf(Date);
  });
  it('creación activa registra activación y no se desbloquea desactivando en el mismo PATCH', async () => {
    const created = (await post(fixture({ estado: 'ACTIVO' }))).body;
    expect(created.puedeCambiarModalidad).toBe(false);
    problem(await patch(created.promotionId, { estado: 'INACTIVO', modalidad: 'CUPON' }), 409, 'MODALIDAD_BLOQUEADA');
    expect((await get(created.promotionId)).body.estado).toBe('ACTIVO');
  });
  it('actualizaciones concurrentes no pierden campos omitidos', async () => {
    const id = (await post()).body.promotionId;
    const result = await Promise.all([patch(id, { nombre: 'Concurrente' }), patch(id, { prioridad: 7 })]);
    expect(result.map(r => r.status)).toEqual([200, 200]);
    expect((await get(id)).body).toMatchObject({ nombre: 'Concurrente', prioridad: 7 });
  });
});
describe('lote atómico PostgreSQL', () => {
  it('guarda de 1 a 20 en orden de entrada', async () => {
    for (const size of [1, 20]) {
      const response = await http().post(`${root}/lote`).set('Authorization', admin).send({ items:
        Array.from({ length: size }, (_, i) => fixture({ nombre: `Lote ${size} / ${i}` })) });
      expect(response.status).toBe(201);
      expect(response.body.items.map((item: { nombre: string }) => item.nombre)).toEqual(Array.from({ length: size }, (_, i) => `Lote ${size} / ${i}`));
      response.body.items.forEach(adminShape);
    }
    expect((await list()).body.meta.total).toBe(21);
  });
  it.each([{ items: [] }, { items: Array.from({ length: 21 }, () => fixture()) },
    { items: [fixture(), fixture({ valor: 0 })] }])('rechaza lote inválido %# sin escrituras', async body => {
    problem(await http().post(`${root}/lote`).set('Authorization', admin).send(body), 422, 'VALIDACION');
    expect((await list()).body.meta.total).toBe(0);
  });
  it('revierte la primera inserción si PostgreSQL falla en la segunda (transacción real)', async () => {
    await sql.query(`CREATE FUNCTION lab_fail_second() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.name='FALLAR_SEGUNDA' THEN RAISE EXCEPTION 'Fallo forzado de prueba'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER lab_fail_second BEFORE INSERT ON promotions FOR EACH ROW EXECUTE FUNCTION lab_fail_second()`);
    try {
      problem(await http().post(`${root}/lote`).set('Authorization', admin).send({ items: [fixture(), fixture({ nombre: 'FALLAR_SEGUNDA' })] }), 500, 'ERROR_INTERNO');
      expect((await sql.query('SELECT * FROM promotions')).rows).toHaveLength(0);
      expect((await sql.query('SELECT * FROM promotion_configuration')).rows).toHaveLength(0);
    } finally { await sql.query('DROP TRIGGER lab_fail_second ON promotions; DROP FUNCTION lab_fail_second()'); }
  });
});
describe('consultas comerciales, administración y borrado', () => {
  it('admin pagina, filtra, cuenta antes de paginar y devuelve orden estable', async () => {
    const a = (await post(fixture({ nombre: 'A' }))).body;
    const b = (await post(fixture({ nombre: 'B' }))).body;
    await post(fixture({ nombre: 'C', estado: 'ACTIVO', modalidad: 'CUPON' }));
    const page = await list('?pagina=2&tamanio=1&estado=INACTIVO&modalidad=AUTOMATICA');
    expect(page.status).toBe(200);
    expect(page.body.meta).toEqual({ pagina: 2, tamanio: 1, total: 2, totalPaginas: 2 });
    expect(page.body.items[0].promotionId).toBe(b.promotionId);
    expect((await list('?pagina=1&tamanio=1')).body.items[0].promotionId).toBe(a.promotionId);
    expect((await list('?pagina=100')).body).toMatchObject({ items: [], meta: { total: 3, totalPaginas: 1 } });
    expect((await list('?estado=INACTIVO&modalidad=CUPON')).body).toMatchObject({ items: [], meta: { total: 0, totalPaginas: 0 } });
    expect((await list()).body.meta).toEqual({ pagina: 1, tamanio: 20, total: 3, totalPaginas: 1 });
  });
  it('desempata created_at iguales por UUID ascendente', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await post()).body.promotionId);
    await sql.query("UPDATE promotions SET created_at='2026-01-01T00:00:00Z'");
    expect((await list()).body.items.map((p: { promotionId: string }) => p.promotionId)).toEqual(ids.sort());
  });
  it('canal + estado + vigencia, defaults y representación comercial exacta', async () => {
    const active = (await post(fixture({ nombre: 'Vigente', estado: 'ACTIVO' }))).body;
    await post(fixture({ nombre: 'Futura', estado: 'ACTIVO', validFrom: '2090-01-01T00:00:00Z' }));
    await post(fixture({ nombre: 'Expirada', estado: 'ACTIVO', validUntil: '2021-01-01T00:00:00Z' }));
    await post(fixture({ nombre: 'Otro canal', estado: 'ACTIVO', canalesHabilitados: ['RETAIL'] }));
    await post(fixture({ nombre: 'Inactiva' }));
    const commercial = async (q: string) => http().get(`${root}?${q}`).set('Authorization', reader);
    expect((await commercial('canal=MARKETPLACE')).body).toEqual({ items: [{ promotion_id: active.promotionId,
      name: 'Vigente', status: 'ACTIVA', valid_from: active.validFrom, valid_until: active.validUntil, channels: ['MARKETPLACE', 'CHATBOT'] }] });
    expect((await commercial('canal=MARKETPLACE&vigentes=false')).body.items.map((p: { name: string }) => p.name)).toEqual(['Vigente', 'Futura', 'Expirada']);
    expect((await commercial('canal=MARKETPLACE&estado=INACTIVO')).body.items[0]).toMatchObject({ name: 'Inactiva', status: 'INACTIVA' });
    expect((await commercial('canal=VENTAS')).body).toEqual({ items: [] });
  });
  it.each(['?pagina=0', '?tamanio=101', '?pagina=1.5', '?estado=ACTIVA', '?modalidad=otra', '?pagina=1&pagina=2'])('admin query inválida %s', async query => {
    problem(await list(query), 400, 'VALIDACION');
  });
  it.each(['', '?canal=otro', '?canal=RETAIL&vigentes=1', '?canal=RETAIL&estado=ACTIVA', '?canal=RETAIL&canal=VENTAS'])('comercial query inválida %s', async query => {
    problem(await http().get(`${root}${query}`).set('Authorization', reader), 400, 'VALIDACION');
  });
  it('DELETE lógico 204 sin cuerpo; excluye eliminado de las tres consultas', async () => {
    const id = (await post(fixture({ estado: 'ACTIVO' }))).body.promotionId;
    const deleted = await http().delete(`${root}/${id}`).set('Authorization', admin);
    expect(deleted.status).toBe(204); expect(deleted.text).toBe('');
    problem(await get(id), 404, 'PROMOCION_NO_ENCONTRADA');
    problem(await patch(id, { nombre: 'Imposible' }), 404, 'PROMOCION_NO_ENCONTRADA');
    problem(await http().delete(`${root}/${id}`).set('Authorization', admin), 404, 'PROMOCION_NO_ENCONTRADA');
    expect((await list()).body.meta.total).toBe(0);
    expect((await http().get(`${root}?canal=MARKETPLACE&estado=INACTIVO&vigentes=false`).set('Authorization', reader)).body).toEqual({ items: [] });
    expect((await sql.query('SELECT deleted_at FROM promotions WHERE id=$1', [id])).rows[0].deleted_at).toBeInstanceOf(Date);
  });
  it('persiste después de cerrar la aplicación y su pool y crear una instancia nueva', async () => {
    const created = (await post(fixture({ estado: 'ACTIVO' }))).body;
    await patch(created.promotionId, { estado: 'INACTIVO' });
    await app.close();
    app = await createApp();
    const response = await get(created.promotionId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...created, estado: 'INACTIVO', puedeCambiarModalidad: false });
    problem(await patch(created.promotionId, { modalidad: 'CUPON' }), 409, 'MODALIDAD_BLOQUEADA');
  });
});
