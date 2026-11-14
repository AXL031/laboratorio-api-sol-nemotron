# Entorno preparado para C-sol-spec — segundo intento

Solo se evalúa GPT-6.1 Sol. Modelo aún NO_EJECUTADO en esta carpeta.
DB aplicación local: 127.0.0.1:55435/lab_promociones.
DB pruebas local: 127.0.0.1:55435/lab_promociones_test.
Puerto HTTP reservado al caso: 3302. Tokens/credenciales son fixtures en .env/.env.test.
PostgreSQL 17 usa imagen por digest, bases/volumen propios; no reutiliza datos del intento anterior.
Las bases de negocio empiezan vacías: debes aplicar tu SQL para crear tablas de promociones.

Comprobar herramientas y ambas conexiones:
node herramientas/comprobar-entorno.mjs

El resultado guardado PRECHECK-ENTORNO.json pertenece a la preparación; no acredita un API implementado.
node_modules y package-lock.json fueron preparados antes de la corrida. Si se pierde node_modules,
usar npm ci --no-audit --no-fund. La descarga desde npm está permitida; no imponer --offline.
El compilador se invoca con npm run build/typecheck y Vitest con npm test/test:e2e.
npm start carga .env; npm run test:e2e carga .env.test, ambos preparados.

Si Docker se cerró, abrir Docker Desktop y ejecutar desde la raíz intento-2:
powershell -ExecutionPolicy Bypass -File herramientas/arrancar-postgres.ps1
No ejecutar docker compose down -v: borraría datos de las nuevas corridas.
Abrir esta carpeta proyecto como proyecto real del cliente para que sea su directorio de trabajo.
El preflight fue ejecutado con permisos locales normales; un sandbox de otro chat puede requerir
elevación para acceder a localhost o al Docker pipe. Un prompt no puede desactivar esas restricciones.
