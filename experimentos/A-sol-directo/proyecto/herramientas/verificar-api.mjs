// Verificación adicional del artefacto compilado en la base de aplicación, sin borrar datos previos.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/lab_promociones') {
  throw new Error('Solo se verifica la base local de aplicación lab_promociones');
}
const port = Number(process.env.PORT ?? 3301);
const base = `http://127.0.0.1:${port}/api/v1/promociones`;
const report = { fecha: new Date().toISOString(), tipo: 'Pruebas HTTP del API compilado y persistencia entre procesos',
  base: url.pathname.slice(1), checks: [], procesos: [], inputs: {} };
const check = (name, passed, evidence) => {
  report.checks.push({ name, estado: passed ? 'PASS' : 'FAIL', evidencia: evidence });
  if (!passed) throw new Error(`Falló ${name}`);
};
const label = `Evidencia ${randomUUID()}`;
const fixture = (name = label) => ({ nombre: name, tipoDescuento: 'PORCENTAJE', valor: 12,
  modalidad: 'AUTOMATICA', estado: 'ACTIVO', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z',
  alcance: { productIds: ['PRD-LAB-001'], skus: ['SKU-LAB-002'] }, prioridad: 2,
  canalesHabilitados: ['MARKETPLACE'], politicaCombinacion: { ofertaPricing: false, promocionAutomatica: false, cupon: true } });
let child;
async function start() {
  child = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('../', import.meta.url),
    env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  report.procesos.push(child.pid);
  let stdout = '', stderr = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('API no inició en 10 segundos')), 10000);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.includes('API académico escuchando')) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`API terminó al iniciar (${code}): ${stderr}`)); });
  });
}
async function stop() {
  if (child && child.exitCode === null && !child.killed) {
    const ended = once(child, 'exit');
    child.kill('SIGTERM');
    await ended;
  }
  child = undefined;
}
async function call(method, path = '', body, token = process.env.LAB_ADMIN_TOKEN) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, text,
    contentType: response.headers.get('content-type') };
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  for (const file of ['contrato/openapi.yaml', 'contrato/openapi.json', 'contrato/contexto.md', 'contrato/catalogo.json',
    'ENTREGA.md', 'ENTORNO.md', 'package.json', 'package-lock.json', 'tsconfig.json']) {
    report.inputs[file] = createHash('sha256').update(await readFile(new URL(`../${file}`, import.meta.url))).digest('hex');
  }
  await start();
  const created = await call('POST', '', fixture());
  check('POST /promociones', created.status === 201 && created.body.puedeCambiarModalidad === false, { status: created.status, promotionId: created.body.promotionId });
  const id = created.body.promotionId;
  const first = (await pool.query('SELECT first_activated_at FROM promotions WHERE id=$1', [id])).rows[0].first_activated_at;
  const batch = await call('POST', '/lote', { items: [fixture(`${label} lote 1`), fixture(`${label} lote 2`)] });
  check('POST /promociones/lote', batch.status === 201 && batch.body.items.length === 2, { status: batch.status, ids: batch.body.items.map(p => p.promotionId) });
  const admin = await call('GET', '/administracion?pagina=1&tamanio=100', undefined, process.env.LAB_READER_TOKEN);
  check('GET /promociones/administracion', admin.status === 200 && admin.body.meta.total >= 3, { status: admin.status, meta: admin.body.meta });
  const commercial = await call('GET', '?canal=MARKETPLACE', undefined, process.env.LAB_READER_TOKEN);
  check('GET /promociones', commercial.status === 200 && commercial.body.items.some(p => p.promotion_id === id && p.status === 'ACTIVA'), { status: commercial.status, ids: commercial.body.items.map(p => p.promotion_id) });
  const detail = await call('GET', `/${id}`, undefined, process.env.LAB_READER_TOKEN);
  check('GET /promociones/{promocionId}', detail.status === 200 && detail.body.alcance.productIds[0] === 'PRD-LAB-001'
    && detail.body.alcance.skus[0] === 'SKU-LAB-002', { status: detail.status, body: detail.body });
  const changed = await call('PATCH', `/${id}`, { nombre: `${label} persistida`, estado: 'INACTIVO' });
  check('PATCH /promociones/{promocionId}', changed.status === 200 && changed.body.puedeCambiarModalidad === false, { status: changed.status, body: changed.body });
  await stop();
  await start();
  const restored = await call('GET', `/${id}`);
  const firstAfter = (await pool.query('SELECT first_activated_at FROM promotions WHERE id=$1', [id])).rows[0].first_activated_at;
  check('Persistencia tras reinicio de proceso Node', restored.status === 200 && JSON.stringify(restored.body) === JSON.stringify(changed.body)
    && first.getTime() === firstAfter.getTime() && report.procesos[0] !== report.procesos[1],
  { promotionId: id, procesos: report.procesos, first_activated_at: firstAfter, registroConservado: true });
  const blocked = await call('PATCH', `/${id}`, { modalidad: 'CUPON' });
  check('Activación histórica sobrevive reinicio', blocked.status === 409 && blocked.body.code === 'MODALIDAD_BLOQUEADA', blocked);
  for (const item of batch.body.items) {
    const deleted = await call('DELETE', `/${item.promotionId}`);
    check('DELETE /promociones/{promocionId}', deleted.status === 204 && deleted.text === '', { status: deleted.status, promotionId: item.promotionId, cuerpo: deleted.text });
    const repeated = await call('DELETE', `/${item.promotionId}`);
    check('Repetir DELETE', repeated.status === 404 && repeated.body.code === 'PROMOCION_NO_ENCONTRADA', repeated);
  }
  const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' ORDER BY ordinal_position");
  check('14 columnas físicas y configuración asociada', columns.rows.length === 14,
    { columnas: columns.rows.map(row => row.column_name), persistida: id });
  report.estado = 'PASS';
} catch (error) {
  report.estado = 'FAIL';
  report.error = { code: error.code, mensaje: error.message };
  process.exitCode = 1;
} finally {
  await stop();
  await pool.end();
  await mkdir(new URL('../../evidencia/', import.meta.url), { recursive: true });
  await writeFile(new URL('../../evidencia/API-PERSISTENCIA.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
