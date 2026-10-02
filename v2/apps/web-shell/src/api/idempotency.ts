// Only opaque operation keys and payload digests are stored, never tokens/profile fields.
async function storageName(operation: string, payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `clinic-v2.operation.${operation}.${hash}`;
}
export async function forgetOperationKey(operation: string, payload: unknown): Promise<void> {
  const name = await storageName(operation, payload);
  try { sessionStorage.removeItem(name); } catch { /* memory fallback */ }
}
export async function stableOperationKey(operation: string, payload: unknown): Promise<string> {
  const name = await storageName(operation, payload);
  try {
    const old = sessionStorage.getItem(name);
    if (old) {
      const entry = JSON.parse(old);
      const age = Date.now() - entry.created;
      if (typeof entry.key === 'string' && /^[0-9a-f-]{36}$/.test(entry.key) && Number.isFinite(age) && age >= 0 && age < 86400000) return entry.key;
    }
  } catch { /* Storage may be unavailable; the in-memory UI still retains retries. */ }
  const key = crypto.randomUUID();
  try { sessionStorage.setItem(name, JSON.stringify({ key, created: Date.now() })); } catch { /* memory fallback */ }
  return key;
}
