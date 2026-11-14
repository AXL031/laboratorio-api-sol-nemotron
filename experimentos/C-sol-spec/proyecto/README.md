# API académico de Promociones

API NestJS/TypeScript con las siete operaciones de `contrato/openapi.yaml` y PostgreSQL local real. Implementa R01–R17 de `contrato/contexto.md` siguiendo las dependencias de los documentos preparados. El avance, resultados y corrección de una carrera de concurrencia están en `AVANCE.md`.

## Preparar y ejecutar

Ejecutar los comandos **dentro de `proyecto/`**. Se requieren Node 24, las dependencias fijadas y PostgreSQL 17 del laboratorio en `127.0.0.1:55435`. Los archivos `.env` y `.env.test` ya contienen los fixtures locales; no se necesita otro servicio.

```powershell
node herramientas/comprobar-entorno.mjs
npm run build
node --env-file=.env herramientas/migrar.mjs
node --env-file=.env.test herramientas/migrar.mjs --test
npm start
```

El API escucha en `http://127.0.0.1:3302/api/v1`. `npm start` carga `.env` y ejecuta `dist/main.js`. Para detenerlo, usar Ctrl+C. Para reiniciarlo, ejecutar otra vez `npm start`: los datos permanecen en PostgreSQL. El arranque no borra ni recrea tablas y no aplica migraciones implícitas.

Las dependencias están instaladas. Solo si es necesario restaurarlas, ejecutar `npm ci --no-audit --no-fund`, que utiliza el lock existente. No se modificaron `package.json`, `package-lock.json` ni `tsconfig.json`.

Si el sandbox informa `EACCES`/`EPERM` al conectar a localhost, repetir la herramienta mediante la elevación del cliente. Ese error no significa que PostgreSQL o el compilador estén ausentes. La comprobación inicial del entorno es independiente de las pruebas del API.

## Configuración local

| Variable | Uso |
|---|---|
| `DATABASE_URL` de `.env` | Base de aplicación `lab_promociones` |
| `TEST_DATABASE_URL` de `.env.test` | Base e2e `lab_promociones_test` |
| `PORT` | Puerto de aplicación reservado, 3302 |
| `LAB_ADMIN_TOKEN` | Bearer del administrador local |
| `LAB_READER_TOKEN` | Bearer del lector local |
| `LAB_ALLOW_E2E_RESET` | Debe ser `SI_SOLO_BASE_DE_PRUEBAS` para permitir la limpieza e2e |

Los dos tokens deben ser distintos, no vacíos y sin espacios. No se incluyen sus valores en los reportes. El adaptador rechaza hosts, puertos y bases ajenos a los asignados al laboratorio. Las pruebas nunca recurren a la base de aplicación si falta `TEST_DATABASE_URL`.

## Operaciones

Todas requieren `Authorization: Bearer <token-local>`. Administrador y lector pueden realizar las tres consultas; las escrituras requieren administrador.

| Método y ruta relativa a `/api/v1` | Resultado |
|---|---|
| `POST /promociones` | 201, configuración administrativa completa |
| `POST /promociones/lote` | 201, `{items:[...]}` en el orden recibido, entre 1 y 20 |
| `PATCH /promociones/{promocionId}` | 200, configuración fusionada y validada |
| `DELETE /promociones/{promocionId}` | 204 sin cuerpo; eliminación lógica |
| `GET /promociones?canal=MARKETPLACE` | 200, `{items:[PromocionResumen]}` |
| `GET /promociones/administracion` | 200, `{items:[PromocionAdmin],meta:{...}}` |
| `GET /promociones/{promocionId}` | 200, configuración administrativa |

Ejemplo en PowerShell, con el servidor abierto en otra terminal:

