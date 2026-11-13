import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiUrl } from '../api/directory'
import { managementRequest, refreshPublicDirectory } from '../api/management'
import type { ManagedListing, ManagementData, ManagerAssignment } from '../api/management'
import { useAuth } from '../hooks/useAuth'
import './ManagementDashboard.css'

const kindLabels = { clubs: 'Club', 'student-projects': 'Student project', events: 'Event' }
function campusInput(value: string | null) {
    if (!value) return ''
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
    const get = (type: string) => parts.find(part => part.type === type)?.value
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
function Assignments({ listing }: { listing: ManagedListing }) {
    const [managers, setManagers] = useState<ManagerAssignment[]>([])
    const [email, setEmail] = useState('')
    const [busy, setBusy] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const endpoint = `/${listing.kind}/${listing.id}/managers`
    useEffect(() => {
        const controller = new AbortController()
        managementRequest<{ data: ManagerAssignment[] }>(endpoint, { signal: controller.signal })
            .then(result => { setManagers(result.data); setLoading(false) })
            .catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false) } })
        return () => controller.abort()
    }, [endpoint])
    async function change(target: string, assign: boolean) {
        setBusy(true); setError(null)
        try {
            await managementRequest(endpoint, { method: 'PUT', body: JSON.stringify({ email: target, assign }) })
            const result = await managementRequest<{ data: ManagerAssignment[] }>(endpoint)
            setManagers(result.data); setEmail('')
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to update assignment') }
        finally { setBusy(false) }
    }
    return <section className="manager-assignments" aria-labelledby="assignment-title">
        <h3 id="assignment-title">Manager assignments</h3>
        <p>Assign a registered user by email. {listing.kind === 'clubs' ? 'Club managers can also edit its linked projects and events.' : 'Project managers can edit this project only.'}</p>
        {error && <p className="management-error" role="alert">{error}</p>}
        {loading ? <p role="status">Loading managers…</p> : managers.length === 0 ? <p>No directly assigned managers.</p> : <ul>
            {managers.map(manager => <li key={manager.user_id}><span><strong>{manager.full_name || manager.email}</strong><small>{manager.email}</small></span>
                <button className="btn secondary" disabled={busy} onClick={() => { void change(manager.email, false) }}>Remove<span className="sr-only"> {manager.email}</span></button></li>)}
        </ul>}
        <form className="assignment-form" onSubmit={event => { event.preventDefault(); void change(email.trim().toLowerCase(), true) }}>
            <label>User email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="student@example.com" /></label>
            <button className="btn" disabled={busy || loading} type="submit">Assign manager</button>
        </form>
    </section>
}
function ListingEditor({ listing, data, onSaved, onReload }: { listing: ManagedListing; data: ManagementData; onSaved: () => void; onReload: () => void }) {
    const [domains, setDomains] = useState(listing.domain_ids)
    const [years, setYears] = useState(listing.year_group_ids)
    const [file, setFile] = useState<File | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const version = useRef(listing.updated_at)
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); setError(null)
        if (file && (file.size > 5 * 1024 * 1024 || !['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(file.type))) {
            setError('Choose a PNG, JPEG, WebP, GIF or AVIF logo no larger than 5 MiB.'); return
        }
        const form = new FormData(event.currentTarget)
        const text = (key: string) => String(form.get(key) ?? '').trim() || null
        const time = (key: string) => text(key) ? `${text(key)}:00+05:30` : null
        const body = {
            expected_updated_at: version.current, name: text('name'), description: text('description'),
            application_start: text('application_start'), registration_deadline: text('registration_deadline'),
            apply_link: text('apply_link'), domain_ids: domains, year_group_ids: years,
            ...(listing.kind === 'clubs' ? { club_kind: text('club_kind') } : {}),
            ...(listing.kind === 'events' ? { event_start: time('event_start'), event_end: time('event_end'), participation_type: text('participation_type') } : {}),
        }
        setBusy(true)
        let saved = false
        try {
            const result = await managementRequest<{ updated_at: string }>(`/${listing.kind}/${listing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
            version.current = result.updated_at; saved = true
            if (file) {
                const upload = new FormData(); upload.set('expected_updated_at', version.current); upload.set('icon', file)
                const icon = await managementRequest<{ updated_at: string }>(`/${listing.kind}/${listing.id}/icon`, { method: 'POST', body: upload })
                version.current = icon.updated_at
            }
            void refreshPublicDirectory(listing.kind)
            onSaved()
        } catch (failure) {
            const message = failure instanceof Error ? failure.message : 'Unable to save listing'
            setError(saved ? `Listing details were saved, but the logo was not updated. ${message}` : message)
            if (saved) void refreshPublicDirectory(listing.kind)
        } finally { setBusy(false) }
    }
    const yearNames: Record<number, string> = { 1: 'First year', 2: 'Second year', 3: 'Third year', 4: 'Fourth year', 5: 'Everyone' }
    return <div className="listing-editor">
        <div className="editor-heading"><div><span className="dashboard-eyebrow">{kindLabels[listing.kind]}</span><h2>{listing.name}</h2></div>
            {listing.icon_url && <img className="editor-icon" src={apiUrl(listing.icon_url)} alt={`${listing.name} logo`} />}
        </div>
        {error && <div className="management-error" role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={onReload}>Reload listing</button></div>}
        <form className="listing-form" onSubmit={event => { void save(event) }}>
            <fieldset disabled={busy}>
                <label>Name<input name="name" defaultValue={listing.name} required maxLength={200} /></label>
                {listing.kind === 'clubs' && <label>Club type<select name="club_kind" defaultValue={listing.club_kind ?? 'Technical'}><option>Technical</option><option>Cultural</option></select></label>}
                <label>Description<textarea name="description" rows={3} defaultValue={listing.description ?? ''} maxLength={10000} /></label>
                <div className="editor-two-columns">
                    <label>Recruitment opens<input type="date" name="application_start" defaultValue={listing.application_start ?? ''} /></label>
                    <label>Registration deadline<input type="date" name="registration_deadline" defaultValue={listing.registration_deadline ?? ''} /></label>
                </div>
                <p className="editor-hint">Leave both dates empty when recruitment is not announced. Deadlines include the final day in Manipal.</p>
                <label>Application link<input type="url" name="apply_link" placeholder="https://…" defaultValue={listing.apply_link ?? ''} maxLength={2048} /></label>
                {listing.kind === 'events' && <>
                    <div className="editor-two-columns">
                        <label>Event starts (IST)<input type="datetime-local" name="event_start" defaultValue={campusInput(listing.event_start)} /></label>
                        <label>Event ends (IST)<input type="datetime-local" name="event_end" defaultValue={campusInput(listing.event_end)} /></label>
                    </div>
                    <label>Participation<select name="participation_type" defaultValue={listing.participation_type ?? ''}><option value="">Not specified</option><option value="INDIVIDUAL">Individual</option><option value="TEAM">Team</option></select></label>
                </>}
                <fieldset className="editor-options"><legend>Domains</legend><div>{data.domains.map(domain => <label key={domain.id}>
                    <input type="checkbox" checked={domains.includes(domain.id)} onChange={() => setDomains(current => current.includes(domain.id) ? current.filter(id => id !== domain.id) : [...current, domain.id])} />{domain.name}</label>)}</div></fieldset>
                <fieldset className="editor-options"><legend>Open to</legend><div>{data.year_groups.map(year => <label key={year.id}>
                    <input type="checkbox" checked={years.includes(year.id)} onChange={() => setYears(current => current.includes(year.id) ? current.filter(id => id !== year.id) : year.id === 5 ? [5] : [...current.filter(id => id !== 5), year.id])} />{yearNames[year.id] ?? year.name}</label>)}</div></fieldset>
                <p className="editor-hint">Leave eligibility unchecked if it has not been confirmed.</p>
                <label>Replace logo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
                <p className="editor-hint">Up to 5 MiB. The image is resized to fit 512 pixels; animated logos use the first frame.</p>
                <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </fieldset>
        </form>
        {data.is_admin && listing.kind !== 'events' && <Assignments listing={listing} />}
    </div>
}
export default function ManagementDashboard({ onClose }: { onClose: () => void }) {
    const { user } = useAuth()
    const userId = user?.id
    const [result, setResult] = useState<{ userId: string; data: ManagementData } | null>(null)
    const [selectedId, setSelectedId] = useState('')
    const [query, setQuery] = useState('')
    const [revision, setRevision] = useState(0)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const panel = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
            if (event.key !== 'Tab') return
            const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') ?? [])]
            const first = elements[0], last = elements[elements.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
        document.addEventListener('keydown',keyboard)
        return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown',keyboard); previous?.focus() }
    }, [onClose])
    useEffect(() => {
        if (!userId) return
        const controller = new AbortController()
        managementRequest<ManagementData>('/dashboard', { signal: controller.signal })
            .then(data => { setResult({ userId, data }); setError(null) })
            .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
        return () => controller.abort()
    }, [userId, revision])
    const data = result?.userId === user?.id ? result?.data : null
    const selected = data?.listings.find(item => item.id === selectedId) ?? data?.listings[0]
    const listings = data?.listings.filter(item => item.name.toLowerCase().includes(query.toLowerCase())) ?? []
    return <div className="dashboard-overlay"><div ref={panel} className="management-dashboard" role="dialog" aria-modal="true" aria-labelledby="dashboard-title">
        <header className="dashboard-header"><div><span className="dashboard-eyebrow">{data?.is_admin ? 'Administrator' : 'Club & project managers'}</span><h1 id="dashboard-title">Manage directory</h1></div><button className="btn secondary" onClick={onClose}>Close dashboard</button></header>
        {message && <p className="dashboard-notice" role="status">{message}</p>}
        {error && <div className="management-error" role="alert"><p>{error}</p><button className="btn" onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
        {!user ? <p className="dashboard-empty">Please sign in to manage listings.</p> : !data && !error ? <p className="dashboard-empty" role="status">Loading your listings…</p> : data && data.listings.length === 0 ? <p className="dashboard-empty">No listings are assigned to you yet. Ask an administrator to assign your club or project.</p> : data && <div className="dashboard-body">
            <aside className="dashboard-sidebar"><label>Find a listing<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your listings" /></label>
                <nav aria-label="Managed listings">{listings.map(item => <button key={item.id} className={selected?.id === item.id ? 'selected' : ''} aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => { setSelectedId(item.id); setMessage(null) }}><span>{item.name}</span><small>{kindLabels[item.kind]}</small></button>)}{!listings.length && <p>No matching listings.</p>}</nav>
            </aside>
            <div className="dashboard-editor">{selected && <ListingEditor key={`${selected.id}:${selected.updated_at}`} listing={selected} data={data}
                onSaved={() => { setMessage('Listing saved.'); setRevision(value => value + 1) }}
                onReload={() => { setMessage(null); setRevision(value => value + 1) }} />}</div>
        </div>}
    </div></div>
}
