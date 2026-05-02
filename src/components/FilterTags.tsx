import React from 'react'
import './FilterTags.css'

const ACCENTS = ['#cc241d','#98971a','#d79921','#458588','#b16286','#689d6a','#7c6f64','#9d0006','#076678','#8f3f71','#427b58']

function pickAccent(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

type Props = {
  filters: string[]
  onRemove: (f: string) => void
  onClear?: () => void
}

const FilterTags: React.FC<Props> = ({ filters, onRemove, onClear }) => {
  if (!filters || filters.length === 0) return null

  return (
    <div className="filter-tags-root">
      <div className="tags">
        {filters.map(f => {
          const color = pickAccent(f)
          return (
            <span key={f} className="tag" style={{ border: `3px solid ${color}` }}>
              <span className="label">{f}</span>
              <button
                className="remove"
                onClick={() => onRemove(f)}
                aria-label={`Remove ${f}`}
                style={{
                  background: color,
                  color: '#f2e5bc',
                  borderLeft: `3px solid ${color}`,
                  zIndex: 4
                }}
              />
            </span>
          )
        })}
      </div>
      <button className="clear-all" onClick={onClear}>Clear</button>
    </div>
  )
}

export default FilterTags
