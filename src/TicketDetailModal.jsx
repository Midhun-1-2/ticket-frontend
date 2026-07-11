import React, { useState, useEffect, useCallback } from 'react'
import api from '/src/api.js'
import '/src/ticket-detail-modal.css'

const STATUS_OPTIONS = ['In Progress', 'On Hold', 'Resolved', 'Closed']

// Same localStorage keys as Header.jsx / GlobalSearch.jsx.
const getPhoneNumber = () => localStorage.getItem('phone_number') || ''
const getRole = () => localStorage.getItem('role') || ''

// Admin accounts often don't have full_name filled in — show "Admin"
// instead of falling back to their raw phone number.
function displayName(person) {
  if (!person) return 'Unknown'
  if (person.role === 'admin') return 'Admin'
  return person.full_name || person.phone_number
}

// Props: ticketId, onClose, onChanged (called after status/transfer/escalate actions).
function TicketDetailModal({ ticketId, onClose, onChanged }) {
  const myPhone = getPhoneNumber()
  const isAdmin = getRole() === 'admin'

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [actionError, setActionError] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [statusRemark, setStatusRemark] = useState('')

  const [showTransfer, setShowTransfer] = useState(false)
  const [staffOptions, setStaffOptions] = useState([])
  const [eligibleStaffIds, setEligibleStaffIds] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [transferSaving, setTransferSaving] = useState(false)

  const [showEscalate, setShowEscalate] = useState(false)
  const [escalateReason, setEscalateReason] = useState('')
  const [escalateSaving, setEscalateSaving] = useState(false)

  const loadTicket = useCallback(async () => {
    try {
      setError('')
      const res = await api.get(`tickets/${ticketId}/`)
      setTicket(res.data)
    } catch (err) {
      setError('Could not load ticket details.')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => { loadTicket() }, [loadTicket])

  // Esc closes the modal.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Whether the current user is allowed to manage this ticket.
  const canManage = ticket && (
    !ticket.assigned_staff
      ? isAdmin
      : ticket.assigned_staff.role === 'admin'
        ? isAdmin
        : ticket.assigned_staff.phone_number === myPhone
  )

  const refreshAfterAction = async () => {
    await loadTicket()
    onChanged?.()
  }

  // Stages a status change; actual PATCH happens in confirmStatusChange.
  const stageStatusChange = (status) => {
    if (status === ticket.status) return
    setPendingStatus(status)
    setStatusRemark('')
    setActionError('')
  }

  const cancelStatusChange = () => {
    setPendingStatus(null)
    setStatusRemark('')
  }

  const confirmStatusChange = async () => {
    if (!pendingStatus || !statusRemark.trim()) return
    setStatusSaving(true)
    setActionError('')
    try {
      await api.patch(`tickets/${ticketId}/status/`, { status: pendingStatus, remark: statusRemark.trim() })
      setPendingStatus(null)
      setStatusRemark('')
      await refreshAfterAction()
    } catch (err) {
      setActionError(
        err.response?.data?.detail
        || err.response?.data?.remark?.[0]
        || 'Could not update status.'
      )
    } finally {
      setStatusSaving(false)
    }
  }

  const openTransferPanel = async () => {
    setShowTransfer(true)
    setShowEscalate(false)
    setActionError('')
    setStaffLoading(true)
    try {
      const [staffRes, eligibleRes] = await Promise.all([
        staffOptions.length > 0 ? Promise.resolve({ data: staffOptions }) : api.get('staff/'),
        api.get(`tickets/${ticketId}/eligible-staff/`),
      ])
      if (staffOptions.length === 0) {
        setStaffOptions(staffRes.data.filter((s) => s.status === 'active'))
      }
      setEligibleStaffIds(eligibleRes.data.staff_ids || [])
    } catch (err) {
      setActionError('Could not load staff list.')
    } finally {
      setStaffLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!selectedStaffId) return
    setTransferSaving(true)
    setActionError('')
    try {
      await api.post(`tickets/${ticketId}/transfer/`, { staff_id: Number(selectedStaffId) })
      setShowTransfer(false)
      setSelectedStaffId('')
      if (isAdmin) {
        await refreshAfterAction()
      } else {
        // The transferring staff member no longer manages this ticket —
        // it's now a pending offer sitting with the new staff member.
        onChanged?.()
        onClose()
      }
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Could not transfer this ticket.')
    } finally {
      setTransferSaving(false)
    }
  }

  const handleEscalate = async () => {
    setEscalateSaving(true)
    setActionError('')
    try {
      await api.post(`tickets/${ticketId}/escalate/`, { reason: escalateReason })
      setShowEscalate(false)
      setEscalateReason('')
      await refreshAfterAction()
    } catch (err) {
      setActionError('Could not escalate this ticket.')
    } finally {
      setEscalateSaving(false)
    }
  }

  const statusChipClass = {
    'Open': 'open',
    'In Progress': 'progress',
    'On Hold': 'hold',
    'Resolved': 'resolved',
    'Closed': 'closed',
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Ticket Details</div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="ticket-modal-status">Loading…</div>}
          {!loading && error && <div className="ticket-modal-status ticket-modal-error">{error}</div>}

          {!loading && !error && ticket && (
            <>
              <div className="ticket-modal-top">
                <div>
                  <div className="ticket-modal-subject">{ticket.subject}</div>
                  <div className="ticket-modal-meta">
                    <span className="mono">{ticket.category}</span>
                    <span className="ticket-modal-sep">·</span>
                    <span>{ticket.product}</span>
                    <span className="ticket-modal-sep">·</span>
                    <span className={`priority ${ticket.priority.toLowerCase()}`}>
                      <span className="dot" /> {ticket.priority}
                    </span>
                  </div>
                </div>
                <span className={`chip ${statusChipClass[ticket.status] || ''}`}>{ticket.status}</span>
              </div>

              {/* Escalation banner, shown to staff while the ticket still sits with admin. */}
              {ticket.escalated && ticket.assigned_staff?.role === 'admin' && !isAdmin && (
                <div className="escalated-banner">
                  <strong>Escalated to admin</strong>
                  {ticket.escalation_note && <p>{ticket.escalation_note}</p>}
                </div>
              )}

              <div className="ticket-modal-section">
                <div className="ticket-modal-label">Raised by</div>
                <div>{ticket.raised_by?.full_name || 'Unknown'} · {ticket.raised_by?.phone_number}</div>
              </div>

              <div className="ticket-modal-section">
                <div className="ticket-modal-label">Assigned to</div>
                <div>{ticket.assigned_staff ? displayName(ticket.assigned_staff) : 'Unassigned'}</div>
              </div>

              <div className="ticket-modal-section">
                <div className="ticket-modal-label">Description</div>
                <p className="ticket-modal-description">{ticket.description}</p>
              </div>

              <div className="ticket-modal-section">
                <div className="ticket-modal-label">Attachments</div>
                {ticket.attachments?.length > 0 ? (
                  <div className="attachment-list">
                    {ticket.attachments.map((att) => (
                      <a key={att.id} href={att.file} target="_blank" rel="noreferrer" className="attachment-item">
                        {att.file.split('/').pop()}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="ticket-modal-status">No attachments</div>
                )}
              </div>

              {actionError && <div className="ticket-modal-status ticket-modal-error">{actionError}</div>}

              {canManage ? (
                <>
                  <div className="ticket-modal-section">
                    <div className="ticket-modal-label">Update status</div>
                    <div className="status-btn-group">
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          className={`status-btn${ticket.status === s ? ' active' : ''}${pendingStatus === s ? ' active' : ''}`}
                          disabled={statusSaving || ticket.status === s}
                          onClick={() => stageStatusChange(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {pendingStatus && (
                      <div style={{ marginTop: 10 }}>
                        <textarea
                          placeholder={`Add a remark for moving this ticket to "${pendingStatus}" (required)`}
                          value={statusRemark}
                          onChange={(e) => setStatusRemark(e.target.value)}
                          rows={3}
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                        <div className="action-row">
                          <button className="btn btn-ghost" onClick={cancelStatusChange} disabled={statusSaving}>Cancel</button>
                          <button
                            className="btn btn-primary"
                            disabled={!statusRemark.trim() || statusSaving}
                            onClick={confirmStatusChange}
                          >
                            {statusSaving ? 'Saving…' : 'Confirm Status Change'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="action-row">
                    <button className="btn btn-ghost" onClick={openTransferPanel}>
                      Transfer to another staff
                    </button>
                    {!isAdmin && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => { setShowEscalate(true); setShowTransfer(false); setActionError('') }}
                      >
                        Escalate to admin
                      </button>
                    )}
                  </div>

                  {showTransfer && (
                    <div className="transfer-panel">
                      {staffLoading ? (
                        <div className="ticket-modal-status">Loading staff…</div>
                      ) : (
                        <>
                          {(() => {
                            const eligibleSet = new Set(eligibleStaffIds)
                            const selectable = staffOptions.filter((s) =>
                              s.phone !== ticket.assigned_staff?.phone_number
                              && s.phone !== myPhone
                            )
                            const assignedGroup = selectable.filter((s) => eligibleSet.has(s.id))
                            const otherGroup = selectable.filter((s) => !eligibleSet.has(s.id))
                            const optionLabel = (s) => `${s.name || s.phone}${s.department ? ` — ${s.department}` : ''}`

                            return (
                              <select
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                              >
                                <option value="">Select a staff member…</option>
                                {assignedGroup.length > 0 && (
                                  <optgroup label="Assigned to this customer">
                                    {assignedGroup.map((s) => (
                                      <option key={s.id} value={s.id}>{optionLabel(s)}</option>
                                    ))}
                                  </optgroup>
                                )}
                                {otherGroup.length > 0 && (
                                  <optgroup label="Other staff">
                                    {otherGroup.map((s) => (
                                      <option key={s.id} value={s.id}>{optionLabel(s)}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            )
                          })()}
                          <div className="action-row">
                            <button className="btn btn-ghost" onClick={() => setShowTransfer(false)}>Cancel</button>
                            <button
                              className="btn btn-primary"
                              disabled={!selectedStaffId || transferSaving}
                              onClick={handleTransfer}
                            >
                              {transferSaving ? 'Transferring…' : 'Confirm Transfer'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {showEscalate && (
                    <div className="escalate-panel">
                      <textarea
                        placeholder="Optional note for admin — what needs attention?"
                        value={escalateReason}
                        onChange={(e) => setEscalateReason(e.target.value)}
                      />
                      <div className="action-row">
                        <button className="btn btn-ghost" onClick={() => setShowEscalate(false)}>Cancel</button>
                        <button className="btn btn-primary" disabled={escalateSaving} onClick={handleEscalate}>
                          {escalateSaving ? 'Escalating…' : 'Confirm Escalation'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                ticket.assigned_staff && (
                  <div className="ticket-modal-status">
                    This ticket was accepted by {displayName(ticket.assigned_staff)}.
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TicketDetailModal