import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api' // adjust this path to match where api.js actually lives
import { initCounters, initTrendChart, buildTrendData } from '../script.js'
import AttachmentThumbnails from '../components/AttachmentPreview'

const STATUS_CHIP = {
  Open: 'chip open',
  'In Progress': 'chip inprogress',
  'On Hold': 'chip hold',
  Resolved: 'chip resolved',
  Closed: 'chip resolved',
}

// Keeps the status pill on a single line, sized to its content.
const chipNoWrapStyle = {
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  maxWidth: 'none',
  minWidth: 'max-content',
  boxSizing: 'content-box',
  overflow: 'visible',
  padding: '4px 12px',
  lineHeight: 1.4,
}


const PRIORITY_CLASS = { Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent' }
const ALL_STATUSES = ['Open', 'In Progress', 'On Hold', 'Resolved', 'Closed']
const CAT_COLORS = ['var(--blue)', undefined, 'var(--amber)', 'var(--violet)', 'var(--red)']

// Same colors as the status chips used everywhere else on this page (Now Working / History tables).
const STATUS_PIE_SLICES = [
  { key: 'open', name: 'Open', color: 'var(--amber)', soft: 'var(--amber-soft)', ink: '#8A550F' },
  { key: 'inProgress', name: 'In Progress', color: 'var(--blue)', soft: 'var(--blue-soft)', ink: 'var(--blue)' },
  { key: 'onHold', name: 'On Hold', color: 'var(--violet)', soft: 'var(--violet-soft)', ink: 'var(--violet)' },
]

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeSlice(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
}

// Open / In Progress / On Hold breakdown as a pie chart — admin dashboard only.
// Hovering (or clicking, to pin it open) a slice or legend row shows the
// matching tickets' subject and who raised them.
function StatusPieChart({ stats, tickets }) {
  const slices = STATUS_PIE_SLICES.map((s) => ({ ...s, value: stats[s.key] }))
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  const [activeKey, setActiveKey] = useState(null)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const panelRef = useRef(null)
  // Closing on mouseleave is delayed briefly so moving the cursor onto the
  // popover to scroll its ticket list (which can momentarily register as
  // leaving the trigger, e.g. crossing the small gap between them) doesn't
  // instantly dismiss it — a fresh hover anywhere on trigger/popover cancels
  // the pending close.
  const closeTimerRef = useRef(null)

  function cancelPendingClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  useEffect(() => () => cancelPendingClose(), [])

  useEffect(() => {
    if (!pinned) return
    const handleOutside = (e) => {
      if (panelRef.current?.contains(e.target)) return
      setPinned(false)
      setActiveKey(null)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') { setPinned(false); setActiveKey(null) }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [pinned])

  function positionNear(el) {
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX })
  }

  function handleEnter(key, e) {
    if (pinned) return
    cancelPendingClose()
    setActiveKey(key)
    positionNear(e.currentTarget)
  }
  function handleLeave() {
    if (pinned) return
    cancelPendingClose()
    closeTimerRef.current = setTimeout(() => setActiveKey(null), 200)
  }
  function handleClick(key, e) {
    e.stopPropagation()
    if (pinned && activeKey === key) {
      setPinned(false)
      setActiveKey(null)
      return
    }
    setActiveKey(key)
    setPinned(true)
    positionNear(e.currentTarget)
  }

  if (total === 0) {
    return <div className="panel-sub">No open, in-progress, or on-hold tickets right now.</div>
  }

  const cx = 90, cy = 90, r = 78
  const nonZero = slices.filter((s) => s.value > 0)
  let cumulativeAngle = 0

  const activeSlice = slices.find((s) => s.key === activeKey)
  const activeTickets = activeSlice
    ? tickets.filter((t) => t.status === activeSlice.name).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    : []

  return (
    <div className="status-pie-wrap">
      <svg viewBox="0 0 180 180" className="status-pie-svg" role="img" aria-label="Open, in progress, and on hold ticket breakdown">
        {nonZero.length === 1 ? (
          <circle
            cx={cx} cy={cy} r={r} fill={nonZero[0].color} stroke="var(--surface)" strokeWidth="3"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => handleEnter(nonZero[0].key, e)}
            onMouseLeave={handleLeave}
            onClick={(e) => handleClick(nonZero[0].key, e)}
          />
        ) : (
          nonZero.map((s) => {
            const startAngle = cumulativeAngle
            const angle = (s.value / total) * 360
            cumulativeAngle += angle
            const endAngle = cumulativeAngle
            const pct = Math.round((s.value / total) * 100)
            // Only label a slice inline if it's wide enough for the text to sit comfortably.
            const showLabel = angle >= 30
            const labelPos = polarToCartesian(cx, cy, r * 0.62, (startAngle + endAngle) / 2)
            return (
              <g key={s.key}>
                <path
                  d={describeSlice(cx, cy, r, startAngle, endAngle)}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => handleEnter(s.key, e)}
                  onMouseLeave={handleLeave}
                  onClick={(e) => handleClick(s.key, e)}
                />
                {showLabel && (
                  <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle" className="status-pie-label" style={{ pointerEvents: 'none' }}>
                    {pct}%
                  </text>
                )}
              </g>
            )
          })
        )}
      </svg>
      <ul className="status-legend">
        {slices.map((s) => (
          <li
            className="status-legend-row status-legend-row-interactive"
            key={s.key}
            onClick={(e) => handleClick(s.key, e)}
          >
            <span className="status-legend-dot" style={{ background: s.color }}></span>
            <span className="status-legend-name">{s.name}</span>
          </li>
        ))}
      </ul>

      {activeSlice && createPortal(
        <div
          ref={panelRef}
          className="status-pie-popover"
          style={{ top: coords.top, left: coords.left, '--slice-color': activeSlice.color }}
          onMouseEnter={() => { if (!pinned) { cancelPendingClose(); setActiveKey(activeSlice.key) } }}
          onMouseLeave={handleLeave}
        >
          <div className="status-pie-popover-head" style={{ background: activeSlice.soft, color: activeSlice.ink }}>
            <span className="status-legend-dot" style={{ background: activeSlice.color }}></span>
            <span className="status-pie-popover-title">{activeSlice.name}</span>
            <span className="status-pie-popover-badge" style={{ color: activeSlice.ink }}>{activeTickets.length}</span>
            {pinned && (
              <button
                type="button"
                className="status-pie-popover-close"
                style={{ color: activeSlice.ink }}
                aria-label="Close"
                onClick={() => { setPinned(false); setActiveKey(null) }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <div className="status-pie-popover-list">
            {activeTickets.length === 0 && (
              <div className="panel-sub" style={{ padding: '10px 4px' }}>No tickets in this status.</div>
            )}
            {activeTickets.map((t) => (
              <div className="status-pie-popover-row" key={t.id}>
                <div className="pie-ticket-title">{t.subject}</div>
                <div className="pie-ticket-raiser">
                  {t.raised_by?.full_name || 'Unknown'}{t.company_name ? ` - ${t.company_name}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Statuses that remove a ticket from "Now Working".
const DONE_STATUSES = ['Resolved', 'Closed']

function timeAgo(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// "Rahul Jose" -> "RJ", single-word names -> first two letters, "" -> "?"
function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Normalizes the staff/ endpoint's response shape into a consistent list.
function normalizeStaff(raw) {
  const list = Array.isArray(raw) ? raw : (raw?.results || raw?.staff || raw?.data || [])
  return list
    .map((s) => ({
      id: s.id ?? s.staff_id ?? s.user_id ?? s.pk,
      full_name: s.full_name || s.name || [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || s.phone_number || 'Unnamed Staff',
      phone_number: s.phone_number || '',
    }))
    .filter((s) => s.id !== undefined && s.id !== null)
}

// Ticket detail modal — read-only from History, with transfer control from Now Working.
function TicketDetailModal({ ticket, staffList, readOnly, onClose, onTransfer, transferring }) {
  const [selectedStaffId, setSelectedStaffId] = useState('')
  // Staff ids eligible for this ticket's company, from eligible-staff/. null = loading.
  const [eligibleIds, setEligibleIds] = useState(null)

  // Status history for this ticket (admin-only view).
  const [statusHistory, setStatusHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    setSelectedStaffId('')
    setEligibleIds(null)
    setStatusHistory([])
    if (!ticket) return
    let cancelled = false

    if (!readOnly) {
      api.get(`tickets/${ticket.id}/eligible-staff/`)
        .then(({ data }) => { if (!cancelled) setEligibleIds(new Set(data.staff_ids || [])) })
        .catch(() => { if (!cancelled) setEligibleIds(new Set()) })
    }

    setHistoryLoading(true)
    api.get(`tickets/${ticket.id}/status-history/`)
      .then(({ data }) => { if (!cancelled) setStatusHistory(data) })
      .catch(() => { if (!cancelled) setStatusHistory([]) })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })

    return () => { cancelled = true }
  }, [ticket, readOnly])

  if (!ticket) return null

  // Excludes the current holder from the transfer options (matched by full_name).
  const transferOptions = staffList.filter((s) => s.full_name !== ticket.assigned_staff?.full_name)
  const assignedGroup = transferOptions.filter((s) => eligibleIds?.has(s.id))
  const otherGroup = transferOptions.filter((s) => !eligibleIds?.has(s.id))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="page-eyebrow">#{ticket.id.slice(0, 8).toUpperCase()}</div>
            <h2 className="modal-title">{ticket.subject}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-row">
            <span className="k">Priority</span>
            <span className="v"><span className={`priority ${PRIORITY_CLASS[ticket.priority] || ''}`}><span className="dot"></span>{ticket.priority}</span></span>
          </div>
          <div className="detail-row">
            <span className="k">Category</span>
            <span className="v">{ticket.category}</span>
          </div>
          <div className="detail-row">
            <span className="k">Status</span>
            <span className="v"><span className={STATUS_CHIP[ticket.status] || 'chip open'} style={chipNoWrapStyle}>{ticket.status}</span></span>
          </div>

          {ticket.description && (
            <>
              <div className="detail-section-title">Description</div>
              <div className="remarks-box">{ticket.description}</div>
            </>
          )}

          <div className="detail-section-title">Raised By</div>
          <div className="detail-row">
            <span className="k">{ticket.raised_by?.full_name || '—'}</span>
            <span className="v">{formatDate(ticket.created_at)}</span>
          </div>

          <div className="detail-section-title">Currently Assigned To</div>
          <div className="detail-row">
            <span className="v">{ticket.assigned_staff?.full_name || 'Unassigned'}</span>
          </div>

          {ticket.attachments?.length > 0 && (
            <>
              <div className="detail-section-title">Attachments</div>
              <AttachmentThumbnails attachments={ticket.attachments} />
            </>
          )}

          <div className="detail-section-title">Status History</div>
          {historyLoading ? (
            <div className="panel-sub">Loading history…</div>
          ) : statusHistory.length === 0 ? (
            <div className="panel-sub">No status changes yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {statusHistory.map((h) => (
                <div
                  key={h.id}
                  style={{ border: '1px solid var(--line, #e5e7eb)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 600 }}>
                    <span className={STATUS_CHIP[h.from_status] || 'chip open'} style={{ ...chipNoWrapStyle, fontSize: 11 }}>{h.from_status}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span className={STATUS_CHIP[h.to_status] || 'chip open'} style={{ ...chipNoWrapStyle, fontSize: 11 }}>{h.to_status}</span>
                  </div>
                  {h.remark && <div style={{ marginTop: 6 }}>{h.remark}</div>}
                  <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                    {h.changed_by?.full_name || h.changed_by?.phone_number || 'Unknown'} · {formatDate(h.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!readOnly && ticket.status !== 'Closed' && (
          <div className="modal-foot">
            <span className="panel-sub" style={{ marginRight: 'auto' }}>Transfer to</span>
            <select
              className="select"
              value={selectedStaffId}
              disabled={transferring || eligibleIds === null || transferOptions.length === 0}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              <option value="">
                {eligibleIds === null
                  ? 'Loading staff…'
                  : transferOptions.length === 0
                    ? 'No other staff available'
                    : 'Select staff…'}
              </option>
              {eligibleIds !== null && assignedGroup.length > 0 && (
                <optgroup label="Assigned">
                  {assignedGroup.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </optgroup>
              )}
              {eligibleIds !== null && otherGroup.length > 0 && (
                <optgroup label="Other staff">
                  {otherGroup.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              className="btn btn-primary"
              disabled={!selectedStaffId || transferring}
              onClick={() => onTransfer(ticket, selectedStaffId)}
            >
              {transferring ? 'Sending offer…' : 'Send Transfer Offer'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminDashboard() {
  const [tickets, setTickets] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [workingTicket, setWorkingTicket] = useState(null) // opened from Now Working — has transfer
  const [viewTicket, setViewTicket] = useState(null)        // opened from History — read only
  const [transferring, setTransferring] = useState(false)

  const [historyStatus, setHistoryStatus] = useState('All')
  const [historySearch, setHistorySearch] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [ticketsRes, staffRes] = await Promise.all([
        api.get('tickets/'),
        api.get('staff/'),
      ])
      setTickets(ticketsRes.data)

      const normalized = normalizeStaff(staffRes.data)
      if (normalized.length === 0) {
        // Helps pinpoint the shape mismatch from the browser console if
        // staff/ is returning something normalizeStaff() doesn't expect.
        console.warn('staff/ returned no usable entries — raw response:', staffRes.data)
      }
      setStaffList(normalized)
    } catch (err) {
      setError('Could not load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === 'Open').length
    const inProgress = tickets.filter((t) => t.status === 'In Progress').length
    const onHold = tickets.filter((t) => t.status === 'On Hold').length
    const resolved = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length
    return { total, open, inProgress, onHold, resolved }
  }, [tickets])

  const staffPerformance = useMemo(() => {
    // Aggregates ticket counts per staff member, keyed by full_name.
    const byName = new Map()

    // Seed every known staff member so zero-ticket staff still show up.
    staffList.forEach((s) => {
      if (!s.full_name) return
      byName.set(s.full_name, { key: s.full_name, name: s.full_name, working: 0, resolved: 0, total: 0 })
    })

    // Aggregate from each ticket's own assigned_staff.
    tickets.forEach((t) => {
      const name = t.assigned_staff?.full_name
      if (!name) return
      if (!byName.has(name)) {
        byName.set(name, { key: name, name, working: 0, resolved: 0, total: 0 })
      }
      const row = byName.get(name)
      row.total += 1
      if (t.status === 'In Progress') row.working += 1
      if (t.status === 'Resolved' || t.status === 'Closed') row.resolved += 1
    })

    const rows = Array.from(byName.values()).sort((a, b) => b.total - a.total)
    const max = rows.length ? Math.max(...rows.map((r) => r.total), 1) : 1
    return rows.map((r) => ({
      ...r,
      id: r.key,
      pct: Math.round((r.total / max) * 100),
      companyShare: stats.total ? Math.round((r.total / stats.total) * 100) : 0,
    }))
  }, [staffList, tickets, stats.total])

  const categoryBreakdown = useMemo(() => {
    const counts = {}
    tickets.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1
    })
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const max = rows.length ? rows[0][1] : 1
    return rows.map(([name, count], i) => ({
      name,
      count,
      pct: Math.round((count / max) * 100),
      color: CAT_COLORS[i % CAT_COLORS.length],
    }))
  }, [tickets])

  // Re-run counter animation + trend chart draw once real stats are ready.
  useEffect(() => {
    if (!loading) {
      initCounters()
      initTrendChart(buildTrendData(tickets))
    }
  }, [loading, stats.total])

  // Tickets not yet Resolved/Closed, including ones mid-transfer (shown as Unassigned).
  const workingTickets = useMemo(
    () => tickets.filter((t) => !DONE_STATUSES.includes(t.status))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [tickets]
  )

  // History is the full company-wide ticket log, unfiltered by staff —
  // same underlying `tickets` list as everything else on this page.
  const historyTickets = useMemo(() => {
    return tickets
      .filter((t) => historyStatus === 'All' || t.status === historyStatus)
      .filter((t) => {
        if (!historySearch.trim()) return true
        const q = historySearch.trim().toLowerCase()
        return t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [tickets, historyStatus, historySearch])

  // Sends a transfer offer; ticket is Unassigned until the target staff accepts it.
  const handleTransfer = async (ticket, staffId) => {
    setTransferring(true)
    setNotice('')
    try {
      await api.post(`tickets/${ticket.id}/transfer/`, { staff_id: Number(staffId) })
      const staffName = staffList.find((s) => s.id === staffId)?.full_name || 'the selected staff member'
      setNotice(`Transfer offer sent to ${staffName}. The ticket is now unassigned until they accept it from Ticket Assignment.`)
      setWorkingTicket(null)
      fetchAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send the transfer offer. Please try again.')
    } finally {
      setTransferring(false)
    }
  }

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">Admin · Overview</div>
            <h1 className="page-title">Company Performance</h1>
            <p className="page-desc">
              Support queue as of {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          </div>
        </div>

        <div className="ticker">
          <div className="ticker-live"><span className="ticker-dot"></span> LIVE QUEUE</div>
          <div className="ticker-item"><b>{stats.open}</b> open</div>
          <div className="ticker-item"><b className="t-accent">{stats.inProgress}</b> in progress</div>
          <div className="ticker-item"><b className="t-amber">{stats.onHold}</b> on hold</div>
          <div className="ticker-item">Last sync <b>{loading ? '…' : 'just now'}</b></div>
        </div>
        {error && <div className="alert-banner error">{error}</div>}
        {notice && <div className="alert-banner success">{notice}</div>}

        <div className="stat-grid">
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Total Tickets</div>
            <div className="stat-value mono" data-count={stats.total}>0</div>
            <div className="stat-foot">All tickets raised</div>
          </div>
          <div className="stat-card" data-tone="amber">
            <div className="stat-label">Open</div>
            <div className="stat-value mono" data-count={stats.open}>0</div>
            <div className="stat-foot">Awaiting assignment</div>
          </div>
          <div className="stat-card" data-tone="blue">
            <div className="stat-label">In Progress</div>
            <div className="stat-value mono" data-count={stats.inProgress}>0</div>
            <div className="stat-foot">Being worked on</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Resolved</div>
            <div className="stat-value mono" data-count={stats.resolved}>0</div>
            <div className="stat-foot">Resolved or closed</div>
          </div>
          <div className="stat-card" data-tone="red">
            <div className="stat-label">On Hold</div>
            <div className="stat-value mono" data-count={stats.onHold}>0</div>
            <div className="stat-foot">Blocked / waiting</div>
          </div>
        </div>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Ticket Trend</div>
                <div className="panel-sub">Opened vs. resolved over time</div>
              </div>
              <div className="tabs">
                <button className="tab active" data-trend-tab="daily">Daily</button>
                <button className="tab" data-trend-tab="weekly">Weekly</button>
                <button className="tab" data-trend-tab="monthly">Monthly</button>
              </div>
            </div>
            <div className="panel-body">
              <div className="chart-wrap">
                <canvas id="trendChart"></canvas>
              </div>
              <div className="chart-legend">
                <div className="legend-item"><span className="legend-dot" style={{ background: '#C8791A' }}></span> Opened</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#0F6E63' }}></span> Resolved</div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">By Category</div>
                <div className="panel-sub">Share of tickets, company-wide</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="cat-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {categoryBreakdown.length === 0 && !loading && (
                  <div className="panel-sub">No tickets yet.</div>
                )}
                {categoryBreakdown.map((c) => (
                  <div className="cat-row" key={c.name}>
                    <div className="cat-name">{c.name}</div>
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar-fill"
                        style={{ width: `${c.pct}%`, ...(c.color ? { background: c.color } : {}) }}
                      ></div>
                    </div>
                    <div className="cat-count">{c.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="status-staff-row">
          <section className="panel status-overview-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Status Overview</div>
                <div className="panel-sub">Open, in progress, and on hold — right now</div>
              </div>
            </div>
            <div className="panel-body">
              <StatusPieChart stats={stats} tickets={tickets} />
            </div>
          </section>

          <section className="panel status-staff-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Staff Performance</div>
                <div className="panel-sub">Tickets handled per staff member</div>
              </div>
              {staffPerformance.length > 0 && (
                <div className="perf-legend">
                  <span className="perf-legend-item"><span className="perf-dot working"></span>Working</span>
                  <span className="perf-legend-item"><span className="perf-dot resolved"></span>Resolved</span>
                  <span className="perf-legend-item"><span className="perf-dot other"></span>Open / On Hold</span>
                </div>
              )}
            </div>
            <div className="panel-body">
              {!loading && staffPerformance.length === 0 && (
                <div className="panel-sub">
                  No staff found. If staff exist in the system, check the browser console for a
                  "staff/ returned no usable entries" warning — the API response shape may not
                  match what this page expects.
                </div>
              )}

              {staffPerformance.length > 0 && (
                // Scrollable horizontal rows, scales to any staff count.
                <div className="staff-list" style={{ maxHeight: 225, overflowY: 'auto', overflowX: 'visible' }}>
                  {staffPerformance.map((s) => {
                    const other = Math.max(s.total - s.working - s.resolved, 0)
                    return (
                      <div className="staff-row" key={s.id}>
                        <div className="staff-avatar">{getInitials(s.name)}</div>
                        <div className="staff-info">
                          <div className="staff-name">{s.name}</div>
                          <div className="staff-dept">
                            {s.working} working · {s.resolved} resolved{other ? ` · ${other} open/on hold` : ''}
                          </div>
                          {/* Bar length = share of busiest staff's total; segments = workload mix. */}
                          <div className="perf-track">
                            <div className="perf-fill" style={{ width: `${Math.max(s.pct, s.total ? 3 : 0)}%` }}>
                              <div className="perf-seg working" style={{ flexBasis: `${s.total ? (s.working / s.total) * 100 : 0}%` }}></div>
                              <div className="perf-seg resolved" style={{ flexBasis: `${s.total ? (s.resolved / s.total) * 100 : 0}%` }}></div>
                              <div className="perf-seg other" style={{ flexBasis: `${s.total ? (other / s.total) * 100 : 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                        <div className="staff-metric">
                          <div className="num">{s.total}</div>
                          <div className="cap">{s.companyShare}% of all</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Now Working</div>
              <div className="panel-sub">Every ticket not yet resolved or closed, company-wide. Click to send a transfer offer.</div>
            </div>
          </div>
          <div className="panel-body table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="tickets">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject / Raised By</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th className="status-col">Status</th>
                  <th>Raised</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6}>Loading tickets…</td></tr>}
                {!loading && workingTickets.length === 0 && (
                  <tr><td colSpan={6}>Nothing in progress right now.</td></tr>
                )}
                {!loading && workingTickets.map((t) => (
                  <tr key={t.id} className="row-clickable" onClick={() => setWorkingTicket(t)}>
                    <td className="tid">#{t.id.slice(0, 8).toUpperCase()}</td>
                    <td className="subject-cell">
                      <div className="subj">{t.subject}</div>
                      <div className="cust">{t.raised_by?.full_name || '—'}</div>
                    </td>
                    <td>{t.assigned_staff?.full_name || 'Unassigned'}</td>
                    <td>
                      <span className={`priority ${PRIORITY_CLASS[t.priority] || ''}`}>
                        <span className="dot"></span>{t.priority}
                      </span>
                    </td>
                    <td className="status-col"><span className={STATUS_CHIP[t.status] || 'chip open'} style={chipNoWrapStyle}>{t.status}</span></td>
                    <td className="sla ok">{timeAgo(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* History: every ticket ever raised; opens the modal read-only. */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">History</div>
              <div className="panel-sub">Every ticket ever raised, company-wide. Click a row for details.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="Search subject or ID…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <select className="select" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}>
                <option value="All">All statuses</option>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="panel-body table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="tickets">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject / Raised By</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th className="status-col">Status</th>
                  <th>Raised</th>
                </tr>
              </thead>
              <tbody>
                {!loading && historyTickets.length === 0 && (
                  <tr><td colSpan={6}>No matching tickets.</td></tr>
                )}
                {!loading && historyTickets.map((t) => (
                  <tr key={t.id} className="row-clickable" onClick={() => setViewTicket(t)}>
                    <td className="tid">#{t.id.slice(0, 8).toUpperCase()}</td>
                    <td className="subject-cell">
                      <div className="subj">{t.subject}</div>
                      <div className="cust">{t.raised_by?.full_name || '—'}</div>
                    </td>
                    <td>{t.assigned_staff?.full_name || 'Unassigned'}</td>
                    <td>
                      <span className={`priority ${PRIORITY_CLASS[t.priority] || ''}`}>
                        <span className="dot"></span>{t.priority}
                      </span>
                    </td>
                    <td className="status-col"><span className={STATUS_CHIP[t.status] || 'chip open'} style={chipNoWrapStyle}>{t.status}</span></td>
                    <td className="sla ok">{timeAgo(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      <TicketDetailModal
        ticket={workingTicket || viewTicket}
        readOnly={!!viewTicket}
        staffList={staffList}
        onClose={() => { setWorkingTicket(null); setViewTicket(null) }}
        onTransfer={handleTransfer}
        transferring={transferring}
      />
    </main>
  )
}

export default AdminDashboard