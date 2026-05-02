import React from 'react'
import './Tabs.css'

type TabsProps = {
  tabs: string[]
  selectedIndex?: number
  onChange?: (index: number) => void
}

const Tabs: React.FC<TabsProps> = ({ tabs, selectedIndex = 0, onChange }) => {
  const [active, setActive] = React.useState<number>(selectedIndex)

  React.useEffect(() => {
    setActive(selectedIndex)
  }, [selectedIndex])

  const handleClick = (i: number) => {
    setActive(i)
    onChange && onChange(i)
  }

  return (
    <div className="tabs-root">
      <div className="tabs">
        {tabs.map((t, i) => (
          <button
            key={t}
            className={"tab" + (i === active ? ' active' : '')}
            onClick={() => handleClick(i)}
            aria-pressed={i === active}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

export default Tabs
