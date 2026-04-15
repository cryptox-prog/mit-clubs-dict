import './App.css'
import TopBar from './components/TopBar'
import Card from './components/Card'

function App() {
    return (
        <>
            <TopBar />
            <div className='main-container'>
                <div className='greeting'>
                    <h1>Clubs, Student Projects and Events</h1>
                    <p>Discover and apply to the student organizations of Manipal Institiute of Technology</p>
                </div>
                <div className='filter-container'>
                    <input placeholder='Search By Name' />
                    <button />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin:'10px 0px 0px 0px' }}>
                    {/* Club Recruitment Card */}
                    <Card
                        event_name="Robotics Recruitment 2026"
                        club_name="Tech Robotics Club"
                        description="Join our club to build amazing robots and participate in national competitions."
                        is_event={false}
                        icon_url="https://cdn-icons-png.flaticon.com/512/1383/1383267.png"
                        recruitment_start={new Date('2026-02-01')}
                        recruitment_end={new Date('2026-02-28')}
                        domains={['AI', 'Automation']}
                        type="Club"
                        application_link="https://techrobotics.example.com/apply"
                    />

                    {/* Event Card */}
                    <Card
                        event_name="Hackathon 2026"
                        club_name="Coding Club"
                        description="Participate in a 48-hour coding marathon and showcase your skills."
                        is_event={true}
                        icon_url="https://cdn-icons-png.flaticon.com/512/2913/2913970.png"
                        application_start={new Date('2026-02-05')}
                        application_end={new Date('2026-02-15')}
                        event_date={new Date('2026-03-01')}
                        domains={['Web', 'Mobile', 'AI']}
                        type="Event"
                        application_link="https://codingclub.example.com/hackathon"
                    />

                    {/* Card with missing dates */}
                    <Card
                        event_name="Photography Exhibition"
                        club_name="Arts & Photography Club"
                        description="Showcase your photography skills in our annual exhibition."
                        is_event={true}
                        icon_url="https://cdn-icons-png.flaticon.com/512/1383/1383269.png"
                        // application_start and end not provided
                        domains={['Photography', 'Arts']}
                        type="Event"
                        application_link="https://artsclub.example.com/exhibition"
                    />
                </div>
            </div>
        </>
    )
}

export default App
