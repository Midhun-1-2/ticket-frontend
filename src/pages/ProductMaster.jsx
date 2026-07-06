import React, { useEffect, useState } from 'react'
import api from '../api'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ProductMasterPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [editProduct, setEditProduct] = useState(null)

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
      const { data } = await api.get('products/')
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

  const handleUpdated = (product) => {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)))
    setEditProduct(null)
    setSuccessMsg(`"${product.name}" was updated successfully.`)
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
                {!loading && products.length === 0 && (
                  <tr><td colSpan={5}>No products yet. Click "Add Product" to create one.</td></tr>
                )}
                {!loading && products.map((p) => (
                  <tr key={p.id}>
                    <td className="subj">{p.name}</td>
                    <td>{p.version || '—'}</td>
                    <td className="sla ok">{formatDate(p.activation_date)}</td>
                    <td>
                      <span className={p.is_active ? 'chip resolved' : 'chip closed'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-action" title="Edit" onClick={() => setEditProduct(p)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          className="icon-action danger"
                          title={p.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleDeactivate(p)}
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

      {showAdd && (
        <ProductFormModal
          title="Add Product"
          onClose={() => setShowAdd(false)}
          onSaved={handleAdded}
        />
      )}
      {editProduct && (
        <ProductFormModal
          title="Edit Product"
          initial={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={handleUpdated}
        />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit form modal
// ---------------------------------------------------------------------------
function ProductFormModal({ title, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    version: initial?.version || '',
    activation_date: initial?.activation_date || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const payload = {
        name: form.name,
        version: form.version,
        activation_date: form.activation_date || null,
      }
      const { data } = initial
        ? await api.patch(`products/${initial.id}/`, payload)
        : await api.post('products/', payload)
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
          <div className="modal-title">{title}</div>
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

export default ProductMasterPage