```powershell
$fixture = Get-Content .env -Raw | ConvertFrom-StringData
$cabeceras = @{ Authorization = "Bearer $($fixture.LAB_ADMIN_TOKEN)" }
$url = 'http://127.0.0.1:3302/api/v1/promociones'
$creada = Invoke-RestMethod -Method Post -Uri $url -Headers $cabeceras -ContentType 'application/json' -Body (Get-Content ejemplos/promocion.json -Raw)
Invoke-RestMethod -Method Get -Uri "$url/$($creada.promotionId)" -Headers $cabeceras
Invoke-RestMethod -Method Patch -Uri "$url/$($creada.promotionId)" -Headers $cabeceras -ContentType 'application/json' -Body '{"nombre":"Otro nombre"}'
Invoke-RestMethod -Method Get -Uri "$url/administracion?pagina=1&tamanio=20" -Headers $cabeceras
Invoke-RestMethod -Method Get -Uri "${url}?canal=MARKETPLACE&estado=INACTIVO&vigentes=false" -Headers $cabeceras
```

El cuerpo de lote es `{ "items": [ <promoción completa>, ... ] }`. Para eliminar una promoción, usar `Invoke-WebRequest -Method Delete -Uri "$url/$($creada.promotionId)" -Headers $cabeceras`. Después, GET/PATCH/DELETE con ese ID dan 404.

El listado comercial exige `canal`; sus defaults son `estado=ACTIVO` y `vigentes=true`. `vigentes=false` omite solo el filtro temporal. La vigencia es `[validFrom, validUntil)`. Su resumen contiene exactamente `promotion_id`, `name`, `status` (`ACTIVA`/`INACTIVA`), `valid_from`, `valid_until` y `channels`.

Administración acepta `pagina=1`, `tamanio=20` (máximo 100), `estado` y `modalidad`. Cuenta resultados filtrados antes de paginar; ordena por `created_at ASC, id ASC`. Una consulta sin resultados tiene `totalPaginas=0`.

PATCH conserva campos omitidos y sustituye completamente cada objeto o lista enviados. La entidad resultante se valida de nuevo. Un objeto parcial de política no se completa con el persistido. Las identidades productId y SKU se conservan por separado y se comprueban contra `contrato/catalogo.json`.

`puedeCambiarModalidad` es calculado: solo vale true para una promoción INACTIVA que nunca fue activada, con los antecedentes de cupones/usos ausentes en este laboratorio. Una primera activación queda registrada para siempre. Desactivar no desbloquea la modalidad. Reenviar la modalidad actual es válido.

## Errores

Los errores previstos usan `application/problem+json` con `status`, `code`, `title` y, opcionalmente, `detail`. No contienen stacks, mensajes del driver ni credenciales.

| Situación | HTTP / código |
|---|---|
| Token ausente o incorrecto | 401 `NO_AUTENTICADO` |
| Lector intenta escribir | 403 `NO_AUTORIZADO` |
| JSON malformado, UUID o query inválidos | 400 `VALIDACION` |
| JSON válido con entidad, fragmento o lote inválido | 422 `VALIDACION` |
| ID inexistente o eliminado | 404 `PROMOCION_NO_ENCONTRADA` |
| Cambio real de modalidad bloqueado | 409 `MODALIDAD_BLOQUEADA` |

La autenticación se ejecuta antes del parser JSON y del análisis del identificador. Por eso una escritura del lector con JSON malformado sigue devolviendo 403 y una petición sin token devuelve 401.

## SQL y consistencia

`sql/001_promociones.sql` contiene el esquema y los fixtures de catálogo propios. `herramientas/migrar.mjs` lo aplica en una transacción, con bloqueo asesor y registro de checksum en `lab_schema_migrations`. Repetir el comando devuelve `ya aplicada` y conserva datos. Si se altera SQL ya aplicado, la migración se detiene: una evolución debe introducir una nueva migración, no sobrescribir historia.

`promociones` tiene exactamente las 14 columnas requeridas: `id`, `name`, `discount_type`, `discount_value`, `modality`, `state`, `valid_from`, `valid_until`, `priority`, `enabled_channels`, `first_activated_at`, `created_at`, `updated_at`, `deleted_at`. `promocion_configuracion` persiste alcance y política como JSONB, vinculados por clave foránea; las identidades y la ausencia de una lista opcional se conservan. Las dos tablas de catálogo reflejan el fixture congelado.

