import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourceCache } from '../src/utils/resourceCache.ts'

const validate = (value: unknown): value is number[] => Array.isArray(value) && value.every(v => typeof v === 'number')
function fixture() {
    let now = 10000
    let calls = 0
    let fail = false
    const stored = new Map<string, string>()
    const options = {
        namespace: 'test:v1:api', validate, now: () => now, freshFor: 1000, retainFor: 5000,
        load: async () => { calls++; if (fail) throw new Error('offline'); return [calls] },
        storage: () => ({
            getItem: (key: string) => stored.get(key) ?? null,
            setItem: (key: string, value: string) => { stored.set(key, value) },
            removeItem: (key: string) => { stored.delete(key) },
        }),
    }
    return { options, stored, advance: (ms: number) => { now += ms }, fail: () => { fail = true }, calls: () => calls }
}
test('cache deduplicates concurrent requests, caches empty results, and allows forced refresh', async () => {
    const f = fixture(), cache = createResourceCache(f.options)
    assert.equal(cache.snapshot('clubs').data, null)
    const first = cache.load('clubs'), second = cache.load('clubs')
    assert.equal(first, second)
    await first
    await cache.load('clubs')
    assert.equal(f.calls(), 1)
    assert.deepEqual(cache.snapshot('clubs').data, [1])
    await cache.load('clubs', true)
    assert.deepEqual(cache.snapshot('clubs').data, [2])
    const empty = createResourceCache({ ...f.options, load: async () => [] })
    await empty.load('events')
    assert.deepEqual(empty.snapshot('events').data, [])
})
test('browser persistence survives new instances and expires after the retention window', async () => {
    const f = fixture(), first = createResourceCache(f.options)
    await first.load('clubs')
    const reloaded = createResourceCache(f.options)
    assert.deepEqual(reloaded.snapshot('clubs').data, [1])
    await reloaded.load('clubs')
    assert.equal(f.calls(), 1)
    f.advance(5001)
    assert.equal(reloaded.snapshot('clubs').data, null)
    assert.equal(f.stored.size, 0)
})
test('stale data remains visible during revalidation and after a failed refresh', async () => {
    const f = fixture(), cache = createResourceCache(f.options)
    await cache.load('clubs')
    f.advance(1001); f.fail()
    const refreshing = cache.load('clubs')
    assert.deepEqual(cache.snapshot('clubs').data, [1])
    assert.equal(cache.snapshot('clubs').refreshing, true)
    await assert.rejects(refreshing)
    assert.deepEqual(cache.snapshot('clubs').data, [1])
    assert.ok(cache.snapshot('clubs').error)
    assert.equal(cache.snapshot('clubs').refreshing, false)
})
test('corrupt, invalid and future-dated persistent data are discarded', () => {
    for (const raw of ['{', JSON.stringify({ data: ['wrong'], updatedAt: 10000 }), JSON.stringify({ data: [1], updatedAt: 20000 })]) {
        const f = fixture()
        f.stored.set('test:v1:api:clubs', raw)
        assert.equal(createResourceCache(f.options).snapshot('clubs').data, null)
        assert.equal(f.stored.size, 0)
    }
})
test('blocked browser storage falls back to working in-memory caching', async () => {
    const f = fixture()
    const cache = createResourceCache({ ...f.options, storage: () => { throw new Error('Storage unavailable') } })
    await cache.load('clubs'); await cache.load('clubs')
    assert.equal(f.calls(), 1)
    assert.deepEqual(cache.snapshot('clubs').data, [1])
})
