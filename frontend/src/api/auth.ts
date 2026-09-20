import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from './token';
import type { AuthResponse, CurrentUser, LoginRequest, RegisterRequest } from '../types/domain';

function saveAuth(response: AuthResponse): AuthResponse {
  if (!response.accessToken || !response.refreshToken) throw new Error('Incomplete authentication response');
  setAccessToken(response.accessToken);
  setRefreshToken(response.refreshToken);
  return response;
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  return saveAuth(await apiRequest<AuthResponse>(apiEndpoints.auth.login, {
    method: 'POST', auth: false, body: JSON.stringify(request)
  }));
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>(apiEndpoints.users.me);
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  return saveAuth(await apiRequest<AuthResponse>(apiEndpoints.auth.register, {
    method: 'POST', auth: false, body: JSON.stringify(request)
  }));
}

// Clear browser credentials even when server revocation cannot be reached.
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await apiRequest<null>(apiEndpoints.auth.logout, {
        method: 'POST', auth: false, body: JSON.stringify({ refreshToken })
      });
    }
  } finally {
    clearTokens();
  }
}
