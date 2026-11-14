import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de autenticación de laboratorio (R15).
 * Lee tokens estáticos LAB_ADMIN_TOKEN y LAB_READER_TOKEN del entorno.
 * Se ejecuta antes de que el cuerpo o el path sean procesados por la aplicación.
 * No usa JWT ni se conecta con Seguridad.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const adminToken = process.env.LAB_ADMIN_TOKEN ?? '';
  const readerToken = process.env.LAB_READER_TOKEN ?? '';

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).type('application/problem+json').send({
      status: 401,
      code: 'NO_AUTENTICADO',
      title: 'No autenticado',
      detail: 'Falta el encabezado Authorization Bearer',
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  // Rutas de escritura solo para admin
  const rutasEscritura = ['POST', 'PATCH', 'DELETE'];
  const esEscritura = rutasEscritura.includes(req.method);

  if (esEscritura) {
    if (token !== adminToken) {
      if (token === readerToken) {
        res.status(403).type('application/problem+json').send({
          status: 403,
          code: 'NO_AUTORIZADO',
          title: 'No autorizado',
          detail: 'El lector no puede realizar operaciones de escritura',
        });
        return;
      }
      res.status(401).type('application/problem+json').send({
        status: 401,
        code: 'NO_AUTENTICADO',
        title: 'No autenticado',
        detail: 'Token inválido',
      });
      return;
    }
  } else {
    // GET: admin o lector
    if (token !== adminToken && token !== readerToken) {
      res.status(401).type('application/problem+json').send({
        status: 401,
        code: 'NO_AUTENTICADO',
        title: 'No autenticado',
        detail: 'Token inválido',
      });
      return;
    }
  }

  // Adjuntar información de rol al request para uso posterior
  (req as any).authToken = token;
  (req as any).authRole = token === adminToken ? 'admin' : 'reader';

  next();
}
