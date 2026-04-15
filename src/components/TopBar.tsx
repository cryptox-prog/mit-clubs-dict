import './TopBar.css'
import { useState, useEffect } from 'react';

const TopBar = () => {
    const [title, setTitle] = useState("Manipal Institute of Technology");

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 600) {
                setTitle("MIT");
            } else {
                setTitle("Manipal Institute of Technology");
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // set initial value

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className='container'>
            <div className='icon'>
                <img src='mit-logo.png' />
            </div>
            <h1>{title}</h1>
            <h2>Clubs Dictionary</h2>
        </div>
    );
};

export default TopBar;
