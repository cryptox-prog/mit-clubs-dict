import './App.css'
import TopBar from './components/TopBar'
import Card from './components/Card'
import Tabs from './components/Tabs'
import FilterDialog from './components/FilterDialog'
import FilterTags from './components/FilterTags'
import React from 'react'

function App() {
    type CategoryTab = 'Clubs' | 'Student Projects' | 'Events'
    type DirectoryCategory = 'Club' | 'Student Project' | 'Event'
    type DirectoryItem = {
        id: string
        name: string
        subtitle?: string
        description: string
        category: DirectoryCategory
        icon_url: string
        application_start?: Date
        application_end: Date
        event_date?: Date
        event_end?: Date
        team_size?: string
        open_to?: string
        domains?: string[]
        application_link?: string
    }

    const tabs: Array<{ label: CategoryTab; mobileLabel?: string }> = [
        { label: 'Clubs' },
        { label: 'Student Projects', mobileLabel: 'SP' },
        { label: 'Events' },
    ]

    const [selectedTab, setSelectedTab] = React.useState<CategoryTab>('Clubs')
    const [filtersOpen, setFiltersOpen] = React.useState(false)
    const [filters, setFilters] = React.useState<string[]>([])
    const [searchQuery, setSearchQuery] = React.useState('')

    const handleApplyFilters = (f: string[]) => setFilters(f)
    const handleRemoveFilter = (f: string) => setFilters(prev => prev.filter(p => p !== f))
    const handleClearFilters = () => setFilters([])
    return (
        <>
            <TopBar />
            <div className='main-container'>
                <div className='greeting'>
                    <h1>Clubs, Student Projects and Events</h1>
                    <p>Discover and apply to the student organizations of Manipal Institiute of Technology</p>
                </div>
                <Tabs
                    tabs={tabs}
                    selectedIndex={tabs.findIndex(tab => tab.label === selectedTab)}
                    onChange={(i) => setSelectedTab(tabs[i].label)}
                />

                <div className='filter-container'>
                    <input
                        placeholder='Search By Name'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button aria-label="Open filters" onClick={() => setFiltersOpen(true)} />
                </div>

                <FilterTags filters={filters} onRemove={handleRemoveFilter} onClear={handleClearFilters} />

                <FilterDialog
                    open={filtersOpen}
                    selectedFilters={filters}
                    onApply={handleApplyFilters}
                    onClose={() => setFiltersOpen(false)}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin:'10px 0px 0px 0px' }}>
                    {/* Cards data */}
                    {(() => {
                        const items: DirectoryItem[] = [
                            {
                                id: 'club-robotics',
                                name: 'Tech Robotics Club',
                                subtitle: 'Robotics Recruitment 2026',
                                description: 'Join our club to build amazing robots and participate in national competitions.',
                                category: 'Club',
                                icon_url: 'https://cdn-icons-png.flaticon.com/512/1383/1383267.png',
                                application_start: new Date('2026-02-01'),
                                application_end: new Date('2026-02-28'),
                                open_to: 'All Students',
                                domains: ['AI', 'Automation'],
                                application_link: 'https://techrobotics.example.com/apply',
                            },
                            {
                                id: 'sp-rover',
                                name: 'Mars Rover Manipal',
                                subtitle: 'Student Project Recruitment 2026',
                                description: 'Build rover systems across mechanical design, electronics, autonomy, and software.',
                                category: 'Student Project',
                                icon_url: 'https://cdn-icons-png.flaticon.com/512/3212/3212608.png',
                                application_start: new Date('2026-02-10'),
                                application_end: new Date('2026-03-05'),
                                open_to: 'All Students',
                                domains: ['AI', 'Automation'],
                                application_link: 'https://marsrover.example.com/apply',
                            },
                            {
                                id: 'event-hackathon',
                                name: 'Hackathon 2026',
                                subtitle: 'Hosted by Coding Club',
                                description: 'Participate in a 48-hour coding marathon and showcase your skills.',
                                category: 'Event',
                                icon_url: 'https://cdn-icons-png.flaticon.com/512/2913/2913970.png',
                                application_start: new Date('2026-02-05'),
                                application_end: new Date('2026-02-15'),
                                event_date: new Date('2026-03-01'),
                                event_end: new Date('2026-03-03'),
                                team_size: '2 - 4 Members',
                                open_to: 'All Students',
                                domains: ['Web', 'Mobile', 'AI'],
                                application_link: 'https://codingclub.example.com/hackathon',
                            },
                            {
                                id: 'event-photo',
                                name: 'Photography Exhibition',
                                subtitle: 'Hosted by Arts & Photography Club',
                                description: 'Showcase your photography skills in our annual exhibition.',
                                category: 'Event',
                                icon_url: 'https://cdn-icons-png.flaticon.com/512/1383/1383269.png',
                                event_date: new Date('2026-03-25'),
                                event_end: new Date('2026-03-25'),
                                application_end: new Date('2026-03-20'),
                                team_size: 'Individual',
                                open_to: 'All Students',
                                domains: ['Photography', 'Arts'],
                                application_link: 'https://artsclub.example.com/exhibition',
                            },
                        ]

                        const q = searchQuery.trim().toLowerCase()

                        const filtered = items.filter(item => {
                            // tab filter
                            if (selectedTab === 'Clubs' && item.category !== 'Club') return false
                            if (selectedTab === 'Student Projects' && item.category !== 'Student Project') return false
                            if (selectedTab === 'Events' && item.category !== 'Event') return false

                            // search filter (match primary or secondary name)
                            if (q) {
                                const name = (item.name || '').toLowerCase()
                                const subtitle = (item.subtitle || '').toLowerCase()
                                if (!name.includes(q) && !subtitle.includes(q)) return false
                            }

                            // domain filters (match any)
                            if (filters && filters.length > 0) {
                                const domains = item.domains || []
                                const matches = domains.some(d => filters.includes(d))
                                if (!matches) return false
                            }

                            return true
                        })

                        return filtered.map(it => (
                            <Card
                                key={it.id}
                                name={it.name}
                                subtitle={it.subtitle}
                                description={it.description}
                                category={it.category}
                                icon_url={it.icon_url}
                                application_start={it.application_start}
                                application_end={it.application_end}
                                event_date={it.event_date}
                                event_end={it.event_end}
                                team_size={it.team_size}
                                open_to={it.open_to}
                                domains={it.domains}
                                application_link={it.application_link}
                            />
                        ))
                    })()}
                </div>
            </div>
        </>
    )
}

export default App
