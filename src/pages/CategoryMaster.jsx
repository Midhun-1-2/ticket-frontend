import React, { useEffect, useState } from 'react'
import api from '../api' // adjust this path to match where api.js actually lives
import '/src/CategoryMaster.css'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const priorityClass = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
  Urgent: 'priority-urgent',
}

const emptyForm = {
  name: '',
  description: '',
  priority: PRIORITIES[1],
}

function CategoryMaster() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)

  const [modalMode, setModalMode] = useState(null) // null | 'add' | 'edit'
  const [activeId, setActiveId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null) // category object pending deletion

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await api.get('categories/')
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

  const confirmDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await api.delete(`categories/${target.id}/`)
      setCategories((prev) => prev.filter((c) => c.id !== target.id))
    } catch (err) {
      setLoadError('Could not delete this category. Please try again.')
    }
  }

  return (
    <main className="main">
    <div className="category-page">
      <div className="category-shell">
        <div className="category-header">
          <div>
            <div className="category-title">Category Management</div>
            <div className="category-subtitle">Manage the categories tickets get routed under.</div>
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>+ Add Category</button>
        </div>

        <div className="category-card">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-title">Loading categories…</div>
            </div>
          ) : loadError ? (
            <div className="empty-state">
              <div className="empty-state-title">Something went wrong</div>
              <div className="empty-state-text">{loadError}</div>
            </div>
          ) : categories.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No categories yet</div>
              <div className="empty-state-text">Add your first category to start routing tickets.</div>
            </div>
          ) : (
            <table className="category-table">
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Category Name</th>
                  <th style={{ width: '44%' }}>Description</th>
                  <th style={{ width: '16%' }}>Default Priority</th>
                  <th style={{ width: '16%' }}></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="cat-name">{cat.name}</td>
                    <td className="cat-desc">{cat.description || '—'}</td>
                    <td>
                      <span className={`priority-pill ${priorityClass[cat.priority] || ''}`}>{cat.priority}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="Edit" onClick={() => openEditModal(cat)}>✎</button>
                        <button className="icon-btn danger" title="Delete" onClick={() => setDeleteTarget(cat)}>🗑</button>
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
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete "{deleteTarget.name}"?</div>
            <p className="delete-modal-text">
              This removes the category from the active list. Tickets already using it will keep the label, but it
              won't be selectable for new tickets.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
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