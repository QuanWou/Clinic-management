import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpApiError, apiRequest } from './client';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './token';

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
  vi.stubGlobal('fetch', vi.fn());
});

describe('typed API client', () => {
  it('preserves genuine empty arrays without demo substitution', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true, data: [], message: 'ok' }), { status: 200 }));
    setAccessToken('access');
    await expect(apiRequest('/api/appointments/my')).resolves.toEqual([]);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer access');
  });

  it('reports 403 without logging out or leaking into a fallback request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Not authorized' }), { status: 403 }));
    setAccessToken('access');
    await expect(apiRequest('/api/medical-records/my')).rejects.toMatchObject({ status: 403, message: 'Not authorized' });
    expect(getAccessToken()).toBe('access');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears both credentials and signals expiration on authenticated 401', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Expired' }), { status: 401 }));
    setAccessToken('access'); setRefreshToken('refresh');
    await expect(apiRequest('/api/users/me')).rejects.toBeInstanceOf(HttpApiError);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects an API body marked unsuccessful even if HTTP is 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: false, data: [] }), { status: 200 }));
    await expect(apiRequest('/api/test', { auth: false })).rejects.toThrow('Invalid API response');
  });
});
