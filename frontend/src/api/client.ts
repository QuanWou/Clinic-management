import type { ApiResponse } from '../types/api';
import { appConfig } from '../config/app.config';
import { clearTokens, getAccessToken } from './token';

type RequestOptions = RequestInit & { auth?: boolean };

export class HttpApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errorCode?: string,
    public readonly path?: string
  ) {
    super(message);
    this.name = 'HttpApiError';
  }
}

// Backward-compatible name used by the registration/onboarding integration tests.
export { HttpApiError as ApiError };

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
    // Show only the route; query parameters can contain patient identifiers.
    const safePath = path.split('?')[0];
    const message = isObject(body) && typeof body.message === 'string' && body.message
      ? body.message
      : response.status === 403
        ? auth
          ? `Không có quyền truy cập API ${safePath} (403). Kiểm tra vai trò tài khoản và đăng nhập lại nếu quyền vừa thay đổi.`
          : `Yêu cầu ${safePath} bị chặn (403). Kiểm tra cấu hình Origin/CORS của máy chủ; chưa phải lỗi phân quyền tài khoản.`
        : `Request failed (${response.status})`;
    const errorCode = isObject(body) && typeof body.errorCode === 'string'
      ? body.errorCode
      : undefined;
    throw new HttpApiError(response.status, message, errorCode, safePath);
  }
  if (!isObject(body) || body.success !== true || !('data' in body)) {
    throw new Error('Invalid API response');
  }
  return (body as ApiResponse<T>).data;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
