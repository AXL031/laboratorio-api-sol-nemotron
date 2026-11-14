# Nemotron 3.5 Super VL Free — un solo prompt por caso

Selecciona en OpenCode opencode/nemotron-3.5-super-vl-free. Usa chats NUEVOS e independientes para B y D.
No entregar al modelo las respuestas ni los tests/resultados de Sol. No abrir toda la raíz del laboratorio.

## B — directo

Abrir únicamente: ./experimentos\B-nemotron-directo\proyecto

```text
Implementa el API académico de Promociones completo en este proyecto con Nemotron 3.5 Super VL Free.
Este es el único prompt del caso; completa código, SQL, pruebas y reporte en esta misma ejecución.
Lee contrato/openapi.yaml, contrato/contexto.md, contrato/catalogo.json, ENTREGA.md y ENTORNO.md.

Enfoque DIRECTO: implementa desde contrato/contexto. No generes spec, plan o tareas formales como fase previa. Puedes organizar internamente tu implementación.

Las dependencias ya están instaladas, el lock está fijado y PostgreSQL local está preparado.
Primero ejecuta node herramientas/comprobar-entorno.mjs y revisa PRECHECK-ENTORNO.json.
No uses npm install --offline. Si necesitas reinstalar, usa npm ci --no-audit --no-fund:
se permite acceso al registro npm para instalar exactamente el lock; eso no autoriza servicios de negocio externos.
Si una operación local da EACCES/EPERM por el sandbox, solicita la elevación de esa herramienta cuando el cliente
la admita, indicando que el usuario autorizó preparar/probar este laboratorio local. No confundas permiso denegado
con ausencia del compilador o de PostgreSQL. Respeta cualquier rechazo de permisos y registra el bloqueo real.

Implementa exactamente las siete operaciones con PostgreSQL real usando las URLs de .env y .env.test.
No cambies entradas, package.json, package-lock.json o tsconfig.json. No leas otros intentos/proyectos.
Mantén SQL/migraciones de negocio propios en sql/. La infraestructura común solo crea bases vacías;
debes crear las tablas de tu implementación antes de comprobarla. La DB e2e está separada de la de aplicación.
Puedes instalar/restaurar dependencias del lock y usar los contenedores locales del caso. No despliegues,
no conectes servicios de negocio externos, no cambies configuraciones globales y no delegues en otros agentes.
Entrega src/main.ts y el API NestJS, SQL reproducible, pruebas unitarias/e2e, sus configuraciones y README.
Ejecuta npm run build, npm run typecheck, npm test y npm run test:e2e; resuelve los errores del código
dentro de esta misma ejecución. Comprueba las siete operaciones y la persistencia local según el contexto.
No cuentes el preflight de infraestructura como pruebas de tu API. No cambies pruebas para ocultar errores.
Termina con archivos producidos, comandos/resultados reales, evidencias y limitaciones. No declares PASS sin salida.
No esperes otro mensaje para implementar ni te detengas tras redactar documentación.
```

## D — con spec preparada

Abrir únicamente: ./experimentos\D-nemotron-spec\proyecto

```text
Implementa el API académico de Promociones completo en este proyecto con Nemotron 3.5 Super VL Free.
Este es el único prompt del caso; completa código, SQL, pruebas y reporte en esta misma ejecución.
Lee contrato/openapi.yaml, contrato/contexto.md, contrato/catalogo.json, ENTREGA.md y ENTORNO.md.

Enfoque CON SPEC: usa documentos/spec.md, documentos/plan.md y documentos/tareas.md ya preparados. No los reescribas; sigue sus dependencias y registra el avance propio en AVANCE.md.

Las dependencias ya están instaladas, el lock está fijado y PostgreSQL local está preparado.
Primero ejecuta node herramientas/comprobar-entorno.mjs y revisa PRECHECK-ENTORNO.json.
No uses npm install --offline. Si necesitas reinstalar, usa npm ci --no-audit --no-fund:
se permite acceso al registro npm para instalar exactamente el lock; eso no autoriza servicios de negocio externos.
Si una operación local da EACCES/EPERM por el sandbox, solicita la elevación de esa herramienta cuando el cliente
la admita, indicando que el usuario autorizó preparar/probar este laboratorio local. No confundas permiso denegado
con ausencia del compilador o de PostgreSQL. Respeta cualquier rechazo de permisos y registra el bloqueo real.

Implementa exactamente las siete operaciones con PostgreSQL real usando las URLs de .env y .env.test.
No cambies entradas, package.json, package-lock.json o tsconfig.json. No leas otros intentos/proyectos.
Mantén SQL/migraciones de negocio propios en sql/. La infraestructura común solo crea bases vacías;
debes crear las tablas de tu implementación antes de comprobarla. La DB e2e está separada de la de aplicación.
Puedes instalar/restaurar dependencias del lock y usar los contenedores locales del caso. No despliegues,
no conectes servicios de negocio externos, no cambies configuraciones globales y no delegues en otros agentes.
Entrega src/main.ts y el API NestJS, SQL reproducible, pruebas unitarias/e2e, sus configuraciones y README.
Ejecuta npm run build, npm run typecheck, npm test y npm run test:e2e; resuelve los errores del código
dentro de esta misma ejecución. Comprueba las siete operaciones y la persistencia local según el contexto.
No cuentes el preflight de infraestructura como pruebas de tu API. No cambies pruebas para ocultar errores.
Termina con archivos producidos, comandos/resultados reales, evidencias y limitaciones. No declares PASS sin salida.
No esperes otro mensaje para implementar ni te detengas tras redactar documentación.
```

Cada sección es un prompt completo: enviar solo la correspondiente al caso, una sola vez.
Después compartir aquí las respuestas como B-Nemotron y D-Nemotron, con las evidencias reales.
