import './Card.css'

export interface CardParameters {
    name: string;
    subtitle?: string;
    description: string;
    icon_url: string;
    category: 'Club' | 'Student Project' | 'Event';

    domains?: string[];

    application_start?: Date;
    application_end?: Date;
    event_date?: Date;
    event_end?: Date;
    team_size?: string;
    open_to?: string;

    type?: string;
    application_link?: string;
}

const formatDate = (date?: Date) => {
    if (!date) return undefined;

    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(date));
}

const Card = ({
    name,
    subtitle,
    description,
    icon_url,
    category,
    domains,
    application_start,
    application_end,
    event_date,
    event_end,
    team_size,
    open_to,
    type,
    application_link
}: CardParameters) => {

    // Determine border color based on status
    const now = new Date();
    let borderColor = 'var(--border-strong)'; // default

    const canApply = application_start && application_end && now >= new Date(application_start) && now <= new Date(application_end);
    const noDate = !application_start || !application_end;

    if (canApply) borderColor = 'green';
    else if (noDate) borderColor = 'gray';
    else borderColor = 'red';

    const applicationEndLabel = formatDate(application_end);
    const detailRows = [
        category === 'Event' && { label: 'Start Date', value: formatDate(event_date) },
        category === 'Event' && { label: 'End Date', value: formatDate(event_end) },
        { label: canApply ? 'Closes On' : 'Closed On', value: applicationEndLabel },
        team_size && { label: 'Team Size', value: team_size },
        open_to && { label: 'Open To', value: open_to },
        category !== 'Event' && { label: 'Apply From', value: formatDate(application_start) },
    ].filter((row): row is { label: string; value: string } => Boolean(row && row.value));

    return (
        <div className="card" style={{ borderColor }}>
            <div className="icon">
                <img src={icon_url} alt={name} />
            </div>
            <div className="content">
                <h3>{name}</h3>
                {subtitle && <h4 className="subheading">{subtitle}</h4>}
                <p>{description}</p>
                {application_link && (
                    <a href={application_link} target="_blank" rel="noopener noreferrer">
                        Apply / Learn More
                    </a>
                )}
                <div className="metadata">
                    <span>Type: {type || category}</span>
                    {domains && domains.length > 0 && <span>Domains: {domains.join(', ')}</span>}
                </div>
                {applicationEndLabel && (
                    <div className="deadline">
                        {canApply ? 'Closes On' : 'Closed On'}: {applicationEndLabel}
                    </div>
                )}
            </div>
            {detailRows.length > 0 && (
                <dl className="details" aria-label={`${name} details`}>
                    {detailRows.map(row => (
                        <div className="detail-row" key={row.label}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
};

export default Card;
