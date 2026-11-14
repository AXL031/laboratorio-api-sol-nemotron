import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

export class Problem extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly title: string,
    public readonly detail?: string) { super(title); }
  body() {
    return { status: this.status, code: this.code, title: this.title,
      ...(this.detail ? { detail: this.detail } : {}) };
  }
}
export const invalid = (detail: string, status = 422): never => {
  throw new Problem(status, 'VALIDACION', 'Solicitud inválida', detail);
};
export const missing = (): never => {
  throw new Problem(404, 'PROMOCION_NO_ENCONTRADA', 'Promoción no encontrada');
};
export function sendProblem(response: Response, problem: Problem) {
  response.status(problem.status).type('application/problem+json').json(problem.body());
}
@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const problem = error instanceof Problem ? error
      : error instanceof HttpException && error.getStatus() < 500
        ? new Problem(error.getStatus(), 'VALIDACION', 'Solicitud inválida')
        : new Problem(500, 'ERROR_INTERNO', 'Error interno');
    sendProblem(host.switchToHttp().getResponse<Response>(), problem);
  }
}
