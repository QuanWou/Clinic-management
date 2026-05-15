import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import { clearAccessToken, setAccessToken } from './token';
import type { AuthResponse, CurrentUser, LoginRequest, RegisterRequest } from '../types/domain';

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(apiEndpoints.auth.login, {
    method: 'POST',
    auth: false,
    body: JSON.stringify(request)
  });
  setAccessToken(response.accessToken);
  return response;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>(apiEndpoints.users.me);
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(apiEndpoints.auth.register, {
    method: 'POST',
    auth: false,
    body: JSON.stringify(request)
  });
  setAccessToken(response.accessToken);
  return response;
}

export function logout(): void {
  clearAccessToken();
}
