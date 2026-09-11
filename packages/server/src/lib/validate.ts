/**
 * Request validation.
 *
 * Hand-written rather than schema-library driven: the surface is six endpoints,
 * and the error messages are better when they name the field and the fix.
 */

import { HttpError } from './http.ts';
import { isValidIsoDate } from './dates.ts';

export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw HttpError.badRequest('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw HttpError.badRequest(`"${field}" is required and must be a non-empty string.`, {
      [field]: 'required',
    });
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw HttpError.badRequest(`"${field}" must be a non-empty string when supplied.`);
  }
  return value.trim();
}

export function requireInteger(
  body: Record<string, unknown>, field: string, opts: { min?: number; max?: number } = {},
): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw HttpError.badRequest(`"${field}" is required and must be an integer.`, { [field]: 'required' });
  }
  return checkRange(value, field, opts);
}

export function optionalInteger(
  body: Record<string, unknown>, field: string, fallback: number, opts: { min?: number; max?: number } = {},
): number {
  const value = body[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw HttpError.badRequest(`"${field}" must be an integer when supplied.`);
  }
  return checkRange(value, field, opts);
}

function checkRange(value: number, field: string, opts: { min?: number; max?: number }): number {
  if (opts.min !== undefined && value < opts.min) {
    throw HttpError.badRequest(`"${field}" must be at least ${opts.min}.`, { [field]: 'out_of_range' });
  }
  if (opts.max !== undefined && value > opts.max) {
    throw HttpError.badRequest(`"${field}" must be at most ${opts.max}.`, { [field]: 'out_of_range' });
  }
  return value;
}

export function requireIsoDate(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (!isValidIsoDate(value)) {
    throw HttpError.badRequest(`"${field}" must be a calendar date in YYYY-MM-DD form.`, {
      [field]: 'invalid_date',
    });
  }
  return value;
}

export function optionalIsoDate(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (!isValidIsoDate(value)) {
    throw HttpError.badRequest(`"${field}" must be a calendar date in YYYY-MM-DD form.`);
  }
  return value;
}

/** Parse a positive integer path or query parameter. */
export function parseId(raw: string | undefined, field: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw HttpError.badRequest(`"${field}" must be a positive integer.`, { [field]: 'invalid' });
  }
  return value;
}
