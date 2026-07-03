import React, { useState, useEffect } from 'react'
import 'bootstrap/dist/css/bootstrap.min.css'
import '/src/bootstrap-theme.css'
import '/src/staff-management.css'
import api from '/src/api.js'

const DEPARTMENTS = ['Technical', 'Billing', 'General', 'Account', 'Product']

const EMPTY_FORM = {
  name: '', email: '', phone: '', department: DEPARTMENTS[0], role: '', password: '',
}

function StaffManagement() {
  const [staff, setStaff] = useState([])
  const [roles, setRoles] = useState([]) // [{ id, name }]
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [showRoleModal, setShowRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [roleError, setRoleError] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setLoadError('')
    try {
      const [staffRes, rolesRes] = await Promise.all([
        api.get('staff/'),
        api.get('staff-roles/'),
      ])
      setStaff(staffRes.data)
      setRoles(rolesRes.data)
    } catch (err) {
      setLoadError(err.response?.data?.detail || 'Failed to load staff data.')
    } finally {
      setLoading(false)
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
      phone: member.phone,
      department: member.department,
      role: member.role,
      password: '',
    })
    setFormError('')
    setShowStaffModal(true)
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleStaffSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.role) {
      setFormError('Name, email, phone, and role are required.')
      return
    }
    if (editingId === null && form.password.length < 4) {
      setFormError('Set a password (at least 4 characters) for the new staff account.')
      return
    }

    setSubmitting(true)
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
        const { data } = await api.post('staff/', {
          name: form.name,
          email: form.email,
          phone: form.phone,
          department: form.department,
          role: form.role,
          password: form.password,
        })
        setStaff((prev) => [...prev, data])
      }
      setShowStaffModal(false)
    } catch (err) {
      const errData = err.response?.data
      const message =
        typeof errData === 'string'
          ? errData
          : errData
          ? Object.values(errData).flat().join(' ')
          : 'Something went wrong. Please try again.'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(id) {
    try {
      const { data } = await api.post(`staff/${id}/toggle-status/`)
      setStaff((prev) => prev.map((s) => (s.id === id ? data : s)))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update status.')
    }
  }

  async function handleAddRole(e) {
    e.preventDefault()
    setRoleError('')
    const trimmed = newRoleName.trim()
    if (!trimmed) return
    try {
      const { data } = await api.post('staff-roles/', { name: trimmed })
      setRoles((prev) => [...prev, data])
      setNewRoleName('')
    } catch (err) {
      setRoleError(err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to add role.')
    }
  }

  async function removeRole(role) {
    try {
      await api.delete(`staff-roles/${role.id}/`)
      setRoles((prev) => prev.filter((r) => r.id !== role.id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove role.')
    }
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
            <button type="button" className="btn btn-primary" onClick={openAddStaff} disabled={roles.length === 0}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Add New Staff
            </button>
          </div>
        </div>

        <section className="panel">
          <div className="panel-body table-wrap">
            {loading ? (
              <div className="text-center text-muted py-4">Loading staff…</div>
            ) : loadError ? (
              <div className="text-center text-danger py-4">{loadError}</div>
            ) : (
              <table className="tickets">
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
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-table-avatar">
                            {member.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="name">{member.name}</div>
                            <div className="email">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{member.department}</td>
                      <td>{member.role}</td>
                      <td className="mono">{member.ticketsAssigned}</td>
                      <td>
                        <span className={`chip ${member.status === 'active' ? 'active' : 'inactive'}`}>
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button type="button" className="btn btn-ghost" onClick={() => openEditStaff(member)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => toggleStatus(member.id)}>
                            {member.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {staff.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">No staff added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ================= Add / Edit Staff Modal ================= */}
        {showStaffModal && (
          <div className="sm-modal-overlay" onClick={() => setShowStaffModal(false)}>
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
                <div className="row g-3">
                  <div className="col-12">
                    <label className="sm-field-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="Full name"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="sm-field-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="name@company.com"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="sm-field-label">Phone</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={form.phone}
                      onChange={(e) => handleFormChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit phone number"
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="sm-field-label">Department</label>
                    <select
                      className="form-select"
                      value={form.department}
                      onChange={(e) => handleFormChange('department', e.target.value)}
                    >
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="sm-field-label">Role / Designation</label>
                    <select
                      className="form-select"
                      value={form.role}
                      onChange={(e) => handleFormChange('role', e.target.value)}
                    >
                      {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </div>

                  {editingId === null && (
                    <div className="col-12">
                      <label className="sm-field-label">Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={form.password}
                        onChange={(e) => handleFormChange('password', e.target.value)}
                        placeholder="Set an initial password"
                        required
                      />
                    </div>
                  )}
                </div>

                {formError && <div className="auth-error mt-3">{formError}</div>}

                <div className="sm-modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowStaffModal(false)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : editingId !== null ? 'Save Changes' : 'Add Staff'}
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

              <form onSubmit={handleAddRole} className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Senior Support Agent"
                />
                <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>Add</button>
              </form>

              {roleError && <div className="auth-error mt-2">{roleError}</div>}

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

      </div>
    </main>
  )
}

export default StaffManagement