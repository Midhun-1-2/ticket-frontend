import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

const CAT_COLORS = ['var(--blue)', undefined, 'var(--amber)', 'var(--violet)', 'var(--red)']

// Statuses a customer is allowed to revoke (i.e. reopen) once staff have
// marked the ticket as finished. A ticket that's still Open / In Progress /
// On Hold is actively being worked on, so revoke isn't offered for those —
// only tickets staff have wrapped up (Resolved/Closed) can be reopened.
const REVOCABLE_STATUSES = ['Resolved', 'Closed']

// Linear progress steps used for the stepper in the detail view.
// On Hold / Cancelled are treated as side-states and shown as a banner instead.
const FLOW_STEPS = ['Open', 'In Progress', 'Resolved']

// Same keys Login.jsx stores and Header.jsx already reads from.
const getFullName = () => localStorage.getItem('full_name') || ''

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

function TicketDetailModal({ ticket, onClose, onRevoke, revoking }) {
  if (!ticket) return null

  const isSideState = ticket.status === 'On Hold' || ticket.status === 'Closed'
  const currentStepIndex = FLOW_STEPS.indexOf(ticket.status)
  const canRevoke = REVOCABLE_STATUSES.includes(ticket.status)

  const history = ticket.status_history && ticket.status_history.length
    ? ticket.status_history
    : [
        { status: 'Open', note: 'Ticket raised', changed_at: ticket.created_at },
        ...(ticket.updated_at && ticket.updated_at !== ticket.created_at
          ? [{ status: ticket.status, note: 'Latest update', changed_at: ticket.updated_at }]
          : []),
      ]

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

          {ticket.description && (
            <>
              <div className="detail-section-title">Description</div>
              <div className="remarks-box">{ticket.description}</div>
            </>
          )}

          <div className="detail-section-title">Status</div>
          {isSideState ? (
            <span className={STATUS_CHIP[ticket.status] || 'chip hold'}>{ticket.status}</span>
          ) : (
            <div className="status-stepper">
              {FLOW_STEPS.map((step, i) => (
                <div key={step} className={`step ${i <= currentStepIndex ? 'step-done' : ''}`}>
                  <div className="step-dot"></div>
                  <div className="step-label">{step}</div>
                </div>
              ))}
            </div>
          )}

          <div className="detail-section-title">Timeline</div>
          <ul className="timeline-list">
            {history.map((h, i) => (
              <li key={i}>
                <span className={STATUS_CHIP[h.status] || 'chip open'}>{h.status}</span>
                <span className="panel-sub">{h.note}</span>
                <span className="panel-sub">{formatDate(h.changed_at)}</span>
              </li>
            ))}
          </ul>

          <div className="detail-row">
            <span className="k">Raised</span>
            <span className="v">{formatDate(ticket.created_at)}</span>
          </div>
        </div>

        <div className="modal-foot">
          {canRevoke ? (
            <button className="btn btn-danger" disabled={revoking} onClick={() => onRevoke(ticket)}>
              {revoking ? 'Reopening…' : 'Reopen Ticket'}
            </button>
          ) : (
            <span className="panel-sub">
              This ticket can't be reopened right now — it's still being worked on.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomerDashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [revoking, setRevoking] = useState(false)

  const fullName = getFullName()

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    setError('')
    try {
      // Assumes the backend scopes this to the logged-in customer's own tickets.
      const { data } = await api.get('tickets/')
      setTickets(data)
    } catch (err) {
      setError('Could not load your tickets.')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === 'Open').length
    const inProgress = tickets.filter((t) => t.status === 'In Progress').length
    const resolved = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length
    const onHold = tickets.filter((t) => t.status === 'On Hold').length
    return { total, open, inProgress, resolved, onHold }
  }, [tickets])

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [tickets]
  )

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

  const handleRevoke = async (ticket) => {
    if (!window.confirm(`Reopen ticket #${ticket.id.slice(0, 8).toUpperCase()}? It'll go back to the Open queue.`)) return
    setRevoking(true)
    try {
      await api.post(`tickets/${ticket.id}/revoke/`)
      setSelectedTicket(null)
      fetchTickets()
    } catch (err) {
      setError('Could not reopen this ticket. Please try again.')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">Customer · Overview</div>
            <h1 className="page-title">Good morning{fullName ? `, ${fullName.split(' ')[0]}` : ''}</h1>
            <p className="page-desc">Here's the status of the tickets you've raised.</p>
          </div>
          <Link to="/raise-ticket/" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Raise Ticket
          </Link>
        </div>

        <div className="ticker">
          <div className="ticker-live"><span className="ticker-dot"></span> MY QUEUE</div>
          <div className="ticker-item"><b>{stats.open}</b> open</div>
          <div className="ticker-item"><b className="t-accent">{stats.inProgress}</b> in progress</div>
          <div className="ticker-item"><b className="t-amber">{stats.onHold}</b> on hold</div>
          <div className="ticker-item">Last sync <b>{loading ? '…' : 'just now'}</b></div>
        </div>
        {error && <div className="raise-banner error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="stat-grid">
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Total Raised</div>
            <div className="stat-value mono" data-count={stats.total}>0</div>
            <div className="stat-foot">All time</div>
          </div>
          <div className="stat-card" data-tone="amber">
            <div className="stat-label">Open</div>
            <div className="stat-value mono" data-count={stats.open}>0</div>
            <div className="stat-foot">Awaiting first action</div>
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
                <div className="panel-sub">Share of your tickets</div>
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
              <div className="panel-title">Your Tickets</div>
              <div className="panel-sub">Click a row to see full status, timeline, and revoke option</div>
            </div>
          </div>
          <div className="panel-body table-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table className="tickets">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Raised</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5}>Loading tickets…</td></tr>}
                {!loading && sortedTickets.length === 0 && (
                  <tr><td colSpan={5}>You haven't raised any tickets yet.</td></tr>
                )}
                {!loading && sortedTickets.map((t) => (
                  <tr key={t.id} className="row-clickable" onClick={() => setSelectedTicket(t)}>
                    <td className="tid">#{t.id.slice(0, 8).toUpperCase()}</td>
                    <td className="subject-cell"><div className="subj">{t.subject}</div></td>
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
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onRevoke={handleRevoke}
        revoking={revoking}
      />
    </main>
  )
}

export default CustomerDashboard