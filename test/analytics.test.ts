import test from 'node:test'
import assert from 'node:assert/strict'
import { createAnalytics, safeAnalyticsUrl, sanitizeAnalyticsEvent } from '../src/utils/analyticsCore.ts'

test('analytics initializes once and preserves identity/event/reset ordering', async () => {
    const calls: unknown[] = []
    let loads = 0
    const analytics = createAnalytics(true, async () => {
        loads++
        return { capture: (event, properties) => calls.push([event, properties]), identify: id => calls.push(['identify', id]), reset: () => calls.push(['reset']) }
    })
    analytics.start(); analytics.start()
    analytics.identify('user-one'); analytics.identify('user-one')
    analytics.capture('account_signed_in', {})
    analytics.identify('user-two')
    analytics.capture('account_signed_out', { all_sessions: false })
    analytics.reset(); analytics.reset()
    await analytics.settled()
    assert.equal(loads, 1)
    assert.deepEqual(calls, [['$pageview', {}], ['identify', 'user-one'], ['account_signed_in', {}], ['reset'], ['identify', 'user-two'], ['account_signed_out', { all_sessions: false }], ['reset']])
})

test('unconfigured or blocked analytics cannot break application actions', async () => {
    let loads = 0
    const disabled = createAnalytics(false, async () => { loads++; throw new Error('must not load') })
    disabled.start(); disabled.identify('user'); disabled.capture('account_signed_up', {}); disabled.reset()
    await disabled.settled(); assert.equal(loads, 0)
    const blocked = createAnalytics(true, async () => { throw new Error('blocked SDK') })
    blocked.start(); blocked.identify('user'); blocked.capture('account_signed_up', {}); blocked.reset()
    await assert.doesNotReject(blocked.settled())
})

test('analytics URL sanitization removes query strings and fragments', () => {
    assert.equal(safeAnalyticsUrl('https://clubs.example/path?email=private@example.com#token=secret'), 'https://clubs.example/path')
    assert.equal(safeAnalyticsUrl(null), '')
    assert.equal(safeAnalyticsUrl('invalid'), '')
})

test('SDK envelope and nested person properties cannot bypass URL sanitization', () => {
    const event = { event: '$identify', $set: { email: 'private@example.com' }, $set_once: { $initial_current_url: 'https://clubs.example/?token=private' },
        properties: { distinct_id: 'account-uuid', $set: { full_name: 'Private Name' }, $set_once: { email: 'private@example.com' },
            $current_url: 'https://clubs.example/?email=private@example.com#private', $session_entry_url: 'https://clubs.example/?token=private',
            $session_entry_referrer: 'https://example.com/?token=private', category: 'Clubs' } }
    const safe = sanitizeAnalyticsEvent(event)
    assert.ok(safe)
    assert.equal(safe.properties.distinct_id, 'account-uuid')
    assert.equal(safe.properties.category, 'Clubs')
    assert.ok(!JSON.stringify(safe).includes('private'))
    assert.ok(!('$set' in safe)); assert.ok(!('$set_once' in safe))
    assert.equal(sanitizeAnalyticsEvent(null), null)
})
