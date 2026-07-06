import React, { useEffect, useMemo, useState } from 'react'
import api from '../api' // adjust this path to match where api.js actually lives
import '/src/CategoryMaster.css'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const priorityClass = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
  Urgent: 'priority-urgent',
}

const AVATAR_PALETTE = ['avatar-violet', 'avatar-amber', 'avatar-rose', 'avatar-teal', 'avatar-sky']

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

function avatarClassFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

// Icons — kept as small inline SVGs so they render identically everywhere,
// rather than relying on emoji glyphs.
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M11.05 2.55a1.5 1.5 0 0 1 2.12 0l.28.28a1.5 1.5 0 0 1 0 2.12l-7.6 7.6-3.1.78.78-3.1 7.52-7.68Z"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
)
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6.5 7.5v4M9.5 7.5v4M3.5 4.5l.6 8a1.5 1.5 0 0 0 1.5 1.4h4.8a1.5 1.5 0 0 0 1.5-1.4l.6-8"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
// Locked/padlock icon — shown in place of the trash icon when a category
// is in use, so the disabled state reads as "protected" rather than just
// looking broken.
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)
const TagIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M12.6 2.6 21 11l-9 9-8.4-8.4V3.6a1 1 0 0 1 1-1H12.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" />
  </svg>
)
// Toggle/power icon — used for the activate/deactivate button.
const PowerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M4.5 4.2a5 5 0 1 0 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

function CategoryMaster() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)
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
      setLastSynced(new Date())
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
      setLastSynced(new Date())
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
      setLastSynced(new Date())
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
      setLastSynced(new Date())
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

  const syncedLabel = lastSynced
    ? lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <main className="main">
    <div className="category-page">
      <div className="category-shell">
        <div className="category-eyebrow">MANAGE · CATEGORIES</div>

        <div className="category-header">
          <div>
            <div className="category-title">Categories</div>
            <div className="category-subtitle">Manage the categories tickets get routed under.</div>
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>
            <PlusIcon />
            Add Category
          </button>
        </div>

        <div className="stat-strip">
          <span className="stat-strip-live">
            <span className="stat-dot" />
            {stats.total} {stats.total === 1 ? 'CATEGORY' : 'CATEGORIES'}
          </span>
          <span className="stat-strip-sep" />
          <span>{stats.activeCount} active</span>
          <span className="stat-strip-sep" />
          <span>Most used priority <b>{stats.topPriority}</b></span>
          <span className="stat-strip-sep" />
          <span>Last synced <b>{syncedLabel}</b></span>
        </div>

        <div className="category-card">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-title">Loading categories…</div>
            </div>
          ) : loadError ? (
            <div className="empty-state">
              <div className="empty-icon empty-icon-error"><TagIcon /></div>
              <div className="empty-state-title">Something went wrong</div>
              <div className="empty-state-text">{loadError}</div>
            </div>
          ) : categories.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><TagIcon /></div>
              <div className="empty-state-title">No categories yet</div>
              <div className="empty-state-text">Add your first category to start routing tickets.</div>
            </div>
          ) : (
            <table className="category-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Category Name</th>
                  <th style={{ width: '34%' }}>Description</th>
                  <th style={{ width: '13%' }}>Default Priority</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '19%' }}></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className={cat.is_active ? '' : 'inactive-row'}>
                    <td>
                      <div className="cat-name-cell">
                        <span className={`cat-avatar ${avatarClassFor(cat.name)}`}>{initialsOf(cat.name)}</span>
                        <span className="cat-name">{cat.name}</span>
                      </div>
                    </td>
                    <td className="cat-desc">{cat.description || '—'}</td>
                    <td>
                      <span className={`priority-pill ${priorityClass[cat.priority] || ''}`}>{cat.priority}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${cat.is_active ? 'status-active' : 'status-inactive'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className={`icon-btn ${cat.is_active ? '' : 'toggle-off'}`}
                          title={cat.is_active ? 'Deactivate' : 'Activate'}
                          disabled={togglingId === cat.id}
                          onClick={() => toggleActive(cat)}
                        >
                          <PowerIcon />
                        </button>
                        <button className="icon-btn" title="Edit" onClick={() => openEditModal(cat)}><PencilIcon /></button>
                        <button
                          className={`icon-btn danger ${cat.in_use ? 'locked' : ''}`}
                          title={cat.in_use ? 'Cannot delete: category is in use by existing tickets' : 'Delete'}
                          disabled={cat.in_use}
                          onClick={() => openDeleteModal(cat)}
                        >
                          {cat.in_use ? <LockIcon /> : <TrashIcon />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{modalMode === 'edit' ? 'Edit Category' : 'Add Category'}</div>
            <div className="modal-subtitle">
              {modalMode === 'edit' ? 'Update the details for this category.' : 'Define a new category for routing tickets.'}
            </div>

            <div className={`modal-field ${errors.name ? 'error' : ''}`}>
              <label>Category Name<span className="required">*</span></label>
              <input
                placeholder="e.g. Hardware Issue"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
              {errors.name && <span className="modal-field-error">{errors.name}</span>}
            </div>

            <div className="modal-field">
              <label>Description</label>
              <textarea
                rows={3}
                placeholder="Briefly describe what falls under this category"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label>Default Priority</label>
              <select value={form.priority} onChange={(e) => updateForm('priority', e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
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
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete "{deleteTarget.name}"?</div>
            <p className="delete-modal-text">
              This will permanently delete the category. This action cannot be undone.
            </p>
            {deleteError && <p className="delete-modal-error">{deleteError}</p>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeDeleteModal}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </main>
  )
}

export default CategoryMaster