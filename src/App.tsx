import './App.css'
import TopBar from './components/TopBar'
import Card from './components/Card'
import Tabs from './components/Tabs'
import FilterDialog from './components/FilterDialog'
import FilterTags from './components/FilterTags'
import React from 'react'

function App() {
    const [selectedTab, setSelectedTab] = React.useState<'Clubs' | 'Events'>('Clubs')
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
                    tabs={["Clubs", "Events"]}
                    selectedIndex={selectedTab === 'Clubs' ? 0 : 1}
                    onChange={(i) => setSelectedTab(i === 0 ? 'Clubs' : 'Events')}
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
                        const items = [
                            {
                                id: 'club-robotics',
                                event_name: 'Robotics Recruitment 2026',
                                club_name: 'Tech Robotics Club',
                                description: 'Join our club to build amazing robots and participate in national competitions.',
                                is_event: false,
                                icon_url: 'https://cdn-icons-png.flaticon.com/512/1383/1383267.png',
                                recruitment_start: new Date('2026-02-01'),
                                recruitment_end: new Date('2026-02-28'),
                                domains: ['AI', 'Automation'],
                                type: 'Club',
                                application_link: 'https://techrobotics.example.com/apply',
                            },
                            {
                                id: 'event-hackathon',
                                event_name: 'Hackathon 2026',
                                club_name: 'Coding Club',
                                description: 'Participate in a 48-hour coding marathon and showcase your skills.',
                                is_event: true,
                                icon_url: 'https://cdn-icons-png.flaticon.com/512/2913/2913970.png',
                                application_start: new Date('2026-02-05'),
                                application_end: new Date('2026-02-15'),
                                event_date: new Date('2026-03-01'),
                                domains: ['Web', 'Mobile', 'AI'],
                                type: 'Event',
                                application_link: 'https://codingclub.example.com/hackathon',
                            },
                            {
                                id: 'event-photo',
                                event_name: 'Photography Exhibition',
                                club_name: 'Arts & Photography Club',
                                description: 'Showcase your photography skills in our annual exhibition.',
                                is_event: true,
                                icon_url: 'https://cdn-icons-png.flaticon.com/512/1383/1383269.png',
                                domains: ['Photography', 'Arts'],
                                type: 'Event',
                                application_link: 'https://artsclub.example.com/exhibition',
                            },
                        ]

                        const q = searchQuery.trim().toLowerCase()

                        const filtered = items.filter(item => {
                            // tab filter
                            if (selectedTab === 'Clubs' && item.is_event) return false
                            if (selectedTab === 'Events' && !item.is_event) return false

                            // search filter (match club or event name)
                            if (q) {
                                const en = (item.event_name || '').toLowerCase()
                                const cn = (item.club_name || '').toLowerCase()
                                if (!en.includes(q) && !cn.includes(q)) return false
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
                                event_name={it.event_name}
                                club_name={it.club_name}
                                description={it.description}
                                is_event={it.is_event}
                                icon_url={it.icon_url}
                                recruitment_start={it.recruitment_start}
                                recruitment_end={it.recruitment_end}
                                application_start={it.application_start}
                                application_end={it.application_end}
                                event_date={it.event_date}
                                domains={it.domains}
                                type={it.type}
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
