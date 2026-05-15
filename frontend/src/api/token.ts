import { authConfig } from '../config/auth.config';

export function getAccessToken(): string | null {
  return localStorage.getItem(authConfig.accessTokenKey);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(authConfig.accessTokenKey, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(authConfig.accessTokenKey);
}
