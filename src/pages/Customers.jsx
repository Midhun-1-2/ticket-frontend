import React, { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../api' // adjust this path to match where api.js actually lives
import useIsMobile from '../hooks/useIsMobile'

const STATUS_CHIP = {
  Active: 'chip resolved',
  'Pending Approval': 'chip hold',
  Blocked: 'chip overdue',
  Expired: 'chip open',
}

// Color map for ticket status chips (separate from customer account status).
const TICKET_STATUS_CHIP = {
  Open: 'chip open',
  'In Progress': 'chip hold',
  'On Hold': 'chip hold',
  Resolved: 'chip resolved',
  Closed: 'chip closed',
}

// Forces every status chip on this page onto a single line, sized to its own content.
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

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending Approval' },
  { key: 'blocked', label: 'Blocked' },
]

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase()
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Shows a "Note" chip for a ticket's staff remark; hover/focus reveals the full text via a portal tooltip.
function RemarkTooltip({ text }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const chipRef = useRef(null)

  if (!text) return <span style={{ color: 'var(--text-faint)' }}>—</span>

  const updatePosition = () => {
    if (chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX })
    }
  }
  const show = () => { updatePosition(); setOpen(true) }
  const hide = () => setOpen(false)

  return (
    <span
      ref={chipRef}
      className="chip hold"
      style={{ cursor: 'help', ...chipNoWrapStyle }}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      Note
      {open && createPortal(
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            zIndex: 1000,
            maxWidth: 260,
            background: 'var(--ink)',
            color: '#DADCE4',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12.5,
            lineHeight: 1.5,
            boxShadow: '0 12px 30px -8px rgba(20,23,31,0.45)',
          }}
        >
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: '#8A8FA3', marginBottom: 4, fontWeight: 600 }}>
            Staff Remark
          </div>
          {text}
        </div>,
        document.body
      )}
    </span>
  )
}

