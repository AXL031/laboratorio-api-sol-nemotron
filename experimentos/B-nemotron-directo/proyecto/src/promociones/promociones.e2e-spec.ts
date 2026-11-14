import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ProblemExceptionFilter } from '../common/problem-exception.filter.js';
import { Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import supertest from 'supertest';

const TEST_DB_URL = 'postgresql://lab:lab-local-only@127.0.0.1:55436/lab_promociones_test';
const ADMIN_TOKEN = 'lab-admin-local-only';
const READER_TOKEN = 'lab-reader-local-only';

let app: INestApplication;
let request: ReturnType<typeof supertest>;
let pool: Pool;

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const nuevaPromocion = (overrides: Record<string, unknown> = {}) => ({
  nombre: 'Promoción E2E',
  tipoDescuento: 'PORCENTAJE',
  valor: 25,
  modalidad: 'AUTOMATICA',
  estado: 'ACTIVO',
  validFrom: '2026-01-01T00:00:00Z',
  validUntil: '2026-12-31T23:59:59Z',
  alcance: { productIds: ['PRD-LAB-001'] },
  prioridad: 1,
  canalesHabilitados: ['MARKETPLACE', 'RETAIL'],
  politicaCombinacion: { ofertaPricing: true, promocionAutomatica: true, cupon: false },
  ...overrides,
});

async function truncateTables() {
  await pool.query('DELETE FROM promocion_politica_combinacion');
  await pool.query('DELETE FROM promocion_alcance_product_ids');
  await pool.query('DELETE FROM promocion_alcance_skus');
  await pool.query('DELETE FROM promociones');
}

describe('API Promociones — e2e (7 operaciones)', () => {
  beforeAll(async () => {
    app = await NestFactory.create(AppModule);
    app.useGlobalFilters(new ProblemExceptionFilter());
    await app.init();
    await app.listen(3303, '127.0.0.1');
    request = supertest(app.getHttpServer());

    pool = new Pool({ connectionString: TEST_DB_URL });

    const sqlPath = path.resolve(__dirname, '../../sql/01-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  afterEach(async () => {
    await truncateTables();
  });

  describe('POST /promociones — crearPromocion', () => {
    it('crea una promoción con 201 y devuelve PromocionAdmin', async () => {
      const res = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion())
        .expect(201);

      expect(res.body.promotionId).toBeDefined();
      expect(res.body.nombre).toBe('Promoción E2E');
      expect(res.body.tipoDescuento).toBe('PORCENTAJE');
      expect(res.body.valor).toBe(25);
      expect(res.body.modalidad).toBe('AUTOMATICA');
      expect(res.body.estado).toBe('ACTIVO');
      expect(res.body.puedeCambiarModalidad).toBe(false);
      expect(res.body.alcance.productIds).toEqual(['PRD-LAB-001']);
      expect(res.body.canalesHabilitados).toContain('MARKETPLACE');
      expect(res.body.politicaCombinacion).toEqual({
        ofertaPricing: true,
        promocionAutomatica: true,
        cupon: false,
      });
    });

    it('401 sin token', async () => {
      await request
        .post('/promociones')
        .send(nuevaPromocion())
        .expect(401)
        .expect((res: any) => {
          expect(res.body.code).toBe('NO_AUTENTICADO');
          expect(res.body.status).toBe(401);
        });
    });

    it('403 con token de lector (solo admin puede POST)', async () => {
      await request
        .post('/promociones')
        .set(authHeader(READER_TOKEN))
        .send(nuevaPromocion())
        .expect(403)
        .expect((res: any) => {
          expect(res.body.code).toBe('NO_AUTORIZADO');
        });
    });

    it('400 con JSON malformado', async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .set('Content-Type', 'application/json')
        .send('not json')
        .expect(400);
    });

    it('422 con valor > 100 en PORCENTAJE', async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ tipoDescuento: 'PORCENTAJE', valor: 150 }))
        .expect(422)
        .expect((res: any) => {
          expect(res.body.code).toBe('VALIDACION');
        });
    });

    it('422 con alcance inexistente', async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ alcance: { productIds: ['PRD-INEXISTENTE'] } }))
        .expect(422);
    });

    it('422 con productId inactivo', async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ alcance: { productIds: ['PRD-LAB-INACTIVO'] } }))
        .expect(422);
    });

    it('genera UUID distinto para cada creación', async () => {
      const r1 = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Promo A' }))
        .expect(201);
      const r2 = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Promo B' }))
        .expect(201);
      expect(r1.body.promotionId).not.toBe(r2.body.promotionId);
    });
  });

  describe('GET /promociones — listarPromociones (comercial)', () => {
    beforeEach(async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Promo Activa', canalesHabilitados: ['MARKETPLACE'] }));
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({
          nombre: 'Promo Inactiva',
          estado: 'INACTIVO',
          canalesHabilitados: ['MARKETPLACE'],
        }));
    });

    it('lista comerciales filtrando por canal y estado ACTIVO', async () => {
      const res = await request
        .get('/promociones')
        .set(authHeader(READER_TOKEN))
        .query({ canal: 'MARKETPLACE' })
        .expect(200);

      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Promo Activa');
      expect(res.body.items[0].status).toBe('ACTIVA');
    });

    it('401 sin token', async () => {
      await request.get('/promociones').query({ canal: 'MARKETPLACE' }).expect(401);
    });

    it('400 sin canal', async () => {
      await request
        .get('/promociones')
        .set(authHeader(READER_TOKEN))
        .expect(400);
    });

    it('vigentes=false omite filtro temporal', async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({
          nombre: 'Promo Vencida',
          validFrom: '2020-01-01T00:00:00Z',
          validUntil: '2020-12-31T23:59:59Z',
          canalesHabilitados: ['MARKETPLACE'],
        }));

      const res = await request
        .get('/promociones')
        .set(authHeader(READER_TOKEN))
        .query({ canal: 'MARKETPLACE', vigentes: 'false' })
        .expect(200);

      const names = res.body.items.map((i: any) => i.name);
      expect(names).toContain('Promo Activa');
      expect(names).toContain('Promo Vencida');
    });

    it('devuelve nombres snake_case y status ACTIVA/INACTIVA', async () => {
      const res = await request
        .get('/promociones')
        .set(authHeader(READER_TOKEN))
        .query({ canal: 'MARKETPLACE', estado: 'INACTIVO' })
        .expect(200);

      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].status).toBe('INACTIVA');
      expect(res.body.items[0].promotion_id).toBeDefined();
      expect(res.body.items[0].valid_from).toBeDefined();
      expect(res.body.items[0].valid_until).toBeDefined();
      expect(res.body.items[0].channels).toBeDefined();
    });
  });

  describe('POST /promociones/lote — crearPromocionesLote', () => {
    it('crea 3 promociones en una transacción atómica con 201', async () => {
      const res = await request
        .post('/promociones/lote')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          items: [
            nuevaPromocion({ nombre: 'Lote 1' }),
            nuevaPromocion({ nombre: 'Lote 2' }),
            nuevaPromocion({ nombre: 'Lote 3' }),
          ],
        })
        .expect(201);

      expect(res.body.items.length).toBe(3);
      expect(res.body.items[0].nombre).toBe('Lote 1');
      expect(res.body.items[1].nombre).toBe('Lote 2');
      expect(res.body.items[2].nombre).toBe('Lote 3');
      const ids = res.body.items.map((i: any) => i.promotionId);
      expect(new Set(ids).size).toBe(3);
    });

    it('422 con 0 items', async () => {
      await request
        .post('/promociones/lote')
        .set(authHeader(ADMIN_TOKEN))
        .send({ items: [] })
        .expect(422);
    });

    it('422 con 21 items', async () => {
      const items = Array.from({ length: 21 }, (_, i) => nuevaPromocion({ nombre: `Lote ${i}` }));
      await request
        .post('/promociones/lote')
        .set(authHeader(ADMIN_TOKEN))
        .send({ items })
        .expect(422);
    });

    it('422 si algún item es inválido (transacción: nada se guarda)', async () => {
      await request
        .post('/promociones/lote')
        .set(authHeader(ADMIN_TOKEN))
        .send({
          items: [
            nuevaPromocion({ nombre: 'Válido' }),
            nuevaPromocion({ valor: -5 }),
          ],
        })
        .expect(422);

      const res = await request
        .get('/promociones/administracion')
        .set(authHeader(ADMIN_TOKEN))
        .expect(200);
      expect(res.body.items.length).toBe(0);
    });
  });

  describe('GET /promociones/administracion — listarPromocionesAdmin', () => {
    beforeEach(async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Admin 1', modalidad: 'AUTOMATICA', estado: 'ACTIVO' }));
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Admin 2', modalidad: 'CUPON', estado: 'INACTIVO' }));
    });

    it('lista paginada con meta correcta', async () => {
      const res = await request
        .get('/promociones/administracion')
        .set(authHeader(READER_TOKEN))
        .query({ pagina: 1, tamanio: 10 })
        .expect(200);

      expect(res.body.items.length).toBe(2);
      expect(res.body.meta).toEqual({
        pagina: 1,
        tamanio: 10,
        total: 2,
        totalPaginas: 1,
      });
    });

    it('filtra por estado exacto', async () => {
      const res = await request
        .get('/promociones/administracion')
        .set(authHeader(ADMIN_TOKEN))
        .query({ estado: 'INACTIVO' })
        .expect(200);

      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].nombre).toBe('Admin 2');
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.totalPaginas).toBe(1);
    });

    it('filtra por modalidad exacta', async () => {
      const res = await request
        .get('/promociones/administracion')
        .set(authHeader(ADMIN_TOKEN))
        .query({ modalidad: 'CUPON' })
        .expect(200);

      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].modalidad).toBe('CUPON');
    });

    it('orden estable por created_at ASC, id ASC', async () => {
      const res = await request
        .get('/promociones/administracion')
        .set(authHeader(ADMIN_TOKEN))
        .expect(200);
      expect(res.body.items.length).toBe(2);
    });
  });

  describe('GET /promociones/{promocionId} — obtenerPromocionAdmin', () => {
    it('devuelve detalle administrativo con 200', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Detalle Test' }))
        .expect(201);

      const res = await request
        .get(`/promociones/${created.body.promotionId}`)
        .set(authHeader(READER_TOKEN))
        .expect(200);

      expect(res.body.promotionId).toBe(created.body.promotionId);
      expect(res.body.nombre).toBe('Detalle Test');
      expect(res.body.puedeCambiarModalidad).toBeDefined();
    });

    it('404 para UUID inexistente', async () => {
      await request
        .get('/promociones/550e8400-e29b-41d4-a716-446655440000')
        .set(authHeader(ADMIN_TOKEN))
        .expect(404)
        .expect((res: any) => {
          expect(res.body.code).toBe('PROMOCION_NO_ENCONTRADA');
        });
    });

    it('400 para UUID inválido en path', async () => {
      await request
        .get('/promociones/no-es-uuid')
        .set(authHeader(ADMIN_TOKEN))
        .expect(400);
    });
  });

  describe('PATCH /promociones/{promocionId} — actualizarPromocion', () => {
    it('actualiza parcialmente y conserva campos omitidos', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Original', valor: 10 }))
        .expect(201);

      const res = await request
        .patch(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ nombre: 'Modificado' })
        .expect(200);

      expect(res.body.nombre).toBe('Modificado');
      expect(res.body.valor).toBe(10);
    });

    it('404 para promoción inexistente', async () => {
      await request
        .patch('/promociones/550e8400-e29b-41d4-a716-446655440000')
        .set(authHeader(ADMIN_TOKEN))
        .send({ nombre: 'X' })
        .expect(404);
    });

    it('409 MODALIDAD_BLOQUEADA al cambiar de AUTOMATICA a CUPON cuando ya fue activada', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ modalidad: 'AUTOMATICA', estado: 'ACTIVO' }))
        .expect(201);

      await request
        .patch(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ modalidad: 'CUPON' })
        .expect(409)
        .expect((res: any) => {
          expect(res.body.code).toBe('MODALIDAD_BLOQUEADA');
        });
    });

    it('permite cambiar modalidad cuando INACTIVO y nunca activada', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ modalidad: 'AUTOMATICA', estado: 'INACTIVO' }))
        .expect(201);

      const res = await request
        .patch(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ modalidad: 'CUPON' })
        .expect(200);

      expect(res.body.modalidad).toBe('CUPON');
    });

    it('reenviar la misma modalidad no es cambio y no bloquea', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ modalidad: 'AUTOMATICA', estado: 'ACTIVO' }))
        .expect(201);

      await request
        .patch(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ modalidad: 'AUTOMATICA' })
        .expect(200);
    });

    it('422 con PATCH vacío', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion())
        .expect(201);

      await request
        .patch(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({})
        .expect(422);
    });

    it('transición INACTIVO -> ACTIVO registra first_activated_at una sola vez', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ estado: 'INACTIVO' }))
        .expect(201);

      await request
        .patch(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .send({ estado: 'ACTIVO' })
        .expect(200);

      const res = await request
        .get(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .expect(200);
      expect(res.body.puedeCambiarModalidad).toBe(false);
    });
  });

  describe('DELETE /promociones/{promocionId} — eliminarPromocionLab', () => {
    it('elimina lógicamente con 204 sin cuerpo', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion())
        .expect(201);

      const res = await request
        .delete(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .expect(204);

      expect(res.text).toBe('');
    });

    it('404 al leer promoción eliminada', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion())
        .expect(201);

      await request
        .delete(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .expect(204);

      await request
        .get(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .expect(404);
    });

    it('404 al eliminar ya eliminada', async () => {
      const created = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion())
        .expect(201);

      await request
        .delete(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .expect(204);

      await request
        .delete(`/promociones/${created.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .expect(404);
    });

    it('excluye eliminados de listados', async () => {
      await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Viva' }))
        .expect(201);
      const toDelete = await request
        .post('/promociones')
        .set(authHeader(ADMIN_TOKEN))
        .send(nuevaPromocion({ nombre: 'Muerta' }))
        .expect(201);

      await request
        .delete(`/promociones/${toDelete.body.promotionId}`)
        .set(authHeader(ADMIN_TOKEN))
        .expect(204);

      const res = await request
        .get('/promociones/administracion')
        .set(authHeader(ADMIN_TOKEN))
        .expect(200);

      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].nombre).toBe('Viva');
    });
  });
});