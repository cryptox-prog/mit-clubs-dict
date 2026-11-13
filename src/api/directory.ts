export type CategoryTab = 'Clubs' | 'Student Projects' | 'Events'
export type YearGroup = 'FIRST_YEAR' | 'SECOND_YEAR' | 'THIRD_YEAR' | 'FOURTH_YEAR' | 'EVERYONE'
export type DirectoryItem = {
    id: string
    name: string
    category: 'Club' | 'Student Project' | 'Event'
    club_name: string | null
    club_kind: 'Technical' | 'Cultural' | null
    description: string | null
    icon_url: string | null
    application_start: string | null
    registration_deadline: string | null
    event_start: string | null
    event_end: string | null
    participation_type: 'INDIVIDUAL' | 'TEAM' | null
    open_to: YearGroup[]
    domains: string[]
    apply_link: string | null
}
export const resources: Record<CategoryTab, string> = {
    Clubs: 'clubs', 'Student Projects': 'student-projects', Events: 'events',
}
// Empty by default: Vite proxies /api locally; production can use a same-origin
// reverse proxy or set this PUBLIC backend origin at build time. Never add keys.
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
export function apiUrl(path: string) {
    return `${apiOrigin}${path}`
}

const nullableText = (value: unknown) => value === null || typeof value === 'string'
export function isDirectoryItems(value: unknown): value is DirectoryItem[] {
    if (!Array.isArray(value)) return false
    return value.every(item => item && typeof item.id === 'string' && typeof item.name === 'string'
        && ['Club', 'Student Project', 'Event'].includes(item.category)
        && [item.description, item.club_name, item.club_kind, item.icon_url, item.application_start,
            item.registration_deadline, item.event_start, item.event_end, item.participation_type, item.apply_link].every(nullableText)
        && Array.isArray(item.domains) && item.domains.every((domain: unknown) => typeof domain === 'string')
        && Array.isArray(item.open_to) && item.open_to.every((year: unknown) =>
            ['FIRST_YEAR', 'SECOND_YEAR', 'THIRD_YEAR', 'FOURTH_YEAR', 'EVERYONE'].includes(String(year))))
}

type DirectoryPage = {
    data: DirectoryItem[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
}
export async function fetchDirectory(resource: string, signal: AbortSignal): Promise<DirectoryItem[]> {
    const items: DirectoryItem[] = []
    let page = 1
    let totalPages = 1
    do {
        const response = await fetch(apiUrl(`/api/${resource}?page=${page}&limit=200`), { signal })
        if (!response.ok) throw new Error('Unable to load the directory. Please try again.')
        const result: DirectoryPage = await response.json()
        if (!isDirectoryItems(result.data) || !Number.isInteger(result.pagination?.totalPages)
            || result.pagination.totalPages < 0 || result.pagination.totalPages > 1000) {
            throw new Error('The directory returned an invalid response. Please try again.')
        }
        items.push(...result.data)
        totalPages = result.pagination.totalPages
        page++
    } while (page <= totalPages)
    return [...new Map(items.map(item => [item.id, item])).values()]
}
