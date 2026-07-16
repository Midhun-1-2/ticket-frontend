import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api' // adjust this path to match where api.js actually lives
import '/src/RaiseTicket.css'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const priorityKey = { Low: 'p-low', Medium: 'p-medium', High: 'p-high', Urgent: 'p-urgent' }

// Dropdown shows only this customer's verified products (from /my-products/).

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
// Extension -> { label, color }, used for the tile badge of non-image files
// (a real thumbnail only makes sense for images — everything else gets a
// consistent, colour-coded "type card" instead).
const FILE_KIND_BY_EXT = {
  pdf: { label: 'PDF', color: '#C4432E' },
  doc: { label: 'DOC', color: '#3B5BA9' }, docx: { label: 'DOC', color: '#3B5BA9' },
  xls: { label: 'XLS', color: '#0F6E63' }, xlsx: { label: 'XLS', color: '#0F6E63' }, csv: { label: 'CSV', color: '#0F6E63' },
  ppt: { label: 'PPT', color: '#C8791A' }, pptx: { label: 'PPT', color: '#C8791A' },
  zip: { label: 'ZIP', color: '#6B5B95' }, rar: { label: 'ZIP', color: '#6B5B95' }, '7z': { label: 'ZIP', color: '#6B5B95' },
  txt: { label: 'TXT', color: '#6b7280' },
  mp4: { label: 'VID', color: '#3B5BA9' }, mov: { label: 'VID', color: '#3B5BA9' },
}
const DEFAULT_FILE_KIND = { label: 'FILE', color: '#8a8a8a' }

function getFileKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  return FILE_KIND_BY_EXT[ext] || DEFAULT_FILE_KIND
}

