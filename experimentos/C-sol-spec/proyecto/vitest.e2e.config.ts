import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.e2e.spec.ts'], environment: 'node', fileParallelism: false, testTimeout: 20000, hookTimeout: 30000,
    reporters: ['default', 'json'], outputFile: { json: 'evidencias/e2e.json' } },
});
