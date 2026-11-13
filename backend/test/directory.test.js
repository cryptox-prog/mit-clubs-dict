import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { iconVersion } from '../utils/iconCache.js';

const id = '7030bcf4-42c4-5641-b837-1d9468287093';
const key = `clubs/${id}/${'a'.repeat(64)}.png`;
function fakeDb({ path = key, listError = null, storageError = null } = {}) {
  const calls = [];
  const db = {
    calls,
    from(table) {
      const query = { table };
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        order() { return builder; },
        range(from, to) { query.range = [from, to]; return builder; },
        eq(field, value) { query[field] = value; return builder; },
        maybeSingle() { query.single = true; return builder; },
        async abortSignal() {
          calls.push(query);
          if (query.single) return { data: { icon_path: path }, error: null };
          return { error: listError, count: 1, data: [{
            id, name: 'ACM Manipal', description: null, icon_path: path, updated_at: '2026-11-13',
            application_start: null, registration_deadline: null, apply_link: null,
            club_kind: 'Technical', domain_links: [{ domain: { name: 'Computer Science' } }],
            year_links: [], password_hash: 'must-not-leak',
          }] };
        },
      };
      return builder;
    },
    storage: { from(bucket) { return { async download(name) {
      calls.push({ bucket, key: name });
      return { data: new Blob([Buffer.from([137,80,78,71,13,10,26,10])], { type: 'image/png' }), error: storageError };
    } }; } },
  };
  return db;
}
async function withApp(db, run) {
  const app = createApp({ config: { CORS_ORIGINS: ['http://localhost:5173'], SUPABASE_STORAGE_BUCKET: 'assets' }, supabase: db });
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(s));
    s.once('error', reject);
  });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('directory projects public fields only, keeps missing dates null, and paginates', async () => {
  const db = fakeDb();
  await withApp(db, async base => {
    const response = await fetch(`${base}/api/clubs?page=2&limit=20`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data[0].name, 'ACM Manipal');
    assert.equal(body.data[0].application_start, null);
    assert.deepEqual(body.data[0].domains, ['Computer Science']);
    assert.deepEqual(body.data[0].open_to, []);
    assert.equal(body.data[0].password_hash, undefined);
    assert.equal(body.data[0].icon_path, undefined);
    assert.match(body.data[0].icon_url, /^\/api\/clubs\//);
    assert.deepEqual(db.calls[0].range, [20,39]);
    assert.ok(!db.calls[0].columns.includes('*'));
    assert.equal(body.pagination.total, 1);
  });
});
test('directory rejects bad pagination and does not expose arbitrary tables', async () => {
  const db = fakeDb();
  await withApp(db, async base => {
    for (const query of ['limit=201','page=0','page=nope','page=1&page=2','unknown=x']) {
      assert.equal((await fetch(`${base}/api/clubs?${query}`)).status, 400);
    }
    assert.equal((await fetch(`${base}/api/users`)).status, 404);
    assert.equal((await fetch(`${base}/api/auth_sessions`)).status, 404);
    assert.equal(db.calls.length, 0);
  });
});
test('directory database failures return a safe retryable error', async () => {
  await withApp(fakeDb({ listError: { message: 'private database information' } }), async base => {
    const response = await fetch(`${base}/api/events`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.message, 'Directory is temporarily unavailable');
  });
});
test('icon streams through Node with MIME, caching, cross-origin policy and conditional request support', async () => {
  const db = fakeDb();
  await withApp(db, async base => {
    const response = await fetch(`${base}/api/clubs/${id}/icon`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal((await response.arrayBuffer()).byteLength, 8);
    assert.deepEqual(db.calls.find(call => call.bucket), { bucket: 'assets', key });
    const cached = await fetch(`${base}/api/clubs/${id}/icon`, { headers: { 'If-None-Match': response.headers.get('etag') } });
    assert.equal(cached.status, 304);
    assert.equal(db.calls.filter(call => call.bucket).length, 1);
  });
});
test('icon refuses invalid IDs, missing icons, and paths outside the entity folder', async () => {
  for (const path of [null, 'private/secrets.txt', `clubs/${id}/../file.png`, `projects/${id}/logo.png`]) {
    const db = fakeDb({ path });
    await withApp(db, async base => {
      assert.equal((await fetch(`${base}/api/clubs/${id}/icon`)).status, 404);
      assert.equal((await fetch(`${base}/api/clubs/bad-id/icon`)).status, 400);
      assert.equal(db.calls.filter(call => call.bucket).length, 0);
    });
  }
});
test('missing storage objects return 404 without cache headers', async () => {
  await withApp(fakeDb({ storageError: { statusCode: '404' } }), async base => {
    const response = await fetch(`${base}/api/clubs/${id}/icon`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), null);
  });
});

test('versioned content-addressed icons get long-lived immutable caching', async () => {
  await withApp(fakeDb(), async base => {
    const response = await fetch(`${base}/api/clubs/${id}/icon?v=${iconVersion(key)}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    await response.arrayBuffer();
  });
});
test('outdated icon versions redirect without poisoning an immutable URL', async () => {
  const db = fakeDb();
  await withApp(db, async base => {
    const response = await fetch(`${base}/api/clubs/${id}/icon?v=old`, { redirect: 'manual' });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('location'), `/api/clubs/${id}/icon?v=${iconVersion(key)}`);
    assert.equal(db.calls.filter(call => call.bucket).length, 0);
  });
});
test('manually named icons stay short-lived and cannot return a stale path-only ETag', async () => {
  const path = `clubs/${id}/manual.png`;
  await withApp(fakeDb({ path }), async base => {
    const response = await fetch(`${base}/api/clubs/${id}/icon?v=${iconVersion(path)}`);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
    assert.equal(response.headers.get('etag'), null);
    await response.arrayBuffer();
  });
});
