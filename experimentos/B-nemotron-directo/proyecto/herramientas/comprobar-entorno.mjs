import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { Pool } from 'pg';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const report = { tipo: 'preflight de entorno; no pruebas del API generado', fecha: new Date().toISOString(), checks: [] };
const check = (name, ok, detail) => report.checks.push({ name, estado: ok ? 'PASS' : 'FAIL', detail });
const env = {};
for (const line of (await read('.env')).split(/\r?\n/)) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line);
  if (match) env[match[1]] = match[2];
}
const testEnv = {};
for (const line of (await read('.env.test')).split(/\r?\n/)) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line);
  if (match) testEnv[match[1]] = match[2];
}
check('Node', Number(process.versions.node.split('.')[0]) === 24, process.version);
for (const [name, script] of [['TypeScript', 'node_modules/typescript/bin/tsc'], ['Vitest', 'node_modules/vitest/vitest.mjs']]) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, root)), '--version'], { cwd: fileURLToPath(root), encoding: 'utf8', timeout: 30000 });
  check(name, result.status === 0, (result.stdout || result.stderr || String(result.error)).trim());
}
try { await import('@nestjs/core'); await import('@nestjs/platform-express'); check('Imports Nest/pg', true, 'Dependencias resueltas desde el proyecto'); }
catch (error) { check('Imports Nest/pg', false, error.message); }
for (const [name, url] of [['PostgreSQL aplicación', env.DATABASE_URL], ['PostgreSQL e2e', testEnv.TEST_DATABASE_URL]]) {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    const info = await client.query('SELECT current_database() AS db, version() AS version');
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE entorno_probe (value integer NOT NULL) ON COMMIT DROP');
    await client.query('INSERT INTO entorno_probe VALUES (42)');
    const result = await client.query('SELECT value FROM entorno_probe');
    await client.query('ROLLBACK');
    check(name, result.rows[0].value === 42, { db: info.rows[0].db, version: info.rows[0].version, escritura_temporal_revertida: true });
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch {} }
    check(name, false, { code: error.code, mensaje: error.message });
  } finally { if (client) client.release(); await pool.end(); }
}
await new Promise(resolve => {
  const server = net.createServer();
  server.once('error', error => { check('Puerto HTTP libre', false, { port: Number(env.PORT), code: error.code }); resolve(); });
  server.listen(Number(env.PORT), '127.0.0.1', () => { check('Puerto HTTP libre', true, Number(env.PORT)); server.close(resolve); });
});
report.package_lock_sha256 = createHash('sha256').update(await readFile(new URL('package-lock.json', root))).digest('hex');
report.estado = report.checks.every(c => c.estado === 'PASS') ? 'PASS' : 'FAIL';
await writeFile(new URL('PRECHECK-ENTORNO.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.estado === 'PASS' ? 0 : 1;
