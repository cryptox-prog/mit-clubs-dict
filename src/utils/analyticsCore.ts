export type AnalyticsEvents = {
    $pageview: Record<string, never>
    directory_tab_viewed: { category: string }
    directory_searched: { category: string; query_length: number; result_count: number }
    directory_filters_changed: { category: string; filter_count: number }
    application_link_clicked: { listing_id: string; category: string; recruitment_status: string }
    account_signed_up: Record<string, never>
    account_signed_in: Record<string, never>
    account_signed_out: { all_sessions: boolean }
}
export type AnalyticsClient = {
    capture: (event: string, properties: Record<string, unknown>) => unknown
    identify: (id: string) => unknown
    reset: () => unknown
}

// Lazy, ordered operations keep identity changes and clicks in the right order.
// A blocked SDK never interrupts navigation, authentication or directory access.
export function createAnalytics(enabled: boolean, load: () => Promise<AnalyticsClient>) {
    let client: Promise<AnalyticsClient> | null = null
    let pending = Promise.resolve()
    let identified: string | null = null
    let started = false
    function enqueue(action: (sdk: AnalyticsClient) => void) {
        if (!enabled) return
        pending = pending.then(async () => {
            client ??= load()
            action(await client)
        }).catch(() => {})
    }
    return {
        start() {
            if (started) return
            started = true
            enqueue(sdk => { sdk.capture('$pageview', {}) })
        },
        capture<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E]) {
            enqueue(sdk => { sdk.capture(event, properties) })
        },
        identify(id: string) {
            enqueue(sdk => {
                if (identified === id) return
                if (identified) sdk.reset()
                sdk.identify(id)
                identified = id
            })
        },
        reset() {
            enqueue(sdk => { if (identified) sdk.reset(); identified = null })
        },
        // Used by isolated tests to await completion without an external service.
        settled: () => pending,
    }
}

export function safeAnalyticsUrl(value: unknown) {
    if (typeof value !== 'string') return ''
    try { const url = new URL(value); return `${url.origin}${url.pathname}` }
    catch { return '' }
}

export function sanitizeAnalyticsEvent<T extends { properties: Record<string, unknown>; $set?: unknown; $set_once?: unknown }>(event: T | null): T | null {
    if (!event) return null
    // The SDK can attach person properties at the envelope or properties level.
    delete event.$set
    delete event.$set_once
    delete event.properties.$set
    delete event.properties.$set_once
    for (const field of ['$current_url', '$initial_current_url', '$referrer', '$initial_referrer', '$session_entry_url', '$session_entry_referrer']) {
        if (field in event.properties) event.properties[field] = safeAnalyticsUrl(event.properties[field])
    }
    return event
}
