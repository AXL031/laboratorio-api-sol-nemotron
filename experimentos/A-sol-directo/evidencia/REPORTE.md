# Entrega A-sol-directo

Ejecución del 14 de noviembre de 2026, hora de Lima. Implementación directa en `proyecto/`,
sin fase previa de spec/plan/tareas, sin delegación, sin despliegue ni servicios de negocio externos.

## Resultado del código

| Comando ejecutado desde `proyecto/` | Salida real / resultado | Exit |
| --- | --- | --- |
| `npm run build` | TypeScript terminó sin diagnósticos; [salida](build.log) | 0 |
| `npm run typecheck` | TypeScript terminó sin diagnósticos; [salida](typecheck.log) | 0 |
| `npm test` | 1 archivo, **87 pruebas passed**; [salida](unitarias.log) | 0 |
| `npm run test:e2e` | 1 archivo, **59 pruebas passed**, PostgreSQL real; [salida](e2e.log) | 0 |
| `node node_modules/typescript/bin/tsc -p tsconfig.tests.json` | Sin diagnósticos; incluye fuentes, pruebas y configuraciones; `typecheck-tests.log` (archivo no disponible en la publicación) | 0 |
| `node --env-file=.env herramientas/migrar.mjs` | Esquema de negocio creado: 14 columnas y 0 promociones antes de probar. Reaplicación posterior: 14 columnas y 3 promociones conservadas; [salida de reaplicación](migracion-app.log) | 0 |
| `node --env-file=.env herramientas/verificar-api.mjs` | Siete operaciones por HTTP y persistencia entre procesos: **PASS**; [evidencia completa](API-PERSISTENCIA.json) | 0 |

El build, typecheck y ambas suites se ejecutaron primero durante la implementación y se
repitieron para conservar las salidas en los logs anteriores. No hubo fallos de código en esas
ejecuciones ni se deshabilitaron pruebas. Las 59 e2e crean el esquema antes de probar y usan
exclusivamente `lab_promociones_test`; no son el preflight de infraestructura.

## Evidencia funcional

La comprobación adicional ejecutó `dist/main.js` con las variables de `.env`, en el puerto 3301:

| Operación | HTTP observado |
| --- | --- |
| POST `/api/v1/promociones` | 201 |
| POST `/api/v1/promociones/lote` | 201, dos UUID diferentes y respuesta en orden |
| GET `/api/v1/promociones/administracion` | 200, total=3 y metadatos de paginación |
| GET `/api/v1/promociones?canal=MARKETPLACE` | 200, tres resúmenes ACTIVA |
| GET `/api/v1/promociones/{promocionId}` | 200, conserva productId y SKU |
| PATCH `/api/v1/promociones/{promocionId}` | 200, conserva lo omitido y cambia nombre/estado |
| DELETE `/api/v1/promociones/{promocionId}` | 204 sin cuerpo; repetición 404 |

Se creó y activó `343e47d0-7827-4b52-a31d-6a9b213be13b`, después se desactivó mediante PATCH.
Al detener el proceso Node **18692** e iniciar el **17588**, el GET devolvió exactamente la misma
configuración. `first_activated_at` siguió siendo `2026-11-14T12:54:25.000Z`, y cambiar modalidad
siguió devolviendo 409 `MODALIDAD_BLOQUEADA` con `application/problem+json`.
El script detuvo también el segundo proceso al finalizar; no queda servidor de prueba arrancado.

La base de aplicación conserva una promoción INACTIVO de evidencia y las dos promociones del lote
con borrado lógico. La reaplicación del SQL conservó las tres filas físicas. La base e2e permanece
independiente. La suite e2e comprueba además:

- Autenticación de las siete rutas antes del JSON/UUID; 401, 403 y 400 diferenciados.
- Rechazo 422 de esquemas y referencias inválidas; respuestas sin auditoría ni credenciales.
- Fusión de PATCH y reemplazo completo de objetos/listas; validación de la entidad resultante.
- Activación histórica, desactivación, reactivación, modalidad bloqueada y misma modalidad permitida.
- Dos PATCH concurrentes sin perder campos omitidos.
- Límites 1/20 del lote, orden de entrada y cero escrituras ante validación inválida.
- **Rollback real**: un trigger temporal falla en la segunda inserción y ninguna de las dos tablas
  conserva la primera; se comprueba el 500 saneado y se retira el trigger en `finally`.
