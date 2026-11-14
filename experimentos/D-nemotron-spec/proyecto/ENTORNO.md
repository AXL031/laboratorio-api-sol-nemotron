# Preparación de Nemotron — D-nemotron-spec

Este proyecto público contiene entradas iniciales; no incluye trabajo en curso ni resultados de Nemotron.
Modelo: opencode/nemotron-3.5-super-vl-free. Un chat nuevo y un solo prompt por caso.
Ejecutar desde la raíz del clon docker compose -f nemotron/infra/compose.yaml up -d --wait,
usando la imagen por digest indicada en el README principal, disponible tras docker pull.
Copiar .env.example a .env y .env.test.example a .env.test, ejecutar npm ci y después
node herramientas/comprobar-entorno.mjs antes de enviar el prompt.
PostgreSQL local 55437; bases separadas lab_promociones y lab_promociones_test. HTTP 3304.
Las dependencias y reglas corresponden a la misma base de Sol. El agente debe crear su propio API y SQL.
Los permisos de terminal/sandbox siguen gobernados por el cliente. No usar datos ni servicios externos de negocio.
