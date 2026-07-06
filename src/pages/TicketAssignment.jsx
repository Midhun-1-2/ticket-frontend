import React, { useState, useEffect, useCallback } from 'react'
import '/src/ticket-assignment.css'
import api from '/src/api.js'

// NOTE: assumes login stores { role, full_name } in localStorage, matching
// the shape returned by the backend's issue_tokens(). Adjust these two
// lines if your AuthContext / api.js stores it differently.
const getRole = () => localStorage.getItem('role') || 'staff'
const getFullName = () => localStorage.getItem('full_name') || ''

const STATUS_META = {
  pending:     { label: 'Awaiting response', chip: 'open' },
  accepted:    { label: 'Accepted',          chip: 'resolved' },
  declined:    { label: 'Declined',          chip: 'hold' },
  unavailable: { label: 'Taken by another',  chip: 'closed' },
}

const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 }

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function groupByTicket(assignments) {
  const map = new Map()
  assignments.forEach((a) => {
    const key = a.ticket.id
    if (!map.has(key)) map.set(key, { ticket: a.ticket, offers: [] })
    map.get(key).offers.push(a)
  })
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.ticket.created_at) - new Date(a.ticket.created_at)
  )
}

function TicketAssignment() {
  const role = getRole()
  const isAdmin = role === 'admin'
  const fullName = getFullName()

  const [offers, setOffers] = useState([])          // staff view: flat list
  const [allAssignments, setAllAssignments] = useState([]) // admin view: flat, grouped in render
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)
  const [error, setError] = useState('')
  const [adminFilter, setAdminFilter] = useState('pending') // '', pending, accepted, unavailable

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try {
      if (isAdmin) {
        const qs = adminFilter ? `?status=${adminFilter}` : ''
        const res = await api.get(`/ticket-assignments/${qs}`)
        setAllAssignments(res.data)
      } else {
        const res = await api.get('/ticket-assignments/mine/')
        setOffers(res.data)
      }
      setError('')
    } catch (err) {
      if (!silent) setError('Could not load ticket assignments. Please try refreshing.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [isAdmin, adminFilter])

  useEffect(() => {
    load(false)
    const interval = setInterval(() => load(true), 12000)
    return () => clearInterval(interval)
  }, [load])

  const respond = async (assignmentId, action) => {
    setActingId(assignmentId)
    setError('')
    try {
      await api.post(`/ticket-assignments/${assignmentId}/${action}/`)
      await load(true)
    } catch (err) {
      if (err.response?.status === 409) {
        setOffers((prev) =>
          prev.map((o) => (o.id === assignmentId ? { ...o, status: 'unavailable' } : o))
        )
        setError(err.response.data?.detail || 'This ticket was already taken by another staff member.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setActingId(null)
    }
  }

  // ---------- Derived data ----------

  const pendingOffers = offers
    .filter((o) => o.status === 'pending')
    .sort((a, b) => (PRIORITY_ORDER[a.ticket.priority] ?? 9) - (PRIORITY_ORDER[b.ticket.priority] ?? 9))
  const pastOffers = offers.filter((o) => o.status !== 'pending')

  const grouped = groupByTicket(allAssignments)
  const stats = {
    pending: allAssignments.filter((a) => a.status === 'pending').length,
    accepted: allAssignments.filter((a) => a.status === 'accepted').length,
    unavailable: allAssignments.filter((a) => a.status === 'unavailable').length,
  }

  // ---------- Staff view pieces ----------

  const renderOfferRow = (offer, actionable) => {
    const meta = STATUS_META[offer.status] || {}
    const isActing = actingId === offer.id
    return (
      <div className="offer-row" key={offer.id}>
        <div className={`offer-priority priority ${offer.ticket.priority.toLowerCase()}`}>
          <span className="dot" />
        </div>
        <div className="offer-main">
          <div className="offer-subject">{offer.ticket.subject}</div>
          <div className="offer-meta">
            <span className="mono">{offer.ticket.category}</span>
            <span className="offer-sep">·</span>
            <span>{offer.ticket.customer_name || 'Unknown customer'}</span>
            {offer.ticket.company_name && (
              <>
                <span className="offer-sep">·</span>
                <span>{offer.ticket.company_name}</span>
              </>
            )}
            <span className="offer-sep">·</span>
            <span className="mono">{timeAgo(offer.offered_at)}</span>
          </div>
        </div>
        {actionable ? (
          <div className="offer-actions">
            <button
              className="btn btn-ghost btn-decline"
              disabled={isActing}
              onClick={() => respond(offer.id, 'decline')}
            >
              Decline
            </button>
            <button
              className="btn btn-primary"
              disabled={isActing}
              onClick={() => respond(offer.id, 'accept')}
            >
              {isActing ? 'Accepting…' : 'Accept'}
            </button>
          </div>
        ) : (
          <span className={`chip ${meta.chip}`}>{meta.label}</span>
        )}
      </div>
    )
  }

  // ---------- Render ----------

  return (
    <main className="main">
      <div className="content">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">TRIAGE · TICKET ASSIGNMENT</div>
            <h1 className="page-title">
              {isAdmin ? 'Ticket Assignment' : `Your ticket offers${fullName ? `, ${fullName.split(' ')[0]}` : ''}`}
            </h1>
            <p className="page-desc">
              {isAdmin
                ? 'See who each ticket has been offered to and how staff are responding.'
                : 'Accept a ticket to claim it. First to accept gets it — others will see it was taken.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="assign-error">{error}</div>
        )}

        {isAdmin ? (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat-card" data-tone="amber">
                <div className="stat-label">Pending</div>
                <div className="stat-value">{stats.pending}</div>
                <div className="stat-foot">Awaiting staff response</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Accepted</div>
                <div className="stat-value">{stats.accepted}</div>
                <div className="stat-foot">Claimed by a staff member</div>
              </div>
              <div className="stat-card" data-tone="violet">
                <div className="stat-label">Unclaimed offers</div>
                <div className="stat-value">{stats.unavailable}</div>
                <div className="stat-foot">Lost to another staff member</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Assignment activity</div>
                  <div className="panel-sub">Grouped by ticket — one row per ticket, all offers shown</div>
                </div>
                <div className="tabs">
                  {['pending', 'accepted', 'unavailable', ''].map((f) => (
                    <div
                      key={f || 'all'}
                      className={`tab ${adminFilter === f ? 'active' : ''}`}
                      onClick={() => setAdminFilter(f)}
                    >
                      {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel-body">
                {loading ? (
                  <div className="assign-empty">Loading assignments…</div>
                ) : grouped.length === 0 ? (
                  <div className="assign-empty">No ticket assignments match this filter.</div>
                ) : (
                  <div className="table-wrap">
                    <table className="tickets">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Priority</th>
                          <th>Customer</th>
                          <th>Offered to</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped.map(({ ticket, offers: ticketOffers }) => {
                          const accepted = ticketOffers.find((o) => o.status === 'accepted')
                          return (
                            <tr key={ticket.id}>
                              <td className="subject-cell">
                                <div className="subj">{ticket.subject}</div>
                                <div className="cust mono">{ticket.category}</div>
                              </td>
                              <td>
                                <span className={`priority ${ticket.priority.toLowerCase()}`}>
                                  <span className="dot" /> {ticket.priority}
                                </span>
                              </td>
                              <td>
                                {ticket.customer_name || '—'}
                                {ticket.company_name && (
                                  <div className="cust">{ticket.company_name}</div>
                                )}
                              </td>
                              <td>
                                <div className="offer-staff-list">
                                  {ticketOffers.map((o) => (
                                    <span key={o.id} className={`chip ${STATUS_META[o.status]?.chip}`}>
                                      {o.staff.full_name || o.staff.phone_number}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                {accepted ? (
                                  <span className="chip resolved">
                                    Accepted by {accepted.staff.full_name || accepted.staff.phone_number}
                                  </span>
                                ) : (
                                  <span className="chip open">Awaiting response</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="ticker">
              <div className="ticker-live">
                <span className="ticker-dot" />
                LIVE OFFERS
              </div>
              <div className="ticker-item">
                <b>{pendingOffers.length}</b> awaiting your response
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Pending offers</div>
                  <div className="panel-sub">Accept quickly — these can be taken by another staff member</div>
                </div>
              </div>
              <div className="panel-body">
                {loading ? (
                  <div className="assign-empty">Loading your offers…</div>
                ) : pendingOffers.length === 0 ? (
                  <div className="assign-empty">No pending ticket offers right now.</div>
                ) : (
                  <div className="offer-list">
                    {pendingOffers.map((o) => renderOfferRow(o, true))}
                  </div>
                )}
              </div>
            </div>

            {pastOffers.length > 0 && (
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Past offers</div>
                    <div className="panel-sub">Tickets you've already responded to</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="offer-list">
                    {pastOffers.map((o) => renderOfferRow(o, false))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default TicketAssignment
