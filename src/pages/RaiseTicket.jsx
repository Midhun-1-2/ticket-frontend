import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api' // adjust this path to match where api.js actually lives
import '/src/RaiseTicket.css'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const priorityKey = { Low: 'p-low', Medium: 'p-medium', High: 'p-high', Urgent: 'p-urgent' }

// The dropdown only ever shows THIS customer's own company's products
// that an admin has verified (from /my-products/) — never the full
// Product Master catalog, and no "Not Applicable" fallback. That's what
// stops a customer from raising a ticket against a product they were
// never registered for (e.g. "Projo"), and makes Product a genuinely
// required, meaningful choice rather than a default anyone can skip.

const MAX_FILE_SIZE_MB = 10
const MAX_TOTAL_FILES = 5

const initialForm = {
  subject: '',
  category: '',
  priority: '',
  description: '',
  product: '',
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <path d="M10 3v10M10 3l-4 4M10 3l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 14v1.5A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)
const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 1.5h5.5L12.5 4.5V13.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M9.5 1.5V4.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
)

function RaiseTicket() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')

  // Product catalog — scoped to THIS customer's own approved/verified
  // products (see /my-products/ on the backend), not the full Product
  // Master catalog. Staff/admin accounts get an empty list from that
  // endpoint (see MyProductsView), so they'll only ever see
  // "Not Applicable" here — which matches how this page is meant to be
  // used (customers raising their own tickets).
  const [productOptions, setProductOptions] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState(null) // { type: 'success' | 'error', text }

  useEffect(() => {
    fetchCategories()
    fetchProducts()
  }, [])

  const fetchCategories = async () => {
    setCategoriesLoading(true)
    setCategoriesError('')
    try {
      // No include_inactive param — only active categories should be
      // selectable when raising a new ticket.
      const { data } = await api.get('categories/')
      setCategories(data)
    } catch (err) {
      setCategoriesError('Could not load categories.')
    } finally {
      setCategoriesLoading(false)
    }
  }

  const fetchProducts = async () => {
    setProductsLoading(true)
    setProductsError('')
    try {
      const { data } = await api.get('my-products/')
      setProductOptions(data.products || [])
    } catch (err) {
      setProductsError('Could not load your products.')
      setProductOptions([])
    } finally {
      setProductsLoading(false)
    }
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // Category has its own handler (rather than going through updateField)
  // because picking one auto-selects that category's own default
  // priority (see Category.priority on the backend) instead of just
  // clearing whatever was there before. The customer can still override
  // the auto-picked priority afterward — this only sets the starting
  // point.
  const updateCategory = (name) => {
    const matched = categories.find((c) => c.name === name)
    setForm((prev) => ({ ...prev, category: name, priority: matched?.priority || '' }))
    setErrors((prev) => ({ ...prev, category: undefined, priority: undefined }))
  }

  // ---------- Attachments ----------

  const addFiles = (fileList) => {
    setFileError('')
    const incoming = Array.from(fileList)
    const oversized = incoming.find((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
    if (oversized) {
      setFileError(`"${oversized.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`)
      return
    }
    setFiles((prev) => {
      const combined = [...prev, ...incoming]
      if (combined.length > MAX_TOTAL_FILES) {
        setFileError(`You can attach up to ${MAX_TOTAL_FILES} files.`)
        return prev
      }
      return combined
    })
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setFileError('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  // ---------- Validation ----------

  const validate = () => {
    const nextErrors = {}
    if (!form.subject.trim()) nextErrors.subject = 'Subject is required'
    if (!form.category) nextErrors.category = 'Category / department is required'
    if (!form.product) nextErrors.product = 'Product / module is required'
    if (!form.priority) nextErrors.priority = 'Priority is required'
    if (!form.description.trim()) nextErrors.description = 'Description is required'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // ---------- Submit ----------

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBanner(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = new FormData()
      payload.append('subject', form.subject)
      payload.append('category', form.category) // backend matches on category NAME
      payload.append('priority', form.priority)
      payload.append('description', form.description)
      payload.append('product', form.product)
      files.forEach((f) => payload.append('attachments', f))

      await api.post('tickets/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setBanner({ type: 'success', text: 'Ticket raised. Redirecting to your dashboard…' })
      setTimeout(() => navigate('/dashboard/'), 1200)
    } catch (err) {
      // Surface DRF field errors if present (e.g. { product: ["You can
      // only raise tickets for products verified on your account..."] }),
      // otherwise fall back to a generic message. This is what shows the
      // rejection message if product validation ever fails server-side —
      // e.g. a stale dropdown selection, or a bypassed/tampered request.
      const data = err.response?.data
      const serverMsg =
        data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null
      setBanner({
        type: 'error',
        text: serverMsg || 'Could not raise the ticket. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => navigate('/dashboard/')

  return (
    <main className="main">
      <div className="raise-page">
        <div className="raise-shell">
          <div className="raise-eyebrow">TICKETS · NEW</div>
          <div className="raise-title">Raise New Ticket</div>
          <div className="raise-subtitle">Describe the issue and route it to the right team.</div>

          <form className="raise-card" onSubmit={handleSubmit}>
            {banner && <div className={`raise-banner ${banner.type}`}>{banner.text}</div>}

            <div className={`raise-field ${errors.subject ? 'error' : ''}`}>
              <label>Subject / Title<span className="required">*</span></label>
              <input
                placeholder="e.g. Unable to export invoice as PDF"
                value={form.subject}
                onChange={(e) => updateField('subject', e.target.value)}
              />
              {errors.subject && <span className="raise-field-error">{errors.subject}</span>}
            </div>

            <div className="raise-row">
              <div className={`raise-field ${errors.category ? 'error' : ''}`}>
                <label>Category / Department<span className="required">*</span></label>
                <select
                  value={form.category}
                  onChange={(e) => updateCategory(e.target.value)}
                  disabled={categoriesLoading}
                >
                  <option value="">{categoriesLoading ? 'Loading…' : 'Select a category'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                {errors.category && <span className="raise-field-error">{errors.category}</span>}
                {categoriesError && <span className="raise-field-error">{categoriesError}</span>}
              </div>

              <div className={`raise-field ${errors.product ? 'error' : ''}`}>
                <label>Product / Module<span className="required">*</span></label>
                <select
                  value={form.product}
                  onChange={(e) => updateField('product', e.target.value)}
                  disabled={productsLoading}
                >
                  <option value="" disabled>{productsLoading ? 'Loading…' : 'Select a product'}</option>
                  {!productsLoading && productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                {errors.product && <span className="raise-field-error">{errors.product}</span>}
                {!productsLoading && productOptions.length === 0 && (
                  <span className="raise-field-hint">
                    No verified products found on your account yet — contact support to get a
                    product added before raising a ticket.
                  </span>
                )}
                {productsError && <span className="raise-field-error">{productsError}</span>}
              </div>
            </div>

            <div className={`raise-field ${errors.priority ? 'error' : ''}`}>
              <label>Priority<span className="required">*</span></label>
              <div className={`priority-select ${!form.category ? 'disabled' : ''}`}>
                {PRIORITIES.map((p) => (
                  <div
                    key={p}
                    className={`priority-option ${priorityKey[p]} ${form.priority === p ? 'selected ' + priorityKey[p] : ''}`}
                    onClick={() => form.category && updateField('priority', p)}
                    aria-disabled={!form.category}
                  >
                    {p}
                  </div>
                ))}
              </div>
            
              {errors.priority && <span className="raise-field-error">{errors.priority}</span>}
            </div>

            <div className={`raise-field ${errors.description ? 'error' : ''}`}>
              <label>Description<span className="required">*</span></label>
              <textarea
                placeholder="What's happening? Steps to reproduce, error messages, anything that helps us fix it faster."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
              {errors.description && <span className="raise-field-error">{errors.description}</span>}
            </div>

            <div className="raise-field">
              <label>Attachments<span className="optional">optional — screenshots, files</span></label>
              <div
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="dropzone-icon"><UploadIcon /></div>
                <div className="dropzone-title">Click to upload or drag and drop</div>
                <div className="dropzone-hint">Up to {MAX_TOTAL_FILES} files, {MAX_FILE_SIZE_MB}MB each</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
                />
              </div>
              {fileError && <div className="file-error">{fileError}</div>}

              {files.length > 0 && (
                <div className="file-list">
                  {files.map((file, i) => (
                    <div className="file-row" key={`${file.name}-${i}`}>
                      <span className="file-icon"><FileIcon /></span>
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{formatSize(file.size)}</div>
                      </div>
                      <button type="button" className="file-remove" onClick={() => removeFile(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="raise-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

export default RaiseTicket