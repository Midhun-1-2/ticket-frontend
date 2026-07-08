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

const PRIORITY_CLASS = { Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent' }
const ALL_STATUSES = ['Open', 'In Progress', 'On Hold', 'Resolved', 'Closed']
// Matches the backend's TicketStatusUpdateSerializer.STAFF_SETTABLE_STATUSES —
// 'Open' is deliberately not a settable target (it's the system's initial
// state before anyone accepts the ticket), so it's excluded from the
// update-status dropdown even though it's still a valid value to filter
// History by (ALL_STATUSES above, used there).
const STAFF_SETTABLE_STATUSES = ['In Progress', 'On Hold', 'Resolved', 'Closed']
const CAT_COLORS = ['var(--blue)', undefined, 'var(--amber)', 'var(--violet)', 'var(--red)']

// A ticket only drops out of "Currently Working On" once it's actually
// finished. Getting transferred away also removes it (assigned_staff no
// longer matches this staff member once the new staff accepts), but
// that's a side effect of the offer/accept flow, not a status value.
const DONE_STATUSES = ['Resolved', 'Closed']

// Same keys Login.jsx stores and Header.jsx already reads from.
const getFullName = () => localStorage.getItem('full_name') || ''
// Used to identify which tickets are "mine" (assigned_staff.phone_number
// matches this) since there's no user id stored client-side to compare
// against assigned_staff.id directly.
const getPhoneNumber = () => localStorage.getItem('phone_number') || ''

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

// Same normalization as AdminDashboard.jsx — keeps staff/ response shape
// mismatches from silently producing an empty transfer list here too.
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
// - readOnly=false (opened from "Currently Working On"): status update + transfer.
// - readOnly=true (opened from History): details only, no footer actions.
function TicketDetailModal({ ticket, staffList, readOnly, onClose, onStatusChange, onTransfer, updating, transferring }) {
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

  // The staff member who currently holds it is shown separately, not as
  // a transfer option — you can't transfer a ticket to whoever already
  // has it (which, on this page, is normally you). Matched by full_name,
  // not phone_number — phone_number comparisons between staffList (from
  // staff/) and each ticket's embedded assigned_staff kept silently
  // failing to match (likely a formatting difference between the two
  // independently-fetched endpoints), which is why the current holder
  // was still showing up as a transfer option.
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
            <span className="v"><span className={STATUS_CHIP[ticket.status] || 'chip open'}>{ticket.status}</span></span>
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
          <div className="modal-foot" style={{ flexWrap: 'wrap', rowGap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="panel-sub">Update status</span>
              <select
                className="select"
                value={ticket.status}
                disabled={updating}
                onChange={(e) => onStatusChange(ticket, e.target.value)}
              >
                {STAFF_SETTABLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {updating && <span className="panel-sub">Saving…</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span className="panel-sub">Transfer to</span>
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
          </div>
        )}
      </div>
    </div>
  )
}

function StaffDashboard() {
  const [tickets, setTickets] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [workingTicket, setWorkingTicket] = useState(null) // opened from Currently Working On — has status update + transfer
  const [viewTicket, setViewTicket] = useState(null)        // opened from History — read only
  const [updating, setUpdating] = useState(false)
  const [transferring, setTransferring] = useState(false)

  const [historyStatus, setHistoryStatus] = useState('All')
  const [historySearch, setHistorySearch] = useState('')

  const fullName = getFullName()
  const myPhone = getPhoneNumber()

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
        console.warn('staff/ returned no usable entries — raw response:', staffRes.data)
      }
      setStaffList(normalized)
    } catch (err) {
      setError('Could not load tickets.')
    } finally {
      setLoading(false)
    }
  }

  // "Mine" = tickets whose assigned_staff.phone_number matches the
  // logged-in staff member's phone number — there's no user id stored
  // client-side (localStorage only has role / full_name / phone_number)
  // to compare against assigned_staff.id directly, so phone number is
  // the only reliable match available. This is used for stats and the
  // "Currently Working On" list — History (below) intentionally uses
  // the full `tickets` list instead, since History is company-wide.
  const myTickets = useMemo(
    () => tickets.filter((t) => t.assigned_staff?.phone_number && t.assigned_staff.phone_number === myPhone),
    [tickets, myPhone]
  )

  const stats = useMemo(() => {
    const total = myTickets.length
    const inProgress = myTickets.filter((t) => t.status === 'In Progress').length
    const onHold = myTickets.filter((t) => t.status === 'On Hold').length
    const resolved = myTickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length
    return { total, inProgress, onHold, resolved }
  }, [myTickets])

  // Broadened from "status === In Progress" — a ticket stays here through
  // Open / In Progress / On Hold, and only drops off once it's Resolved,
  // Closed, or transferred away — a transfer clears assigned_staff to
  // None immediately, which drops it out of myTickets right away (not
  // waiting for the new staff member to accept).
  const workingTickets = useMemo(
    () => myTickets.filter((t) => !DONE_STATUSES.includes(t.status))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [myTickets]
  )

  const categoryBreakdown = useMemo(() => {
    const counts = {}
    myTickets.forEach((t) => {
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
  }, [myTickets])

  // Re-run counter animation + trend chart draw once real stats are ready,
  // and again whenever this page mounts (matches how the original admin
  // Dashboard.jsx wired these up).
  useEffect(() => {
    if (!loading) {
      initCounters()
      initTrendChart(buildTrendData(myTickets))
    }
  }, [loading, stats.total])

  // History is the full company-wide ticket log, not just this staff
  // member's own tickets — everyone gets to see everything the company
  // has ever received, same underlying `tickets` list AdminDashboard uses.
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

  // Hits the dedicated status endpoint (PATCH tickets/{id}/status/), NOT
  // tickets/{id}/ — that generic detail endpoint has `status` marked
  // read_only on TicketSerializer, so a PATCH there returns 200 but
  // silently ignores the status change server-side. Updates local state
  // from the server's response rather than assuming the value we sent
  // was applied, so the UI can't drift out of sync with what's actually
  // in the database again.
  const handleStatusChange = async (ticket, newStatus) => {
    setUpdating(true)
    try {
      const { data } = await api.patch(`tickets/${ticket.id}/status/`, { status: newStatus })
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? data : t)))
      setWorkingTicket((prev) => (prev && prev.id === ticket.id ? data : prev))
    } catch (err) {
      setError(
        err.response?.data?.detail
        || err.response?.data?.status?.[0]
        || 'Could not update ticket status.'
      )
    } finally {
      setUpdating(false)
    }
  }

  // Per TransferTicketView on the backend: this clears assigned_staff to
  // None on the ticket immediately (not left with the outgoing staff
  // member) and creates a fresh 'pending' TicketAssignment for the target
  // staff — they must accept it from Ticket Assignment before it's
  // actually theirs. Until then the ticket is unassigned and only an
  // admin can act on it (see _can_manage_ticket on the backend).
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
            <div className="page-eyebrow">Staff · Overview</div>
            <h1 className="page-title">Good morning{fullName ? `, ${fullName.split(' ')[0]}` : ''}</h1>
            <p className="page-desc">Here's what's on your plate today.</p>
          </div>
        </div>

        <div className="ticker">
          <div className="ticker-live"><span className="ticker-dot"></span> MY QUEUE</div>
          <div className="ticker-item"><b className="t-accent">{stats.inProgress}</b> in progress</div>
          <div className="ticker-item"><b className="t-amber">{stats.onHold}</b> on hold</div>
          <div className="ticker-item"><b>{stats.resolved}</b> resolved</div>
          <div className="ticker-item">Last sync <b>{loading ? '…' : 'just now'}</b></div>
        </div>
        {error && <div className="alert-banner error">{error}</div>}
        {notice && <div className="alert-banner success">{notice}</div>}

        <div className="stat-grid">
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Assigned to Me</div>
            <div className="stat-value mono" data-count={stats.total}>0</div>
            <div className="stat-foot">All time</div>
          </div>
          <div className="stat-card" data-tone="blue">
            <div className="stat-label">In Progress</div>
            <div className="stat-value mono" data-count={stats.inProgress}>0</div>
            <div className="stat-foot">Currently working</div>
          </div>
          <div className="stat-card" data-tone="red">
            <div className="stat-label">On Hold</div>
            <div className="stat-value mono" data-count={stats.onHold}>0</div>
            <div className="stat-foot">Blocked / waiting</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Resolved</div>
            <div className="stat-value mono" data-count={stats.resolved}>0</div>
            <div className="stat-foot">Resolved or closed</div>
          </div>
        </div>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Your Ticket Trend</div>
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
                <div className="panel-sub">Share of tickets assigned to you</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="cat-list">
                {categoryBreakdown.length === 0 && !loading && (
                  <div className="panel-sub">Nothing assigned yet.</div>
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
              <div className="panel-title">Currently Working On</div>
              <div className="panel-sub">Every ticket assigned to you that isn't resolved or closed yet. Click to update status or transfer.</div>
            </div>
          </div>
          <div className="panel-body table-wrap">
            <table className="tickets">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject / Raised By</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Raised</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5}>Loading tickets…</td></tr>}
                {!loading && workingTickets.length === 0 && (
                  <tr><td colSpan={5}>Nothing in progress right now.</td></tr>
                )}
                {!loading && workingTickets.map((t) => (
                  <tr key={t.id} className="row-clickable" onClick={() => setWorkingTicket(t)}>
                    <td className="tid">#{t.id.slice(0, 8).toUpperCase()}</td>
                    <td className="subject-cell">
                      <div className="subj">{t.subject}</div>
                      <div className="cust">{t.raised_by?.full_name || '—'}</div>
                    </td>
                    <td>
                      <span className={`priority ${PRIORITY_CLASS[t.priority] || ''}`}>
                        <span className="dot"></span>{t.priority}
                      </span>
                    </td>
                    <td><span className={STATUS_CHIP[t.status] || 'chip open'}>{t.status}</span></td>
                    <td className="sla ok">{timeAgo(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* History = every ticket the company has ever received, not just
            yours. Clicking a row opens the same modal in read-only mode —
            status update and transfer only happen from the table above. */}
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
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Raised</th>
                </tr>
              </thead>
              <tbody>
                {!loading && historyTickets.length === 0 && (
                  <tr><td colSpan={5}>No matching tickets.</td></tr>
                )}
                {!loading && historyTickets.map((t) => (
                  <tr key={t.id} className="row-clickable" onClick={() => setViewTicket(t)}>
                    <td className="tid">#{t.id.slice(0, 8).toUpperCase()}</td>
                    <td className="subject-cell">
                      <div className="subj">{t.subject}</div>
                      <div className="cust">{t.raised_by?.full_name || '—'}</div>
                    </td>
                    <td>
                      <span className={`priority ${PRIORITY_CLASS[t.priority] || ''}`}>
                        <span className="dot"></span>{t.priority}
                      </span>
                    </td>
                    <td><span className={STATUS_CHIP[t.status] || 'chip open'}>{t.status}</span></td>
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
        onStatusChange={handleStatusChange}
        onTransfer={handleTransfer}
        updating={updating}
        transferring={transferring}
      />
    </main>
  )
}

export default StaffDashboard