import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api' // adjust this path to match where api.js actually lives
import { initCounters, initTrendChart } from '../script.js'

const STATUS_CHIP = {
  Open: 'chip open',
  'In Progress': 'chip progress',
  'On Hold': 'chip hold',
  Resolved: 'chip resolved',
  Closed: 'chip resolved',
}

const PRIORITY_CLASS = { Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent' }

const CAT_COLORS = ['var(--blue)', undefined, 'var(--amber)', 'var(--violet)', 'var(--red)']

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('tickets/')
      setTickets(data)
    } catch (err) {
      setError('Could not load tickets.')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Derived stats ----------

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === 'Open').length
    const inProgress = tickets.filter((t) => t.status === 'In Progress').length
    const resolved = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length
    const onHold = tickets.filter((t) => t.status === 'On Hold').length
    return { total, open, inProgress, resolved, onHold }
  }, [tickets])

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

  const recentTickets = useMemo(() => tickets.slice(0, 5), [tickets])

  // Re-run counter animation + trend chart draw once real stats are ready,
  // and again whenever this page mounts (App.jsx's initApp() only fires
  // once on first load, so navigating away and back needs this too).
  useEffect(() => {
    if (!loading) {
      initCounters()
      initTrendChart()
    }
  }, [loading, stats.total])

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">Admin · Overview</div>
            <h1 className="page-title">Good morning, Rahul</h1>
            <p className="page-desc">
              Here's how the support queue is looking today, {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/raise-ticket/" className="btn btn-ghost">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Raise Ticket
            </Link>
            <a href="#" className="btn btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Assign Tickets
            </a>
          </div>
        </div>

        {/* Signature element: live queue ticker */}
        <div className="ticker">
          <div className="ticker-live"><span className="ticker-dot"></span> LIVE QUEUE</div>
          <div className="ticker-item"><b>{stats.open}</b> open</div>
          <div className="ticker-item"><b className="t-accent">{stats.inProgress}</b> in progress</div>
          <div className="ticker-item"><b className="t-amber">{stats.onHold}</b> on hold</div>
          <div className="ticker-item">Last sync <b>{loading ? '…' : 'just now'}</b></div>
        </div>
        {error && <div className="raise-banner error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Summary cards */}
        <div className="stat-grid">
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Total Tickets</div>
            <div className="stat-value mono" data-count={stats.total}>0</div>
            <div className="stat-foot">All tickets raised</div>
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
          <div className="stat-card" data-tone="red">
            <div className="stat-label">On Hold</div>
            <div className="stat-value mono" data-count={stats.onHold}>0</div>
            <div className="stat-foot">Blocked / waiting</div>
          </div>
        </div>

        {/* Trend + Staff performance */}
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
                <div className="panel-sub">Share of tickets</div>
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

        {/* Recent tickets */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Recent Tickets</div>
              <div className="panel-sub">Newest activity across the queue</div>
            </div>
            <a href="/all-tickets/" className="btn btn-ghost">View all</a>
          </div>
          <div className="panel-body table-wrap">
            <table className="tickets">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject / Raised By</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5}>Loading tickets…</td></tr>
                )}
                {!loading && recentTickets.length === 0 && (
                  <tr><td colSpan={5}>No tickets yet.</td></tr>
                )}
                {!loading && recentTickets.map((t) => (
                  <tr key={t.id}>
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
    </main>
  )
}

export default Dashboard