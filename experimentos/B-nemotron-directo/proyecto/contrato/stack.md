# Stack común del segundo intento

NestJS/TypeScript/PostgreSQL local; Node 24. Dependencias directas con las versiones exactas
de package.json y transitivas fijadas en package-lock.json, idénticos en A/C.
Corrección de la base inicial: @types/supertest 7.0.0 no fue encontrado en el registro oficial;
se usa 7.2.1, verificado antes de iniciar la corrida. No se modifican las reglas ni el OpenAPI.
Los paquetes ya están instalados. Restauración permitida con npm ci, sin --offline.
Leer ENTORNO.md: solo PostgreSQL de laboratorio, nunca credenciales de G6.
