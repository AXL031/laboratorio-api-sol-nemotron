# Avance propio — API académico de Promociones

Fecha: 2026-11-14, America/Lima. Entradas de `documentos/` conservadas sin cambios.

## P01 / T01 — completado

- Proyecto localizado en `proyecto/`; la invocación inicial desde el directorio contenedor falló con MODULE_NOT_FOUND. Se corrigió el directorio, sin modificar entradas.
- Leídos OpenAPI, contexto R01–R17, catálogo, ENTREGA, ENTORNO, spec, plan y tareas.
- Precheck inicial local: Node/TypeScript/Vitest/imports PASS; conexiones PostgreSQL EACCES por sandbox.
- Repetición con elevación autorizada: salida 0, todos los checks PASS, PostgreSQL 17.11, bases `lab_promociones` y `lab_promociones_test`. Esto es infraestructura, no prueba del API.
- Huellas de entradas congeladas: `evidencias/entradas-iniciales.json`.

## P02–P07 / T02–T09 — completados

| Etapa / tareas | Implementación propia | Evidencia |
|---|---|---|
| P02 / T02 | `sql/001_promociones.sql`; 14 columnas principales, configuración JSONB asociada, catálogo local, restricciones y triggers; adaptador `pg` y migrador transaccional con checksum | Migraciones aplicadas en ambas bases, salidas 0 en `evidencias/migracion-app.txt` y `evidencias/migracion-e2e.txt` |
| P03 / T03 | Validación estricta de esquema y R01–R07, calendario con zona, referencias activas, enums, rangos, listas únicas, fusión completa PATCH | 91 pruebas unitarias; inválidos e2e sin filas parciales |
| P04 / T04 | Prefijo `/api/v1`; autenticación por tokens antes del parser JSON/ID; errores Problem con MIME contractual | e2e: JSON malformado e ID inválido producen 401/403 antes de validación; JSON malformado autenticado da 400 |
| P05 / T05–T06 | Alta y lote 1–20, UUID nuevo, nombres repetidos permitidos, configuración completa en la misma transacción | 201 individual/lote; fallo SQL 23514 real en la segunda asociación revierte todas las filas principales/asociadas |
| P06 / T07 | PATCH bloquea fila, relee configuración después del bloqueo, fusiona, valida y guarda; historia protegida por trigger | Concurrencia determinista, activación/desactivación, modalidad 409; reenvío de misma modalidad 200 |
| P07 / T08 | Tres consultas; resumen snake_case, canal/estado/vigencia, filtros administrativos, conteo previo y orden estable | Validación de respuestas contra el OpenAPI congelado y casos de filtros/defaults/páginas vacías |
| P06 / T09 | DELETE lógico con estado INACTIVO e historia conservada; mismo bloqueo de fila que PATCH | 204 sin cuerpo; GET/PATCH/DELETE posteriores 404; listado comercial y admin excluyen borrados; carrera no resucita datos |

Se siguieron las dependencias de `documentos/plan.md` y `documentos/tareas.md`; se implementaron todas sus etapas. Esos documentos permanecen como entradas.

## P08 / T10 — pruebas y corrección propia

1. Primera compilación y typecheck: ambos salida 0. Primera suite: 91 unitarias y 67 e2e aprobadas.
2. Revisión adicional: una lectura conjunta de principal/configuración con `FOR UPDATE OF p` podía retener configuración del snapshot anterior a una espera. Se añadió una prueba determinista que mantiene una transacción externa, modifica alcance/política y confirma que el PATCH espera un bloqueo real observando `pg_stat_activity`.
3. La nueva prueba **falló realmente**, salida 1, mostrando SKU y política antiguos. Se conserva `evidencias/regresion-concurrencia-antes.txt`. No se relajó la aserción ni se retiró la prueba.
4. Corrección: bloquear primero la principal; consultar principal y asociados en una nueva sentencia después del bloqueo, bajo la misma transacción. También se preservan historial de activación y borrado al serializar PATCH/DELETE.
5. Se repitieron build, typecheck, unitarias y la suite e2e completa sobre la corrección. Resultados finales:

