import './Card.css'

export interface CardParameters {
    event_name: string;      // Main heading
    club_name?: string;      // Subheading below the event
    description: string;
    is_event: boolean;
    icon_url: string;

    recruitment_start?: Date;
    recruitment_end?: Date;
    domains?: string[];

    application_start?: Date;
    application_end?: Date;
    event_date?: Date;

    type?: string;
    application_link?: string;
}

const Card = ({
    event_name,
    club_name,
    description,
    is_event,
    icon_url,
    recruitment_start,
    recruitment_end,
    domains,
    application_start,
    application_end,
    event_date,
    type,
    application_link
}: CardParameters) => {

    // Determine border color based on status
    const now = new Date();
    let borderColor = 'var(--border-strong)'; // default

    const canApply = is_event
        ? application_start && application_end && now >= new Date(application_start) && now <= new Date(application_end)
        : recruitment_start && recruitment_end && now >= new Date(recruitment_start) && now <= new Date(recruitment_end);

    const noDate = is_event
        ? !application_start || !application_end
        : !recruitment_start || !recruitment_end;

    if (canApply) borderColor = 'green';
    else if (noDate) borderColor = 'gray';
    else borderColor = 'red';

    return (
        <div className="card" style={{ borderColor }}>
            <div className="icon">
                <img src={icon_url} alt={event_name} />
            </div>
            <div className="content">
                <h3>{event_name}</h3>
                {club_name && <h4 className="subheading">{club_name}</h4>}
                <p>{description}</p>
                {application_link && (
                    <a href={application_link} target="_blank" rel="noopener noreferrer">
                        Apply / Learn More
                    </a>
                )}
                <div className="metadata">
                    {type && <span>Type: {type}</span>}
                    {domains && domains.length > 0 && <span>Domains: {domains.join(', ')}</span>}
                </div>
            </div>
        </div>
    );
};

export default Card;
