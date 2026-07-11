import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import '/src/ticket-assignment.css'
import api from '/src/api.js'
import TicketDetailModal from '/src/TicketDetailModal.jsx'

// Reads role/full_name as stored in localStorage at login.
const getRole = () => localStorage.getItem('role') || 'staff'
const getFullName = () => localStorage.getItem('full_name') || ''

const STATUS_META = {
  pending:     { label: 'Awaiting response', chip: 'open' },
  accepted:    { label: 'Accepted',          chip: 'resolved' },
  declined:    { label: 'Declined',          chip: 'hold' },
  unavailable: { label: 'Taken by another',  chip: 'closed' },
  transferred: { label: 'Transferred',       chip: 'hold' },
}

// Keeps every status chip on this page on a single line, sized to its content.
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

const PAST_FILTERS = ['all', 'accepted', 'unavailable', 'declined', 'transferred']

const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 }

// Gap kept between the popover and the viewport edge / the chip itself.
const EDGE_MARGIN = 12
const CHIP_GAP = 8

// Admin accounts often don't have full_name filled in — show "Admin"
// instead of falling back to their raw phone number.
function displayName(person) {
  if (!person) return 'Unknown'
  if (person.role === 'admin') return 'Admin'
  return person.full_name || person.phone_number
}

// Verb/label per TicketAssignmentEvent.action — matches the ACTION_CHOICES
// on the backend model exactly.
const EVENT_META = {
  offered:      { chip: 'open' },
  accepted:     { chip: 'resolved' },
  declined:     { chip: 'hold' },
  unavailable:  { chip: 'closed' },
  transferred:  { chip: 'hold' },
  escalated:    { chip: 'hold' },
}

function eventLabel(e) {
  switch (e.action) {
    case 'offered':     return `Offered to ${displayName(e.staff)}`
    case 'accepted':    return `${displayName(e.staff)} accepted`
    case 'declined':    return `${displayName(e.staff)} declined`
    case 'unavailable': return `${displayName(e.staff)} — too late, already taken`
    case 'transferred': return `${displayName(e.staff)} → ${displayName(e.to_staff)}`
    case 'escalated':   return `${displayName(e.staff)} → ${displayName(e.to_staff)} (escalated)`
    default:             return e.action
  }
}

// Chip showing who currently holds a ticket; hover/focus reveals its full
// assignment history in a portal tooltip that auto-repositions to stay on screen.
function HolderChip({ ticket }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, ready: false })
  const [events, setEvents] = useState(null) // null = not yet fetched
  const [loadingEvents, setLoadingEvents] = useState(false)
  const chipRef = useRef(null)
  const portalRef = useRef(null)

  // Anchors under the chip and lazily fetches history on first open.
  const show = () => {
    if (chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY + CHIP_GAP,
        left: rect.left + window.scrollX,
        ready: false,
      })
    }
    setOpen(true)

    if (events === null && !loadingEvents) {
      setLoadingEvents(true)
      api.get(`/tickets/${ticket.id}/assignment-history/`)
        .then(({ data }) => setEvents(data))
        .catch(() => setEvents([]))
        .finally(() => setLoadingEvents(false))
    }
  }
  const hide = () => setOpen(false)

  // Re-flips/clamps the popover position once its real size is known.
  useLayoutEffect(() => {
    if (!open || !portalRef.current || !chipRef.current) return

    const chipRect = chipRef.current.getBoundingClientRect()
    const popoverRect = portalRef.current.getBoundingClientRect()

    const viewportBottom = window.scrollY + window.innerHeight
    const wouldOverflowBelow = chipRect.bottom + CHIP_GAP + popoverRect.height + EDGE_MARGIN > viewportBottom
    const spaceAbove = chipRect.top - EDGE_MARGIN
    const canFitAbove = spaceAbove >= popoverRect.height + CHIP_GAP

    let top = chipRect.bottom + window.scrollY + CHIP_GAP
    if (wouldOverflowBelow && canFitAbove) {
      top = chipRect.top + window.scrollY - popoverRect.height - CHIP_GAP
    }

    let left = chipRect.left + window.scrollX
    const viewportRight = window.scrollX + window.innerWidth
    if (left + popoverRect.width + EDGE_MARGIN > viewportRight) {
      left = viewportRight - popoverRect.width - EDGE_MARGIN
    }
    if (left < window.scrollX + EDGE_MARGIN) {
      left = window.scrollX + EDGE_MARGIN
    }

    setCoords({ top, left, ready: true })
    // Re-measure once events finish loading (popover height changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, events?.length, loadingEvents])

  const holderLabel = ticket.assigned_staff ? displayName(ticket.assigned_staff) : 'Unassigned'

  return (
    <span
      ref={chipRef}
      className={`chip holder-chip ${ticket.assigned_staff ? 'resolved' : 'open'}`}
      style={chipNoWrapStyle}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => e.stopPropagation()}
    >
      {holderLabel}
      {open && createPortal(
        <div
          ref={portalRef}
          className="transfer-history-portal"
          // Hidden via opacity until positioning is finalized, to avoid a flash.
          style={{ top: coords.top, left: coords.left, opacity: coords.ready ? 1 : 0 }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="transfer-history-title">Assignment history</div>
          {loadingEvents && <div className="transfer-history-row">Loading…</div>}
          {!loadingEvents && (() => {
            // Filters out 'unavailable' noise rows from the displayed history.
            const visibleEvents = (events || []).filter((e) => e.action !== 'unavailable')
            if (visibleEvents.length === 0) {
              return <div className="transfer-history-row">No history yet.</div>
            }
            return visibleEvents.map((e) => (
              <div key={e.id} className="transfer-history-row">
                <span className="transfer-history-name">{eventLabel(e)}</span>
                <span className={`chip ${EVENT_META[e.action]?.chip}`} style={chipNoWrapStyle}>{e.action}</span>
              </div>
            ))
          })()}
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
        // Fetches full unfiltered history; tab filtering happens client-side in `grouped`.
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
  // "Unavailable" tab excludes tickets that were later accepted by someone else.
  const grouped = adminFilter === 'unavailable'
    ? groupedAll.filter((g) => !g.ticket.assigned_staff && g.offers.some((o) => o.status === 'unavailable'))
    : adminFilter
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
    // offer.ticket.assigned_staff is whoever currently holds the ticket.
    const label = offer.status === 'transferred' && offer.transferred_to
      ? `Transferred to ${displayName(offer.transferred_to)}`
      : offer.status === 'unavailable' && offer.ticket.assigned_staff
        ? `Taken by ${displayName(offer.ticket.assigned_staff)}`
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
          <span className={`chip ${meta.chip}`} style={chipNoWrapStyle}>{label}</span>
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
            <div className="stat-grid stat-grid-4">
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
                        <HolderChip ticket={ticket} />
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
                  {['pending', 'accepted', ''].map((f) => (
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
                                <HolderChip ticket={ticket} />
                              </td>
                              <td>
                                {ticket.assigned_staff ? (
                                  <span className="chip resolved" style={chipNoWrapStyle}>
                                    Accepted by {displayName(ticket.assigned_staff)}
                                  </span>
                                ) : ticketOffers.some((o) => o.status === 'pending') ? (
                                  <span className="chip open" style={chipNoWrapStyle}>Awaiting response</span>
                                ) : (
                                  <span className="chip hold" style={chipNoWrapStyle}>Unassigned</span>
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