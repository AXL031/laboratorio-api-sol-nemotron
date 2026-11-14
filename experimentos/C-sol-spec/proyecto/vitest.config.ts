import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.unit.spec.ts'], environment: 'node', reporters: ['default', 'json'], outputFile: { json: 'evidencias/unitarias.json' } },
});
