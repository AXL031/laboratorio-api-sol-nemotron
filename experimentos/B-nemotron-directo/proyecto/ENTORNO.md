# Entorno de Nemotron 3.5 Super VL Free — caso B-nemotron-directo

Modelo OpenCode: opencode/nemotron-3.5-super-vl-free. Usar chat nuevo y seleccionar el modelo antes de enviar el único prompt.
Solo se preparó infraestructura; el modelo todavía no fue ejecutado y no existe implementación.
HTTP local: 3303. PostgreSQL local: 127.0.0.1:55436.
DB aplicación: lab_promociones. DB e2e: lab_promociones_test.
.env/.env.test contienen únicamente fixtures locales. Las bases empiezan sin tablas de negocio.

Misma base, versiones exactas, lock, reglas, catálogo y OpenAPI que los casos Sol, sin copiar sus soluciones.
Este caso no recibe spec/plan/tareas; implementar directamente desde el contrato y el contexto.
No leer carpetas de Sol ni otros casos, informes, respuestas o pruebas ajenas.

Preflight: node herramientas/comprobar-entorno.mjs.
Dependencias instaladas antes de la corrida. Restaurar con npm ci --no-audit --no-fund si se necesitan;
no imponer --offline. npm start carga .env y npm run test:e2e carga .env.test.
Si Docker se cierra: ejecutar nemotron/herramientas/arrancar-postgres.ps1 desde la raíz del laboratorio.
No usar los contenedores de Sol ni sus puertos; no borrar volúmenes.
Los permisos del cliente siguen aplicándose. Un preflight no equivale a pruebas del API.
