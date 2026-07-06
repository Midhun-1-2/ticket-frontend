import React, { useEffect, useState } from 'react'
import api from '../api' // adjust this path to match where api.js actually lives
import '/src/staff-management.css'

const DEPARTMENTS = ['Technical', 'Billing', 'General', 'Account', 'Product']

const EMPTY_FORM = {
  name: '', email: '', phone: '', department: DEPARTMENTS[0], role: '', password: '',
}

function StaffManagement() {
  const [staff, setStaff] = useState([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffLoadError, setStaffLoadError] = useState('')
  const [togglingId, setTogglingId] = useState(null)

  const [roles, setRoles] = useState([]) // [{ id, name }]
  const [rolesLoading, setRolesLoading] = useState(true)

  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = adding new, otherwise editing this id
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showRoleModal, setShowRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [roleError, setRoleError] = useState('')
  const [addingRole, setAddingRole] = useState(false)

  // --- Staff detail slide-over (assigned customers) ---
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [assignedCustomers, setAssignedCustomers] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // --- Delete staff (hard delete, with confirmation) ---
  const [staffToDelete, setStaffToDelete] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    fetchStaff()
    fetchRoles()
  }, [])

  const fetchStaff = async () => {
    setStaffLoading(true)
    setStaffLoadError('')
    try {
      const { data } = await api.get('staff/')
      setStaff(data)
    } catch (err) {
      setStaffLoadError('Could not load staff. Please try again.')
    } finally {
      setStaffLoading(false)
    }
  }

  const fetchRoles = async () => {
    setRolesLoading(true)
    try {
      const { data } = await api.get('staff-roles/')
      setRoles(data)
      setForm((prev) => (prev.role ? prev : { ...prev, role: data[0]?.name || '' }))
    } catch (err) {
      // Non-fatal — the role dropdown will just show as empty/loading.
    } finally {
      setRolesLoading(false)
    }
  }

  function openAddStaff() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, role: roles[0]?.name || '' })
    setFormError('')
    setShowStaffModal(true)
  }

  function openEditStaff(member) {
    setEditingId(member.id)
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      department: member.department,
      role: member.role || roles[0]?.name || '',
      password: '', // left blank on edit — only sent if changed
    })
    setFormError('')
    setShowStaffModal(true)
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Flattens DRF's { field: ["error msg"] } into one readable string.
  function flattenApiErrors(data) {
    if (!data || typeof data !== 'object') return 'Something went wrong. Please try again.'
    if (data.detail) return data.detail
    return Object.entries(data)
      .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
      .join('\n')
  }

  async function handleStaffSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setFormError('Name, email, and phone are required.')
      return
    }
    if (editingId === null && form.password.length < 4) {
      setFormError('Set a password (at least 4 characters) for the new staff account.')
      return
    }

    setSaving(true)
    try {
      if (editingId !== null) {
        const { data } = await api.patch(`staff/${editingId}/`, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          department: form.department,
          role: form.role,
        })
        setStaff((prev) => prev.map((s) => (s.id === editingId ? data : s)))
      } else {
        const { data } = await api.post('staff/', form)
        setStaff((prev) => [...prev, data])
      }
      setShowStaffModal(false)
    } catch (err) {
      setFormError(flattenApiErrors(err.response?.data))
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(id) {
    setTogglingId(id)
    try {
      const { data } = await api.post(`staff/${id}/toggle-status/`)
      setStaff((prev) => prev.map((s) => (s.id === id ? data : s)))
    } catch (err) {
      setStaffLoadError('Could not update status. Please try again.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleAddRole(e) {
    e.preventDefault()
    setRoleError('')
    const trimmed = newRoleName.trim()
    if (!trimmed) return

    setAddingRole(true)
    try {
      const { data } = await api.post('staff-roles/', { name: trimmed })
      setRoles((prev) => [...prev, data])
      setNewRoleName('')
    } catch (err) {
      setRoleError(flattenApiErrors(err.response?.data))
    } finally {
      setAddingRole(false)
    }
  }

  async function removeRole(role) {
    try {
      await api.delete(`staff-roles/${role.id}/`)
      setRoles((prev) => prev.filter((r) => r.id !== role.id))
    } catch (err) {
      setRoleError('Could not remove this role. It may still be assigned to staff.')
    }
  }

  // --- Delete staff (hard delete, with confirmation) ---
  function openDeleteConfirm(member) {
    setStaffToDelete(member)
    setDeleteError('')
    setShowDeleteModal(true)
  }

  function closeDeleteConfirm() {
    if (deletingId !== null) return // don't allow closing mid-delete
    setShowDeleteModal(false)
    setStaffToDelete(null)
    setDeleteError('')
  }

  async function confirmDeleteStaff() {
    if (!staffToDelete) return
    setDeletingId(staffToDelete.id)
    setDeleteError('')
    try {
      await api.delete(`staff/${staffToDelete.id}/`)
      setStaff((prev) => prev.filter((s) => s.id !== staffToDelete.id))
      setShowDeleteModal(false)
      setStaffToDelete(null)
    } catch (err) {
      if (err.response?.status === 405) {
        setDeleteError('Delete is not enabled on the server yet (405 Method Not Allowed). Add a `delete` handler to StaffDetailView in views.py.')
      } else if (err.response?.data) {
        setDeleteError(flattenApiErrors(err.response.data))
      } else {
        setDeleteError('Could not delete this staff member. Please try again.')
      }
    } finally {
      setDeletingId(null)
    }
  }

  // --- Staff detail slide-over ---
  async function openStaffDetail(member) {
    setSelectedStaff(member)
    setShowDetailPanel(true)
    setDetailError('')
    setAssignedCustomers([])
    setDetailLoading(true)
    try {
      const { data } = await api.get(`staff/${member.id}/assigned-customers/`)
      setAssignedCustomers(data)
    } catch (err) {
      setDetailError('Could not load assigned customers. Please try again.')
    } finally {
      setDetailLoading(false)
    }
  }

  function closeStaffDetail() {
    setShowDetailPanel(false)
    setSelectedStaff(null)
    setAssignedCustomers([])
    setDetailError('')
  }

  return (
    <main className="main">
    <div className="content">

      <div className="staff-page-head">
        <div>
          <div className="page-eyebrow">Manage · Staff</div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-desc">View, add, and manage staff accounts and their roles.</p>
        </div>

        <div className="staff-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setShowRoleModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Add Role/Designation
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openAddStaff}
            disabled={rolesLoading || roles.length === 0}
            title={!rolesLoading && roles.length === 0 ? 'Add a role/designation first to enable this.' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Add New Staff
          </button>
        </div>
      </div>

      {!rolesLoading && roles.length === 0 && (
        <p className="sm-role-hint">
          No roles/designations added yet — add one before you can create staff accounts.
        </p>
      )}

      {staffLoadError && <div className="auth-error" style={{ marginBottom: 16 }}>{staffLoadError}</div>}

      <section className="panel">
        <div className="panel-body table-wrap">
          <table className="tickets staff-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Role</th>
                <th>Tickets Assigned</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffLoading ? (
                <tr>
                  <td colSpan={6} className="sm-empty-row">Loading staff…</td>
                </tr>
              ) : (
                <>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <button
                          type="button"
                          className="staff-name-btn"
                          onClick={() => openStaffDetail(member)}
                        >
                          <div className="staff-table-avatar">
                            {member.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="name">{member.name}</div>
                            <div className="email">{member.email}</div>
                          </div>
                        </button>
                      </td>
                      <td>{member.department || '—'}</td>
                      <td>{member.role || '—'}</td>
                      <td className="mono">{member.ticketsAssigned}</td>
                      <td>
                        <span className={`chip ${member.status === 'active' ? 'active' : 'inactive'}`}>
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-action edit"
                            onClick={() => openEditStaff(member)}
                            title="Edit"
                            aria-label={`Edit ${member.name}`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className={`icon-action ${member.status === 'active' ? 'deactivate' : 'activate'}`}
                            disabled={togglingId === member.id}
                            onClick={() => toggleStatus(member.id)}
                            title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                            aria-label={`${member.status === 'active' ? 'Deactivate' : 'Activate'} ${member.name}`}
                          >
                            {togglingId === member.id ? (
                              <span className="icon-action-spinner" />
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                <line x1="12" y1="2" x2="12" y2="12" />
                              </svg>
                            )}
                          </button>

                          <button
                            type="button"
                            className="icon-action delete"
                            onClick={() => openDeleteConfirm(member)}
                            title="Delete"
                            aria-label={`Delete ${member.name}`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {staff.length === 0 && (
                    <tr>
                      <td colSpan={6} className="sm-empty-row">No staff added yet.</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================= Add / Edit Staff Modal ================= */}
      {showStaffModal && (
        <div className="sm-modal-overlay" onClick={() => !saving && setShowStaffModal(false)}>
          <div className="sm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-head">
              <div>
                <h2 className="sm-modal-title">{editingId !== null ? 'Edit Staff' : 'Add New Staff'}</h2>
                <p className="sm-modal-sub">
                  {editingId !== null ? 'Update this staff member\'s details.' : 'Create a new staff account.'}
                </p>
              </div>
              <button type="button" className="sm-modal-close" onClick={() => setShowStaffModal(false)} aria-label="Close">
                &times;
              </button>
            </div>

            <form onSubmit={handleStaffSubmit}>
              <div className="sm-form-grid">
                <div className="sm-field-full">
                  <label className="sm-field-label">Name</label>
                  <input
                    type="text"
                    className="sm-input"
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Full name"
                    required
                  />
                </div>

                <div>
                  <label className="sm-field-label">Email</label>
                  <input
                    type="email"
                    className="sm-input"
                    value={form.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    placeholder="name@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="sm-field-label">Phone</label>
                  <input
                    type="tel"
                    className="sm-input"
                    value={form.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit phone number"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <label className="sm-field-label">Department</label>
                  <select
                    className="sm-select"
                    value={form.department}
                    onChange={(e) => handleFormChange('department', e.target.value)}
                  >
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="sm-field-label">Role / Designation</label>
                  <select
                    className="sm-select"
                    value={form.role}
                    onChange={(e) => handleFormChange('role', e.target.value)}
                    disabled={rolesLoading}
                  >
                    {rolesLoading && <option value="">Loading…</option>}
                    {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>

                {editingId === null && (
                  <div className="sm-field-full">
                    <label className="sm-field-label">Password</label>
                    <input
                      type="password"
                      className="sm-input"
                      value={form.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                      placeholder="Set an initial password"
                      required
                    />
                  </div>
                )}
              </div>

              {formError && <div className="auth-error" style={{ marginTop: 14, whiteSpace: 'pre-line' }}>{formError}</div>}

              <div className="sm-modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowStaffModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingId !== null ? 'Save Changes' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= Add / Manage Role Modal ================= */}
      {showRoleModal && (
        <div className="sm-modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="sm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-head">
              <div>
                <h2 className="sm-modal-title">Manage Roles / Designations</h2>
                <p className="sm-modal-sub">These appear in the Role/Designation dropdown when adding staff.</p>
              </div>
              <button type="button" className="sm-modal-close" onClick={() => setShowRoleModal(false)} aria-label="Close">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddRole} className="sm-inline-form">
              <input
                type="text"
                className="sm-input"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Senior Support Agent"
              />
              <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }} disabled={addingRole}>
                {addingRole ? 'Adding…' : 'Add'}
              </button>
            </form>

            {roleError && <div className="auth-error" style={{ marginTop: 10 }}>{roleError}</div>}

            <ul className="role-manage-list">
              {roles.map((r) => (
                <li className="role-manage-row" key={r.id}>
                  {r.name}
                  <button type="button" onClick={() => removeRole(r)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ================= Staff Detail Slide-over (Assigned Customers) ================= */}
      {showDetailPanel && selectedStaff && (
        <div className="sm-slideover-overlay" onClick={closeStaffDetail}>
          <div className="sm-slideover-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sm-slideover-head">
              <div className="staff-name-cell">
                <div className="staff-table-avatar big">
                  {selectedStaff.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div className="name">{selectedStaff.name}</div>
                  <div className="email">{selectedStaff.email}</div>
                </div>
              </div>
              <button type="button" className="sm-modal-close" onClick={closeStaffDetail} aria-label="Close">
                &times;
              </button>
            </div>

            <div className="sm-slideover-meta">
              <div className="meta-item">
                <span className="meta-label">Department</span>
                <span className="meta-value">{selectedStaff.department || '—'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Role</span>
                <span className="meta-value">{selectedStaff.role || '—'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status</span>
                <span className={`chip ${selectedStaff.status === 'active' ? 'active' : 'inactive'}`}>
                  {selectedStaff.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Tickets Assigned</span>
                <span className="meta-value mono">{selectedStaff.ticketsAssigned}</span>
              </div>
            </div>

            <div className="sm-slideover-section">
              <h3>Assigned Customers</h3>

              {detailLoading && <p className="sm-empty-row">Loading…</p>}
              {detailError && <div className="auth-error">{detailError}</div>}

              {!detailLoading && !detailError && (
                assignedCustomers.length === 0 ? (
                  <p className="sm-empty-row">No customers assigned yet.</p>
                ) : (
                  <ul className="sm-customer-list">
                    {assignedCustomers.map((c) => (
                      <li className="sm-customer-row" key={`${c.company_id}-${c.product_name}`}>
                        <span className="cust-name">{c.company_name}</span>
                        <span className="cust-scope">{c.product_name || 'All products'}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= Delete Staff Confirmation ================= */}
      {showDeleteModal && staffToDelete && (
        <div className="sm-modal-overlay" onClick={closeDeleteConfirm}>
          <div className="sm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-head">
              <div>
                <h2 className="sm-modal-title">Delete Staff Account</h2>
                <p className="sm-modal-sub">
                  This will permanently delete <strong>{staffToDelete.name}</strong> and all of their
                  related records (assignment history, M-PIN, etc). This action cannot be undone.
                </p>
              </div>
              <button type="button" className="sm-modal-close" onClick={closeDeleteConfirm} aria-label="Close">
                &times;
              </button>
            </div>

            {deleteError && <div className="auth-error" style={{ marginBottom: 14 }}>{deleteError}</div>}

            <div className="sm-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeDeleteConfirm} disabled={deletingId !== null}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteStaff} disabled={deletingId !== null}>
                {deletingId !== null ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </main>
  )
}

export default StaffManagement