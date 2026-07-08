import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Case- and whitespace-insensitive key so "ExcelUpload", "excel upload",
// "Excel Upload " (extra space), etc. are all treated as the exact same
// product when grouping versions together — ALL whitespace is stripped
// (not just collapsed), since "Excel Upload" and "ExcelUpload" should
// match too.
function normalizeName(name) {
  return (name || '').replace(/\s+/g, '').toLowerCase()
}

// Strips any leading "v"/"V" the user may have typed (so re-displaying it
// with our own "v" prefix never doubles up as "vv4.2"), then adds exactly
// one "v" back for display. Storage itself should hold the clean number
// (see stripVersionPrefix used on save), but this also self-heals any
// already-saved rows that still have a "v" baked into the stored value.
function displayVersion(version) {
  if (!version) return '—'
  const cleaned = String(version).trim().replace(/^v/i, '')
  return cleaned ? `v${cleaned}` : '—'
}

// Used when saving from the Add Product form so we never store a
// redundant "v" the user typed themselves — the "v" is purely a display
// concern, handled by displayVersion above.
function stripVersionPrefix(version) {
  return String(version || '').trim().replace(/^v/i, '')
}

function ProductMasterPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [editGroup, setEditGroup] = useState(null) // { name, versions: [...] }
  const [deleteProduct, setDeleteProduct] = useState(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(''), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  const fetchProducts = async () => {
    setLoading(true)
    setError('')
    try {
      // include_inactive so the table still shows deactivated products —
      // the admin needs to see them to decide whether to delete them.
      const { data } = await api.get('products/?include_inactive=true')
      setProducts(data)
    } catch (err) {
      setError('Could not load products.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdded = (product) => {
    setProducts((prev) => [product, ...prev])
    setShowAdd(false)
    setSuccessMsg(`"${product.name}" was added successfully.`)
  }

  const handleDeactivate = async (product) => {
    try {
      const { data } = await api.patch(`products/${product.id}/`, { is_active: !product.is_active })
      setProducts((prev) => prev.map((p) => (p.id === product.id ? data : p)))
      setSuccessMsg(`"${product.name}" was ${data.is_active ? 'activated' : 'deactivated'}.`)
    } catch (err) {
      setError('Could not update product status.')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteProduct) return
    try {
      await api.delete(`products/${deleteProduct.id}/`)
      setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id))
      setSuccessMsg(`"${deleteProduct.name}"${deleteProduct.version ? ` ${displayVersion(deleteProduct.version)}` : ''} was deleted.`)
    } catch (err) {
      // 409 from the backend if it's actually in use (in_use should have
      // already locked the button, but this covers a race where it
      // became "in use" between page load and the click).
      setError(err.response?.data?.detail || 'Could not delete this product.')
    } finally {
      setDeleteProduct(null)
    }
  }

  // Called from the Edit modal after saving name/version-date changes.
  const handleGroupSaved = (updatedRows) => {
    setProducts((prev) => prev.map((p) => {
      const match = updatedRows.find((u) => u.id === p.id)
      return match || p
    }))
    setEditGroup(null)
    setSuccessMsg(`"${updatedRows[0]?.name}" was updated.`)
  }

  // Called from the Edit modal's ✕ on a version chip.
  const handleVersionRemoved = (id, removedLabel) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setSuccessMsg(`${removedLabel} was removed.`)
  }

  // ---------------------------------------------------------------------
  // Group flat product rows (one row per version) into one entry per
  // product name — matched case/whitespace-insensitively so re-typing the
  // same name slightly differently still lands under the same product.
  // The most recently activated version is the "primary" one shown in
  // the row; the rest are available via the versions dropdown.
  // ---------------------------------------------------------------------
  const grouped = useMemo(() => {
    const byKey = new Map()
    products.forEach((p) => {
      const key = normalizeName(p.name)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(p)
    })

    const groups = Array.from(byKey.values()).map((versions) => {
      const sorted = [...versions].sort((a, b) => {
        const aTime = a.activation_date ? new Date(a.activation_date).getTime() : -Infinity
        const bTime = b.activation_date ? new Date(b.activation_date).getTime() : -Infinity
        if (bTime !== aTime) return bTime - aTime
        return (b.id > a.id ? 1 : -1)
      })
      return { name: sorted[0].name, versions: sorted }
    })

    groups.sort((a, b) => {
      const aTime = a.versions[0]?.activation_date ? new Date(a.versions[0].activation_date).getTime() : -Infinity
      const bTime = b.versions[0]?.activation_date ? new Date(b.versions[0].activation_date).getTime() : -Infinity
      return bTime - aTime
    })

    return groups
  }, [products])

  const renderStatusChip = (p) => (
    <span className={p.is_active ? 'chip resolved' : 'chip closed'} style={{ whiteSpace: 'nowrap' }}>
      {p.is_active ? 'Active' : 'Inactive'}
    </span>
  )

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">Admin · Manage</div>
            <h1 className="page-title">Product Master</h1>
            <p className="page-desc">Manage the catalog of products available across the system.</p>
          </div>
          <div className="page-head-actions">
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Product
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="alert-banner success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {successMsg}
          </div>
        )}
        {error && (
          <div className="alert-banner error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            {error}
          </div>
        )}

        <section className="panel">
          <div className="panel-body table-wrap" style={{ paddingTop: 18 }}>
            <table className="tickets">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Version</th>
                  <th>Activation Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5}>Loading products…</td></tr>
                )}
                {!loading && grouped.length === 0 && (
                  <tr><td colSpan={5}>No products yet. Click "Add Product" to create one.</td></tr>
                )}
                {!loading && grouped.map((group) => {
                  const primary = group.versions[0]
                  const hasMultiple = group.versions.length > 1

                  return (
                    <tr key={normalizeName(group.name)}>
                      <td className="subj">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{group.name}</span>
                          {hasMultiple && (
                            <VersionsDropdown group={group} />
                          )}
                        </div>
                      </td>
                      <td>{displayVersion(primary.version)}</td>
                      <td className="sla ok">{formatDate(primary.activation_date)}</td>
                      <td>{renderStatusChip(primary)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-action" title="Edit" onClick={() => setEditGroup(group)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            className="icon-action danger"
                            title={primary.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleDeactivate(primary)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" />
                            </svg>
                          </button>
                          <button
                            className="icon-action danger"
                            title={primary.in_use ? 'This product is in use and cannot be deleted' : 'Delete'}
                            disabled={primary.in_use}
                            style={primary.in_use ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                            onClick={() => !primary.in_use && setDeleteProduct(primary)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" /><path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {showAdd && (
        <AddProductModal
          onClose={() => setShowAdd(false)}
          onSaved={handleAdded}
        />
      )}
      {editGroup && (
        <EditProductModal
          group={editGroup}
          onClose={() => setEditGroup(null)}
          onSaved={handleGroupSaved}
          onVersionRemoved={handleVersionRemoved}
        />
      )}
      {deleteProduct && (
        <ConfirmDeleteModal
          product={deleteProduct}
          onCancel={() => setDeleteProduct(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Versions dropdown — click the "N versions" chip to see a floating list
// of every version under this product (read-only). Rendered through a
// portal on <body> so it's never clipped by the table's own overflow, and
// closes on outside click or Escape.
// ---------------------------------------------------------------------------
function VersionsDropdown({ group }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const openPanel = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <span ref={triggerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        className="chip hold"
        style={{ whiteSpace: 'nowrap', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        {group.versions.length} versions
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" width="12" height="12"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            zIndex: 1000,
            minWidth: 220,
            background: '#fff',
            border: '1px solid var(--line, #e5e7eb)',
            borderRadius: 10,
            boxShadow: '0 12px 30px -8px rgba(20,23,31,0.25)',
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: '#8A8FA3', fontWeight: 600, padding: '10px 14px 6px' }}>
            All Versions
          </div>
          {group.versions.map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '8px 14px', fontSize: 13, borderTop: '1px solid var(--line, #f1f1f3)',
              }}
            >
              <span className="mono">{displayVersion(v.version)}</span>
              <span style={{ color: '#6b7280', fontSize: 12 }}>{formatDate(v.activation_date)}</span>
              <span className={v.is_active ? 'chip resolved' : 'chip closed'} style={{ whiteSpace: 'nowrap', fontSize: 10.5 }}>
                {v.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Add Product modal — creates a brand-new version row. If the name
// (ignoring case/extra spaces) matches an existing product, it will
// automatically appear grouped under that product on the table.
// ---------------------------------------------------------------------------
function AddProductModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', version: '', activation_date: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const { data } = await api.post('products/', {
        name: form.name,
        version: stripVersionPrefix(form.version),
        activation_date: form.activation_date || null,
      })
      onSaved(data)
    } catch (err) {
      setErrors(err.response?.data || { detail: 'Could not save product.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Add Product</div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label>Product name</label>
            <input value={form.name} onChange={handleChange('name')} placeholder="e.g. Analytics Suite" />
            {errors.name && <div className="form-error">{errors.name[0]}</div>}
          </div>
          <div className="form-field">
            <label>Version</label>
            <input value={form.version} onChange={handleChange('version')} placeholder="e.g. 2.4.1" />
            {errors.version && <div className="form-error">{errors.version[0]}</div>}
          </div>
          <div className="form-field">
            <label>Activation date</label>
            <input type="date" value={form.activation_date || ''} onChange={handleChange('activation_date')} />
            {errors.activation_date && <div className="form-error">{errors.activation_date[0]}</div>}
          </div>
          {errors.detail && <div className="form-error">{errors.detail}</div>}
          {errors.non_field_errors && <div className="form-error">{errors.non_field_errors[0]}</div>}

          <p style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>
            If a product with this name (regardless of spacing or capitalization) already exists,
            this will be added as another version under it automatically.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit Product modal — edits the product's name (applied to every version
// in the group), and each version's own activation date individually.
// Click a version row to expand an inline date editor for that specific
// version; "Save Changes" persists the name and only the dates that were
// actually touched. Versions aren't renamed/retyped here — use "Add
// Product" with the same name to add another version; use ✕ to remove one.
// ---------------------------------------------------------------------------
function EditProductModal({ group, onClose, onSaved, onVersionRemoved }) {
  const primary = group.versions[0]
  const [name, setName] = useState(group.name)
  const [versions, setVersions] = useState(group.versions)
  // Per-version activation date edits, keyed by version id. Seeded from
  // each version's current date so unopened rows still save correctly.
  const [versionDates, setVersionDates] = useState(() =>
    Object.fromEntries(group.versions.map((v) => [v.id, v.activation_date || '']))
  )
  const [expandedId, setExpandedId] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const nameChanged = name !== primary.name

      const patchPromises = versions.map((v) => {
        const payload = {}
        if (nameChanged) payload.name = name

        const editedDate = versionDates[v.id] ?? (v.activation_date || '')
        const originalDate = v.activation_date || ''
        if (editedDate !== originalDate) {
          payload.activation_date = editedDate || null
        }

        if (Object.keys(payload).length === 0) {
          return Promise.resolve({ data: v })
        }
        return api.patch(`products/${v.id}/`, payload)
      })

      const results = await Promise.all(patchPromises)
      onSaved(results.map((r) => r.data))
    } catch (err) {
      setErrors(err.response?.data || { detail: 'Could not save product.' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveVersion = async (v) => {
    if (v.in_use) return
    setRemovingId(v.id)
    setErrors({})
    try {
      await api.delete(`products/${v.id}/`)
      setVersions((prev) => prev.filter((x) => x.id !== v.id))
      setVersionDates((prev) => {
        const next = { ...prev }
        delete next[v.id]
        return next
      })
      if (expandedId === v.id) setExpandedId(null)
      onVersionRemoved(v.id, `"${group.name}" ${displayVersion(v.version)}`)
    } catch (err) {
      setErrors({ detail: err.response?.data?.detail || 'Could not remove this version.' })
    } finally {
      setRemovingId(null)
    }
  }

  // If every version got removed via the ✕ buttons, there's nothing left
  // to edit — close automatically.
  useEffect(() => {
    if (versions.length === 0) onClose()
  }, [versions, onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Edit Product</div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label>Product name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Analytics Suite" />
            {errors.name && <div className="form-error">{errors.name[0]}</div>}
          </div>
          {errors.detail && <div className="form-error">{errors.detail}</div>}
          {errors.non_field_errors && <div className="form-error">{errors.non_field_errors[0]}</div>}

          <div className="form-field">
            <label>Versions</label>
            <p style={{ fontSize: 11.5, color: '#6b7280', margin: '0 0 8px' }}>
              Click a version to edit its activation date.
            </p>
            <div style={{ border: '1px solid var(--line, #e5e7eb)', borderRadius: 10, overflow: 'hidden' }}>
              {versions.map((v, i) => {
                const isExpanded = expandedId === v.id
                const currentDate = versionDates[v.id] ?? ''
                return (
                  <div key={v.id}>
                    <div
                      onClick={() => toggleExpand(v.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        fontSize: 13,
                        borderTop: i === 0 ? 'none' : '1px solid var(--line, #f1f1f3)',
                        background: isExpanded
                          ? 'rgba(15,110,99,0.05)'
                          : v.is_active ? 'transparent' : 'rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                      }}
                    >
                      <span className="mono" style={{ fontWeight: 600, minWidth: 56 }}>
                        {displayVersion(v.version)}
                      </span>
                      <span style={{ color: '#6b7280', flex: 1 }}>
                        {formatDate(currentDate)}
                      </span>
                      <span className={v.is_active ? 'chip resolved' : 'chip closed'} style={{ whiteSpace: 'nowrap', fontSize: 10.5 }}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <svg
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" width="14" height="14"
                        style={{ flexShrink: 0, color: '#9ca3af', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveVersion(v) }}
                        disabled={v.in_use || removingId === v.id}
                        title={v.in_use ? 'This version is in use and cannot be removed' : 'Remove this version'}
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: '2px 4px',
                          lineHeight: 1,
                          fontSize: 14,
                          cursor: v.in_use ? 'not-allowed' : 'pointer',
                          opacity: v.in_use ? 0.4 : 1,
                          color: 'inherit',
                        }}
                      >
                        {removingId === v.id ? '…' : '✕'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: '10px 14px 14px',
                          background: 'rgba(15,110,99,0.03)',
                          borderTop: '1px solid var(--line, #f1f1f3)',
                        }}
                      >
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                          Activation date — {displayVersion(v.version)}
                        </label>
                        <input
                          type="date"
                          value={currentDate}
                          onChange={(e) => setVersionDates((prev) => ({ ...prev, [v.id]: e.target.value }))}
                          style={{
                            width: '100%',
                            height: 38,
                            border: '1px solid var(--line, #e5e7eb)',
                            borderRadius: 8,
                            padding: '0 12px',
                            fontSize: 13.5,
                            fontFamily: 'inherit',
                            color: 'inherit',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
              {versions.length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#6b7280' }}>
                  No versions left.
                </div>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: '#6b7280', marginTop: 8 }}>
              To add another version, use "Add Product" with the same name — it'll be grouped in
              here automatically.
            </p>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || versions.length === 0}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------
function ConfirmDeleteModal({ product, onCancel, onConfirm }) {
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
          <div className="modal-title">Delete product?</div>
        </div>
        <div className="modal-body">
          <p className="confirm-text">
            This will permanently delete <strong>{product.name}</strong>
            {product.version ? ` (${displayVersion(product.version)})` : ''}. This can't be undone.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductMasterPage