import './App.css'
import TopBar from './components/TopBar'
import AuthControl from './components/AuthControl'
import ManagementDashboard from './components/ManagementDashboard'
import { useAuth } from './hooks/useAuth'
import Card from './components/Card'
import Tabs from './components/Tabs'
import FilterDialog from './components/FilterDialog'
import FilterTags from './components/FilterTags'
import React from 'react'
import { resources } from './api/directory'
import type { CategoryTab, DirectoryItem, YearGroup } from './api/directory'
import { useDirectory } from './hooks/useDirectory'
import { analytics } from './utils/analytics'

const tabs: Array<{ label: CategoryTab; mobileLabel?: string }> = [
    { label: 'Clubs' }, { label: 'Student Projects', mobileLabel: 'SP' }, { label: 'Events' },
]
function formatOpenTo(openTo: YearGroup[]) {
    if (!openTo.length) return undefined
    if (openTo.includes('EVERYONE')) return 'Everyone'
    const labels: Record<YearGroup, string> = {
        FIRST_YEAR: 'First Years', SECOND_YEAR: 'Second Years', THIRD_YEAR: 'Third Years',
        FOURTH_YEAR: 'Fourth Years', EVERYONE: 'Everyone',
    }
    if (['FIRST_YEAR', 'SECOND_YEAR', 'THIRD_YEAR', 'FOURTH_YEAR'].every(year => openTo.includes(year as YearGroup))) return 'All Years'
    return openTo.map(year => labels[year]).join(', ')
}
function getSubtitle(item: DirectoryItem) {
    if (item.category === 'Event' && item.club_name) return `Hosted by ${item.club_name}`
    if (item.category === 'Student Project') return 'Technical'
    return item.club_kind ?? undefined
}
function App() {
    const { user } = useAuth()
    const [dashboardOpen, setDashboardOpen] = React.useState(false)
    const closeDashboard = React.useCallback(() => setDashboardOpen(false), [])
    const [selectedTab, setSelectedTab] = React.useState<CategoryTab>('Clubs')
    const [filtersOpen, setFiltersOpen] = React.useState(false)
    const [filters, setFilters] = React.useState<string[]>([])
    const [searchQuery, setSearchQuery] = React.useState('')
    const [theme, setTheme] = React.useState<'light' | 'dark'>('dark')
    const [themeBurst, setThemeBurst] = React.useState(false)
    const [themeBurstKey, setThemeBurstKey] = React.useState(0)
    const [now, setNow] = React.useState(() => new Date())
    const { items, loading, error, warning, retry } = useDirectory(resources[selectedTab])
    const lastTab = React.useRef<string | null>(null)
    const lastSearch = React.useRef<string | null>(null)
    React.useEffect(() => {
        if (lastTab.current === selectedTab) return
        lastTab.current = selectedTab
        analytics.capture('directory_tab_viewed', { category: selectedTab })
    }, [selectedTab])

    React.useEffect(() => {
        document.documentElement.dataset.theme = theme
    }, [theme])
    React.useEffect(() => {
        if (!themeBurst) return
        const burstTimer = window.setTimeout(() => setThemeBurst(false), 520)
        return () => window.clearTimeout(burstTimer)
    }, [themeBurst])
    React.useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60000)
        return () => window.clearInterval(timer)
    }, [])

    const domainOptions = [...new Set(items.flatMap(item => item.domains))].sort()
    const q = searchQuery.trim().toLowerCase()
    const filtered = items.filter(item => {
        if (q && !item.name.toLowerCase().includes(q) && !(getSubtitle(item) ?? '').toLowerCase().includes(q)) return false
        if (filters.length && !item.domains.some(domain => filters.includes(domain))
            && !filters.includes(item.category === 'Student Project' ? 'Technical' : item.club_kind ?? '')) return false
        return true
    })
    React.useEffect(() => {
        if (!q) { lastSearch.current = null; return }
        if (loading || error) return
        const signature = JSON.stringify([selectedTab, q, filters])
        if (lastSearch.current === signature) return
        const timer = window.setTimeout(() => {
            lastSearch.current = signature
            analytics.capture('directory_searched', { category: selectedTab, query_length: q.length, result_count: filtered.length })
        }, 700)
        return () => window.clearTimeout(timer)
    }, [q, selectedTab, filters, filtered.length, loading, error])
    const changeFilters = (next: string[]) => {
        setFilters(next)
        analytics.capture('directory_filters_changed', { category: selectedTab, filter_count: next.length })
    }
    const handleToggleTheme = () => {
        setTheme(current => current === 'dark' ? 'light' : 'dark')
        setThemeBurst(true)
        setThemeBurstKey(current => current + 1)
    }
    return (
        <>
            {themeBurst && <div key={themeBurstKey} className={`theme-burst theme-burst-${theme}`} aria-hidden="true" />}
            <TopBar theme={theme} onToggleTheme={handleToggleTheme} />
            <main className="main-container">
                <div className="greeting">
                    <h1>Clubs, Student Projects and Events</h1>
                    <p>Discover and apply to the student organizations of Manipal Institute of Technology</p>
                </div>
                <Tabs tabs={tabs} selectedIndex={tabs.findIndex(tab => tab.label === selectedTab)}
                    onChange={index => setSelectedTab(tabs[index].label)} />
                <div className="filter-container">
                    <input aria-label="Search by name" placeholder="Search By Name" value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)} />
                    <button aria-label="Open filters" onClick={() => setFiltersOpen(true)} />
                </div>
                <FilterTags filters={filters} onRemove={filter => changeFilters(filters.filter(value => value !== filter))}
                    onClear={() => changeFilters([])} />
                <FilterDialog open={filtersOpen} selectedFilters={filters} domainOptions={domainOptions}
                    onApply={changeFilters} onClose={() => setFiltersOpen(false)} />
                <section className="directory-list" aria-label={selectedTab} aria-busy={loading}>
                    {loading && <p className="directory-message" role="status">Loading {selectedTab.toLowerCase()}…</p>}
                    {warning && <div className="directory-message" role="status">
                        <p>Showing saved directory data. {warning}</p>
                        <button className="btn secondary" onClick={retry}>Refresh data</button>
                    </div>}
                    {error && <div className="directory-message" role="alert">
                        <p>{error}</p><button className="btn" onClick={retry}>Try again</button>
                    </div>}
                    {!loading && !error && filtered.length === 0 && <div className="directory-message" role="status">
                        <p>{items.length ? 'No matches. Try another search or clear your filters.' : `No ${selectedTab.toLowerCase()} listed yet.`}</p>
                        {items.length > 0 && <button className="btn secondary" onClick={() => { setSearchQuery(''); changeFilters([]) }}>Clear search and filters</button>}
                    </div>}
                    {!loading && !error && filtered.map(item => <Card key={item.id} id={item.id} name={item.name}
                        subtitle={getSubtitle(item)} description={item.description} category={item.category}
                        icon_url={item.icon_url} application_start={item.application_start}
                        registration_deadline={item.registration_deadline} event_start={item.event_start}
                        event_end={item.event_end} participation_type={item.participation_type}
                        open_to={formatOpenTo(item.open_to)} domains={item.domains} apply_link={item.apply_link} now={now} />)}
                </section>
            </main>
            <AuthControl onManage={() => setDashboardOpen(true)} />
            {dashboardOpen && user && <ManagementDashboard onClose={closeDashboard} />}
        </>
    )
}
export default App
