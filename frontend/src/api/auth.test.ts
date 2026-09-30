import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, login, logout } from './auth';
import { getAccessToken, getRefreshToken } from './token';
import { getPrimaryRole, normalizeRoles } from '../utils/roles';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
});

describe('real authentication contract with mocked transport, not live E2E', () => {
  it('posts credentials without an Authorization header, reads real roles and revokes refresh token on logout', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/login')) return new Response(JSON.stringify({
        success: true, data: { accessToken: 'access-only', refreshToken: 'refresh-only', roles: ['ROLE_PATIENT'] }
      }), { status: 200 });
      if (url.endsWith('/users/me')) return new Response(JSON.stringify({
        success: true, data: { id: 'account', email: 'user@clinic.test', roles: ['ROLE_DOCTOR'] }
      }), { status: 200 });
      if (url.endsWith('/auth/logout')) return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
      throw new Error(`Unexpected route: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await login({ email: 'user@clinic.test', password: 'example-password' });
    expect(getAccessToken()).toBe('access-only');
    expect(getRefreshToken()).toBe('refresh-only');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/login$/);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBeNull();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'user@clinic.test', password: 'example-password' });

    const currentUser = await getCurrentUser();
    expect(getPrimaryRole(normalizeRoles(currentUser.roles))).toBe('DOCTOR');
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer access-only');

    await logout();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ refreshToken: 'refresh-only' });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('does not save either credential when backend returns an incomplete login payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ success: true, data: { accessToken: 'access-only' } }), { status: 200 })));
    await expect(login({ email: 'user@clinic.test', password: 'example-password' })).rejects.toThrow('Incomplete authentication response');
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});