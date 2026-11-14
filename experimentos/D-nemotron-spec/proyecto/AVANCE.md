# AVANCE — D-nemotron-spec (Nemotron 3.5 Super VL Free)

## Resumen

Implementación completa del API académico de Promociones con las 7 operaciones del contrato
OpenAPI, reglas R01-R17 de `contrato/contexto.md`, y pruebas unitarias/e2e. Todo verificado
con comandos reales en esta misma ejecución.

## Estado general

| Área | Estado | Detalle |
|------|--------|---------|
| Preflight de entorno | PASS | `node herramientas/comprobar-entorno.mjs` → PASS |
| Build (`npm run build`) | PASS | TypeScript compila sin errores |
| Typecheck (`npm run typecheck`) | PASS | `tsc --noEmit` sin errores |
| Pruebas unitarias (`npm test`) | PASS | 44/44 tests pasan |
| Pruebas e2e (`npm run test:e2e`) | PASS | 37/37 tests pasan |
| Persistencia PostgreSQL | PASS | Tablas creadas en `lab_promociones` y `lab_promociones_test` |

## Archivos producidos

### Código fuente (`src/`)
- `main.ts` — Bootstrap NestJS, prefijo `/api/v1`, filtros globales, auth middleware
- `app.module.ts` — Módulo raíz
- `auth/auth.middleware.ts` — Auth Bearer con tokens estáticos (R15)
- `common/problem.ts` — ProblemError y cuerpo `application/problem+json` (R16)
- `common/problem-exception.filter.ts` — Filtro global `@Catch(ProblemError)`
- `common/validation.ts` — Validación manual R01-R07, R16
- `db/pool.ts` — Pool pg con `withTransaction` (BEGIN/COMMIT/ROLLBACK)
- `promociones/promociones.controller.ts` — 7 operaciones HTTP
- `promociones/promociones.service.ts` — Lógica de negocio y reglas
- `promociones/promociones.repository.ts` — Acceso SQL a PostgreSQL
- `promociones/promociones.module.ts` — Módulo de promociones
- `promociones/dto/*.ts` — DTOs de entrada
- `promociones/entities/*.ts` — Interfaces de filas de BD

### SQL (`sql/`)
- `001_inicial.sql` — Esquema: 14 columnas + alcance + política + índices

### Pruebas
- `test/unit/validation.spec.ts` — 44 tests unitarios
- `test/e2e/promociones.e2e.spec.ts` — 37 tests e2e

### Configuraciones
- `vitest.config.ts` — Config pruebas unitarias
- `vitest.e2e.config.ts` — Config pruebas e2e

### Documentación
- `README.md` — Instalación, arranque, operaciones, autenticación, errores
- `AVANCE.md` — Este archivo

## Detalle de las 7 operaciones verificadas

| ID | Operación | Ruta | Rol | Estado e2e |
|----|-----------|------|-----|------------|
| O01 | Crear | POST /promociones | ADMIN | PASS (201, UUID nuevo, validaciones) |
| O02 | Crear lote | POST /promociones/lote | ADMIN | PASS (transacción atómica, orden preservado) |
| O03 | Modificar | PATCH /promociones/{id} | ADMIN | PASS (fusión, SELECT FOR UPDATE, 409 modalidad) |
| O04 | Eliminar | DELETE /promociones/{id} | ADMIN | PASS (204, borrado lógico, 404 tras eliminar) |
| O05 | Listar comercial | GET /promociones | LECTOR/ADMIN | PASS (canal, estado, vigencia, resumen snake_case) |
| O06 | Listar admin | GET /promociones/administracion | LECTOR/ADMIN | PASS (paginación, meta.total, totalPaginas) |
| O07 | Detalle admin | GET /promociones/{id} | LECTOR/ADMIN | PASS (PromocionAdmin, puedeCambiarModalidad) |

## Reglas del contrato implementadas

R01-R17 implementadas y verificadas, incluyendo:
- R01: nombre, descuento, porcentaje <= 100
- R02: fechas ISO 8601 con zona, validFrom < validUntil
- R03: alcance con referencias activas de catalogo.json
- R04: enums exactos, prioridad >= 1
- R05: canales explícitos, únicos, del contrato
- R06: política con 3 booleanos obligatorios
- R07: PATCH conserva omitidos, rechaza desconocidos/solo-lectura
- R08: first_activated_at una sola vez, puedeCambiarModalidad, SELECT FOR UPDATE
- R09: sin cupones/usos (declarado como limitación)
- R10: UUID distinto por creación, nombres repetidos válidos
- R11: lote atómico, todos o ninguno
- R12: borrado lógico, deleted_at, 404 tras eliminar
- R13: paginación estable, total antes de paginar
- R14: consulta comercial con canal, resumen snake_case
- R15: auth tokens estáticos, lector solo GET
- R16: errores application/problem+json
- R17: PostgreSQL local real

## Limitaciones declaradas

1. **R09**: No se implementan cupones ni usos históricos. Ambos antecedentes están ausentes.
   `puedeCambiarModalidad` considera que no hay cupones ni usos (factor siempre favorable).
2. **R12**: El borrado lógico no afirma idempotencia de respuesta 204 en repetición.
3. No se conecta con Seguridad, JWT ni Supabase (tokens estáticos de laboratorio).
4. No se implementan evaluación de cestas, pricing, reservas ni mensajería.
5. No se desplegó; todo es local en puertos del caso (3304 HTTP, 55437 PostgreSQL).

## Comandos ejecutados y resultados

```bash
# Preflight
node herramientas/comprobar-entorno.mjs
# Resultado: {"estado":"PASS",...}

# Build
node node_modules/typescript/bin/tsc -p tsconfig.json
# Resultado: sin errores

# Typecheck
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
# Resultado: sin errores

# Unitarias
node node_modules/vitest/vitest.mjs run
# Resultado: Test Files 1 passed, Tests 44 passed

# E2E
node --env-file=.env.test node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts
# Resultado: Test Files 1 passed, Tests 37 passed
```

## Archivos de entrada NO modificados

- `package.json`, `package-lock.json`, `tsconfig.json` — intactos
- `contrato/` (openapi.yaml, openapi.json, contexto.md, catalogo.json, stack.md) — intactos
- `documentos/` (spec.md, plan.md, tareas.md) — intactos, no reescritos
- `.env`, `.env.test` — intactos, solo credenciales locales

## Próximos pasos (si fuera necesario)

- Verificar persistencia tras reinicio del servidor PostgreSQL (requiere reinicio de DB, fuera del alcance de este prompt)
- Los tests e2e ya incluyen una prueba de persistencia tras reinicio del servidor NestJS
