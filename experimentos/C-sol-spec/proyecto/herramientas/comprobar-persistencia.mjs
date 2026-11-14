import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Database, migrate } from '../dist/database.js';

const root = new URL('../', import.meta.url);
const fixture = parseEnv(await readFile(new URL('.env', root), 'utf8'));
const database = new Database(fixture.DATABASE_URL);
const base = `http://127.0.0.1:${Number(fixture.PORT)}/api/v1/promociones`;
const report = { tipo: 'API propio: siete operaciones HTTP y reinicio de proceso real', fecha: new Date().toISOString(), checks: [], estado: 'FAIL' };
let child;
function check(nombre, evidencia) { report.checks.push({ nombre, estado: 'PASS', evidencia }); }
async function call(method, suffix = '', body, token = fixture.LAB_ADMIN_TOKEN) {
  const response = await fetch(base + suffix, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined, text };
}
async function start() {
  // No apropiarse de un servidor ya existente en el puerto reservado.
  try {
    await fetch(base + '/administracion', { signal: AbortSignal.timeout(500) });
    throw new Error('El puerto está ocupado; la prueba exige controlar su propio proceso');
  } catch (error) { if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error; }
  child = spawn(process.execPath, ['--env-file=.env', 'dist/main.js'], { cwd: fileURLToPath(root), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', () => {});
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('El servidor terminó antes de estar listo');
    if (output.includes('API académico escuchando')) return child.pid;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('El servidor no inició a tiempo');
}
async function stop() {
  if (!child) return;
  const current = child; child = undefined;
  if (current.exitCode !== null || current.signalCode !== null) return;
  const exited = once(current, 'exit');
  current.kill('SIGTERM');
  await exited;
}
try {
  const migration = await migrate(database);
  check('Migración reproducible sin borrar datos', { estado: migration });
  const pid1 = await start();
  const data = {
    nombre: `Evidencia de persistencia ${report.fecha}`, tipoDescuento: 'PORCENTAJE', valor: 15,
    modalidad: 'AUTOMATICA', estado: 'INACTIVO', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z',
    alcance: { productIds: ['PRD-LAB-001'], skus: ['SKU-LAB-001'] }, prioridad: 1,
    canalesHabilitados: ['MARKETPLACE'], politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: true },
  };
  const created = await call('POST', '', data); assert.equal(created.status, 201);
  const id = created.body.promotionId;
  check('O01 POST promoción', { status: 201, promotionId: id, base: 'lab_promociones' });
  const batch = await call('POST', '/lote', { items: [{ ...data, nombre: 'Alta temporal de lote 1' }, { ...data, nombre: 'Alta temporal de lote 2' }] });
  assert.equal(batch.status, 201); assert.equal(batch.body.items.length, 2);
  check('O02 POST lote', { status: 201, elementos: 2 });
  const active = await call('PATCH', `/${id}`, { estado: 'ACTIVO' }); assert.equal(active.status, 200);
  const first = (await database.pool.query('SELECT first_activated_at FROM promociones WHERE id=$1', [id])).rows[0].first_activated_at;
  assert.ok(first instanceof Date);
  const off = await call('PATCH', `/${id}`, { estado: 'INACTIVO' }); assert.equal(off.status, 200); assert.equal(off.body.puedeCambiarModalidad, false);
  check('O03 PATCH y antecedente', { status: 200, first_activated_at: first.toISOString(), puedeCambiarModalidad: false });
  const commercial = await call('GET', '?canal=MARKETPLACE&estado=INACTIVO&vigentes=false', undefined, fixture.LAB_READER_TOKEN);
  assert.equal(commercial.status, 200); assert.ok(commercial.body.items.some(p => p.promotion_id === id));
  check('O05 GET comercial con lector', { status: 200, contieneId: true });
  const page = await call('GET', '/administracion?tamanio=1', undefined, fixture.LAB_READER_TOKEN);
  assert.equal(page.status, 200); assert.equal(page.body.items.length, 1); assert.ok(page.body.meta.total >= 3);
  check('O06 GET administración con lector', { status: 200, meta: page.body.meta });
  const before = await call('GET', `/${id}`); assert.equal(before.status, 200);
  check('O07 GET detalle', { status: 200, promotionId: id });
  for (const item of batch.body.items) {
    const deleted = await call('DELETE', `/${item.promotionId}`); assert.equal(deleted.status, 204); assert.equal(deleted.text, '');
    const absent = await call('GET', `/${item.promotionId}`); assert.equal(absent.status, 404);
  }
  check('O04 DELETE lógico', { status: 204, cuerpo: 'vacío', posterior: 404 });
  await stop();
  const pid2 = await start(); assert.notEqual(pid1, pid2);
  const after = await call('GET', `/${id}`); assert.equal(after.status, 200); assert.deepEqual(after.body, before.body);
  const again = (await database.pool.query('SELECT first_activated_at FROM promociones WHERE id=$1', [id])).rows[0].first_activated_at;
  assert.deepEqual(again, first);
  const blocked = await call('PATCH', `/${id}`, { modalidad: 'CUPON' }); assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'MODALIDAD_BLOQUEADA');
  check('Persistencia tras reinicio de proceso', { pidAntes: pid1, pidDespues: pid2, promotionId: id, detalleIdentico: true, antecedenteIdentico: true, cambioModalidad: 409 });
  const columns = (await database.pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='promociones' ORDER BY ordinal_position")).rows.map(r => r.column_name);
  assert.equal(columns.length, 14);
  check('Modelo físico', { columnas: columns, cantidad: columns.length });
  const info = (await database.pool.query('SELECT current_database() AS base, version() AS version')).rows[0];
  report.postgresql = info;
  report.estado = 'PASS';
} catch (error) {
  // Las excepciones propias no contienen URL/tokens; no serializar errores del driver.
  report.error = error instanceof assert.AssertionError ? { tipo: 'AssertionError', operador: error.operator } : { tipo: error?.code ?? error?.name ?? 'Error' };
  process.exitCode = 1;
} finally {
  await stop();
  await database.onModuleDestroy();
  await writeFile(new URL('evidencias/persistencia.json', root), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
