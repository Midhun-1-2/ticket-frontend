import React, { useEffect, useMemo, useState } from 'react'
import api from '../api' // adjust this path to match where api.js actually lives
import { initCounters, initTrendChart, buildTrendData } from '../script.js'

const STATUS_CHIP = {
  Open: 'chip open',
  'In Progress': 'chip progress',
  'On Hold': 'chip hold',
  Resolved: 'chip resolved',
  Closed: 'chip resolved',
}

// Same fix as AllTickets.jsx: forces the status pill onto a single line
// and sizes it to its own content, matching that page's status design
// exactly.
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

// A ticket only drops out of "Now Working" once it's actually finished.
// Getting transferred also removes it from view here (the assigned_staff
// changes once the new staff member accepts), but that's a side effect of
// the offer/accept flow, not a status value itself.
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

// The staff/ endpoint's exact response shape isn't confirmed yet — this
// normalizes a few common possibilities (a bare array, a paginated DRF
// response with { results: [...] }, or a differently-named list key) and
// a few common field-name variants for id/name/phone, so the dashboard
// doesn't silently end up with an empty list if the shape differs
// slightly from what was assumed here.
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

// One modal, two modes:
// - readOnly=false (opened from "Now Working"): shows the transfer control.
// - readOnly=true (opened from History): details only, no footer actions.
function TicketDetailModal({ ticket, staffList, readOnly, onClose, onTransfer, transferring }) {
  const [selectedStaffId, setSelectedStaffId] = useState('')
  // Staff ids tied to this ticket's raising company (via StaffAssignment),
  // from GET tickets/{id}/eligible-staff/ — used purely to group the
  // dropdown into "Assigned to this customer" vs "Other staff", per that
  // endpoint's own docstring. null = still loading.
  const [eligibleIds, setEligibleIds] = useState(null)

  useEffect(() => {
    setSelectedStaffId('')
    setEligibleIds(null)
    if (!ticket || readOnly) return
    let cancelled = false
    api.get(`tickets/${ticket.id}/eligible-staff/`)
      .then(({ data }) => { if (!cancelled) setEligibleIds(new Set(data.staff_ids || [])) })
      .catch(() => { if (!cancelled) setEligibleIds(new Set()) })
    return () => { cancelled = true }
  }, [ticket, readOnly])

  if (!ticket) return null

  // The person who currently holds the ticket is shown separately above,
  // not as a selectable option — you can't transfer a ticket to whoever
  // already has it. Matched by full_name, not phone_number — phone_number
  // comparisons between staffList (from staff/) and each ticket's embedded
  // assigned_staff kept silently failing to match (likely a formatting
  // difference between the two independently-fetched endpoints), which is
  // why the current holder was still showing up as a transfer option.
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
        </div>

        {!readOnly && (
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
    // Keyed by full_name rather than phone_number: the modal proves
    // ticket.assigned_staff.full_name is reliably populated and matches
    // what staffList shows for the same person, whereas phone_number
    // comparisons across the two independently-fetched endpoints kept
    // coming up empty (0 everywhere) — likely a formatting/shape
    // difference between staff/ and the tickets/ endpoint's embedded
    // assigned_staff that isn't visible from the frontend alone.
    const byName = new Map()

    // Seed every known staff member first, so someone with zero tickets
    // right now still shows up in the list at 0 rather than being
    // silently absent.
    staffList.forEach((s) => {
      if (!s.full_name) return
      byName.set(s.full_name, { key: s.full_name, name: s.full_name, working: 0, resolved: 0, total: 0 })
    })

    // Then aggregate straight from each ticket's own assigned_staff —
    // this is the actual source of truth for who holds what, and it's
    // guaranteed consistent with what the ticket detail modal displays.
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

  // Re-run counter animation + trend chart draw once real stats are ready,
  // and again whenever this page mounts (matches how the original admin
  // Dashboard.jsx wired these up).
  useEffect(() => {
    if (!loading) {
      initCounters()
      initTrendChart(buildTrendData(tickets))
    }
  }, [loading, stats.total])

  // Broadened from "status === In Progress" — a ticket stays here through
  // Open / In Progress / On Hold, and only drops off once it's Resolved,
  // Closed, or transferred away — a transfer clears assigned_staff to
  // None immediately (not on acceptance), so the ticket shows as
  // "Unassigned" here right after a transfer is sent, until someone
  // accepts the new pending offer via Ticket Assignment.
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

  // Per TransferTicketView on the backend: this clears assigned_staff to
  // None on the ticket immediately (not left with the outgoing/current
  // staff member) and creates a fresh 'pending' TicketAssignment for the
  // target staff — they must accept it from Ticket Assignment before it's
  // actually theirs. Until then the ticket shows as Unassigned and only
  // an admin can act on it further (see _can_manage_ticket on the backend).
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
              <div className="cat-list">
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

        <section className="panel">
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
              // Horizontal rows scale to any staff count without getting
              // cramped — a fixed max-height + scroll (same pattern as the
              // History tables below) rather than a vertical bar chart,
              // which gets unreadable fast once there are more than a
              // handful of columns.
              <div className="staff-list" style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'visible' }}>
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
                        {/* Bar's overall length = this staff's share of the
                            busiest staff member's total (s.pct); the color
                            segments inside it = the composition of their
                            own workload (working/resolved/other). */}
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

        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Now Working</div>
              <div className="panel-sub">Every ticket not yet resolved or closed, company-wide. Click to send a transfer offer.</div>
            </div>
          </div>
          <div className="panel-body table-wrap">
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

        {/* History = every ticket the company has ever received. Clicking
            a row opens the same modal in read-only mode — no transfer
            control, since that only happens from "Now Working" above. */}
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