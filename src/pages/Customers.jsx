import React, { useEffect, useMemo, useState } from 'react'
import api from '../api' // adjust this path to match where api.js actually lives

const STATUS_CHIP = {
  Active: 'chip resolved',
  'Pending Approval': 'chip hold',
  Blocked: 'chip overdue',
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

function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')

  const [viewUser, setViewUser] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [confirmUser, setConfirmUser] = useState(null)

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
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5}>Loading customers…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={5}>No customers found.</td></tr>
                )}
                {!loading && filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cust-cell">
                        <div className="cust-avatar">{initials(c.name)}</div>
                        <div>
                          <div className="cust-name">{c.name || '—'}</div>
                          <div className="cust-email">{c.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.company || '—'}</td>
                    <td><span className={STATUS_CHIP[c.status] || 'chip open'}>{c.status}</span></td>
                    <td className="sla ok">{formatDate(c.date_joined)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-action" title="View" onClick={() => setViewUser(c)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button className="icon-action" title="Edit" onClick={() => setEditUser({ ...c, errors: {} })}>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {viewUser && <ViewModal user={viewUser} onClose={() => setViewUser(null)} />}
      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(updated) => {
            patchLocal(updated.id, {
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
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
    </main>
  )
}

// ---------------------------------------------------------------------------
// View modal — wide, two-column, shows every field entered by the customer
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
              <div className="detail-section-title">Account</div>
              <div className="detail-grid">
                <div className="detail-row"><span className="k">Name</span><span className="v">{detail.name}</span></div>
                <div className="detail-row"><span className="k">Status</span><span className="v"><span className={STATUS_CHIP[detail.status] || 'chip open'}>{detail.status}</span></span></div>
                <div className="detail-row"><span className="k">Email</span><span className="v">{detail.email || '—'}</span></div>
                <div className="detail-row"><span className="k">Phone</span><span className="v">{detail.phone}</span></div>
                <div className="detail-row"><span className="k">Joined</span><span className="v">{formatDate(detail.date_joined)}</span></div>
              </div>

              <div className="detail-section-title">Company Profile</div>
              {company ? (
                <>
                  <div className="detail-grid">
                    <div className="detail-row"><span className="k">Company Name</span><span className="v">{company.company_name || '—'}</span></div>
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
                <div className="panel-sub">No company on file.</div>
              )}
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
// Edit modal — PATCH name / email / phone
// ---------------------------------------------------------------------------
function EditModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '', phone: user.phone || '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const { data } = await api.patch(`customers/${user.id}/`, {
        full_name: form.name,
        email: form.email,
        phone_number: form.phone,
      })
      onSaved(data)
    } catch (err) {
      setErrors(err.response?.data || { detail: 'Could not save changes.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box narrow" onClick={(e) => e.stopPropagation()}>
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

export default Customers