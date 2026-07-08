import React from 'react'
import { Link } from 'react-router-dom'
import '../landing.css' // adjust this path if landing.css lives somewhere else

// ---------------------------------------------------------------------------
// Small inline icon set — same stroke language as the rest of the app
// (stroke="currentColor", strokeWidth 2, round caps/joins, 24x24 viewBox)
// so the landing page reads as the same product, not a separate template.
// ---------------------------------------------------------------------------
const Icon = {
  Claim: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  Route: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" />
      <path d="M9 6h6a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H9a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3" />
    </svg>
  ),
  Layers: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" />
    </svg>
  ),
  Chart: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3v18h18" /><path d="M7 15v3" /><path d="M12 10v8" /><path d="M17 6v12" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  ),
  Bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
    </svg>
  ),
}

const FEATURES = [
  {
    icon: Icon.Claim,
    tone: 'accent',
    title: 'Race-safe claiming',
    body: 'Two staff hit the same ticket at once — only one wins. Row-locked assignment means no double-work, ever.',
  },
  {
    icon: Icon.Route,
    tone: 'blue',
    title: 'Transfer & escalation',
    body: 'Hand a ticket to another department or flag it up to admin in one click, with a permanent escalation trail.',
  },
  {
    icon: Icon.Layers,
    tone: 'violet',
    title: 'Role-built dashboards',
    body: 'Customers, staff, and admins each see exactly what their role needs — nothing borrowed from a generic template.',
  },
  {
    icon: Icon.Chart,
    tone: 'amber',
    title: 'Live performance charts',
    body: 'Resolution trends and staff throughput computed straight from real ticket timestamps, not sampled estimates.',
  },
  {
    icon: Icon.Shield,
    tone: 'red',
    title: 'Full audit trail',
    body: 'Every claim, transfer, and status change is logged against the ticket — nothing gets lost in a side channel.',
  },
  {
    icon: Icon.Bell,
    tone: 'accent',
    title: 'Real-time offers',
    body: 'New tickets are offered to the right staff instantly, with unclaimed offers surfaced before they go stale.',
  },
]

const LIFECYCLE = [
  { label: 'Open', chip: 'chip open' },
  { label: 'In Progress', chip: 'chip hold' },
  { label: 'On Hold', chip: 'chip hold' },
  { label: 'Resolved', chip: 'chip resolved' },
  { label: 'Closed', chip: 'chip closed' },
]

const ROLES = [
  {
    tag: 'Customer',
    tone: 'accent',
    heading: 'Raise it, track it, done.',
    points: ['Raise tickets against your products', 'Watch status change in real time', 'See every staff remark in one thread'],
  },
  {
    tag: 'Staff',
    tone: 'blue',
    heading: 'Your queue, actually yours.',
    points: ['Claim offers before they slip away', 'Transfer what isn\u2019t yours to fix', 'Track your own resolution stats'],
  },
  {
    tag: 'Admin',
    tone: 'violet',
    heading: 'The whole desk, one screen.',
    points: ['Every ticket, every team, one view', 'Escalations land on your desk automatically', 'Approve accounts, manage staff & categories'],
  },
]

const MOCK_TICKETS = {
  open: [
    { id: 'TD-2291', subj: 'VPN drops on WFH days', pri: 'high' },
    { id: 'TD-2294', subj: 'Invoice PDF missing GST', pri: 'medium' },
  ],
  progress: [
    { id: 'TD-2288', subj: 'Printer offline — 3rd floor', pri: 'urgent' },
  ],
  resolved: [
    { id: 'TD-2280', subj: 'Password reset — locked out', pri: 'low' },
  ],
}

function MiniChip({ children, tone }) {
  return <span className={`landing-chip landing-chip--${tone}`}>{children}</span>
}

function MockTicket({ t, floating }) {
  return (
    <div className={`mock-ticket${floating ? ' mock-ticket--float' : ''}`}>
      <span className={`mock-pri mock-pri--${t.pri}`} />
      <div className="mock-ticket-body">
        <div className="mock-tid">{t.id}</div>
        <div className="mock-subj">{t.subj}</div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="landing">

      {/* ---------------- Nav ---------------- */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <span className="landing-brand-mark">TD</span>
            <span className="landing-brand-text">
              <span className="landing-brand-name">Ticket Desk</span>
              <span className="landing-brand-sub">Ops console for support teams</span>
            </span>
          </div>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost">Log in</Link>
            <Link to="/onboarding" className="landing-btn landing-btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">
              <span className="landing-eyebrow-dot" />
              Live dispatch, not a shared inbox
            </div>
            <h1 className="landing-h1">
              Every ticket, <span className="landing-h1-accent">claimed</span> — never dropped, never doubled.
            </h1>
            <p className="landing-sub">
              Ticket Desk routes support requests to the right person, locks claims so nobody
              collides, and gives customers, staff, and admins a dashboard actually built for
              what they do — not one shared view stretched three ways.
            </p>
            <div className="landing-hero-actions">
              <Link to="/onboarding" className="landing-btn landing-btn-primary landing-btn-lg">
                Get started free <Icon.Arrow width="16" height="16" />
              </Link>
              <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-lg">Log in</Link>
            </div>
            <div className="landing-hero-proof">
              <div><strong>Race-safe</strong> ticket claiming</div>
              <div><strong>Real-time</strong> escalation trail</div>
              <div><strong>Role-built</strong> dashboards</div>
            </div>
          </div>

          <div className="landing-hero-visual" aria-hidden="true">
            <div className="mock-window">
              <div className="mock-titlebar">
                <span className="mock-dot" style={{ background: '#E7A64C' }} />
                <span className="mock-dot" style={{ background: '#39D6A1' }} />
                <span className="mock-dot" style={{ background: '#E77A67' }} />
                <span className="mock-titlebar-label">Ticket Assignment — live</span>
              </div>
              <div className="mock-ticker">
                <span className="mock-ticker-dot" /> LIVE&nbsp;&nbsp;<b>4</b>&nbsp;open&nbsp;&middot;&nbsp;<b>1</b>&nbsp;in progress&nbsp;&middot;&nbsp;<b>1</b>&nbsp;resolved today
              </div>
              <div className="mock-board">
                <div className="mock-col">
                  <div className="mock-col-head"><MiniChip tone="amber">Open</MiniChip></div>
                  {MOCK_TICKETS.open.map((t) => <MockTicket key={t.id} t={t} />)}
                </div>
                <div className="mock-col">
                  <div className="mock-col-head"><MiniChip tone="blue">In Progress</MiniChip></div>
                  <MockTicket t={MOCK_TICKETS.progress[0]} floating />
                </div>
                <div className="mock-col">
                  <div className="mock-col-head"><MiniChip tone="accent">Resolved</MiniChip></div>
                  {MOCK_TICKETS.resolved.map((t) => <MockTicket key={t.id} t={t} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Stat strip ---------------- */}
         </div>
  )
}