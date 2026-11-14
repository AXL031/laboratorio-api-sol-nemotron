import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

export class Problem extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly title: string, public readonly detail?: string) {
    super(title);
  }
  toJSON() {
    return { status: this.status, code: this.code, title: this.title, ...(this.detail ? { detail: this.detail } : {}) };
  }
}
export function invalid(detail: string, status = 422): never {
  throw new Problem(status, 'VALIDACION', 'Entrada inválida', detail);
}
export function missing(): never {
  throw new Problem(404, 'PROMOCION_NO_ENCONTRADA', 'Promoción no encontrada');
}
export function sendProblem(response: Response, problem: Problem) {
  response.status(problem.status).type('application/problem+json').json(problem.toJSON());
}
@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let problem: Problem;
    if (error instanceof Problem) problem = error;
    else if (error instanceof HttpException && error.getStatus() === 404) {
      problem = new Problem(404, 'PROMOCION_NO_ENCONTRADA', 'Recurso no encontrado');
    } else {
      // No enviar mensajes del driver, stack ni valores de conexión al cliente.
      problem = new Problem(500, 'ERROR_INTERNO', 'Error interno');
    }
    sendProblem(host.switchToHttp().getResponse<Response>(), problem);
  }
}
