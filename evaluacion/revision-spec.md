# Revisión de documentos preparados — enfoque con spec

Objeto: entrada-spec/spec.md, plan.md y tareas.md, compartidos como entrada por C/D.
El coordinador los prepara antes de la nueva corrida; no se evalúan documentos generados por C/D.
La revisión estructural del coordinador comprueba trazabilidad R01–R17/O01–O07, referencias locales
y copias idénticas. No equivale a revisión humana, pruebas de implementación ni integración.

| Criterio | Fuente para revisar |
|---|---|
| Siete operaciones sin rutas extra | spec §3 y contrato |
| Reglas R01–R17 y criterios observables | spec §4, tareas |
| Más de 10 columnas y persistencia asociada | spec §5, plan P02 |
| Lote atómico y estado/modalidad consistentes | spec R08/R11, plan P05/P06 |
| PATCH fusionado, borrado y consultas | spec R07/R12–R14 |
| Orden de dependencias y aceptación | plan P01–P08, tareas T01–T12 |
| Fixtures y límites académicos | spec §§1–2 y contexto |

Revisión humana de los integrantes: PENDIENTE / no atribuida al coordinador.
Si detectan un cambio necesario, aplicarlo a la entrada común y a ambas copias antes de correr C/D,
registrando versión; no ajustar una entrada después de observar qué modelo falla.
