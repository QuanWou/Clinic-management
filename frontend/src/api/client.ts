import type { ApiResponse } from '../types/api';
import { appConfig } from '../config/app.config';
import { clearTokens, getAccessToken } from './token';

type RequestOptions = RequestInit & { auth?: boolean };

export class HttpApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpApiError';
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body != null && !(requestOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = auth ? getAccessToken() : null;
  if (auth && token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, { ...requestOptions, headers });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && auth && token && getAccessToken() === token) {
      clearTokens();
      window.dispatchEvent(new Event('clinic:unauthorized'));
    }
    const message = isObject(body) && typeof body.message === 'string' && body.message
      ? body.message
      : `Request failed (${response.status})`;
    throw new HttpApiError(response.status, message);
  }
  if (!isObject(body) || body.success !== true || !('data' in body)) {
    throw new Error('Invalid API response');
  }
  return (body as ApiResponse<T>).data;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
