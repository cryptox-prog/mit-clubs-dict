import { authenticatedFetch } from './auth'
import { directoryCache } from './directoryCache'

export type ListingKind = 'clubs' | 'student-projects' | 'events'
export type ManagedListing = {
    kind: ListingKind; id: string; name: string; description: string | null
    club_kind: 'Technical' | 'Cultural' | null; club_id: string | null; icon_url: string | null
    application_start: string | null; registration_deadline: string | null; apply_link: string | null
    event_start: string | null; event_end: string | null; participation_type: 'INDIVIDUAL' | 'TEAM' | null
    updated_at: string; domain_ids: string[]; year_group_ids: number[]
}
export type ManagementData = {
    is_admin: boolean; listings: ManagedListing[]
    domains: Array<{ id: string; name: string }>; year_groups: Array<{ id: number; name: string }>
}
export type ManagementAccess = { is_admin: boolean; managed_club_ids: string[]; managed_project_ids: string[] }
export type ManagerAssignment = { user_id: string; email: string; full_name: string }
export class ManagementError extends Error {
    status: number
    constructor(message: string, status: number) { super(message); this.status = status }
}
export async function managementRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers)
    if (options.method && options.method !== 'GET') headers.set('X-Requested-With', 'mit-clubs-web')
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    const response = await authenticatedFetch(`/api/manage${path}`, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(20000) })
    if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new ManagementError(result?.error?.message ?? 'Unable to update the directory. Please try again.', response.status)
    }
    return response.status === 204 ? undefined as T : response.json()
}
export async function refreshPublicDirectory(kind: ListingKind) {
    // Wait out any old request before forcing a post-save read.
    await directoryCache.load(kind).catch(() => {})
    await directoryCache.load(kind, true).catch(() => {})
}
