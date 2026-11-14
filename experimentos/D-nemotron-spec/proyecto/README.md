# API Académica de Promociones — Nemotron 3.5 Super VL Free (D-nemotron-spec)

Implementación completa de las siete operaciones del API académico de Promociones
con NestJS, TypeScript y PostgreSQL local. Enfoque CON SPEC (documentos preparados
en `documentos/`).

## Modelo

- `opencode/nemotron-3.5-super-vl-free` (Nemotron 3.5 Super VL Free)
- Un solo prompt de implementación, sin delegar en otros modelos.

## Estructura del proyecto

```
src/
  main.ts              # Punto de entrada NestJS, prefijo /api/v1, filtros globales
  app.module.ts        # Módulo raíz
  auth/
    auth.middleware.ts # Auth Bearer con tokens estáticos (LAB_ADMIN_TOKEN / LAB_READER_TOKEN)
  common/
    problem.ts         # ProblemError + cuerpo application/problem+json (RFC 7807)
    problem-exception.filter.ts  # Filtro global que convierte ProblemError en respuesta HTTP
    validation.ts      # Validación manual de entradas (R01-R07, R16)
  db/
    pool.ts            # Pool pg con withTransaction (BEGIN/COMMIT/ROLLBACK)
  promociones/
    promociones.controller.ts   # 7 operaciones HTTP
    promociones.service.ts      # Lógica de negocio (transacciones, reglas R01-R14)
    promociones.repository.ts   # Acceso SQL a PostgreSQL
    promociones.module.ts
    dto/                 # DTOs de entrada
    entities/            # Interfaces de filas de BD
sql/
  001_inicial.sql      # Esquema reproducible: 14 columnas + alcance + política
test/
  unit/                # Pruebas unitarias (44 tests)
  e2e/                 # Pruebas e2e contra API real (37 tests)
vitest.config.ts       # Config pruebas unitarias
vitest.e2e.config.ts   # Config pruebas e2e
```

## Siete operaciones implementadas

| ID | Operación | Ruta | Rol | Descripción |
|----|-----------|------|-----|-------------|
| O01 | Crear | `POST /api/v1/promociones` | ADMIN | Alta única con UUID nuevo |
| O02 | Crear lote | `POST /api/v1/promociones/lote` | ADMIN | 1-20 items, transacción atómica |
| O03 | Modificar | `PATCH /api/v1/promociones/{id}` | ADMIN | Fusión, valida entidad completa, SELECT FOR UPDATE |
| O04 | Eliminar | `DELETE /api/v1/promociones/{id}` | ADMIN | Borrado lógico (deleted_at), 204 sin cuerpo |
| O05 | Listar comercial | `GET /api/v1/promociones` | LECTOR/ADMIN | Filtro canal, estado, vigencia; resumen snake_case |
| O06 | Listar admin | `GET /api/v1/promociones/administracion` | LECTOR/ADMIN | Paginación, filtros, conteo antes de paginar |
| O07 | Detalle admin | `GET /api/v1/promociones/{id}` | LECTOR/ADMIN | Devuelve PromocionAdmin con puedeCambiarModalidad |

## Reglas del contrato implementadas

R01-R17 de `contrato/contexto.md`, incluyendo:
- Validación de nombre (1-160 chars, no solo espacios)
- Descuento finito > 0, porcentaje <= 100
- Fechas ISO 8601 con zona, validFrom < validUntil
- Alcance con referencias activas de catalogo.json
- Canales explícitos, únicos, del enum contractual
- Política de combinación con 3 booleanos obligatorios
- PATCH conserva omitidos, rechaza desconocidos y solo-lectura
- first_activited_at registrado una sola vez (R08)
- puedeCambiarModalidad: solo INACTIVO y nunca activado (R08)
- Cambio de modalidad bloqueado: 409 MODALIDAD_BLOQUEADA (R08, R09)
- Lote atómico: todos o ninguno (R11)
- Borrado lógico: deleted_at, INACTIVO, historial conservado (R12)
- Paginación estable con meta.total y totalPaginas (R13)
- Auth de laboratorio: tokens estáticos, lector solo GET (R15)
- Errores application/problem+json con status/code/title (R16)
- PostgreSQL local real, sin repositorios en memoria (R17)

## Variables de entorno

