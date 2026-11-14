export interface ProblemBody {
  status: number;
  code: string;
  title: string;
  detail?: string;
}

export class ProblemError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail?: string;

  constructor(status: number, code: string, title: string, detail?: string) {
    super(title);
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.name = 'ProblemError';
  }
}

/**
 * Crea el cuerpo de error en formato application/problem+json
 * conforme a RFC 7807 y al contrato del laboratorio.
 */
export function problemBody(status: number, code: string, title: string, detail?: string): ProblemBody {
  const body: ProblemBody = { status, code, title };
  if (detail) {
    body.detail = detail;
  }
  return body;
}

/**
 * Códigos de error del contrato.
 */
export const ErrorCode = {
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  NO_AUTORIZADO: 'NO_AUTORIZADO',
  VALIDACION: 'VALIDACION',
  PROMOCION_NO_ENCONTRADA: 'PROMOCION_NO_ENCONTRADA',
  MODALIDAD_BLOQUEADA: 'MODALIDAD_BLOQUEADA',
} as const;