function Customers() {
  // On mobile the Actions column moves to the front — see AllTickets.jsx for
  // the same pattern/rationale.
  const isMobile = useIsMobile()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')

  const [viewUser, setViewUser] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [confirmUser, setConfirmUser] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)
  const [activityUser, setActivityUser] = useState(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('customers/')
      setCustomers(data)
    } catch (err) {
      setError('Could not load customers.')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Derived stats ----------
  const stats = useMemo(() => {
    const total = customers.length
    const active = customers.filter((c) => c.status === 'Active').length
    const pending = customers.filter((c) => c.status === 'Pending Approval').length
    const blocked = customers.filter((c) => c.status === 'Blocked').length
    return { total, active, pending, blocked }
  }, [customers])

  const filtered = useMemo(() => {
    let rows = customers
    if (statusTab !== 'all') {
      const map = { active: 'Active', pending: 'Pending Approval', blocked: 'Blocked' }
      rows = rows.filter((c) => c.status === map[statusTab])
    }
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
      )
    }
    return rows
  }, [customers, search, statusTab])

  // ---------- Row actions ----------
  const patchLocal = (id, patch) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const handleDeactivateConfirm = async () => {
    if (!confirmUser) return
    try {
      const { data } = await api.patch(`customers/${confirmUser.id}/deactivate/`)
      patchLocal(confirmUser.id, { status: data.status })
    } catch (err) {
      setError('Could not update customer status.')
    } finally {
      setConfirmUser(null)
    }
  }

  const handleDeleted = (id) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id))
    setDeleteUser(null)
  }

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">Admin · Manage</div>
            <h1 className="page-title">Customers</h1>
            <p className="page-desc">View, edit, and manage customer accounts.</p>
          </div>
        </div>

        {error && <div className="raise-banner error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Summary cards */}
        <div className="stat-grid stat-grid-4">
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Total Customers</div>
            <div className="stat-value mono">{stats.total}</div>
            <div className="stat-foot">All accounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active</div>
            <div className="stat-value mono">{stats.active}</div>
            <div className="stat-foot">Approved &amp; active</div>
          </div>
          <div className="stat-card" data-tone="violet">
            <div className="stat-label">Pending Approval</div>
            <div className="stat-value mono">{stats.pending}</div>
            <div className="stat-foot">Awaiting admin review</div>
          </div>
          <div className="stat-card" data-tone="red">
            <div className="stat-label">Blocked</div>
            <div className="stat-value mono">{stats.blocked}</div>
            <div className="stat-foot">Deactivated accounts</div>
          </div>
        </div>

        {/* Search + filter */}
        <div className="filter-bar">
          <div className="search-field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              placeholder="Search by name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="tabs">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${statusTab === t.key ? 'active' : ''}`}
                onClick={() => setStatusTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <section className="panel">
          <div className="panel-body table-wrap" style={{ paddingTop: 18 }}>
            <table className="tickets">
              <thead>
                <tr>
                  {isMobile && <th>Actions</th>}
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Joined</th>
                  <th>AMC Valid Till</th>
                  <th>Status</th>
                  {!isMobile && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6}>Loading customers…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6}>No customers found.</td></tr>
                )}
                {!loading && filtered.map((c) => {
                  const actionsCell = (
                    <td key="actions" onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="icon-action" title="View" onClick={() => setViewUser(c)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          className="icon-action"
                          title={c.status === 'Blocked' ? 'Reactivate the account to edit' : 'Edit'}
                          onClick={() => setEditUser({ ...c, errors: {} })}
                          disabled={c.status === 'Blocked'}
                          style={c.status === 'Blocked' ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          className="icon-action danger"
                          title={c.status === 'Blocked' ? 'Activate' : 'Deactivate'}
                          onClick={() => setConfirmUser(c)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" />
                          </svg>
                        </button>
                        <button className="icon-action danger" title="Delete" onClick={() => setDeleteUser(c)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )
                  return (
                    <tr
                      key={c.id}
                      className="row-clickable"
                      onClick={() => setActivityUser(c)}
                    >
                      {isMobile && actionsCell}
                      <td>
                        <div className="cust-cell">
                          <div className="cust-avatar">{initials(c.name)}</div>
                          <div>
                            <div className="cust-name">{c.name || '—'}</div>
                            <div className="cust-email">{c.email || '—'}</div>
                            <div className="cust-email">{c.phone || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{c.company || '—'}</td>
                      <td className="sla ok">{formatDate(c.date_joined)}</td>
                      <td className="sla ok">{c.amc_valid_till ? formatDate(c.amc_valid_till) : '—'}</td>
                      <td><span className={STATUS_CHIP[c.status] || 'chip open'} style={chipNoWrapStyle}>{c.status}</span></td>
                      {!isMobile && actionsCell}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {viewUser && <ViewModal user={viewUser} onClose={() => setViewUser(null)} />}
      {activityUser && <TicketActivityModal user={activityUser} onClose={() => setActivityUser(null)} />}
      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(updated) => {
            patchLocal(updated.id, {
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              status: updated.status,
            })
            setEditUser(null)
          }}
        />
      )}
      {confirmUser && (
        <ConfirmModal
          title={confirmUser.status === 'Blocked' ? 'Activate customer?' : 'Deactivate customer?'}
          text={
            confirmUser.status === 'Blocked'
              ? `${confirmUser.name} will regain access to their account.`
              : `${confirmUser.name} will lose access to their account until reactivated.`
          }
          confirmLabel={confirmUser.status === 'Blocked' ? 'Activate' : 'Deactivate'}
          onCancel={() => setConfirmUser(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}
      {deleteUser && (
        <DeleteCustomerModal
          user={deleteUser}
          onCancel={() => setDeleteUser(null)}
          onDeleted={() => handleDeleted(deleteUser.id)}
        />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// View modal — shows full customer/company details plus ticket activity
// ---------------------------------------------------------------------------
function ViewModal({ user, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get(`customers/${user.id}/`).then(({ data }) => {
      if (active) {
        setDetail(data)
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [user.id])

  const company = detail?.company
  const ticketStats = detail?.ticket_stats
  const tickets = detail?.tickets || []

  const accountSection = detail && (
    <>
      <div className="detail-section-title">Account</div>
      <div className="detail-grid">
        <div className="detail-row"><span className="k">Name</span><span className="v">{detail.name}</span></div>
        <div className="detail-row"><span className="k">Status</span><span className="v"><span className={STATUS_CHIP[detail.status] || 'chip open'} style={chipNoWrapStyle}>{detail.status}</span></span></div>
        <div className="detail-row"><span className="k">Email</span><span className="v">{detail.email || '—'}</span></div>
        <div className="detail-row"><span className="k">Phone</span><span className="v">{detail.phone}</span></div>
        <div className="detail-row"><span className="k">Joined</span><span className="v">{formatDate(detail.date_joined)}</span></div>
      </div>
    </>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Customer Details</div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {loading && <div className="panel-sub">Loading…</div>}

          {!loading && detail && (
            <>
              {company && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', marginBottom: 20,
                    borderRadius: 10, borderLeft: '4px solid #0f6e63',
                    background: 'linear-gradient(135deg, rgba(15,110,99,0.08), rgba(15,110,99,0.02))',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0f6e63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
                    <path d="M9 9v.01" /><path d="M9 12v.01" /><path d="M9 15v.01" /><path d="M9 18v.01" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#0f6e63', fontWeight: 600, marginBottom: 2 }}>
                      Company
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: '#14171f', lineHeight: 1.2 }}>
                      {company.company_name || '—'}
                    </div>
                  </div>
                </div>
              )}

              <div className="detail-section-title" style={{ marginTop: 0 }}>Company Profile</div>
              {company ? (
                <>
                  <div className="detail-grid">
                    <div className="detail-row"><span className="k">Company Code</span><span className="v">{company.company_code || '—'}</span></div>
                    <div className="detail-row"><span className="k">Type</span><span className="v">{company.company_type || '—'}</span></div>
                    <div className="detail-row"><span className="k">Industry</span><span className="v">{company.industry_type || '—'}</span></div>
                    <div className="detail-row"><span className="k">GST Number</span><span className="v">{company.gst_number || '—'}</span></div>
                    <div className="detail-row"><span className="k">PAN Number</span><span className="v">{company.pan_number || '—'}</span></div>
                    <div className="detail-row"><span className="k">Website</span><span className="v">{company.website || '—'}</span></div>
                    <div className="detail-row"><span className="k">Annual Turnover</span><span className="v">{company.annual_turnover || '—'}</span></div>
                    <div className="detail-row"><span className="k">Employees</span><span className="v">{company.employee_count || '—'}</span></div>
                    <div className="detail-row"><span className="k">Approval Status</span><span className="v">{company.status || '—'}</span></div>
                  </div>

                  <div className="detail-section-title">Address</div>
                  <div className="detail-grid">
                    <div className="detail-row"><span className="k">Address Line 1</span><span className="v">{company.address_line1 || '—'}</span></div>
                    <div className="detail-row"><span className="k">Address Line 2</span><span className="v">{company.address_line2 || '—'}</span></div>
                    <div className="detail-row"><span className="k">City</span><span className="v">{company.city || '—'}</span></div>
                    <div className="detail-row"><span className="k">State</span><span className="v">{company.state || '—'}</span></div>
                    <div className="detail-row"><span className="k">Country</span><span className="v">{company.country || '—'}</span></div>
                    <div className="detail-row"><span className="k">Pincode</span><span className="v">{company.pincode || '—'}</span></div>
                  </div>

                  <div className="detail-section-title">Contact Person</div>
                  <div className="detail-grid">
                    <div className="detail-row"><span className="k">Contact Name</span><span className="v">{company.contact_name || '—'}</span></div>
                    <div className="detail-row"><span className="k">Designation</span><span className="v">{company.designation || '—'}</span></div>
                    <div className="detail-row"><span className="k">Contact Email</span><span className="v">{company.email || '—'}</span></div>
                    <div className="detail-row"><span className="k">Alternate Email</span><span className="v">{company.alternate_email || '—'}</span></div>
                    <div className="detail-row"><span className="k">Mobile</span><span className="v">{company.mobile_number || '—'}</span></div>
                    <div className="detail-row"><span className="k">Phone</span><span className="v">{company.phone_number || '—'}</span></div>
                  </div>

                  {accountSection}

                  <div className="detail-section-title">Support &amp; Contract</div>
                  <div className="detail-grid">
                    <div className="detail-row"><span className="k">AMC Status</span><span className="v">{company.amc_status || '—'}</span></div>
                    <div className="detail-row"><span className="k">AMC Start</span><span className="v">{formatDate(company.amc_start_date)}</span></div>
                    <div className="detail-row"><span className="k">AMC End</span><span className="v">{formatDate(company.amc_end_date)}</span></div>
                    <div className="detail-row"><span className="k">Contract Ref</span><span className="v">{company.contract_ref_number || '—'}</span></div>
                    <div className="detail-row"><span className="k">Preferred Channel</span><span className="v">{company.preferred_channel || '—'}</span></div>
                    <div className="detail-row"><span className="k">Preferred Time</span><span className="v">{company.preferred_time || '—'}</span></div>
                  </div>

                  {company.products_in_use?.length > 0 && (
                    <>
                      <div className="detail-section-title">Products In Use</div>
                      <div className="product-chip-list">
                        {company.products_in_use.map((p) => (
                          <span className="product-chip" key={p}>{p}</span>
                        ))}
                      </div>
                    </>
                  )}

                  {company.products?.length > 0 && (
                    <>
                      <div className="detail-section-title">Product Details</div>
                      <table className="product-table">
                        <thead>
                          <tr>
                            <th>Product</th><th>Version</th><th>Activated</th><th>Support</th>
                          </tr>
                        </thead>
                        <tbody>
                          {company.products.map((p) => (
                            <tr key={p.id}>
                              <td>{p.product_name}</td>
                              <td>{p.product_version || '—'}</td>
                              <td>{formatDate(p.activation_date)}</td>
                              <td>{p.support_type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {company.remarks && (
                    <>
                      <div className="detail-section-title">Remarks</div>
                      <div className="remarks-box">{company.remarks}</div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="panel-sub">No company on file.</div>
                  {accountSection}
                </>
              )}

              {/* ---------------- Ticket Activity / Contact Tracking (highlighted) ---------------- */}
              <div
                style={{
                  marginTop: 24,
                  padding: '18px 20px 20px',
                  borderRadius: 12,
                  border: '1.5px solid #1f8a83',
                  background: 'rgba(31, 138, 131, 0.06)',
                  boxShadow: '0 0 0 1px rgba(31, 138, 131, 0.08)',
                }}
              >
                <div
                  className="detail-section-title"
                  style={{ marginTop: 0, color: '#1f8a83', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Ticket Activity
                </div>
                <div className="stat-grid stat-grid-4" style={{ marginBottom: 20 }}>
                  <div className="stat-card" data-tone="accent">
                    <div className="stat-label">Total Tickets</div>
                    <div className="stat-value mono">{ticketStats?.total ?? 0}</div>
                    <div className="stat-foot">Times contacted us</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Open</div>
                    <div className="stat-value mono">{ticketStats?.by_status?.Open ?? 0}</div>
                    <div className="stat-foot">Awaiting action</div>
                  </div>
                  <div className="stat-card" data-tone="violet">
                    <div className="stat-label">In Progress</div>
                    <div className="stat-value mono">{ticketStats?.by_status?.['In Progress'] ?? 0}</div>
                    <div className="stat-foot">Being worked on</div>
                  </div>
                  <div className="stat-card" data-tone="red">
                    <div className="stat-label">Resolved / Closed</div>
                    <div className="stat-value mono">
                      {(ticketStats?.by_status?.Resolved ?? 0) + (ticketStats?.by_status?.Closed ?? 0)}
                    </div>
                    <div className="stat-foot">Completed</div>
                  </div>
                </div>

                {tickets.length > 0 ? (
                  <table className="product-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Assigned Staff</th>
                        <th>Remarks</th>
                        <th>Raised On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t.id}>
                          <td>{t.subject}</td>
                          <td>{t.product || '—'}</td>
                          <td>{t.category}</td>
                          <td>{t.priority}</td>
                          <td><span className={TICKET_STATUS_CHIP[t.status] || 'chip open'} style={chipNoWrapStyle}>{t.status}</span></td>
                          <td>{t.assigned_staff_name || <span style={{ color: 'var(--text-faint)' }}>Unassigned</span>}</td>
                          <td><RemarkTooltip text={t.remarks} /></td>
                          <td className="sla ok">{formatDateTime(t.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="panel-sub">No tickets raised yet.</div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ticket Activity modal — clicking anywhere on a customer row shows just
// this (the same block ViewModal renders at the bottom of its full detail
// view), rather than the entire account/company profile.
// ---------------------------------------------------------------------------
const TICKET_ACTIVITY_PAGE_SIZE = 5

function TicketActivityModal({ user, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    api.get(`customers/${user.id}/`).then(({ data }) => {
      if (active) {
        setDetail(data)
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [user.id])

  const ticketStats = detail?.ticket_stats
  const tickets = detail?.tickets || []
  const totalPages = Math.max(1, Math.ceil(tickets.length / TICKET_ACTIVITY_PAGE_SIZE))
  const pageTickets = tickets.slice(
    (page - 1) * TICKET_ACTIVITY_PAGE_SIZE,
    page * TICKET_ACTIVITY_PAGE_SIZE
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Ticket Activity — {user.name}</div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {loading && <div className="panel-sub">Loading…</div>}

          {!loading && detail && (
            <div
              style={{
                padding: '18px 20px 20px',
                borderRadius: 12,
                border: '1.5px solid #1f8a83',
                background: 'rgba(31, 138, 131, 0.06)',
                boxShadow: '0 0 0 1px rgba(31, 138, 131, 0.08)',
              }}
            >
              <div
                className="detail-section-title"
                style={{ marginTop: 0, color: '#1f8a83', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Ticket Activity
              </div>
              <div className="stat-grid stat-grid-4" style={{ marginBottom: 20 }}>
                <div className="stat-card" data-tone="accent">
                  <div className="stat-label">Total Tickets</div>
                  <div className="stat-value mono">{ticketStats?.total ?? 0}</div>
                  <div className="stat-foot">Times contacted us</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Open</div>
                  <div className="stat-value mono">{ticketStats?.by_status?.Open ?? 0}</div>
                  <div className="stat-foot">Awaiting action</div>
                </div>
                <div className="stat-card" data-tone="violet">
                  <div className="stat-label">In Progress</div>
                  <div className="stat-value mono">{ticketStats?.by_status?.['In Progress'] ?? 0}</div>
                  <div className="stat-foot">Being worked on</div>
                </div>
                <div className="stat-card" data-tone="red">
                  <div className="stat-label">Resolved / Closed</div>
                  <div className="stat-value mono">
                    {(ticketStats?.by_status?.Resolved ?? 0) + (ticketStats?.by_status?.Closed ?? 0)}
                  </div>
                  <div className="stat-foot">Completed</div>
                </div>
              </div>

              {tickets.length > 0 ? (
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned Staff</th>
                      <th>Remarks</th>
                      <th>Raised On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageTickets.map((t) => (
                      <tr key={t.id}>
                        <td>{t.subject}</td>
                        <td>{t.product || '—'}</td>
                        <td>{t.category}</td>
                        <td>{t.priority}</td>
                        <td><span className={TICKET_STATUS_CHIP[t.status] || 'chip open'} style={chipNoWrapStyle}>{t.status}</span></td>
                        <td>{t.assigned_staff_name || <span style={{ color: 'var(--text-faint)' }}>Unassigned</span>}</td>
                        <td><RemarkTooltip text={t.remarks} /></td>
                        <td className="sla ok">{formatDateTime(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="panel-sub">No tickets raised yet.</div>
              )}

              {tickets.length > TICKET_ACTIVITY_PAGE_SIZE && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '5px 12px', fontSize: 12.5 }}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '5px 12px', fontSize: 12.5 }}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit modal — updates name/email/phone and manages the customer's products
// ---------------------------------------------------------------------------
function EditModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name || '', email: user.email || '', phone: user.phone || '',
    amcStartDate: '', amcEndDate: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [detailLoading, setDetailLoading] = useState(true)
  const [hasCompany, setHasCompany] = useState(false)
  const [products, setProducts] = useState([])   // products already on this customer's company
  const [catalog, setCatalog] = useState([])     // Product Master catalog (flat list)

  const [showAddRow, setShowAddRow] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [productError, setProductError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get(`customers/${user.id}/`),
      api.get('products/'),
    ])
      .then(([custRes, catalogRes]) => {
        if (!active) return
        setHasCompany(!!custRes.data.company)
        setProducts(custRes.data.company?.products || [])
        setCatalog((catalogRes.data || []).filter((p) => p.is_active))
        setForm((f) => ({
          ...f,
          amcStartDate: custRes.data.company?.amc_start_date || '',
          amcEndDate: custRes.data.company?.amc_end_date || '',
        }))
      })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [user.id])

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    if (hasCompany && (!form.amcStartDate || !form.amcEndDate)) {
      setErrors({
        amc_start_date: !form.amcStartDate ? ['AMC start date is required.'] : undefined,
        amc_end_date: !form.amcEndDate ? ['AMC end date is required.'] : undefined,
      })
      return
    }
    setSaving(true)
    setErrors({})
    try {
      const payload = {
        full_name: form.name,
        email: form.email,
        phone_number: form.phone,
      }
      if (hasCompany) {
        payload.amc_start_date = form.amcStartDate
        payload.amc_end_date = form.amcEndDate
      }
      const { data } = await api.patch(`customers/${user.id}/`, payload)
      onSaved(data)
    } catch (err) {
      setErrors(err.response?.data || { detail: 'Could not save changes.' })
    } finally {
      setSaving(false)
    }
  }

  // Keys already attached to this customer's company, so both dropdowns
  // hide combinations that are already added rather than just the name.
  const addedKeys = useMemo(
    () => new Set(products.map((p) => `${p.product_name}|${p.product_version || ''}`)),
    [products]
  )

  const catalogByName = useMemo(() => {
    const map = {}
    catalog.forEach((p) => {
      if (!map[p.name]) map[p.name] = []
      map[p.name].push(p)
    })
    return map
  }, [catalog])

  const versionsFor = (name) =>
    (catalogByName[name] || []).filter((p) => !addedKeys.has(`${p.name}|${p.version || ''}`))

  const availableNames = useMemo(
    () => Object.keys(catalogByName).filter((name) => versionsFor(name).length > 0).sort(),
    [catalogByName, addedKeys]
  )

  const availableVersions = useMemo(() => versionsFor(selectedName), [catalogByName, selectedName, addedKeys])

  const catalogExhausted = !detailLoading && hasCompany && catalog.length > 0 && availableNames.length === 0
  const catalogEmpty = !detailLoading && hasCompany && catalog.length === 0

  // Picking a name auto-fills the first available version.
  const handleNameChange = (e) => {
    const name = e.target.value
    setSelectedName(name)
    const versions = versionsFor(name)
    setSelectedVersionId(versions[0]?.id || '')
  }

  const handleAddProduct = async () => {
    if (!selectedVersionId) return
    setAddingProduct(true)
    setProductError('')
    try {
      const { data } = await api.post(`customers/${user.id}/products/`, {
        product_id: selectedVersionId,
      })
      setProducts((prev) => [...prev, data])
      setSelectedName('')
      setSelectedVersionId('')
      setShowAddRow(false)
    } catch (err) {
      setProductError(err.response?.data?.detail || 'Could not add product.')
    } finally {
      setAddingProduct(false)
    }
  }

  const handleRemoveProduct = async (product) => {
    const label = product.product_version
      ? `${product.product_name} (v${product.product_version})`
      : product.product_name
    if (!window.confirm(`Remove ${label} from this customer?`)) return

    setRemovingId(product.id)
    setProductError('')
    try {
      await api.delete(`customers/${user.id}/products/${product.id}/`)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch (err) {
      setProductError(err.response?.data?.detail || 'Could not remove product.')
    } finally {
      setRemovingId(null)
    }
  }

  const closeAddRow = () => {
    setShowAddRow(false)
    setSelectedName('')
    setSelectedVersionId('')
    setProductError('')
  }

  const canAdd = !!selectedVersionId && !addingProduct

  const selectStyle = {
    flex: '1 1 45%',
    minWidth: 0,
    height: 38,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid #dcdacf',
    background: '#fff',
    fontSize: 13.5,
    color: '#1f1e1a',
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Edit Customer</div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label>Full name</label>
            <input value={form.name} onChange={handleChange('name')} />
            {errors.full_name && <div className="form-error">{errors.full_name[0]}</div>}
          </div>
          <div className="form-field">
            <label>Email</label>
            <input value={form.email} onChange={handleChange('email')} />
            {errors.email && <div className="form-error">{errors.email[0]}</div>}
          </div>
          <div className="form-field">
            <label>Phone number</label>
            <input value={form.phone} onChange={handleChange('phone')} maxLength={10} />
            {errors.phone_number && <div className="form-error">{errors.phone_number[0]}</div>}
          </div>
          {errors.detail && <div className="form-error">{errors.detail}</div>}

          {/* ---------------- AMC (styled card, teal accent) ---------------- */}
          {!detailLoading && hasCompany && (
            <div
              style={{
                marginTop: 22,
                padding: '16px 18px 18px',
                borderRadius: 12,
                border: '1px solid #e3e1d6',
                background: '#faf9f5',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0f6e63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6c6a5f' }}>
                  AMC
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <div className="form-field" style={{ flex: '1 1 45%', minWidth: 0, marginBottom: 0 }}>
                  <label>AMC Start Date<span className="required">*</span></label>
                  <input
                    type="date"
                    value={form.amcStartDate}
                    onChange={handleChange('amcStartDate')}
                    required
                    style={{ width: '100%' }}
                  />
                  {errors.amc_start_date && <div className="form-error">{errors.amc_start_date[0]}</div>}
                </div>
                <div className="form-field" style={{ flex: '1 1 45%', minWidth: 0, marginBottom: 0 }}>
                  <label>AMC End Date<span className="required">*</span></label>
                  <input
                    type="date"
                    value={form.amcEndDate}
                    onChange={handleChange('amcEndDate')}
                    required
                    style={{ width: '100%' }}
                  />
                  {errors.amc_end_date && <div className="form-error">{errors.amc_end_date[0]}</div>}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- Products (styled card, teal accent) ---------------- */}
          <div
            style={{
              marginTop: 22,
              padding: '16px 18px 18px',
              borderRadius: 12,
              border: '1px solid #e3e1d6',
              background: '#faf9f5',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0f6e63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
                  <circle cx="7" cy="7" r="1" fill="#0f6e63" stroke="none" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6c6a5f' }}>
                  Products
                </span>
              </div>
              {!detailLoading && hasCompany && (
                <span style={{ fontSize: 12, color: '#8c8a7d' }}>
                  {products.length} added
                </span>
              )}
            </div>

            {detailLoading && <div className="panel-sub">Loading products…</div>}

            {!detailLoading && !hasCompany && (
              <div className="panel-sub">This customer has no company profile yet.</div>
            )}

            {!detailLoading && hasCompany && (
              <>
                {products.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {products.map((p) => (
                      <span
                        key={p.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 8px 6px 12px',
                          borderRadius: 999,
                          background: 'rgba(15,110,99,0.08)',
                          border: '1px solid rgba(15,110,99,0.25)',
                          color: '#0f6e63',
                          fontSize: 13,
                          fontWeight: 500,
                          opacity: removingId === p.id ? 0.5 : 1,
                        }}
                      >
                        {p.product_name}
                        {p.product_version && (
                          <span style={{ fontWeight: 400, opacity: 0.75 }}>v{p.product_version}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(p)}
                          disabled={removingId === p.id}
                          title={`Remove ${p.product_name}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 16,
                            height: 16,
                            border: 'none',
                            borderRadius: '50%',
                            background: 'transparent',
                            color: '#0f6e63',
                            cursor: removingId === p.id ? 'default' : 'pointer',
                            padding: 0,
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="panel-sub" style={{ marginBottom: 14 }}>No products added yet.</div>
                )}

                {!showAddRow && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowAddRow(true)}
                      disabled={availableNames.length === 0}
                      style={{
                        fontSize: 13,
                        opacity: availableNames.length === 0 ? 0.5 : 1,
                        cursor: availableNames.length === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      + Add Product
                    </button>
                    {catalogExhausted && (
                      <div style={{ fontSize: 12, color: '#8c8a7d', marginTop: 6 }}>
                        Every product in the catalog is already added to this customer.
                      </div>
                    )}
                    {catalogEmpty && (
                      <div style={{ fontSize: 12, color: '#8c8a7d', marginTop: 6 }}>
                        No products exist in Product Master yet.
                      </div>
                    )}
                  </>
                )}

                {showAddRow && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid #e3e1d6',
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <select value={selectedName} onChange={handleNameChange} style={selectStyle}>
                        <option value="">Product name…</option>
                        {availableNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <select
                        value={selectedVersionId}
                        onChange={(e) => setSelectedVersionId(e.target.value)}
                        disabled={!selectedName}
                        style={{ ...selectStyle, opacity: selectedName ? 1 : 0.55 }}
                      >
                        <option value="">Version…</option>
                        {availableVersions.map((p) => (
                          <option key={p.id} value={p.id}>{p.version || 'No version'}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {!canAdd && selectedName && (
                        <span style={{ fontSize: 12, color: '#8c8a7d', marginRight: 'auto' }}>
                          Select a version to continue
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={closeAddRow}
                        style={{ fontSize: 13 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddProduct}
                        disabled={!canAdd}
                        style={{
                          fontSize: 13,
                          opacity: canAdd ? 1 : 0.5,
                          cursor: canAdd ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {addingProduct ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}
                {productError && <div className="form-error">{productError}</div>}
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
// ---------------------------------------------------------------------------
// Confirm modal — Deactivate / Activate
// ---------------------------------------------------------------------------
function ConfirmModal({ title, text, confirmLabel, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
        </div>
        <div className="modal-body">
          <p className="confirm-text">{text}</p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete modal — only customers with zero tickets can be deleted
// ---------------------------------------------------------------------------
function DeleteCustomerModal({ user, onCancel, onDeleted }) {
  const [checking, setChecking] = useState(true)
  const [ticketCount, setTicketCount] = useState(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`customers/${user.id}/`)
      .then(({ data }) => {
        if (!active) return
        setTicketCount(data.ticket_stats?.total ?? 0)
        setChecking(false)
      })
      .catch(() => {
        if (!active) return
        setError('Could not verify ticket history for this customer.')
        setChecking(false)
      })
    return () => { active = false }
  }, [user.id])

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await api.delete(`customers/${user.id}/`)
      onDeleted()
    } catch (err) {
      // Backend also enforces this (409 if tickets exist) — covers a race
      // where a ticket got raised between opening this modal and confirming.
      setError(err.response?.data?.detail || 'Could not delete this customer.')
    } finally {
      setDeleting(false)
    }
  }

  const blocked = !checking && ticketCount > 0

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Delete customer?</div>
        </div>
        <div className="modal-body">
          {checking && <p className="confirm-text">Checking ticket history…</p>}

          {!checking && blocked && (
              <p className="confirm-text">
                <strong>{user.name}</strong> has raised {ticketCount === 1 ? 'a ticket' : `${ticketCount} tickets`} and cannot be
                deleted. Deactivate the account instead if you need to restrict access.
              </p>
            )}

          {!checking && !blocked && !error && (
            <p className="confirm-text">
              This will permanently delete <strong>{user.name}</strong>'s account. This customer has no tickets on
              record. This can't be undone.
            </p>
          )}

          {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel} disabled={deleting}>
            {blocked ? 'Close' : 'Cancel'}
          </button>
          {!checking && !blocked && (
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Customers