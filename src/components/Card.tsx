import { useState } from 'react'
import { apiUrl } from '../api/directory'
import { formatDirectoryDate, recruitmentStatus } from '../utils/recruitment'
import './Card.css'
import { analytics } from '../utils/analytics'

export interface CardParameters {
    id: string
    name: string
    subtitle?: string
    description?: string | null
    icon_url?: string | null
    category: 'Club' | 'Student Project' | 'Event'
    domains?: string[]
    application_start?: string | null
    registration_deadline?: string | null
    event_start?: string | null
    event_end?: string | null
    participation_type?: 'INDIVIDUAL' | 'TEAM' | null
    open_to?: string
    apply_link?: string | null
    now?: Date
}
function DirectoryIcon({ name, url }: { name: string; url?: string | null }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null)
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
    return <div className="icon">
        {url && failedUrl !== url ? <img src={apiUrl(url)} alt={`${name} logo`} loading="lazy"
            onError={() => setFailedUrl(url)} /> : <span className="icon-initials" aria-label={`${name} logo unavailable`}>{initials}</span>}
    </div>
}
function Card({ id, name, subtitle, description, icon_url, category, domains, application_start,
    registration_deadline, event_start, event_end, participation_type, open_to, apply_link, now }: CardParameters) {
    const status = recruitmentStatus(application_start, registration_deadline, now)
    const canApply = status === 'open' || status === 'ending_today'
    const statusClass = {
        not_announced: 'status-unknown', upcoming: 'status-upcoming', closed: 'status-closed',
        open: 'status-active', ending_today: 'status-ending-today',
    }[status]
    const statusLabel = {
        not_announced: 'Recruitment not announced', upcoming: 'Recruitment opens soon',
        closed: 'Recruitment closed', open: 'Recruitment open', ending_today: 'Recruitment closes today',
    }[status]
    const borderColor = status === 'closed' ? 'var(--accent-red)'
        : status === 'ending_today' ? 'var(--accent-yellow)'
        : canApply ? 'var(--accent-cyan)' : 'var(--border-strong)'
    const applicationEndLabel = formatDirectoryDate(registration_deadline)
    const deadlineLabel = status === 'closed' ? 'Closed On' : 'Closes On'
    const detailRows = [
        { label: 'Recruitment', value: statusLabel },
        { label: deadlineLabel, value: applicationEndLabel },
        { label: 'Apply From', value: formatDirectoryDate(application_start) },
        { label: 'Open To', value: open_to },
        { label: 'Participation', value: category === 'Event' && participation_type ? (participation_type === 'TEAM' ? 'Team' : 'Individual') : undefined },
        { label: 'Event Start', value: category === 'Event' ? formatDirectoryDate(event_start) : undefined },
        { label: 'Event End', value: category === 'Event' ? formatDirectoryDate(event_end) : undefined },
    ].filter((row): row is { label: string; value: string } => Boolean(row.value))
    const validApplyLink = apply_link && /^https:\/\/[^\s]+$/.test(apply_link)
    return <article className={`card ${statusClass}`} style={{ borderColor }}>
        <DirectoryIcon name={name} url={icon_url} />
        <div className="content">
            <h3>{name}</h3>
            {subtitle && <h4 className="subheading">{subtitle}</h4>}
            {description && <p>{description}</p>}
            {canApply && validApplyLink && <a href={apply_link} target="_blank" rel="noopener noreferrer"
                onClick={() => analytics.capture('application_link_clicked', { listing_id: id, category, recruitment_status: status })}>Apply</a>}
            <div className="metadata">
                <span>Type: {category}</span>
                {!!domains?.length && <span>Domains: {domains.join(', ')}</span>}
            </div>
            <div className="deadline">
                {statusLabel}{applicationEndLabel ? ` · ${deadlineLabel}: ${applicationEndLabel}` : ''}
            </div>
        </div>
        <dl className="details" aria-label={`${name} details`}>
            {detailRows.map(row => <div className="detail-row" key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
        </dl>
    </article>
}
export default Card
