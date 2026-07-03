import React, { useState, useEffect } from 'react'
import React, { useState } from 'react'
import '/src/staff-management.css'

// ---- Mock data — replace with real API calls when the backend is ready ----
const INITIAL_STAFF = [
  { id: 1, name: 'Meera Nair', email: 'meera.nair@ticketdesk.com', department: 'Billing', role: 'Support Agent', ticketsAssigned: 14, status: 'active' },
  { id: 2, name: 'Arjun Menon', email: 'arjun.menon@ticketdesk.com', department: 'Technical', role: 'Technical Specialist', ticketsAssigned: 21, status: 'active' },
  { id: 3, name: 'Divya Pillai', email: 'divya.pillai@ticketdesk.com', department: 'General', role: 'Support Agent', ticketsAssigned: 9, status: 'active' },
  { id: 4, name: 'Ken Osei', email: 'ken.osei@ticketdesk.com', department: 'Technical', role: 'Team Lead', ticketsAssigned: 17, status: 'inactive' },
]
const DEPARTMENTS = ['Technical', 'Billing', 'General', 'Account', 'Product']

const DEFAULT_ROLES = ['Support Agent', 'Technical Specialist', 'Team Lead', 'Team Manager']

const EMPTY_FORM = {
  name: '', email: '', phone: '', department: DEPARTMENTS[0], role: DEFAULT_ROLES[0], password: '',
}

function StaffManagement() {
  const [staff, setStaff] = useState(INITIAL_STAFF)
  const [roles, setRoles] = useState(DEFAULT_ROLES)

  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = adding new, otherwise editing this id
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  const [showRoleModal, setShowRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')

  function openAddStaff() {
    setEditingId(null)
    setForm(EMPTY_FORM)
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
      role: member.role,
      password: '', // left blank on edit — only sent if changed
    })
    setFormError('')
    setShowStaffModal(true)
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleStaffSubmit(e) {
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

    // TODO: replace with real API calls, e.g.:
    // if (editingId) await api.put(`/staff/${editingId}/`, form)
    // else await api.post('/staff/', form)

    if (editingId !== null) {
      setStaff((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, name: form.name, email: form.email, phone: form.phone, department: form.department, role: form.role }
            : s
        )
      )
    } else {
      setStaff((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: form.name,
          email: form.email,
          phone: form.phone,
          department: form.department,
          role: form.role,
          ticketsAssigned: 0,
          status: 'active',
        },
      ])
    }

    setShowStaffModal(false)
  }

  function toggleStatus(id) {
    // TODO: replace with real API call, e.g. api.patch(`/staff/${id}/`, { status: newStatus })
    setStaff((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s
      )
    )
  }

  function handleAddRole(e) {
    e.preventDefault()
    const trimmed = newRoleName.trim()
    if (!trimmed || roles.includes(trimmed)) return
    // TODO: replace with real API call, e.g. api.post('/staff-roles/', { name: trimmed })
    setRoles((prev) => [...prev, trimmed])
    setNewRoleName('')
  }

  function removeRole(roleToRemove) {
    // TODO: replace with real API call to delete the role server-side
    setRoles((prev) => prev.filter((r) => r !== roleToRemove))
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
          <button type="button" className="btn btn-primary" onClick={openAddStaff}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Add New Staff
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-body table-wrap">
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
                    <div className="row-actions">
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
                  <td colSpan={6} className="sm-empty-row">No staff added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
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
                  >
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
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

              {formError && <div className="auth-error" style={{ marginTop: 14 }}>{formError}</div>}

              <div className="sm-modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowStaffModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId !== null ? 'Save Changes' : 'Add Staff'}
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
              <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>Add</button>
            </form>

            <ul className="role-manage-list">
              {roles.map((r) => (
                <li className="role-manage-row" key={r}>
                  {r}
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