import type { ApiResponse } from '../types/api';
import { appConfig } from '../config/app.config';
import { getAccessToken } from './token';

type RequestOptions = RequestInit & {
  auth?: boolean;
};

type ApiErrorBody = {
  errorCode?: string;
  message?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    headers
  });

  const body = await response.json().catch(() => null) as ApiResponse<T> | ApiErrorBody | null;

  if (!response.ok) {
    const message = body && 'message' in body && body.message ? body.message : 'Request failed';
    const errorCode = body && 'errorCode' in body ? body.errorCode : undefined;
    throw new ApiError(message, response.status, errorCode);
  }

  if (!body || !('data' in body)) {
    throw new Error('Invalid API response');
  }

  return body.data;
}
