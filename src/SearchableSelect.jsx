import React, { useState, useRef, useEffect } from 'react'

// A lightweight searchable dropdown — used for Country and State fields,
// which need to filter long lists (250 countries, and states that can run
// into the dozens) rather than making people scroll a giant native <select>.
//
// Accessible-ish basics: closes on outside click and Escape, keeps the
// native-select-like keyboard tabbing via a real <button> trigger.
//
// VIEWPORT FIX: the panel used to always open downward from the trigger
// with no check for available space, so on fields lower on the page
// (State/Province, Pincode) it ran past the bottom of the screen. It now
// measures actual remaining space above/below the trigger on open and
// flips upward (adds the `panel-up` class, styled in onboarding.css)
// whenever there isn't enough room below but there is above.
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
  const [openUpward, setOpenUpward] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

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

  // Decide open-up vs open-down based on real remaining viewport space —
  // recomputed every time the panel opens, since scroll position can
  // have changed since the last time it was opened.
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const PANEL_ESTIMATE = 300 // search box + ~6 visible rows + padding
    setOpenUpward(spaceBelow < PANEL_ESTIMATE && spaceAbove > spaceBelow)
  }, [open])

  const selected = options.find((o) => getValue(o) === value)
  const filtered = query.trim()
    ? options.filter((o) => getLabel(o).toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div className={`searchable-select ${disabled ? 'disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`searchable-select-trigger ${open ? 'open' : ''}`}
        ref={triggerRef}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={selected ? 'searchable-select-value' : 'searchable-select-placeholder'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="searchable-select-caret">⌄</span>
      </button>

      {open && (
        <div className={`searchable-select-panel ${openUpward ? 'panel-up' : ''}`}>
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