| Comando ejecutado | Salida real | Evidencia |
|---|---|---|
| `npm run build` | 0, `tsc -p tsconfig.json` sin errores | `evidencias/build.txt` |
| `npm run typecheck` | 0, `tsc -p tsconfig.json --noEmit` sin errores | `evidencias/typecheck.txt` |
| `npm test` | 0, 1 archivo; **91 passed (91)** | `evidencias/unitarias.txt`, `evidencias/unitarias.json` |
| `npm run test:e2e` | 0, 1 archivo; **68 passed (68)** con PostgreSQL 17.11 | `evidencias/e2e.txt`, `evidencias/e2e.json` |
| `node herramientas/comprobar-persistencia.mjs` | 0, **PASS**, diez comprobaciones del API/migración/modelo | `evidencias/persistencia.txt`, `evidencias/persistencia.json` |

Las pruebas e2e se ejecutaron con elevación para acceder al PostgreSQL local autorizado. No hubo rechazo de elevación ni reinstalación de dependencias. Las 159 pruebas finales son del código propio; el preflight no se cuenta como prueba del API.

### Evidencias de las siete operaciones en la base de aplicación

Última ejecución: 2026-11-14 08:12:47 America/Lima (`13:12:47Z`). Comprobador propio usando HTTP y `dist/main.js` compilado, PostgreSQL `lab_promociones`.

| Operación | Resultado observado |
|---|---|
| O01 POST individual | 201; UUID `13ff2d7f-7929-4708-b501-8e664543901e` |
| O02 POST lote | 201; dos altas ordenadas |
| O03 PATCH | 200; activa y desactiva; antecedente `2026-11-14T13:12:49.701Z` conservado |
| O04 DELETE | 204 vacío para las altas temporales del lote; siguiente GET 404 |
| O05 GET comercial | 200 con lector, canal/estado/tiempo y UUID esperado |
| O06 GET administración | 200 con lector; tamaño 1, conteo total previo a paginar |
| O07 GET detalle | 200; configuración completa idéntica antes/después del reinicio |

El proceso anterior tenía PID 25116; se detuvo y se inició un proceso nuevo con PID 7188. El nuevo proceso leyó la misma promoción, alcance, política e historia desde PostgreSQL. El intento posterior de cambio de modalidad devolvió 409 MODALIDAD_BLOQUEADA. Ambos procesos fueron detenidos por el comprobador. Se verificaron las 14 columnas por `information_schema`. Volver a migrar devolvió `ya aplicada` sin borrar datos.

El comprobador se ejecutó dos veces durante el desarrollo (la segunda sobre la compilación final); quedan dos promociones INACTIVAS de evidencia en la base de aplicación, además de las altas temporales borradas lógicamente. La e2e usa exclusivamente su base separada y la limpia antes de cada caso. No se eliminó el volumen PostgreSQL.

## T11–T12 — documentación y revisión final

- `README.md`: preparación desde bases vacías, migraciones para ambas bases, entorno, autenticación, ejemplos de uso, arranque/reinicio, pruebas y límites.
- `ejemplos/promocion.json`: request válido reutilizable.
- Configuración de Vitest separada; reportes JSON y salidas de consola conservados.
- Entregados `src/main.ts`, resto del API NestJS, SQL, unitarias/e2e, sus configuraciones y herramientas locales propias.
- Integridad de entradas congeladas comprobada por SHA-256 en `evidencias/integridad.json`.
- Sin lectura de otros intentos/proyectos, sin delegación, despliegue, cambios globales ni servicios de negocio externos.

## Limitaciones y estado final

Implementado y verificado: O01–O07, R01–R17 dentro del alcance académico. No queda una etapa requerida sin ejecutar ni un bloqueo de permisos pendiente.

Cupones y usos históricos no se implementan: sus antecedentes están ausentes según R09. El cálculo de capacidad solo representa el estado y antecedente local de activación; no acredita integraciones externas. La persistencia se comprobó tras reinicio del **proceso del API**, no tras reinicio del contenedor PostgreSQL o de la máquina. Se usan exclusivamente catálogo y tokens fixtures. No hay despliegue ni evaluación de descuentos/cestas.