Hay restricciones de rangos, fechas, enums, canales únicos, estructura de configuración y referencias activas. Un trigger diferible impide confirmar promociones sin configuración. Otro conserva la primera activación, calcula auditoría y bloquea cambios históricos de modalidad incluso ante SQL directo.

Cada alta y todos los elementos de un lote se confirman en una única conexión/transacción. Los errores revierten también los asociados. PATCH y DELETE bloquean primero la fila principal con `FOR UPDATE`; una sentencia posterior lee su configuración bajo un snapshot nuevo antes de fusionar. Así no se pierden cambios asociados confirmados durante una espera de bloqueo. El conteo y página administrativa comparten una transacción de lectura `REPEATABLE READ`.

## Verificación reproducible

```powershell
npm run build
npm run typecheck
npm test
npm run test:e2e
node herramientas/comprobar-persistencia.mjs
```

La suite e2e aplica la migración si hace falta y limpia **solo** `lab_promociones_test` antes de cada caso. Valida el nombre de base, el flag explícito y la separación respecto de `.env` antes de hacer `TRUNCATE`. No ejecutar e2e sobre datos que deban conservarse en esa base de pruebas.

El comprobador de persistencia controla dos procesos hijos reales de `dist/main.js`, verifica las siete operaciones en `lab_promociones` y reinicia entre escrituras y lecturas. Conserva una promoción INACTIVA como evidencia y elimina lógicamente las dos creadas por lote. No se apropia de un servidor existente ni lo termina; el puerto 3302 debe estar libre. Al finalizar detiene sus procesos. Puede repetirse y conserva las evidencias anteriores en la base, reemplazando el reporte de la última ejecución.

Resultados reales de esta entrega:

| Comando | Resultado |
|---|---|
| `npm run build` | salida 0 |
| `npm run typecheck` | salida 0 |
| `npm test` | salida 0; 91/91 pruebas |
| `npm run test:e2e` | salida 0; 68/68 pruebas con PostgreSQL real |
| `node herramientas/comprobar-persistencia.mjs` | salida 0; siete operaciones, 14 columnas y reinicio de proceso comprobados |

Salidas en `evidencias/*.txt`; reportes estructurados en `evidencias/unitarias.json`, `evidencias/e2e.json` y `evidencias/persistencia.json`. La regresión de concurrencia falló antes de la corrección y su salida se conserva en `evidencias/regresion-concurrencia-antes.txt`. El reporte final está en `AVANCE.md`.

## Archivos y alcance académico

- `src/main.ts`, `src/app.ts`: arranque, configuración Nest, autenticación y parser.
- `src/promotions.controller.ts`: las siete operaciones.
- `src/domain.ts`, `src/problem.ts`: reglas, consultas, representaciones y errores.
- `src/database.ts`, `src/promotions.repository.ts`: migración, PostgreSQL y transacciones.
- `sql/001_promociones.sql`: SQL reproducible de negocio.
- `test/`: fixtures, validación independiente de respuestas contra OpenAPI, unitarias y e2e.
- `vitest.config.ts`, `vitest.e2e.config.ts`: configuración de pruebas y reportes.
- `herramientas/migrar.mjs`, `herramientas/comprobar-persistencia.mjs`: ejecución local reproducible.
- `ejemplos/promocion.json`, `AVANCE.md`, `evidencias/`: ejemplo, trazabilidad y resultados.

Este API usa tokens y catálogo de laboratorio. No implementa cupones, usos, evaluación de cestas, precios, integraciones externas ni despliegue. El antecedente de activación sí se persiste y comprueba. La prueba de persistencia reinicia el proceso del API, no el contenedor PostgreSQL ni el equipo. No se modificaron las entradas congeladas ni se utilizaron otros agentes o proyectos.
