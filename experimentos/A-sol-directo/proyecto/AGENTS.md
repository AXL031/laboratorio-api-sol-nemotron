# A-sol-directo — segundo intento — solo GPT-6.1 Sol

Un único prompt: completar la implementación y verificarla, sin pedir otra fase de mensajes.
Trabajar solo en esta carpeta; no leer ni copiar otros casos ni resultados previos.
contrato/, package.json, package-lock.json y tsconfig.json son entradas congeladas.
Enfoque directo: no redactar spec/plan/tareas como fase previa.
Las dependencias ya están instaladas; no imponer npm --offline. Se permite npm ci del lock y DB local.
ENTORNO.md y .env/.env.test indican puertos/bases exclusivos. No usar producción ni otros proyectos.
Si el sandbox deniega permisos locales, usar el mecanismo de elevación admitido por el cliente;
no ignorar rechazos ni afirmar PASS. No delegar, desplegar ni cambiar configuración global.
El coordinador preparó infraestructura, no código del API. Registrar resultados reales del código propio.
