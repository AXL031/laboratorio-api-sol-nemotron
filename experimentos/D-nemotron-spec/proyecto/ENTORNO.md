# Entorno de Nemotron 3.5 Super VL Free — caso D-nemotron-spec

Modelo OpenCode: opencode/nemotron-3.5-super-vl-free. Usar chat nuevo y seleccionar el modelo antes de enviar el único prompt.
Solo se preparó infraestructura; el modelo todavía no fue ejecutado y no existe implementación.
HTTP local: 3304. PostgreSQL local: 127.0.0.1:55437.
DB aplicación: lab_promociones. DB e2e: lab_promociones_test.
.env/.env.test contienen únicamente fixtures locales. Las bases empiezan sin tablas de negocio.

Misma base, versiones exactas, lock, reglas, catálogo y OpenAPI que los casos Sol, sin copiar sus soluciones.
documentos/ tiene copias EXACTAS de la spec/plan/tareas de entrada de Sol. Sus etiquetas históricas se refieren a la procedencia; el modelo actual es Nemotron. No regenerar ni editar esos archivos.
No leer carpetas de Sol ni otros casos, informes, respuestas o pruebas ajenas.

Preflight: node herramientas/comprobar-entorno.mjs.
Dependencias instaladas antes de la corrida. Restaurar con npm ci --no-audit --no-fund si se necesitan;
no imponer --offline. npm start carga .env y npm run test:e2e carga .env.test.
Si Docker se cierra: ejecutar nemotron/herramientas/arrancar-postgres.ps1 desde la raíz del laboratorio.
No usar los contenedores de Sol ni sus puertos; no borrar volúmenes.
Los permisos del cliente siguen aplicándose. Un preflight no equivale a pruebas del API.
