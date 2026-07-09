import React, { useState, useRef, useEffect } from 'react'

// A lightweight searchable dropdown — used for Country and State fields,
// which need to filter long lists (250 countries, and states that can run
// into the dozens) rather than making people scroll a giant native <select>.
//
// Accessible-ish basics: closes on outside click and Escape, keeps the
// native-select-like keyboard tabbing via a real <button> trigger.
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  searchPlaceholder = 'Search…',
  disabled = false,
  emptyLabel = 'No matches',
  getLabel = (o) => o.label,
  getValue = (o) => o.value,
  renderOption,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const selected = options.find((o) => getValue(o) === value)
  const filtered = query.trim()
    ? options.filter((o) => getLabel(o).toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div className={`searchable-select ${disabled ? 'disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`searchable-select-trigger ${open ? 'open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={selected ? 'searchable-select-value' : 'searchable-select-placeholder'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="searchable-select-caret">⌄</span>
      </button>

      {open && (
        <div className="searchable-select-panel">
          <input
            autoFocus
            type="text"
            className="searchable-select-search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="searchable-select-list">
            {filtered.length === 0 && (
              <div className="searchable-select-empty">{emptyLabel}</div>
            )}
            {filtered.map((o) => {
              const val = getValue(o)
              return (
                <div
                  key={val}
                  className={`searchable-select-option ${val === value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(val)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {renderOption ? renderOption(o) : getLabel(o)}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
