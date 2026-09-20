import { authConfig } from '../config/auth.config';

const refreshTokenKey = 'clinic.refreshToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(authConfig.accessTokenKey);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(authConfig.accessTokenKey, token);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(refreshTokenKey);
}

export function setRefreshToken(token: string): void {
  sessionStorage.setItem(refreshTokenKey, token);
}

export function clearTokens(): void {
  localStorage.removeItem(authConfig.accessTokenKey);
  sessionStorage.removeItem(refreshTokenKey);
}

export function clearAccessToken(): void {
  clearTokens();
}
