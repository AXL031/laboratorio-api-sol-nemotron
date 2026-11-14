# API académico de Promociones

Implementación directa de `contrato/openapi.yaml` y `contrato/contexto.md`, con NestJS 12,
TypeScript y PostgreSQL 17 local. La base HTTP es `http://127.0.0.1:3301/api/v1`.
No se modificaron las entradas del caso, el manifiesto, el lock ni el tsconfig original.

## Reproducir

Ejecutar desde esta carpeta `proyecto/`, con Node 24 y PostgreSQL local preparado según `ENTORNO.md`:

```powershell
node herramientas/comprobar-entorno.mjs
node --env-file=.env herramientas/migrar.mjs
npm run build
npm run typecheck
npm test
npm run test:e2e
npm start
```

El precheck solo verifica infraestructura. El API se comprueba con las suites y el script descrito abajo.
Las dependencias están instaladas; si fuera necesario restaurarlas, usar
`npm ci --no-audit --no-fund`, conservando el lock. No se necesita ningún servicio de negocio externo.

`npm start` carga `.env`: `DATABASE_URL`, `LAB_ADMIN_TOKEN`, `LAB_READER_TOKEN`, `PORT`.
Los dos tokens deben existir y ser distintos. El servidor escucha únicamente en `127.0.0.1`.
En este laboratorio el puerto es 3301. Ante `EACCES`/`EPERM` de localhost, ejecutar el mismo
comando con los permisos locales autorizados por el usuario; no implica que PostgreSQL falte.

## Operaciones

Todas requieren `Authorization: Bearer <token del entorno>`.

| Método y ruta bajo `/api/v1` | Acceso | Resultado |
| --- | --- | --- |
| POST `/promociones` | ADMIN | 201, PromocionAdmin |
| POST `/promociones/lote` | ADMIN | 201, `{items:[...]}` en orden de entrada |
| GET `/promociones/administracion` | LECTOR o ADMIN | 200, `{items,meta}` |
| GET `/promociones?canal=MARKETPLACE` | LECTOR o ADMIN | 200, resumen comercial |
| GET `/promociones/{promocionId}` | LECTOR o ADMIN | 200, PromocionAdmin |
| PATCH `/promociones/{promocionId}` | ADMIN | 200, PromocionAdmin |
| DELETE `/promociones/{promocionId}` | ADMIN | 204, sin cuerpo |

No hay rutas adicionales de negocio. Crear admite exactamente los once campos del contrato:

```json
{
  "nombre": "Promoción académica",
  "tipoDescuento": "PORCENTAJE",
  "valor": 15,
  "modalidad": "AUTOMATICA",
  "estado": "INACTIVO",
  "validFrom": "2026-01-01T00:00:00-05:00",
  "validUntil": "2027-01-01T00:00:00-05:00",
  "alcance": { "productIds": ["PRD-LAB-001"], "skus": ["SKU-LAB-001"] },
  "prioridad": 1,
  "canalesHabilitados": ["MARKETPLACE", "CHATBOT"],
  "politicaCombinacion": { "ofertaPricing": false, "promocionAutomatica": true, "cupon": false }
}
```

El lote envuelve entre 1 y 20 creaciones en `{ "items": [...] }`. Los nombres repetidos son válidos.
`PATCH` admite un fragmento no vacío: conserva campos omitidos y sustituye objetos/listas completos.
Después valida toda la entidad fusionada. Las fechas requieren zona y se devuelven normalizadas a UTC.
`alcance` conserva productIds y SKUs independientemente, usando solo referencias activas del catálogo congelado.

Administración usa `pagina=1`, `tamanio=20` por defecto (máximo 100), y filtros exactos `estado` y
`modalidad`. Ordena por `created_at ASC, id ASC`. El conteo y la página usan un único snapshot SQL.
El listado comercial requiere `canal`, usa `estado=ACTIVO` y `vigentes=true` por defecto.
La vigencia es `valid_from <= ahora < valid_until`; `vigentes=false` omite solo ese filtro.
Su representación es `promotion_id`, `name`, `status` (`ACTIVA`/`INACTIVA`), `valid_from`,
`valid_until`, `channels`.

La autorización se procesa antes del parser JSON y del identificador. Sin token válido: 401;
lector escribiendo: 403. JSON malformado, UUID o query inválida: 400 `VALIDACION`.
Entrada de creación/PATCH/lote inválida: 422 `VALIDACION`. Todos los errores usan
`application/problem+json`, con `status`, `code`, `title` y, si corresponde, `detail`.
Los errores internos se presentan como 500 `ERROR_INTERNO`, sin stack ni credenciales.