### `.env` (para `npm start`)
```
PORT=3304
DATABASE_URL=postgresql://lab:lab-local-only@127.0.0.1:55437/lab_promociones
LAB_ADMIN_TOKEN=lab-admin-local-only
LAB_READER_TOKEN=lab-reader-local-only
```

### `.env.test` (para `npm run test:e2e`)
```
PORT=3304
DATABASE_URL=postgresql://lab:lab-local-only@127.0.0.1:55437/lab_promociones_test
LAB_ADMIN_TOKEN=lab-admin-local-only
LAB_READER_TOKEN=lab-reader-local-only
TEST_DATABASE_URL=postgresql://lab:lab-local-only@127.0.0.1:55437/lab_promociones_test
LAB_ALLOW_E2E_RESET=SI_SOLO_BASE_DE_PRUEBAS
```

## Instalación y arranque

### Requisitos
- Node.js >= 24.15.0 < 25
- PostgreSQL local en 127.0.0.1:55437
- Bases `lab_promociones` y `lab_promociones_test` ya creadas (vacías)

### Paso 1: Instalar dependencias (si es necesario)
```bash
npm ci --no-audit --no-fund
```

### Paso 2: Crear tablas (ejecutar sobre cada base)
```bash
# Conectar a lab_promociones y ejecutar:
psql -f sql/001_inicial.sql

# Conectar a lab_promociones_test y ejecutar:
psql -f sql/001_inicial.sql
```

### Paso 3: Arrancar el API
```bash
npm start
# Escucha en http://127.0.0.1:3304/api/v1
```

### Paso 4: Ejecutar pruebas
```bash
# Unitarias
npm test

# e2e (carga .env.test)
npm run test:e2e

# Build y typecheck
npm run build
npm run typecheck
```

## Autenticación

Todos los endpoints requieren encabezado `Authorization: Bearer <token>`.

| Token | Rol | Operaciones |
|-------|-----|-------------|
| `LAB_ADMIN_TOKEN` | Admin | Todas (GET, POST, PATCH, DELETE) |
| `LAB_READER_TOKEN` | Lector | Solo GET |

Sin token o token incorrecto: `401 NO_AUTENTICADO`.
Lector intentando escribir: `403 NO_AUTORIZADO`.

## Formato de errores

Todos los errores usan `application/problem+json`:
```json
{
  "status": 422,
  "code": "VALIDACION",
  "title": "Descripción del error",
  "detail": "Detalle opcional",
  "timestamp": "2026-11-14T...",
  "path": "/api/v1/promociones"
}
```

Códigos: `NO_AUTENTICADO`, `NO_AUTORIZADO`, `VALIDACION`, `PROMOCION_NO_ENCONTRADA`, `MODALIDAD_BLOQUEADA`.

## Persistencia

- Tabla `promociones` con 14 columnas físicas (incluye `deleted_at`).
- Tablas hijas: `promocion_alcance` y `promocion_politica_combinacion`.
- Transacciones reales con `BEGIN`/`COMMIT`/`ROLLBACK` en `withTransaction`.
- El lote (O02) usa una transacción que abarca todas las altas y datos asociados.
- PATCH (O03) usa `SELECT FOR UPDATE` para serializar cambios de modalidad.
- Los datos sobreviven al reinicio del servidor.

## Limitaciones académicas declaradas (R09)

- No se implementan cupones ni usos históricos; ambos antecedentes están ausentes.
- `puedeCambiarModalidad` considera que no hay cupones ni usos (siempre `true` para el factor de cupones/usos).
- No se conecta con Seguridad, JWT ni Supabase.
- No se implementan evaluación de cestas, pricing, reservas ni mensajería.
- El borrado lógico no afirma idempotencia de respuesta 204 en repetición (R12).

## Pruebas

- **Unitarias (44)**: validación de rangos, fechas, alcance, canales, política, PATCH, lote.
- **E2E (37)**: 7 operaciones, auth/errores, lote atómico sin altas parciales, ausencia de eliminados, filtros/paginación, antecedente de activación, preservación de campos omitidos, persistencia tras reinicio.

## Comandos de validación

```bash
npm run build      # Compila TypeScript
npm run typecheck  # Verifica tipos sin emitir
npm test           # Pruebas unitarias (vitest)
npm run test:e2e   # Pruebas e2e contra API real con .env.test
```

## Créditos

Construido con NestJS 12, TypeScript 6, pg 8, Vitest 4, Supertest 7.
Entorno de laboratorio académico aislado, sin servicios externos de G6.
