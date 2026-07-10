import React, { useEffect, useMemo, useState } from 'react'
import api from '../api' // adjust this path to match where api.js actually lives

// Same fix as ProductMaster.jsx / AllTickets.jsx / the dashboards: forces
// every status chip on this page onto a single line and sizes it to its
// own content, matching the design used everywhere else in the app.
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

const PRIORITY_KEY = { Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent' }

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const emptyForm = {
  name: '',
  description: '',
  priority: PRIORITIES[1],
}

function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '--'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function CategoryMaster() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const [modalMode, setModalMode] = useState(null) // null | 'add' | 'edit'
  const [activeId, setActiveId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null) // category object pending deletion
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await api.get('categories/?include_inactive=true')
      setCategories(data)
    } catch (err) {
      setLoadError('Could not load categories. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const openAddModal = () => {
    setForm(emptyForm)
    setErrors({})
    setActiveId(null)
    setModalMode('add')
  }

  const openEditModal = (category) => {
    setForm({
      name: category.name,
      description: category.description,
      priority: category.priority,
    })
    setErrors({})
    setActiveId(category.id)
    setModalMode('edit')
  }

  const closeModal = () => {
    if (saving) return
    setModalMode(null)
    setActiveId(null)
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Category name is required'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (modalMode === 'edit') {
        const { data } = await api.patch(`categories/${activeId}/`, form)
        setCategories((prev) => prev.map((c) => (c.id === activeId ? data : c)))
      } else {
        const { data } = await api.post('categories/', form)
        setCategories((prev) => [...prev, data])
      }
      closeModal()
    } catch (err) {
      const apiErrors = err.response?.data
      if (apiErrors && typeof apiErrors === 'object') {
        setErrors({
          name: Array.isArray(apiErrors.name) ? apiErrors.name[0] : undefined,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (category) => {
    setDeleteError('')
    setDeleteTarget(category)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
    setDeleteError('')
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    try {
      await api.delete(`categories/${target.id}/`)
      // Hard delete on the backend (categories not in use are removed
      // outright, not just deactivated) — drop it from the list entirely.
      setCategories((prev) => prev.filter((c) => c.id !== target.id))
      setDeleteTarget(null)
      setDeleteError('')
    } catch (err) {
      if (err.response?.status === 409) {
        // Category became in-use between render and click (e.g. a ticket
        // was just filed against it) — surface that instead of a generic
        // failure, and refresh so its row locks correctly.
        setDeleteError(err.response?.data?.detail || 'This category is in use and cannot be deleted.')
        fetchCategories()
      } else {
        setDeleteError('Could not delete this category. Please try again.')
      }
    }
  }

  // Flips is_active on the backend, then updates just that row locally
  // so the rest of the table doesn't need a full refetch.
  const toggleActive = async (category) => {
    setTogglingId(category.id)
    try {
      const { data } = await api.patch(`categories/${category.id}/`, {
        is_active: !category.is_active,
      })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? data : c)))
    } catch (err) {
      setLoadError('Could not update status. Please try again.')
    } finally {
      setTogglingId(null)
    }
  }

  const stats = useMemo(() => {
    const total = categories.length
    const activeCount = categories.filter((c) => c.is_active).length
    const counts = {}
    categories.forEach((c) => { counts[c.priority] = (counts[c.priority] || 0) + 1 })
    let topPriority = '—'
    let topCount = 0
    Object.entries(counts).forEach(([p, n]) => {
      if (n > topCount) { topPriority = p; topCount = n }
    })
    return { total, activeCount, topPriority }
  }, [categories])

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">Manage · Categories</div>
            <h1 className="page-title">Categories</h1>
            <p className="page-desc">Manage the categories tickets get routed under.</p>
          </div>
          <div className="page-head-actions">
            <button className="btn btn-primary" onClick={openAddModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Category
            </button>
          </div>
        </div>

        {loadError && (
          <div className="alert-banner error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            {loadError}
          </div>
        )}

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Total Categories</div>
            <div className="stat-value mono">{stats.total}</div>
            <div className="stat-foot">All categories</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active</div>
            <div className="stat-value mono">{stats.activeCount}</div>
            <div className="stat-foot">Currently routing tickets</div>
          </div>
          <div className="stat-card" data-tone="amber">
            <div className="stat-label">Most Used Priority</div>
            <div className="stat-value mono">{stats.topPriority}</div>
            <div className="stat-foot">Across all categories</div>
          </div>
        </div>

        <section className="panel">
          <div className="panel-body table-wrap" style={{ paddingTop: 18 }}>
            <table className="tickets">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Default Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5}>Loading categories…</td></tr>
                )}
                {!loading && categories.length === 0 && (
                  <tr><td colSpan={5}>No categories yet. Click "Add Category" to create one.</td></tr>
                )}
                {!loading && categories.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="cust-avatar">{initialsOf(cat.name)}</span>
                        <span className="subj">{cat.name}</span>
                      </div>
                    </td>
                    <td>{cat.description || '—'}</td>
                    <td>
                      <span className={`priority ${PRIORITY_KEY[cat.priority] || ''}`}><span className="dot"></span>{cat.priority}</span>
                    </td>
                    <td>
                      <span className={cat.is_active ? 'chip resolved' : 'chip closed'} style={chipNoWrapStyle}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-action"
                          title={cat.is_active ? 'Deactivate' : 'Activate'}
                          disabled={togglingId === cat.id}
                          onClick={() => toggleActive(cat)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" />
                          </svg>
                        </button>
                        <button className="icon-action" title="Edit" onClick={() => openEditModal(cat)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          className="icon-action danger"
                          title={cat.in_use ? 'Cannot delete: category is in use by existing tickets' : 'Delete'}
                          disabled={cat.in_use}
                          style={cat.in_use ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                          onClick={() => !cat.in_use && openDeleteModal(cat)}
                        >
                          {cat.in_use ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" /><path d="M14 11v6" />
                            </svg>
                          )}
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

      {/* Add / Edit modal */}
      {modalMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{modalMode === 'edit' ? 'Edit Category' : 'Add Category'}</div>
              <button className="modal-close" onClick={closeModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Category name</label>
                <input
                  placeholder="e.g. Hardware Issue"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe what falls under this category"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  style={{
                    width: '100%', border: '1px solid var(--line)', borderRadius: 8,
                    padding: '8px 12px', fontSize: 13.5, fontFamily: 'var(--font-body)',
                    color: 'var(--text)', outline: 'none', resize: 'vertical',
                  }}
                />
              </div>

              <div className="form-field">
                <label>Default priority</label>
                <select className="select" style={{ width: '100%' }} value={form.priority} onChange={(e) => updateForm('priority', e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : modalMode === 'edit' ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-box narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Delete category?</div>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                This will permanently delete <strong>{deleteTarget.name}</strong>. This can't be undone.
              </p>
              {deleteError && <div className="form-error" style={{ marginTop: 8 }}>{deleteError}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={closeDeleteModal}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default CategoryMaster