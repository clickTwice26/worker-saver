import type { Response } from 'express';
import type { ApiErrorCode } from '@ale/shared';

/** An error carrying the HTTP status and machine-readable code to return. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: Record<string, string> | undefined;

  constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, string>): HttpError {
    return new HttpError(400, 'validation_failed', message, details);
  }

  static notFound(message: string): HttpError {
    return new HttpError(404, 'not_found', message);
  }

  static roleNotResolved(name: string): HttpError {
    return new HttpError(
      400,
      'role_not_resolved',
      `No role matches "${name}". Send a roleId, or use a name from GET /api/roles.`,
      { role: name },
    );
  }
}

export function sendError(res: Response, error: HttpError): void {
  res.status(error.status).json({
    error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
  });
}
