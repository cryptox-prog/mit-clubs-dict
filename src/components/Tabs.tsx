import React from 'react'
import './Tabs.css'

type TabsProps = {
  tabs: Array<string | { label: string; mobileLabel?: string }>
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
        {tabs.map((tab, i) => {
          const label = typeof tab === 'string' ? tab : tab.label
          const mobileLabel = typeof tab === 'string' ? tab : tab.mobileLabel || tab.label

          return (
          <button
            key={label}
            className={"tab" + (i === active ? ' active' : '')}
            data-mobile-label={mobileLabel}
            onClick={() => handleClick(i)}
            aria-pressed={i === active}
          >
            <span>{label}</span>
          </button>
          )
        })}
      </div>
    </div>
  )
}

export default Tabs
