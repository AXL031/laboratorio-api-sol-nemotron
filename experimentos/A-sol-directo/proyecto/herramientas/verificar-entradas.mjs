import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const expected = JSON.parse(await readFile(new URL('../../evidencia/ENTRADAS-INICIALES.json', import.meta.url), 'utf8'));
const checks = [];
for (const [file, before] of Object.entries(expected)) {
  const after = createHash('sha256').update(await readFile(new URL(`../${file}`, import.meta.url))).digest('hex');
  checks.push({ archivo: file, antes: before, despues: after, estado: before === after ? 'PASS' : 'FAIL' });
}
const report = { fecha: new Date().toISOString(), checks, estado: checks.every(c => c.estado === 'PASS') ? 'PASS' : 'FAIL' };
await writeFile(new URL('../../evidencia/ENTRADAS-FINALES.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.estado !== 'PASS') process.exitCode = 1;
