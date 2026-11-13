import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { parseEnv } from '../config/env.js';

const config = { CORS_ORIGINS: ['http://localhost:5173'] };
function fakeDatabase(error = null) {
  return { from: () => ({ select: () => ({ limit: () => ({
    abortSignal: async () => ({ error }),
  }) }) }) };
}
async function withServer(supabase, run) {
  const app = createApp({ config, supabase });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', error => {
      if (error) reject(error);
      else resolve(listener);
    });
    listener.once('error', reject);
  });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('health, allowed browser origin, request IDs and security headers', async () => {
  await withServer(fakeDatabase(), async base => {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.ok(response.headers.get('x-request-id'));
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await response.json()).status, 'ok');
    assert.equal((await fetch(`${base}/api/health/ready`)).status, 200);
  });
});

test('rejects unapproved browser origins, malformed JSON, and unknown paths', async () => {
  await withServer(fakeDatabase(), async base => {
    const denied = await fetch(`${base}/api/health`, { headers: { Origin: 'https://unapproved.example' } });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const malformed = await fetch(`${base}/api/missing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.message, 'Invalid JSON body');
    const missing = await fetch(`${base}/api/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.message, 'Route not found');
  });
});

test('readiness failure hides upstream information', async () => {
  await withServer(fakeDatabase({ message: 'secret database internals' }), async base => {
    const response = await fetch(`${base}/api/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'not_ready' });
  });
});

test('environment rejects missing secrets and invalid ports without disclosing secret values', () => {
  const input = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
    JWT_SECRET: 'test-only-secret-with-more-than-32-characters',
  };
  assert.equal(parseEnv(input).PORT, 3000);
  assert.throws(() => parseEnv({ ...input, PORT: 'wrong' }), /PORT/);
  assert.throws(() => parseEnv({ ...input, JWT_SECRET: 'do-not-print-me' }), error => {
    assert.match(error.message, /JWT_SECRET/);
    assert.ok(!error.message.includes('do-not-print-me'));
    return true;
  });
  assert.throws(() => parseEnv({}), /SUPABASE_SERVICE_ROLE_KEY/);
});
