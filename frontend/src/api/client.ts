import type { ApiResponse } from '../types/api';
import { appConfig } from '../config/app.config';
import { getAccessToken } from './token';

type RequestOptions = RequestInit & {
  auth?: boolean;
};

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

  const body = await response.json().catch(() => null) as ApiResponse<T> | { message?: string } | null;

  if (!response.ok) {
    const message = body && 'message' in body && body.message ? body.message : 'Request failed';
    throw new Error(message);
  }

  if (!body || !('data' in body)) {
    throw new Error('Invalid API response');
  }

  return body.data;
}
