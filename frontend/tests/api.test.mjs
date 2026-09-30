import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  configFile: false,
  root,
  logLevel: 'silent',
  build: {
    ssr: resolve(root, 'tests/api-entry.ts'),
    write: false,
    minify: false,
    rollupOptions: { output: { format: 'es' } }
  }
});
const chunk = result.output.find((output) => output.type === 'chunk');
assert.ok(chunk, 'Vite must produce a test entry bundle');
const api = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;
const originalSessionStorage = globalThis.sessionStorage;
let items;
let sessionItems;
let requests;

beforeEach(() => {
  items = new Map();
  sessionItems = new Map();
  requests = [];
  globalThis.localStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key)
  };
  globalThis.sessionStorage = {
    getItem: (key) => sessionItems.get(key) ?? null,
    setItem: (key, value) => sessionItems.set(key, String(value)),
    removeItem: (key) => sessionItems.delete(key)
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return success({ ok: true });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalLocalStorage;
  globalThis.sessionStorage = originalSessionStorage;
});

function success(data) {
  return new Response(JSON.stringify({ success: true, message: 'Success', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('API request attaches bearer token and unwraps the response', async () => {
  items.set('clinic.accessToken', 'test-token');
  const data = await api.apiRequest('/api/users/me');
  assert.deepEqual(data, { ok: true });
  assert.equal(requests[0].url, '/api/users/me');
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token');
  assert.equal(requests[0].options.headers.get('Content-Type'), null);
});

test('unauthenticated API request does not leak a stored token', async () => {
  items.set('clinic.accessToken', 'existing-token');
  await api.apiRequest('/api/auth/login', { auth: false, method: 'POST' });
  assert.equal(requests[0].options.headers.has('Authorization'), false);
});

test('API request preserves HTTP status and backend error code', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false, message: 'Access denied', errorCode: 'FORBIDDEN'
  }), { status: 403 });
  await assert.rejects(api.apiRequest('/api/patients/profile'), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 403);
    assert.equal(error.errorCode, 'FORBIDDEN');
    assert.equal(error.message, 'Access denied');
    return true;
  });
});

test('API request rejects malformed success response', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  await assert.rejects(api.apiRequest('/api/users/me'), /Invalid API response/);
});

test('login persists access token, current-user call sends it, logout clears it', async () => {
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return success(url.endsWith('/login')
      ? { accessToken: 'issued-token', refreshToken: 'issued-refresh-token' }
      : { email: 'user@clinic.test' });
  };
  await api.login({ email: 'user@clinic.test', password: 'not-a-real-password' });
  assert.equal(items.get('clinic.accessToken'), 'issued-token');
  assert.equal(sessionItems.get('clinic.refreshToken'), 'issued-refresh-token');
  assert.equal(requests[0].options.headers.has('Authorization'), false);
  assert.deepEqual(await api.getCurrentUser(), { email: 'user@clinic.test' });
  assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer issued-token');
  await api.logout();
  assert.equal(items.has('clinic.accessToken'), false);
  assert.equal(sessionItems.has('clinic.refreshToken'), false);
});

test('frontend endpoint contract points to gateway routes', () => {
  assert.equal(api.apiEndpoints.dashboard.me, '/api/dashboard/me');
  assert.equal(api.apiEndpoints.patients.profile, '/api/patients/profile');
  assert.equal(api.apiEndpoints.specialties.collection, '/api/specialties');
  assert.equal(api.apiEndpoints.doctors.schedules('doctor-id'), '/api/doctors/doctor-id/schedules');
});

test('role utilities support strings, role objects and empty roles', () => {
  assert.deepEqual(api.normalizeRoles(['ROLE_PATIENT', { code: 'ROLE_DOCTOR' }, { name: 'ROLE_ADMIN' }]),
    ['PATIENT', 'DOCTOR', 'ADMIN']);
  assert.deepEqual(api.normalizeRoles(null), []);
  assert.equal(api.getPrimaryRole([]), null);
  assert.match(api.getWorkspaceCopy('ROLE_PATIENT'), /patient portal/i);
});
