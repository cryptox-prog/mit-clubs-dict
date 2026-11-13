// Recruitment dates are campus calendar dates, inclusive through the final day.
export function campusDay(now = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now)
    const get = (type: string) => parts.find(part => part.type === type)!.value
    return `${get('year')}-${get('month')}-${get('day')}`
}
function validDay(value?: string | null): value is string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function recruitmentStatus(start?: string | null, deadline?: string | null, now = new Date()) {
    if (!validDay(start) || !validDay(deadline) || start > deadline) return 'not_announced'
    const today = campusDay(now)
    if (today < start) return 'upcoming'
    if (today > deadline) return 'closed'
    return today === deadline ? 'ending_today' : 'open'
}
export function formatDirectoryDate(value?: string | null) {
    if (!value) return undefined
    // Anchor date-only fields at campus noon, avoiding UTC-midnight shifts.
    const parsed = new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value)
    if (Number.isNaN(parsed.getTime())) return undefined
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    }).format(parsed)
}
