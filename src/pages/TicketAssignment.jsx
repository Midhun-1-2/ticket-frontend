import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import '/src/ticket-assignment.css'
import api from '/src/api.js'
import TicketDetailModal from '/src/TicketDetailModal.jsx'

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
  transferred: { label: 'Transferred',       chip: 'hold' },
}

const PAST_FILTERS = ['all', 'accepted', 'unavailable', 'declined', 'transferred']

const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 }

// Admin accounts often don't have full_name filled in — show "Admin"
// instead of falling back to their raw phone number.
function displayName(person) {
  if (!person) return 'Unknown'
  if (person.role === 'admin') return 'Admin'
  return person.full_name || person.phone_number
}

// Shows who currently holds a ticket as a single chip. Hovering (or
// focusing, so it works for keyboard/touch too) reveals the real custody
// chain — who accepted it first, and any transfers since — filtered down
// to just 'accepted'/'transferred' rows ("taken by another" noise from
// the original multi-staff offer round is left out). The tooltip renders
// through a portal straight onto <body>, so it isn't clipped by any
// ancestor's overflow:hidden (the panel it lives in has that for its own
// rounded corners) and never needs an internal scrollbar to be seen.
function HolderChip({ ticket, offers }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const chipRef = useRef(null)

  const historyOffers = offers
    .filter((o) => o.status === 'accepted' || o.status === 'transferred')
    .sort((a, b) => new Date(a.responded_at || a.offered_at) - new Date(b.responded_at || b.offered_at))

  const updatePosition = () => {
    if (chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX })
    }
  }

  const show = () => { updatePosition(); setOpen(true) }
  const hide = () => setOpen(false)

  const holderLabel = ticket.assigned_staff ? displayName(ticket.assigned_staff) : 'Unassigned'

  return (
    <span
      ref={chipRef}
      className={`chip holder-chip ${ticket.assigned_staff ? 'resolved' : 'open'}`}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => e.stopPropagation()}
    >
      {holderLabel}
      {open && historyOffers.length > 0 && createPortal(
        <div
          className="transfer-history-portal"
          style={{ top: coords.top, left: coords.left }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="transfer-history-title">Assignment history</div>
          {historyOffers.map((o) => (
            <div key={o.id} className="transfer-history-row">
              <span className="transfer-history-name">
                {o.status === 'transferred' && o.transferred_to
                  ? `${displayName(o.staff)} → ${displayName(o.transferred_to)}`
                  : displayName(o.staff)}
              </span>
              <span className={`chip ${STATUS_META[o.status]?.chip}`}>{STATUS_META[o.status]?.label}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </span>
  )
}

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
  const [escalatedAssignments, setEscalatedAssignments] = useState([]) // admin view: always fetched, independent of adminFilter
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)
  const [error, setError] = useState('')
  const [adminFilter, setAdminFilter] = useState('pending') // '', pending, accepted, unavailable
  const [pastFilter, setPastFilter] = useState('all')       // staff view: filter for the Past offers list

  // Ticket detail modal — shared between the staff "past offers" list and
  // the admin grouped table; just needs a ticket id to fetch its own data.
  const [openTicketId, setOpenTicketId] = useState(null)

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try {
      if (isAdmin) {
        // Always fetch the FULL history (no ?status= filter) — filtering
        // server-side meant a ticket's other rows (e.g. an outgoing
        // staff's 'transferred' row) were never even fetched when a tab
        // like "Accepted" was selected, so HolderChip's tooltip had no
        // way to show the full chain. The Pending/Accepted/Unavailable
        // tabs now just decide which tickets to DISPLAY (client-side,
        // see `grouped` below); every ticket's tooltip always has its
        // complete history regardless of which tab is active.
        const [fullRes, escRes] = await Promise.all([
          api.get('/ticket-assignments/'),
          api.get('/ticket-assignments/?escalated=true'),
        ])
        setAllAssignments(fullRes.data)
        setEscalatedAssignments(escRes.data)
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
  }, [isAdmin])

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
  const allPastOffers = offers.filter((o) => o.status !== 'pending')
  const pastOffers = pastFilter === 'all'
    ? allPastOffers
    : allPastOffers.filter((o) => o.status === pastFilter)

  const groupedAll = groupByTicket(allAssignments)
  const grouped = adminFilter
    ? groupedAll.filter((g) => g.offers.some((o) => o.status === adminFilter))
    : groupedAll
  const escalatedGrouped = groupByTicket(escalatedAssignments)
  const stats = {
    pending: allAssignments.filter((a) => a.status === 'pending').length,
    accepted: allAssignments.filter((a) => a.status === 'accepted').length,
    unavailable: allAssignments.filter((a) => a.status === 'unavailable').length,
    escalated: escalatedGrouped.length,
  }

  // ---------- Staff view pieces ----------

  const renderOfferRow = (offer, actionable) => {
    const meta = STATUS_META[offer.status] || {}
    const isActing = actingId === offer.id
    const label = offer.status === 'transferred' && offer.transferred_to
      ? `Transferred to ${displayName(offer.transferred_to)}`
      : meta.label

    return (
      <div
        className={`offer-row${!actionable ? ' offer-row-clickable' : ''}`}
        key={offer.id}
        onClick={!actionable ? () => setOpenTicketId(offer.ticket.id) : undefined}
      >
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
              onClick={(e) => { e.stopPropagation(); respond(offer.id, 'decline') }}
            >
              Decline
            </button>
            <button
              className="btn btn-primary"
              disabled={isActing}
              onClick={(e) => { e.stopPropagation(); respond(offer.id, 'accept') }}
            >
              {isActing ? 'Accepting…' : 'Accept'}
            </button>
          </div>
        ) : (
          <span className={`chip ${meta.chip}`}>{label}</span>
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
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
              <div className="stat-card" data-tone="red">
                <div className="stat-label">Escalated</div>
                <div className="stat-value">{stats.escalated}</div>
                <div className="stat-foot">Handed up to admin</div>
              </div>
            </div>

            {escalatedGrouped.length > 0 && (
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Escalated tickets</div>
                    <div className="panel-sub">Handed up to admin — click one for the full history and note</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="offer-list">
                    {escalatedGrouped.map(({ ticket, offers: ticketOffers }) => (
                      <div
                        className="offer-row offer-row-clickable"
                        key={ticket.id}
                        onClick={() => setOpenTicketId(ticket.id)}
                      >
                        <div className={`offer-priority priority ${ticket.priority.toLowerCase()}`}>
                          <span className="dot" />
                        </div>
                        <div className="offer-main">
                          <div className="offer-subject">{ticket.subject}</div>
                          <div className="offer-meta">
                            <span className="mono">{ticket.category}</span>
                            <span className="offer-sep">·</span>
                            <span>{ticket.customer_name || 'Unknown customer'}</span>
                            {ticket.company_name && (
                              <>
                                <span className="offer-sep">·</span>
                                <span>{ticket.company_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <HolderChip ticket={ticket} offers={ticketOffers} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Assignment activity</div>
                  <div className="panel-sub">Grouped by ticket — click a row to view full details</div>
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
                            <tr
                              key={ticket.id}
                              className="table-row-clickable"
                              onClick={() => setOpenTicketId(ticket.id)}
                            >
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
                                <HolderChip ticket={ticket} offers={ticketOffers} />
                              </td>
                              <td>
                                {accepted ? (
                                  <span className="chip resolved">
                                    Accepted by {displayName(accepted.staff)}
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

            {allPastOffers.length > 0 && (
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Past offers</div>
                    <div className="panel-sub">Tickets you've already responded to — click one for details</div>
                  </div>
                  <div className="tabs">
                    {PAST_FILTERS.map((f) => (
                      <div
                        key={f}
                        className={`tab ${pastFilter === f ? 'active' : ''}`}
                        onClick={() => setPastFilter(f)}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel-body">
                  {pastOffers.length === 0 ? (
                    <div className="assign-empty">No offers match this filter.</div>
                  ) : (
                    <div className="offer-list">
                      {pastOffers.map((o) => renderOfferRow(o, false))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {openTicketId && (
        <TicketDetailModal
          ticketId={openTicketId}
          onClose={() => setOpenTicketId(null)}
          onChanged={() => load(true)}
        />
      )}
    </main>
  )
}

export default TicketAssignment