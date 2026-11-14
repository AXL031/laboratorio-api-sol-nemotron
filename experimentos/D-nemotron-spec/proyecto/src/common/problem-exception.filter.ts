import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemError } from './problem.js';

/**
 * Filtro global de excepciones.
 * Captura ProblemError y devuelve application/problem+json
 * con el status, code y title correctos (R16).
 * No expone stack traces ni credenciales.
 * Cualquier error no capturado se devuelve como 500 sin detalles internos.
 */
@Catch(ProblemError)
export class ProblemExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ProblemError) {
      response.status(exception.status).type('application/problem+json').send({
        status: exception.status,
        code: exception.code,
        title: exception.title,
        detail: exception.detail,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    // Error no controlado: 500 sin exponer detalles
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).type('application/problem+json').send({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'ERROR_INTERNO',
      title: 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
