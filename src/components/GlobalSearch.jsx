import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../global-search.css'

// Same localStorage key Header.jsx / App.jsx already read from.
const getRole = () => localStorage.getItem('role') || ''

// Every destination reachable from the sidebar (+ a couple of aliases/
// keywords per item so "assign" finds Ticket Assignment, "approve" finds
// Account Approvals, etc). Add a line here any time a new page/tab is
// added to Header.jsx and it'll show up in search automatically.
//
// `roles` mirrors App.jsx's <RequireRole allow={[...]}> for the matching
// route exactly (and Header.jsx's can* flags) — search should never
// surface a page the current role would just get Permission Denied on.
// If access for a route changes in App.jsx, update the matching entry
// here too.
const DESTINATIONS = [
  {
    label: 'Dashboard', path: '/dashboard/', group: 'Overview',
    keywords: ['home', 'overview', 'summary'],
    roles: ['admin', 'staff', 'customer'],
  },
  {
    label: 'All Tickets', path: '/all-tickets/', group: 'Overview',
    keywords: ['tickets', 'list', 'queue'],
    roles: ['admin', 'staff', 'customer'],
  },
  {
    label: 'Raise Ticket', path: '/raise-ticket/', group: 'Overview',
    keywords: ['new ticket', 'create ticket', 'open ticket'],
    roles: ['customer'],
  },
  {
    label: 'Ticket Assignment', path: '/ticket-assignment/', group: 'Triage',
    keywords: ['assign', 'offers', 'claim'],
    roles: ['admin', 'staff'],
  },
  {
    label: 'Account Approvals', path: '/accountapproval/', group: 'Triage',
    keywords: ['approve', 'approval', 'pending accounts', 'onboarding'],
    roles: ['admin'],
  },
  {
    label: 'Customers', path: '/customers/', group: 'Manage',
    keywords: ['clients', 'accounts', 'companies'],
    roles: ['admin'],
  },
  {
    label: 'Staff Management', path: '/staffmanagement/', group: 'Manage',
    keywords: ['staff', 'employees', 'team', 'agents'],
    roles: ['admin'],
  },
  {
    label: 'Categories', path: '/categories/', group: 'Manage',
    keywords: ['category', 'department', 'tags'],
    roles: ['admin'],
  },
  {
    label: 'Product Master', path: '/products/', group: 'Manage',
    keywords: ['products', 'catalog', 'versions'],
    roles: ['admin'],
  },
  {
    label: 'My Profile', path: '/profile/', group: 'Overview',
    keywords: ['account', 'settings', 'mpin', 'password'],
    roles: ['admin', 'staff', 'customer'],
  },
]

function matches(item, query) {
  const q = query.toLowerCase()
  return (
    item.label.toLowerCase().includes(q)
    || item.group.toLowerCase().includes(q)
    || item.keywords.some((k) => k.toLowerCase().includes(q))
  )
}

function GlobalSearch() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)          // desktop dropdown
  const [mobileOpen, setMobileOpen] = useState(false) // mobile full overlay
  const [activeIndex, setActiveIndex] = useState(0)

  const containerRef = useRef(null)
  const desktopInputRef = useRef(null)
  const mobileInputRef = useRef(null)

  // Read once per mount — role doesn't change without a fresh login, and
  // a fresh login remounts the whole app anyway.
  const role = useMemo(() => getRole(), [])

  const visibleDestinations = useMemo(
    () => DESTINATIONS.filter((item) => item.roles.includes(role)),
    [role]
  )

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    return visibleDestinations.filter((item) => matches(item, q))
  }, [query, visibleDestinations])

  // Reset the highlighted row whenever the result set changes, so arrow
  // keys always start from the top of a fresh search.
  useEffect(() => { setActiveIndex(0) }, [query])

  // Close the desktop dropdown on outside click.
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ⌘K / Ctrl+K opens search from anywhere — the dropdown on desktop, the
  // full overlay on mobile. Escape closes whichever is open.
  useEffect(() => {
    function handleKeydown(e) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (isCmdK) {
        e.preventDefault()
        if (window.matchMedia('(max-width: 640px)').matches) {
          setMobileOpen(true)
        } else {
          setOpen(true)
          desktopInputRef.current?.focus()
        }
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      const t = setTimeout(() => mobileInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [mobileOpen])

  const showDropdown = open && query.trim().length > 0

  const goTo = (path) => {
    navigate(path)
    setQuery('')
    setOpen(false)
    setMobileOpen(false)
  }

  const handleKeyDown = (e) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      goTo(results[activeIndex].path)
    }
  }

  // Groups results under their sidebar section (Overview / Triage / Manage)
  // in the order those sections appear in the sidebar itself.
  const grouped = useMemo(() => {
    const order = ['Overview', 'Triage', 'Manage']
    return order
      .map((group) => ({ group, items: results.filter((r) => r.group === group) }))
      .filter((g) => g.items.length > 0)
  }, [results])

  const renderResults = () => {
    if (results.length === 0) {
      return <div className="search-status">No pages match "{query}"</div>
    }
    let runningIndex = -1
    return (
      <div className="search-results-list">
        {grouped.map(({ group, items }) => (
          <div className="search-group" key={group}>
            <div className="search-group-label">{group}</div>
            {items.map((item) => {
              runningIndex += 1
              const idx = runningIndex
              return (
                <button
                  key={item.path}
                  className={`search-result-row${idx === activeIndex ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goTo(item.path)}
                >
                  <span className="search-result-title">{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Desktop / tablet inline search — replaced by the icon trigger below 640px */}
      <div className="search-field search-field-desktop" ref={containerRef}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          ref={desktopInputRef}
          type="text"
          placeholder="Jump to a page — tickets, staff, categories…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <span className="search-hint">⌘K</span>
        {showDropdown && (
          <div className="search-results">
            {renderResults()}
          </div>
        )}
      </div>

      {/* Mobile icon trigger — shown only below 640px, opens the full overlay */}
      <button
        className="icon-btn search-trigger-mobile"
        aria-label="Search"
        onClick={() => setMobileOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </button>

      {/* Mobile full-width search overlay */}
      {mobileOpen && (
        <div className="search-overlay">
          <div className="search-overlay-bar">
            <div className="search-field search-field-mobile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                ref={mobileInputRef}
                type="text"
                placeholder="Jump to a page — tickets, staff, categories…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button className="icon-btn" aria-label="Close search" onClick={() => { setMobileOpen(false); setQuery('') }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="search-overlay-body">
            {query.trim()
              ? renderResults()
              : <div className="search-status">Start typing a page name…</div>}
          </div>
        </div>
      )}
    </>
  )
}

export default GlobalSearch