- Paginación, conteos filtrados, páginas vacías y desempate por UUID cuando created_at coincide.
- Canal, estado, vigencia y representación comercial; borrado lógico excluido de todas las consultas.
- Cierre del pool y reconstrucción de la aplicación sin perder el antecedente de activación.

## Archivos producidos

- `proyecto/src/main.ts`, `app.ts`: arranque y módulo NestJS, autenticación anterior al parser.
- `proyecto/src/promotions.controller.ts`, `promotions.service.ts`: las siete operaciones y persistencia.
- `proyecto/src/database.ts`, `validation.ts`, `problem.ts`: transacciones, validación y errores.
- `proyecto/sql/001-promociones.sql`: tablas, restricciones e índices de negocio reproducibles.
- `proyecto/test/fixture.ts`, `validation.unit.spec.ts`, `promotions.e2e.spec.ts`: pruebas propias.
- `proyecto/vitest.config.ts`, `vitest.e2e.config.ts`, `tsconfig.tests.json`: configuraciones añadidas.
- `proyecto/herramientas/migrar.mjs`, `verificar-api.mjs`, `verificar-entradas.mjs`: ejecución reproducible.
- `proyecto/README.md`: instrucciones, uso, persistencia, pruebas y límites.
- `evidencia/`: este reporte, logs, evidencia HTTP/persistencia y hashes iniciales/finales.
- `proyecto/dist/`: artefactos JavaScript y sourcemaps generados por `npm run build`.

`ENTRADAS-INICIALES.json` transcribe los SHA-256 obtenidos antes de implementar;
`herramientas/verificar-entradas.mjs` los compara con los archivos finales y escribe
`ENTRADAS-FINALES.json`. Los hashes de esas entradas también están en la evidencia HTTP.
No se cambiaron `package.json`, `package-lock.json`, `tsconfig.json`, contrato ni condiciones de entrega.
No se reinstalaron dependencias.

## Incidencias de entorno y límites

El primer comando se lanzó desde la carpeta contenedora del caso, donde no existe
`herramientas/comprobar-entorno.mjs`: terminó con MODULE_NOT_FOUND. Se localizó `proyecto/`
dentro del mismo caso y se ejecutó inmediatamente desde allí, sin leer otros proyectos.

El precheck correcto desde `proyecto/` reconoció Node, TypeScript, Vitest y Nest, pero el sandbox
denegó ambas conexiones a `127.0.0.1:55434` con **EACCES**. Se solicitó la elevación autorizada
por el usuario y el mismo comando terminó con exit 0 y todos los checks de infraestructura PASS
en `proyecto/PRECHECK-ENTORNO.json`. Se usó elevación para migraciones y pruebas locales de red;
no hubo rechazo de permisos ni bloqueo pendiente. Ese precheck **no se contabiliza como prueba del API**.

Conforme a R09 no hay cupones ni usos históricos: sus antecedentes empiezan ausentes y no se
inventan rutas para modificarlos. El historial de activación sí está persistido y probado.
Catálogo y tokens son fixtures académicos. No hay pricing, evaluación de cestas, JWT, integración
de seguridad ni despliegue. Las fechas usan precisión de milisegundos de JavaScript y la prioridad
se limita a enteros seguros de JavaScript. La persistencia comprobada fue entre instancias y
procesos del API; no se reinició el contenedor de PostgreSQL durante esta ejecución.


## Nota editorial de publicación

El reporte original menciona `typecheck-tests.log`, pero ese archivo no estaba entre las evidencias disponibles. No se generó un log sustituto. El comando adicional de tipado de pruebas se conserva como afirmación del reporte; la tabla principal del README se apoya en los logs de build/typecheck/unit/e2e que sí están incluidos.
