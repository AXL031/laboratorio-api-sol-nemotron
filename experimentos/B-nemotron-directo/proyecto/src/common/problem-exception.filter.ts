import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ProblemException } from './problem.exception.js';

@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status: number;
    let code: string;
    let title: string;
    let detail: string | undefined;

    if (exception instanceof ProblemException) {
      status = exception.status;
      code = exception.code;
      title = exception.title;
      detail = exception.detail;
    } else if (
      exception !== null &&
      typeof exception === 'object' &&
      'getStatus' in exception
    ) {
      const httpEx = exception as {
        getStatus?: () => number;
        getResponse?: () => unknown;
      };
      status = (httpEx.getStatus?.() ?? 500) as number;
      const resp = httpEx.getResponse?.();
      const respObj =
        resp !== null && typeof resp === 'object' ? (resp as Record<string, unknown>) : {};
      code = (respObj['code'] as string) ?? 'VALIDACION';
      title =
        (respObj['message'] as string) ??
        String((exception as unknown as Error).message ?? 'Error');
      detail = respObj['detail'] as string | undefined;
    } else {
      status = 500;
      code = 'ERROR_INTERNO';
      title = 'Error interno';
      detail = String(exception);
    }

    const body: Record<string, unknown> = { status, code, title };
    if (detail !== undefined && detail !== null) {
      body['detail'] = detail;
    }

    response.status(status).type('application/problem+json').json(body);
  }
}