## SQL y persistencia

`sql/001-promociones.sql` es una migración de negocio idempotente y transaccional. Un bloqueo
asesor evita carreras entre ejecuciones de la migración. El script `herramientas/migrar.mjs`
restringe su destino a las dos bases locales del caso; no elimina ni reinicia datos.
El arranque normal presupone que se aplicó la migración.

`promotions` conserva exactamente las 13 columnas físicas requeridas más `deleted_at`:
`id`, `name`, `discount_type`, `discount_value`, `modality`, `state`, `valid_from`, `valid_until`,
`priority`, `enabled_channels`, `first_activated_at`, `created_at`, `updated_at`, `deleted_at`.
`promotion_configuration` guarda el alcance y la política como JSONB asociados por clave foránea.
No se convierten productIds a SKUs. Los índices cubren orden, filtros y pertenencia a canales.
Los parámetros SQL se pasan separados de la sentencia.

Cada creación usa UUID nuevo. Cada creación individual y cada lote usan una transacción real,
incluyendo las configuraciones. Un fallo revierte todas las inserciones del lote.
`PATCH` bloquea la fila mediante `FOR UPDATE` antes de fusionar, validar y escribir; evita pérdida
de actualizaciones y carreras con el borrado. Crear ACTIVO o activar con PATCH fija
`first_activated_at` una vez. Desactivar, reactivar y eliminar conservan ese antecedente.
Un cambio real de modalidad requiere que el estado persistido previo sea INACTIVO y nunca
haya sido activado. Reenviar la misma modalidad es válido; un cambio bloqueado devuelve
409 `MODALIDAD_BLOQUEADA`.

DELETE marca `deleted_at`, cambia el estado a INACTIVO y conserva los datos. Los eliminados
se excluyen de las tres consultas. Repetir DELETE, GET o PATCH sobre uno devuelve
404 `PROMOCION_NO_ENCONTRADA`.

## Pruebas y evidencia

```powershell
npm test
npm run test:e2e
node node_modules/typescript/bin/tsc -p tsconfig.tests.json
# Con npm start detenido y el puerto 3301 libre:
node --env-file=.env herramientas/verificar-api.mjs
```

`vitest.config.ts` selecciona solo unitarias. `vitest.e2e.config.ts` selecciona solo e2e.
`npm run test:e2e` carga `.env.test`; crea las tablas con el SQL propio y trunca únicamente
`promotions` y `promotion_configuration` en `lab_promociones_test` antes de cada prueba.
La suite rechaza cualquier reset sin `LAB_ALLOW_E2E_RESET=SI_SOLO_BASE_DE_PRUEBAS`, sin igualdad
de DATABASE_URL y TEST_DATABASE_URL, si la base coincide con `.env`, o si no es la base local de pruebas.
No toca datos de la aplicación.

Las suites cubren validación, identidad del catálogo, auth de las siete rutas, paginación y filtros,
formas de respuesta, PATCH fusionado, historial de activación, concurrencia, borrado lógico y
persistencia al reconstruir la aplicación. Para demostrar rollback real se instala temporalmente
un trigger en la base e2e que falla durante la segunda inserción del lote; luego se comprueba
que ambas tablas están vacías y se elimina el trigger en `finally`.

`verificar-api.mjs` inicia el artefacto compilado, prueba las siete operaciones por HTTP real,
detiene el proceso, inicia otro y comprueba datos y activación histórica. Usa `.env` y conserva
una promoción INACTIVO identificada como evidencia; elimina lógicamente las dos del lote.
No borra registros anteriores. Escribe `../evidencia/API-PERSISTENCIA.json`, con estados HTTP,
UUID, procesos y hashes de las entradas. El servidor de la comprobación se detiene al terminar.

Los resultados reales de esta ejecución y sus salidas están en `../evidencia/REPORTE.md`
y los archivos que enlaza. El precheck no se cuenta como prueba del API.

## Límites del laboratorio

No se implementan cupones ni usos históricos, conforme a R09: ambos antecedentes empiezan
ausentes y no hay operaciones para modificarlos. `puedeCambiarModalidad` considera estado e
historial de activación; no acredita integración con sistemas de cupones o usos.
El catálogo y los tokens son fixtures locales. No hay JWT, Seguridad, Supabase, pricing,
evaluación de cestas, mensajería ni despliegue. Estas simplificaciones no cambian el contrato
oficial de ningún proyecto externo. Las fechas se procesan con la precisión de milisegundos
de Date de JavaScript; la prioridad usa enteros seguros de JavaScript.
