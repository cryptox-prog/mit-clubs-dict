import './TopBar.css'

interface TopBarProps {
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

const TopBar = ({ theme, onToggleTheme }: TopBarProps) => {
    return (
        <div className='container'>
            <div className='icon'>
                <img src='mit-logo.png' alt='MIT logo' />
            </div>
            <h1>
                <span className='institute-full'>Manipal Institute of Technology</span>
                <span className='institute-short'>MIT</span>
            </h1>
            <h2>Clubs Dictionary</h2>
            <button
                className={`theme-toggle theme-toggle-${theme === 'dark' ? 'sun' : 'moon'}`}
                type='button'
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-pressed={theme === 'dark'}
                onClick={onToggleTheme}
            />
        </div>
    );
};

export default TopBar;
