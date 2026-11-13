import React from 'react'
import './FilterDialog.css'

type Props = {
  open: boolean
  selectedFilters: string[]
  onApply: (filters: string[]) => void
  onClose: () => void
  domainOptions: string[]
}

const TYPE_OPTIONS = ['Technical', 'Cultural']

const FilterDialog: React.FC<Props> = ({ open, selectedFilters, onApply, onClose, domainOptions }) => {
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
    <div className="filter-overlay" role="dialog" aria-modal="true" aria-labelledby="filter-title">
      <div className="filter-dialog">
        <div className="filter-header">
          <h3 id="filter-title">Filters</h3>
          <button className="close" onClick={onClose} aria-label="Close" />
        </div>

        <div className="filter-body">
        <div className="filter-section">
          <strong>Type</strong>
          <div className="options">
            {TYPE_OPTIONS.map(type => (
              <label key={type} className="option">
                <input type="checkbox" checked={selected.includes(type)} onChange={() => toggle(type)} />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <strong>Domains</strong>
          <div className="options">
            {domainOptions.map(d => (
              <label key={d} className="option">
                <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
                <span>{d}</span>
              </label>
            ))}
          </div>
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
