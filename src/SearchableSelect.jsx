import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// A lightweight searchable dropdown (e.g. for Country/State fields), with panel
// flip-up when there isn't enough room below the trigger.
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
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && rootRef.current.contains(e.target)) return
      if (panelRef.current && panelRef.current.contains(e.target)) return
      setOpen(false)
      setQuery('')
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

  // Decides whether the panel opens up or down based on viewport space, and
  // positions it (rendered via portal — see below) against the trigger.
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const PANEL_ESTIMATE = 300 // search box + ~6 visible rows + padding
    const upward = spaceBelow < PANEL_ESTIMATE && spaceAbove > spaceBelow
    setOpenUpward(upward)
    setCoords({
      top: (upward ? rect.top - 6 : rect.bottom + 6) + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    })
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

      {open && createPortal(
        // Positioning wrapper (plain, no animation) — kept separate from the
        // panel below so the upward-flip translateY doesn't fight the
        // panel's own scale/fade entrance animation on the same element.
        <div
          ref={panelRef}
          className="searchable-select-positioner"
          style={{
            top: coords.top,
            left: coords.left,
            width: coords.width,
            transform: openUpward ? 'translateY(-100%)' : 'none',
          }}
        >
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
        </div>,
        document.body
      )}
    </div>
  )
}

export default SearchableSelect