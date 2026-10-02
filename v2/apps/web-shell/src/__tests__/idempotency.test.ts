// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { stableOperationKey, forgetOperationKey } from '../api/idempotency';
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); sessionStorage.clear(); });
describe('opaque retry keys', () => {
 it('recovers the same operation across reloads without storing patient fields', async () => {
  const input={patientId:'synthetic-private-patient',slotId:'synthetic-slot'};
  const key=await stableOperationKey('hold',input);
  expect(await stableOperationKey('hold',input)).toBe(key);
  expect(await stableOperationKey('confirm',input)).not.toBe(key);
  expect(JSON.stringify(sessionStorage)).not.toContain('synthetic-private-patient');
  await forgetOperationKey('hold',input);
  expect(await stableOperationKey('hold',input)).not.toBe(key);
 });
 it('does not reuse malformed or expired storage records', async () => {
  const key=await stableOperationKey('hold',{});
  const name=sessionStorage.key(0)!;
  sessionStorage.setItem(name,JSON.stringify({key,created:Date.now()-86400001}));
  const fresh=await stableOperationKey('hold',{});expect(fresh).not.toBe(key);
  sessionStorage.setItem(name,'invalid');
  expect(await stableOperationKey('hold',{})).not.toBe(fresh);
 });
});
