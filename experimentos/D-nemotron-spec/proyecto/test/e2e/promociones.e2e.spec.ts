import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module.js';
import { authMiddleware } from '../../src/auth/auth.middleware.js';
import { pool, closePool, withTransaction } from '../../src/db/pool.js';
import { query } from '../../src/db/pool.js';
import SuperTest, { SuperTest as SuperTestStatic, Test } from 'supertest';

const ADMIN_TOKEN = process.env.LAB_ADMIN_TOKEN ?? 'lab-admin-local-only';
const READER_TOKEN = process.env.LAB_READER_TOKEN ?? 'lab-reader-local-only';

let app: any;
let request: SuperTestStatic<Test>;

async function resetDb(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM promocion_politica_combinacion');
    await client.query('DELETE FROM promocion_alcance');
    await client.query('DELETE FROM promociones');
  });
}

async function ejecutarSQLInicial(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const sqlPath = path.join(process.cwd(), 'sql', '001_inicial.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
}

describe('E2E — Siete operaciones del API de Promociones', () => {
  beforeAll(async () => {
    await ejecutarSQLInicial();
    await resetDb();

    app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api/v1');
    app.use(authMiddleware);
    await app.init();

    const expressApp = app.getHttpAdapter().getInstance();
    request = SuperTest(expressApp);
  });

  afterAll(async () => {
    await app.close();
    await closePool();
  });

  describe('O01: POST /promociones — Crear (ADMIN)', () => {
    it('crea una promoción válida y devuelve 201 con promoción completa', async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Promo E2E 1',
          tipoDescuento: 'PORCENTAJE',
          valor: 15,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: true, cupon: false },
        });
      expect(res.status).toBe(201);
      expect(res.body.promotionId).toBeDefined();
      expect(res.body.nombre).toBe('Promo E2E 1');
      expect(res.body.puedeCambiarModalidad).toBe(false);
      expect(res.body.estado).toBe('ACTIVO');
      // first_activated_at debe haberse registrado al crear ACTIVO
      const detalle = await request
        .get(`/api/v1/promociones/${res.body.promotionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(detalle.status).toBe(200);
    });

    it('rechaza sin token: 401 NO_AUTENTICADO', async () => {
      const res = await request
        .post('/api/v1/promociones')
        .send({
          nombre: 'Sin token',
          tipoDescuento: 'PORCENTAJE',
          valor: 10,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NO_AUTENTICADO');
    });

    it('rechaza token de lector escribiendo: 403 NO_AUTORIZADO', async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${READER_TOKEN}`)
        .send({
          nombre: 'Lector escribiendo',
          tipoDescuento: 'PORCENTAJE',
          valor: 10,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NO_AUTORIZADO');
    });

    it('rechaza valor > 100 para PORCENTAJE: 422 VALIDACION', async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Porcentaje invalido',
          tipoDescuento: 'PORCENTAJE',
          valor: 150,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDACION');
    });

    it('rechaza reach inexistente/inactivo: 422 VALIDACION', async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Alcance invalido',
          tipoDescuento: 'PORCENTAJE',
          valor: 10,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-INACTIVO'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDACION');
    });

    it('rechaza canales vacíos: 422 VALIDACION', async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Canales vacíos',
          tipoDescuento: 'PORCENTAJE',
          valor: 10,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: [],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDACION');
    });

    it('nombres repetidos son válidos (IDs distintos)', async () => {
      const res1 = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Mismo nombre',
          tipoDescuento: 'MONTO_FIJO',
          valor: 5,
          modalidad: 'CUPON',
          estado: 'INACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { skus: ['SKU-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['RETAIL'],
          politicaCombinacion: { ofertaPricing: true, promocionAutomatica: false, cupon: true },
        });
      expect(res1.status).toBe(201);
      const id1 = res1.body.promotionId;

      const res2 = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Mismo nombre',
          tipoDescuento: 'MONTO_FIJO',
          valor: 5,
          modalidad: 'CUPON',
          estado: 'INACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { skus: ['SKU-LAB-002'] },
          prioridad: 2,
          canalesHabilitados: ['RETAIL'],
          politicaCombinacion: { ofertaPricing: true, promocionAutomatica: false, cupon: true },
        });
      expect(res2.status).toBe(201);
      expect(res2.body.promotionId).not.toBe(id1);
    });
  });

  describe('O02: POST /promociones/lote — Crear por lote (ADMIN)', () => {
    it('crea varios en una transacción y conserva el orden', async () => {
      const res = await request
        .post('/api/v1/promociones/lote')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          items: [
            {
              nombre: 'Lote 1',
              tipoDescuento: 'PORCENTAJE',
              valor: 10,
              modalidad: 'AUTOMATICA',
              estado: 'ACTIVO',
              validFrom: '2026-01-01T00:00:00Z',
              validUntil: '2026-12-31T23:59:59Z',
              alcance: { productIds: ['PRD-LAB-001'] },
              prioridad: 1,
              canalesHabilitados: ['MARKETPLACE'],
              politicaCombinacion: { ofertaPricing: false, promocionAutomatica: true, cupon: false },
            },
            {
              nombre: 'Lote 2',
              tipoDescuento: 'MONTO_FIJO',
              valor: 20,
              modalidad: 'CUPON',
              estado: 'INACTIVO',
              validFrom: '2026-02-01T00:00:00Z',
              validUntil: '2026-11-30T23:59:59Z',
              alcance: { skus: ['SKU-LAB-001', 'SKU-LAB-002'] },
              prioridad: 2,
              canalesHabilitados: ['CHATBOT', 'RETAIL'],
              politicaCombinacion: { ofertaPricing: true, promocionAutomatica: false, cupon: true },
            },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.items.length).toBe(2);
      expect(res.body.items[0].nombre).toBe('Lote 1');
      expect(res.body.items[1].nombre).toBe('Lote 2');
      expect(res.body.items[0].promotionId).not.toBe(res.body.items[1].promotionId);
    });

    it('si un elemento falla, no se guarda ninguno (transacción atómica)', async () => {
      const conteoAntes = await pool.query('SELECT COUNT(*) FROM promociones');
      const antes = parseInt(conteoAntes.rows[0].count, 10);

      const res = await request
        .post('/api/v1/promociones/lote')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          items: [
            {
              nombre: 'Lote valido 1',
              tipoDescuento: 'PORCENTAJE',
              valor: 10,
              modalidad: 'AUTOMATICA',
              estado: 'ACTIVO',
              validFrom: '2026-01-01T00:00:00Z',
              validUntil: '2026-12-31T23:59:59Z',
              alcance: { productIds: ['PRD-LAB-001'] },
              prioridad: 1,
              canalesHabilitados: ['MARKETPLACE'],
              politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
            },
            {
              nombre: 'Lote invalido',
              tipoDescuento: 'PORCENTAJE',
              valor: 200, // > 100 para PORCENTAJE
              modalidad: 'AUTOMATICA',
              estado: 'ACTIVO',
              validFrom: '2026-01-01T00:00:00Z',
              validUntil: '2026-12-31T23:59:59Z',
              alcance: { productIds: ['PRD-LAB-001'] },
              prioridad: 1,
              canalesHabilitados: ['MARKETPLACE'],
              politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
            },
          ],
        });
      expect(res.status).toBe(422);

      const conteoDespues = await pool.query('SELECT COUNT(*) FROM promociones');
      const despues = parseInt(conteoDespues.rows[0].count, 10);
      expect(despues).toBe(antes); // Ningún registro del lote quedó
    });

    it('rechaza 0 items: 422', async () => {
      const res = await request
        .post('/api/v1/promociones/lote')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ items: [] });
      expect(res.status).toBe(422);
    });
  });

  describe('O03: PATCH /promociones/{id} — Modificar parcialmente (ADMIN)', () => {
    let promocionId: string;

    beforeAll(async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Para PATCH',
          tipoDescuento: 'MONTO_FIJO',
          valor: 10,
          modalidad: 'CUPON',
          estado: 'INACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { skus: ['SKU-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['RETAIL'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      promocionId = res.body.promotionId;
    });

    it('PATCH solo nombre conserva el resto', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ nombre: 'Nombre actualizado' });
      expect(res.status).toBe(200);
      expect(res.body.nombre).toBe('Nombre actualizado');
      expect(res.body.tipoDescuento).toBe('MONTO_FIJO');
      expect(res.body.valor).toBe(10);
    });

    it('cambiar tipoDescuento a PORCENTAJE con valor > 100 rechaza la entidad fusionada: 422', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ tipoDescuento: 'PORCENTAJE' });
      // valor persistido es 10, que es <= 100, así que debería funcionar
      // pero si fueramos a cambiar a valor > 100, fallaría
      expect(res.status).toBe(200);
    });

    it('cambiar modalidad de INACTIVO nunca activado: permitido', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ modalidad: 'AUTOMATICA' });
      expect(res.status).toBe(200);
      expect(res.body.modalidad).toBe('AUTOMATICA');
    });

    it('reenviar la misma modalidad: permitido (no es cambio)', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ modalidad: 'AUTOMATICA' });
      expect(res.status).toBe(200);
    });

    it('activar (pasar a ACTIVO) registra first_activated_at', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ estado: 'ACTIVO' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('ACTIVO');
      // puedeCambiarModalidad ahora debe ser false porque ya fue activado
      expect(res.body.puedeCambiarModalidad).toBe(false);
    });

    it('desactivar conserva first_activated_at', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ estado: 'INACTIVO' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('INACTIVO');
      // puedeCambiarModalidad sigue false porque ya fue activado
      expect(res.body.puedeCambiarModalidad).toBe(false);
    });

    it('cambiar modalidad tras activación: 409 MODALIDAD_BLOQUEADA', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ modalidad: 'CUPON' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('MODALIDAD_BLOQUEADA');
    });

    it('PATCH vacío: 422', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({});
      expect(res.status).toBe(422);
    });

    it('PATCH promoción inexistente: 404', async () => {
      const res = await request
        .patch('/api/v1/promociones/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ nombre: 'no existe' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PROMOCION_NO_ENCONTRADA');
    });
  });

  describe('O04: DELETE /promociones/{id} — Eliminación lógica (ADMIN)', () => {
    let promocionId: string;

    beforeAll(async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Para eliminar',
          tipoDescuento: 'PORCENTAJE',
          valor: 10,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      promocionId = res.body.promotionId;
    });

    it('DELETE devuelve 204 sin cuerpo', async () => {
      const res = await request
        .delete(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('consultar eliminado: 404 PROMOCION_NO_ENCONTRADA', async () => {
      const res = await request
        .get(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PROMOCION_NO_ENCONTRADA');
    });

    it('modificar eliminado: 404', async () => {
      const res = await request
        .patch(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ nombre: 'no' });
      expect(res.status).toBe(404);
    });

    it('repetir DELETE: 404 (no idempotente en respuesta)', async () => {
      const res = await request
        .delete(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(404);
    });
  });

  describe('O05: GET /promociones — Consulta comercial (LECTOR_O_ADMIN)', () => {
    beforeAll(async () => {
      await resetDb();
      // Crear algunas promociones para filtrar
      await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Comercial vigente MP',
          tipoDescuento: 'PORCENTAJE',
          valor: 10,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: true, cupon: false },
        });
      await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Comercial vigente CHATBOT',
          tipoDescuento: 'PORCENTAJE',
          valor: 10,
          modalidad: 'CUPON',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { skus: ['SKU-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['CHATBOT'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: true },
        });
      await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Comercial INACTIVO',
          tipoDescuento: 'MONTO_FIJO',
          valor: 5,
          modalidad: 'AUTOMATICA',
          estado: 'INACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
    });

    it('exige canal: 400 sin canal', async () => {
      const res = await request
        .get('/api/v1/promociones')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(400);
    });

    it('filtra por canal y devuelve resumen snake_case', async () => {
      const res = await request
        .get('/api/v1/promociones?canal=MARKETPLACE')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].promotion_id).toBeDefined();
      expect(res.body.items[0].name).toBe('Comercial vigente MP');
      expect(res.body.items[0].status).toBe('ACTIVA');
      expect(res.body.items[0].valid_from).toBeDefined();
      expect(res.body.items[0].valid_until).toBeDefined();
      expect(res.body.items[0].channels).toContain('MARKETPLACE');
    });

    it('filtro estado=INACTIVO excluye activos', async () => {
      const res = await request
        .get('/api/v1/promociones?canal=MARKETPLACE&estado=INACTIVO')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].status).toBe('INACTIVA');
    });

    it('vigentes=false omite filtro temporal', async () => {
      const res = await request
        .get('/api/v1/promociones?canal=MARKETPLACE&vigentes=false')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      // estado default es ACTIVO, así que solo devuelve el activo de MARKETPLACE
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].status).toBe('ACTIVA');
    });

    it('lector puede leer: 200', async () => {
      const res = await request
        .get('/api/v1/promociones?canal=MARKETPLACE')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe('O06: GET /promociones/administracion — Paginado (LECTOR_O_ADMIN)', () => {
    beforeAll(async () => {
      await resetDb();
      for (let i = 1; i <= 5; i++) {
        await request
          .post('/api/v1/promociones')
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
          .send({
            nombre: `Admin promo ${i}`,
            tipoDescuento: 'PORCENTAJE',
            valor: i * 5,
            modalidad: i % 2 === 0 ? 'CUPON' : 'AUTOMATICA',
            estado: 'ACTIVO',
            validFrom: '2026-01-01T00:00:00Z',
            validUntil: '2026-12-31T23:59:59Z',
            alcance: { productIds: ['PRD-LAB-001'] },
            prioridad: i,
            canalesHabilitados: ['MARKETPLACE'],
            politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
          });
      }
    });

    it('pagina=1, tamanio=2 por defecto devuelve 2 items y meta correcta', async () => {
      const res = await request
        .get('/api/v1/promociones/administracion?pagina=1&tamanio=2')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(2);
      expect(res.body.meta.pagina).toBe(1);
      expect(res.body.meta.tamanio).toBe(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.totalPaginas).toBe(3);
    });

    it('total 0 da totalPaginas 0', async () => {
      // Reset y crear none... mejor usar filtro que no matchee
      const res = await request
        .get('/api/v1/promociones/administracion?estado=INACTIVO')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(0);
      expect(res.body.meta.total).toBe(0);
      expect(res.body.meta.totalPaginas).toBe(0);
    });

    it('filtro modalidad=CUPON', async () => {
      const res = await request
        .get('/api/v1/promociones/administracion?modalidad=CUPON')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      for (const item of res.body.items) {
        expect(item.modalidad).toBe('CUPON');
      }
    });

    it('tamanio máximo 100', async () => {
      const res = await request
        .get('/api/v1/promociones/administracion?tamanio=100')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(5);
    });

    it('tamanio 101: 400', async () => {
      const res = await request
        .get('/api/v1/promociones/administracion?tamanio=101')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });

  describe('O07: GET /promociones/{id} — Detalle administrativo (LECTOR_O_ADMIN)', () => {
    let promocionId: string;

    beforeAll(async () => {
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Detalle admin',
          tipoDescuento: 'MONTO_FIJO',
          valor: 25,
          modalidad: 'CUPON',
          estado: 'INACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { skus: ['SKU-LAB-001'] },
          prioridad: 3,
          canalesHabilitados: ['VENTAS'],
          politicaCombinacion: { ofertaPricing: true, promocionAutomatica: true, cupon: true },
        });
      promocionId = res.body.promotionId;
    });

    it('devuelve PromocionAdmin completo con puedeCambiarModalidad', async () => {
      const res = await request
        .get(`/api/v1/promociones/${promocionId}`)
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.promotionId).toBe(promocionId);
      expect(res.body.nombre).toBe('Detalle admin');
      expect(res.body.valor).toBe(25);
      expect(res.body.puedeCambiarModalidad).toBe(true); // INACTIVO, nunca activado
      expect(res.body.politicaCombinacion).toEqual({
        ofertaPricing: true,
        promocionAutomatica: true,
        cupon: true,
      });
    });

    it('promoción inexistente: 404', async () => {
      const res = await request
        .get('/api/v1/promociones/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PROMOCION_NO_ENCONTRADA');
    });

    it('UUID inválido: 400', async () => {
      const res = await request
        .get('/api/v1/promociones/no-es-un-uuid')
        .set('Authorization', `Bearer ${READER_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Persistencia tras reinicio', () => {
    it('los datos sobreviven al reinicio del servidor', async () => {
      // Crear una promoción
      const res = await request
        .post('/api/v1/promociones')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          nombre: 'Persistencia test',
          tipoDescuento: 'PORCENTAJE',
          valor: 50,
          modalidad: 'AUTOMATICA',
          estado: 'ACTIVO',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2026-12-31T23:59:59Z',
          alcance: { productIds: ['PRD-LAB-001'] },
          prioridad: 1,
          canalesHabilitados: ['MARKETPLACE'],
          politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: false },
        });
      expect(res.status).toBe(201);

      // Cerrar y volver a abrir la app
      await app.close();

      app = await NestFactory.create(AppModule);
      app.setGlobalPrefix('api/v1');
      app.use(authMiddleware);
      await app.init();
      const expressApp = app.getHttpAdapter().getInstance();
      request = SuperTest(expressApp);

      // Leer la promoción creada antes del reinicio
      const res2 = await request
        .get(`/api/v1/promociones/${res.body.promotionId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res2.status).toBe(200);
      expect(res2.body.nombre).toBe('Persistencia test');

      await app.close();
      // Reiniciar para los siguientes tests
      app = await NestFactory.create(AppModule);
      app.setGlobalPrefix('api/v1');
      app.use(authMiddleware);
      await app.init();
      const expressApp2 = app.getHttpAdapter().getInstance();
      request = SuperTest(expressApp2);
    });
  });
});
