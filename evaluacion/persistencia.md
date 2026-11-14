# Prueba manual de persistencia tras reinicio

Estado: NO_EJECUTADO. Repetir para cada caso y guardar evidencia por separado.
Con el servidor y su DB académica en marcha, crear una promoción válida con Postman.
Guardar request, response 201 e ID. No ejecutar DELETE sobre ese ID.
Detener únicamente el proceso del servicio; no borrar datos, volúmenes ni reiniciar con semillas destructivas.
Iniciar el mismo proyecto, versión y DATABASE_URL; GET al ID con token lector debe devolver 200 y los
mismos campos. Verificar además antecedente de activación y eliminación lógica con inspección DB autorizada
para este laboratorio. Registrar comando real, timestamps y respuestas. No basta con datos en memoria.
Eliminar al final únicamente los datos de prueba dentro de la DB aislada, según procedimiento del equipo.