// What the zoom popup can actually render for a given file: a real image,
// the browser's native PDF viewer, the file's text content, or (for
// everything else — DOC, ZIP, etc.) the type-card fallback.
function getPreviewKind(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (file.type?.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (file.type === 'text/plain' || ext === 'txt') return 'text'
  return 'none'
}

// Small checkmark used in both the success banner and the submit button
// once a ticket has been raised — purely decorative, no behavior tied to it.
const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
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
  const [zoomedFile, setZoomedFile] = useState(null) // { url, name, kind } | null
  const [textPreview, setTextPreview] = useState('')
  const [textPreviewLoading, setTextPreviewLoading] = useState(false)

  // Per-file preview kind + a blob URL for whichever kinds actually need one
  // (a real thumbnail for images, only ever fully rendered for pdf/text/image
  // in the zoom popup — the grid tile itself still only ever shows a real
  // thumbnail for images, a colour-coded type card for everything else).
  const filePreviews = useMemo(
    () => files.map((f) => {
      const kind = getPreviewKind(f)
      const url = (kind === 'image' || kind === 'pdf') ? URL.createObjectURL(f) : null
      return { kind, url }
    }),
    [files]
  )
  useEffect(() => {
    return () => filePreviews.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url) })
  }, [filePreviews])

  useEffect(() => {
    if (!zoomedFile) return
    const handleEscape = (e) => { if (e.key === 'Escape') setZoomedFile(null) }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [zoomedFile])

  const openPreview = (file, preview) => {
    setZoomedFile({ url: preview.url, name: file.name, kind: preview.kind })
    if (preview.kind === 'text') {
      setTextPreview('')
      setTextPreviewLoading(true)
      const reader = new FileReader()
      reader.onload = () => { setTextPreview(reader.result); setTextPreviewLoading(false) }
      reader.onerror = () => { setTextPreview('Could not read this file.'); setTextPreviewLoading(false) }
      reader.readAsText(file)
    }
  }

  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')

  // Customer's verified product options, from /my-products/.
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
      const products = data.products || []
      setProductOptions(products)
      // Only one product on the account — nothing to actually choose, so
      // pick it automatically instead of making them select a single option.
      if (products.length === 1) {
        setForm((prev) => (prev.product ? prev : { ...prev, product: products[0] }))
      }
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

  // Selecting a category also auto-fills its default priority.
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
      // Keep submitting=true so buttons stay disabled during the redirect delay.
      setTimeout(() => navigate('/dashboard/'), 1200)
    } catch (err) {
      // Surface DRF field errors if present, otherwise show a generic message.
      const data = err.response?.data
      const serverMsg =
        data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null
      setBanner({
        type: 'error',
        text: serverMsg || 'Could not raise the ticket. Please try again.',
      })
      setSubmitting(false)
    }
  }

  const handleCancel = () => navigate('/dashboard/')

  const isSuccess = banner?.type === 'success'

  return (
    <main className="main">
      <div className="raise-page">
        <div className="raise-shell">
          <div className="raise-eyebrow">TICKETS · NEW</div>
          <div className="raise-title">Raise New Ticket</div>
          <div className="raise-subtitle">Describe the issue and route it to the right team.</div>

          {/* is-success only adds a CSS class for the ring-pulse defined in
              RaiseTicket.css — doesn't touch any submit/validation logic. */}
          <form className={`raise-card${isSuccess ? ' is-success' : ''}`} onSubmit={handleSubmit}>
            {banner && (
              <div className={`raise-banner ${banner.type}`}>
                {isSuccess && (
                  <span className="raise-banner-icon">
                    <CheckIcon size={12} />
                  </span>
                )}
                {banner.text}
              </div>
            )}

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

              <div className="file-grid">
                {files.length < MAX_TOTAL_FILES && (
                  <div
                    className={`file-add-tile ${isDragging ? 'dragging' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <span className="file-add-icon"><UploadIcon /></span>
                    <span className="file-add-label">Add file</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
                    />
                  </div>
                )}

                {files.map((file, i) => {
                  const preview = filePreviews[i]
                  const kind = preview.kind === 'image' ? null : getFileKind(file.name)
                  return (
                    <div className="file-tile" key={`${file.name}-${i}`}>
                      <button
                        type="button"
                        className="file-tile-thumb"
                        onClick={() => openPreview(file, preview)}
                        aria-label={`Preview ${file.name}`}
                        title="Click to preview"
                      >
                        {preview.kind === 'image' ? (
                          <img className="file-thumb" src={preview.url} alt="" />
                        ) : (
                          <span className="file-tile-badge" style={{ background: kind.color }}>{kind.label}</span>
                        )}
                      </button>
                      <button type="button" className="file-tile-remove" onClick={() => removeFile(i)} aria-label={`Remove ${file.name}`}>×</button>
                      <div className="file-tile-name" title={file.name}>{file.name}</div>
                      <div className="file-tile-size">{formatSize(file.size)}</div>
                    </div>
                  )
                })}
              </div>
              <div className="file-hint">Up to {MAX_TOTAL_FILES} files, {MAX_FILE_SIZE_MB}MB each</div>
              {fileError && <div className="file-error">{fileError}</div>}
            </div>

            <div className="raise-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {isSuccess ? (
                  <span className="raise-btn-check"><CheckIcon size={15} /></span>
                ) : (
                  submitting ? 'Submitting…' : 'Submit Ticket'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {zoomedFile && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setZoomedFile(null) }}>
          <div className={`image-zoom-box ${zoomedFile.kind === 'pdf' || zoomedFile.kind === 'text' ? 'image-zoom-box-tall' : ''}`}>
            <div className="image-zoom-head">
              <span className="image-zoom-name">{zoomedFile.name}</span>
              <button type="button" className="modal-close" onClick={() => setZoomedFile(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {zoomedFile.kind === 'image' && (
              <img className="image-zoom-full" src={zoomedFile.url} alt={zoomedFile.name} />
            )}

            {zoomedFile.kind === 'pdf' && (
              <iframe className="pdf-zoom-frame" src={zoomedFile.url} title={zoomedFile.name} />
            )}

            {zoomedFile.kind === 'text' && (
              <div className="text-zoom-body">
                {textPreviewLoading ? (
                  <p className="text-zoom-loading">Loading…</p>
                ) : (
                  <pre className="text-zoom-pre">{textPreview}</pre>
                )}
              </div>
            )}

            {zoomedFile.kind === 'none' && (
              <div className="image-zoom-fallback">
                <span
                  className="file-tile-badge file-tile-badge-lg"
                  style={{ background: getFileKind(zoomedFile.name).color }}
                >
                  {getFileKind(zoomedFile.name).label}
                </span>
                <p>Preview isn't available for this file type.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default RaiseTicket