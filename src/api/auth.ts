import { apiUrl } from './directory'
import { analytics } from '../utils/analytics'

export type AuthUser = {
    id: string; email: string; full_name: string; year_group_id: number | null
    email_verified_at: string | null
}
type SessionResponse = { user: AuthUser; accessToken: string; expiresIn: number }
type AuthState = { user: AuthUser | null; ready: boolean; unavailable: boolean }
let state: AuthState = { user: null, ready: false, unavailable: false }
let accessToken: string | null = null
let refreshPromise: Promise<void> | null = null
let bootstrapped = false
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
const listeners = new Set<() => void>()
const namespace = `mit-auth:${apiUrl('/api/auth')}`
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(namespace)
export class AuthError extends Error {
    status: number
    constructor(message: string, status: number) { super(message); this.status = status }
}
function publish(next: AuthState) { state = next; listeners.forEach(listener => listener()) }
function clearSession() {
    analytics.reset()
    generation++
    accessToken = null
    clearTimeout(timer)
    publish({ user: null, ready: true, unavailable: false })
}
async function request(path: string, body: unknown = {}, token?: string | null) {
    const response = await fetch(apiUrl(`/api/auth${path}`), {
        method: 'POST', credentials: 'include', cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mit-clubs-web', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new AuthError(result?.error?.message ?? 'Unable to complete authentication. Please try again.', response.status)
    }
    return response.status === 204 ? null : response.json()
}
function accept(session: SessionResponse) {
    analytics.identify(session.user.id)
    accessToken = session.accessToken
    publish({ user: session.user, ready: true, unavailable: false })
    clearTimeout(timer)
    timer = setTimeout(() => { void refreshSession().catch(() => {}) }, Math.max(10000, (session.expiresIn - 30) * 1000))
}
export function refreshSession(): Promise<void> {
    if (refreshPromise) return refreshPromise
    const current = generation
    const run = async () => {
        try {
            const session: SessionResponse = await request('/refresh')
            if (current === generation) accept(session)
        } catch (error) {
            if (current === generation) {
                if (error instanceof AuthError && error.status === 401) clearSession()
                else {
                    publish({ ...state, ready: true, unavailable: true })
                    if (state.user) timer = setTimeout(() => { void refreshSession().catch(() => {}) }, 30000)
                }
            }
            throw error
        }
    }
    // Refresh cookies are shared between tabs. Serialize rotations so two tabs
    // don't submit the same old token and trigger the backend's replay protection.
    const task = typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request(namespace, run) : run()
    const pending = Promise.resolve(task).then(() => {}).finally(() => { refreshPromise = null })
    refreshPromise = pending
    return pending
}
if (channel) channel.onmessage = event => {
    if (event.data === 'logout') clearSession()
    if (event.data === 'changed') { void refreshSession().catch(() => {}) }
}
export const authStore = {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    bootstrap() {
        if (bootstrapped) return
        bootstrapped = true
        void refreshSession().catch(() => {})
    },
    async submit(mode: 'login' | 'signup', fields: { email: string; password: string; full_name?: string; year_group_id?: number | null }) {
        if (refreshPromise) await refreshPromise.catch(() => {})
        const session: SessionResponse = await request(`/${mode}`, fields)
        generation++
        accept(session)
        analytics.capture(mode === 'signup' ? 'account_signed_up' : 'account_signed_in', {})
        channel?.postMessage('changed')
    },
    async logout(all = false) {
        if (refreshPromise) await refreshPromise.catch(() => {})
        try { await request(all ? '/logout-all' : '/logout', {}, accessToken) }
        catch (error) {
            if (!all || !(error instanceof AuthError) || error.status !== 401) throw error
            await refreshSession()
            await request('/logout-all', {}, accessToken)
        }
        analytics.capture('account_signed_out', { all_sessions: all })
        clearSession()
        channel?.postMessage('logout')
    },
}
// For future protected API calls. Access JWTs exist only in memory; a 401 gets
// one refresh + retry. Auth responses and private records never enter directory cache.
export async function authenticatedFetch(path: string, options: RequestInit = {}) {
    const send = () => {
        const headers = new Headers(options.headers)
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
        return fetch(apiUrl(path), { ...options, headers, credentials: 'include', cache: 'no-store' })
    }
    let response = await send()
    if (response.status === 401) { await refreshSession(); response = await send() }
    return response
}
