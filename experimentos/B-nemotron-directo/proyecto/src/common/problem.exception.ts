export class ProblemException extends Error {
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
    Object.setPrototypeOf(this, ProblemException.prototype);
  }
}