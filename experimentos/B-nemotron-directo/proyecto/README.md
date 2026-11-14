# API Académica — Promociones (Nemotron 3.5 Super VL Free, directo)

Caso: **B-nemotron-directo** — Enfoque DIRECTO desde contrato/contexto.

## Estructura

```
src/
  main.ts                 # Punto de entrada NestJS
  app.module.ts           # Módulo raíz
  common/
    problem.exception.ts  # Excepción Problem+JSON
    problem-exception.filter.ts  # Filtro global de errores
    auth.guard.ts         # Guard de autenticación por bearer token (fixture)
    validators.ts         # Validación de esquemas y reglas de negocio (R01-R16)
  promociones/
    promociones.controller.ts   # 7 operaciones REST
    promociones.service.ts      # Lógica de negocio y reglas R01-R16
    promociones.repository.ts   # Acceso a PostgreSQL (pg Pool)
    promociones.module.ts       # Módulo con inyección de dependencias
sql/
  01-schema.sql           # DDL de tablas de negocio (14 columnas + hijas)
src/**/*.spec.ts          # Pruebas unitarias (vitest)
src/**/*.e2e-spec.ts      # Pruebas e2e contra PostgreSQL real (vitest)
vitest.config.ts          # Config pruebas unitarias
vitest.e2e.config.ts      # Config pruebas e2e
```

## Siete operaciones implementadas

| Método | Ruta | Operación | Rol |
|--------|------|-----------|-----|
| POST | `/promociones` | crearPromocion | ADMIN |
| POST | `/promociones/lote` | crearPromocionesLote | ADMIN |
| GET | `/promociones` | listarPromociones | LECTOR_O_ADMIN |
| GET | `/promociones/administracion` | listarPromocionesAdmin | LECTOR_O_ADMIN |
| GET | `/promociones/{promocionId}` | obtenerPromocionAdmin | LECTOR_O_ADMIN |
| PATCH | `/promociones/{promocionId}` | actualizarPromocion | ADMIN |
| DELETE | `/promociones/{promocionId}` | eliminarPromocionLab | ADMIN |

## Reglas de negocio implementadas

- **R01**: nombre no vacío, ≤160 chars, no solo espacios; tipoDescuento PORCENTAJE/MONTO_FIJO; valor > 0; si PORCENTAJE, valor ≤ 100; rechazar no finitos.
- **R02**: fechas ISO 8601 con zona; validFrom < validUntil; vigente si validFrom ≤ ahora < validUntil.
- **R03**: alcance con al menos un productId o SKU activo de catalogo.json; sin duplicados; inexistentes/inactivos → 422.
- **R04**: modalidad AUTOMATICA/CUPON; estado ACTIVO/INACTIVO; prioridad entero ≥ 1.
- **R05**: canalesHabilitados explícitos, no vacíos, sin duplicados, solo canales del contrato.
- **R06**: politicaCombinacion con 3 booleanos obligatorios.
- **R07**: PATCH conserva omitidos, reemplaza presentes; validar entidad fusionada; vacío o desconocidos → 422; solo lectura no admite entrada.
- **R08**: crear ACTIVO o pasar a ACTIVO registra first_activated_at una vez; desactivar conserva antecedente; puedeCambiarModalidad solo si INACTIVO y nunca activada; cambio real bloqueado → 409.
- **R09**: sin cupones ni usos históricos (declarado como limitación).
- **R10**: UUID distinto por creación; nombres repetidos válidos.
- **R11**: lote 1-20 items; validar todo, guardar todo o nada en una transacción real; orden de entrada en respuesta.
- **R12**: DELETE lógico (deleted_at, INACTIVO, conserva first_activated_at); 204 sin cuerpo; excluidos de consultas; repetir/leer/modificar eliminado → 404.
- **R13**: admin paginado: página=1, tamaño=20 (máx 100); filtros estado/modalidad exactos; orden creado_at ASC, id ASC; total antes de paginar; totalPaginas=ceil(total/tamaño); 0 → 0.
- **R14**: comercial exige canal; filtra pertenencia y estado (ACTIVO por defecto); vigentes=true aplica R02; false omite solo temporal; PromocionResumen snake_case.
- **R15**: auth por tokens estáticos LAB_ADMIN_TOKEN / LAB_READER_TOKEN; 401 sin token/inválido; 403 lector escribiendo.
- **R16**: JSON malformado/UUID inválido/query inválida → 400 VALIDACION; JSON válido que incumple reglas → 422 VALIDACION; application/problem+json.

## Persistencia

PostgreSQL local real en `127.0.0.1:55436`.
- Base aplicación: `lab_promociones` (usando `.env`)
- Base e2e: `lab_promociones_test` (usando `.env.test`)

Tablas de negocio (en `sql/01-schema.sql`):
- `promociones` — 14 columnas físicas (id, name, discount_type, discount_value, modality, state, valid_from, valid_until, priority, enabled_channels, first_activated_at, created_at, updated_at, deleted_at)
- `promocion_alcance_product_ids` — alcance por productId
- `promocion_alcance_skus` — alcance por SKU
- `promocion_politica_combinacion` — política de combinación

No se usa ORM ni repositorios en memoria: acceso directo con `pg` Pool.

## Instalación y ejecución

```bash
# Instalar/ restaurar dependencias (si es necesario)
npm ci --no-audit --no-fund

# Compilar TypeScript
npm run build

# Typecheck
npm run typecheck

# Pruebas unitarias (vitest, sin DB)
npm test

# Pruebas e2e (contra PostgreSQL real de prueba)
npm run test:e2e

# Iniciar el servidor (carga .env)
npm start
```

Variables de entorno (`.env`):
```
PORT=3303
DATABASE_URL=postgresql://lab:lab-local-only@127.0.0.1:55436/lab_promociones
LAB_ADMIN_TOKEN=lab-admin-local-only
LAB_READER_TOKEN=lab-reader-local-only
```

## Limitaciones conocidas

- **R09**: El entorno académico no implementa cupones ni usos históricos. Esos antecedentes empiezan ausentes y no se inventaron operaciones HTTP para modificarlos. La limitación se declara en este informe.
- `puedeCambiarModalidad` considera solo `estado === 'INACTIVO'` y `first_activated_at === null`. Sin datos de cupones/usos, esa parte de la regla se trata como siempre satisfecha.
- Autenticación por tokens estáticos de fixture (no JWT, no Seguridad, no Supabase).

## Evidencia

Ejecutar en orden: `npm run build`, `npm run typecheck`, `npm test`, `npm run test:e2e`. Todos deben salir con estado de éxito y salida real.