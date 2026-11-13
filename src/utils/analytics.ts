import { createAnalytics, sanitizeAnalyticsEvent } from './analyticsCore'

const key = (import.meta.env.VITE_POSTHOG_KEY ?? '').trim()
const host = (import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/$/, '')
let validHost = false
try { const url = new URL(host); validHost = url.protocol === 'https:' && url.origin === host } catch { /* Disabled until configured. */ }

export const analytics = createAnalytics(Boolean(key && key.startsWith('phc_') && validHost), async () => {
    const { default: posthog } = await import('posthog-js')
    posthog.init(key, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_external_dependency_loading: true,
        disable_capture_url_hashes: true,
        advanced_disable_flags: true,
        person_profiles: 'identified_only',
        persistence: 'localStorage',
        save_campaign_params: false,
        save_referrer: false,
        respect_dnt: true,
        ip: false,
        property_denylist: ['$initial_current_url', '$initial_referrer', '$referrer', '$initial_person_info'],
        before_send: sanitizeAnalyticsEvent,
    })
    return posthog
})
