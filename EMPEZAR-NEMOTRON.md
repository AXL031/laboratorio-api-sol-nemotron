# Ejecutar Nemotron 3.5 Super VL Free en OpenCode

1. Abrir un chat NUEVO en experimentos/B-nemotron-directo/proyecto.
2. En /models seleccionar Nemotron 3.5 Super VL Free (opencode/nemotron-3.5-super-vl-free); registrar alias, fecha y versión de cliente.
3. Enviar una vez su PROMPT-INICIAL.md. También puedes copiar la sección B de PROMPTS-NEMOTRON.md.
4. Para D, abrir OTRO chat nuevo en experimentos/D-nemotron-spec/proyecto y enviar su prompt una vez.
   Su spec, plan y tareas ya están preparados; no pedirle que los genere.
5. Compartir las respuestas completas B/D y archivos/evidencias. No copiar respuestas entre modelos/casos.

Se mantienen las siete operaciones y el mismo lock de Sol, con PostgreSQL e2e/aplicación aislados.
Solo se prepara el entorno: no se ha invocado a Nemotron ni creado código de su solución.
El opencode.json del proyecto fija el modelo para sesiones nuevas; confirmar la selección real con /models.
Selecciones previas de una sesión pueden tener prioridad sobre el archivo del proyecto.
Identificador del catálogo comprobado en https://opencode.ai/docs/console/models/ el 14/11/2026.

Comparaciones previstas: A-Sol/B-Nemotron (directo), C-Sol/D-Nemotron (con spec), B/D para enfoques Nemotron.
Si se usan clientes distintos, la herramienta/configuración también es una variable; declararlo en el informe.
Las suites propias no se comparan por cantidad de tests como si midieran la misma cobertura.
La condición temporal/gratuita del proveedor puede cambiar; conservar el alias real de esta corrida.
