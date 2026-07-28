import React from 'react'
import './FilterDialog.css'

type Props = {
  open: boolean
  selectedFilters: string[]
  onApply: (filters: string[]) => void
  onClose: () => void
}

const DOMAIN_OPTIONS = ['AI', 'Web', 'Mobile', 'Automation', 'Photography', 'Arts']

const FilterDialog: React.FC<Props> = ({ open, selectedFilters, onApply, onClose }) => {
  const [selected, setSelected] = React.useState<string[]>(selectedFilters || [])

  React.useEffect(() => {
    setSelected(selectedFilters || [])
  }, [selectedFilters, open])

  if (!open) return null

  const toggle = (value: string) => {
    setSelected(prev => (prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]))
  }

  const apply = () => {
    onApply(selected)
    onClose()
  }

  const clear = () => setSelected([])

  return (
    <div className="filter-overlay" role="dialog" aria-modal="true">
      <div className="filter-dialog">
        <div className="filter-header">
          <h3>Filters</h3>
          <button className="close" onClick={onClose} aria-label="Close" />
        </div>

        <div className="filter-section">
          <strong>Domains</strong>
          <div className="options">
            {DOMAIN_OPTIONS.map(d => (
              <label key={d} className="option">
                <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
                <span>{d}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn secondary" onClick={clear}>Clear</button>
          <div style={{flex:1}} />
          <button className="btn" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  )
}

export default FilterDialog
