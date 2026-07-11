import React, { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import ExcelJS from 'exceljs'
import api from '../api' // adjust this path to match where api.js actually lives

// Reads the logged-in user's role from localStorage.
const getRole = () => localStorage.getItem('role') || 'staff'
const getFullName = () => localStorage.getItem('full_name') || ''
const ROLE_EYEBROW = { admin: 'Admin · Manage', staff: 'Staff · Manage', customer: 'Customer · Manage' }

// Static option lists — mirrors RaiseTicket.jsx / ticketapp/models.py.
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const STATUSES = ['In Progress', 'On Hold', 'Resolved', 'Closed']

const PRIORITY_KEY = { Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent' }

const STATUS_CHIP = {
  Open: 'chip open',
  'In Progress': 'chip progress',
  'On Hold': 'chip hold',
  Resolved: 'chip resolved',
  Closed: 'chip closed',
}

// Keeps status chips on a single line regardless of label length.
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

const STATUS_TABS = [
  { key: 'all', label: 'All Statuses' },
  { key: 'Open', label: 'Open' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'On Hold', label: 'On Hold' },
  { key: 'Resolved', label: 'Resolved' },
  { key: 'Closed', label: 'Closed' },
]

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase()
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function shortId(id) {
  return id ? id.slice(0, 8).toUpperCase() : '—'
}

// Prefixes a relative attachment path with the backend's origin.
const BACKEND_ORIGIN = api.defaults.baseURL.replace(/\/+$/, '')
function attachmentUrl(path) {
  if (!path) return '#'
  return path.startsWith('http') ? path : `${BACKEND_ORIGIN}${path}`
}

// Formats Ticket.closed_at, if the ticket has been closed.
function closedOn(ticket) {
  return ticket.closed_at ? formatDateTime(ticket.closed_at) : '—'
}

// Truncated remark preview with the full text shown on hover via a portal.
function RemarkTooltip({ text, maxLen = 36 }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const chipRef = useRef(null)

  if (!text) return <span style={{ color: 'var(--text-faint)' }}>—</span>

  const truncated = text.length > maxLen ? `${text.slice(0, maxLen)}…` : text

  const updatePosition = () => {
    if (chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX })
    }
  }
  const show = () => { updatePosition(); setOpen(true) }
  const hide = () => setOpen(false)

  return (
    <span
      ref={chipRef}
      style={{
        cursor: 'help',
        display: 'inline-block',
        maxWidth: 200,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 12.5,
        verticalAlign: 'bottom',
      }}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {truncated}
      {open && createPortal(
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            zIndex: 1000,
            maxWidth: 260,
            background: '#fff',
            color: 'var(--text)',
            border: '1px solid var(--line, #e5e7eb)',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 12.5,
            lineHeight: 1.5,
            boxShadow: '0 12px 30px -8px rgba(20,23,31,0.25)',
          }}
        >
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted, #6b7280)', marginBottom: 4, fontWeight: 600 }}>
            Remark
          </div>
          {text}
        </div>,
        document.body
      )}
    </span>
  )
}

function AllTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState([])
  const [productOptions, setProductOptions] = useState([])

  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [viewTicket, setViewTicket] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    fetchTickets()
    fetchCategories()
    fetchProducts()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('tickets/')
      setTickets(data)
    } catch (err) {
      setError('Could not load tickets.')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('categories/?include_inactive=true')
      setCategories(data)
    } catch (err) {
      // Filter dropdown just won't populate — not fatal.
    }
  }

  const fetchProducts = async () => {
    try {
      // include_inactive so tickets tagged with a deactivated product still filter correctly.
      const { data } = await api.get('products/?include_inactive=true')
      setProductOptions(data.map((p) => p.name))
    } catch (err) {
      // Filter dropdown just won't populate — not fatal.
    }
  }

  const patchLocal = (id, patch) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  // ---------- Derived stats ----------
  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === 'Open').length
    const inProgress = tickets.filter((t) => t.status === 'In Progress').length
    const resolvedClosed = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length
    return { total, open, inProgress, resolvedClosed }
  }, [tickets])

  const filtered = useMemo(() => {
    let rows = tickets
    if (statusTab !== 'all') rows = rows.filter((t) => t.status === statusTab)
    if (priorityFilter !== 'all') rows = rows.filter((t) => t.priority === priorityFilter)
    if (categoryFilter !== 'all') rows = rows.filter((t) => t.category === categoryFilter)
    if (productFilter !== 'all') rows = rows.filter((t) => t.product === productFilter)

    // Date range filter, inclusive on both ends.
    if (dateFrom) {
      const from = new Date(dateFrom)
      rows = rows.filter((t) => new Date(t.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      rows = rows.filter((t) => new Date(t.created_at) <= to)
    }

    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (t) =>
          t.subject?.toLowerCase().includes(q) ||
          t.raised_by?.full_name?.toLowerCase().includes(q) ||
          t.raised_by?.phone_number?.includes(q) ||
          t.category?.toLowerCase().includes(q)
      )
    }
    return rows
  }, [tickets, search, statusTab, priorityFilter, categoryFilter, productFilter, dateFrom, dateTo])

  // Builds a branded .xlsx report of the currently filtered tickets.
  const handleCreateReport = async () => {
    setGeneratingReport(true)
    setError('')
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'TIXA'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet('Tickets Report')

      const columns = [
        'Ticket ID', 'Subject', 'Raised By', 'Phone', 'Category', 'Product',
        'Priority', 'Status', 'Assigned Staff', 'Remark', 'Raised On', 'Closed On',
      ]

      // Solid banner behind the logo/title/meta block.
      for (let r = 1; r <= 4; r += 1) {
        for (let c = 1; c <= columns.length; c += 1) {
          sheet.getRow(r).getCell(c).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E63' },
          }
        }
      }

      try {
        const logoBuffer = await fetch('/logo.png').then((r) => r.arrayBuffer())
        const logoImageId = workbook.addImage({ buffer: logoBuffer, extension: 'png' })
        sheet.addImage(logoImageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 48, height: 48 } })
      } catch (err) {
        // Logo is cosmetic — a failed fetch shouldn't block the report itself.
      }

      sheet.mergeCells('B1:E1')
      sheet.getCell('B1').value = 'TIXA — Ticket Report'
      sheet.getCell('B1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }

      sheet.mergeCells('B2:E2')
      sheet.getCell('B2').value = `Report created: ${formatDateTime(new Date().toISOString())}`
      sheet.getCell('B2').font = { size: 10.5, color: { argb: 'FFDCEFEC' } }

      const creatorName = getFullName() || 'Unknown'
      const creatorRole = getRole()
      sheet.mergeCells('B3:E3')
      sheet.getCell('B3').value = `Created by: ${creatorName} (${creatorRole.charAt(0).toUpperCase()}${creatorRole.slice(1)})`
      sheet.getCell('B3').font = { size: 10.5, color: { argb: 'FFDCEFEC' } }

      sheet.getRow(1).height = 22
      sheet.getRow(2).height = 16
      sheet.getRow(3).height = 16
      sheet.getRow(4).height = 8 // spacer row before the table

      const headerRowIndex = 5
      const headerRow = sheet.getRow(headerRowIndex)
      headerRow.values = columns
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14171F' } }
        cell.alignment = { vertical: 'middle' }
      })

      filtered.forEach((t, i) => {
        sheet.getRow(headerRowIndex + 1 + i).values = [
          shortId(t.id),
          t.subject,
          t.raised_by?.full_name || '—',
          t.raised_by?.phone_number || '—',
          t.category,
          t.product || '—',
          t.priority,
          t.status,
          t.assigned_staff?.full_name || 'Unassigned',
          t.current_remark || t.escalation_note || '',
          formatDateTime(t.created_at),
          closedOn(t),
        ]
      })

      const widths = [12, 28, 18, 13, 14, 16, 10, 12, 16, 34, 18, 18]
      widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tixa-tickets-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Could not generate the report. Please try again.')
    } finally {
      setGeneratingReport(false)
    }
  }

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">{ROLE_EYEBROW[getRole()] || 'Manage'}</div>
            <h1 className="page-title">All Tickets</h1>
            <p className="page-desc">Every ticket raised across all customers.</p>
          </div>
          <div className="page-head-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateReport}
              disabled={generatingReport || filtered.length === 0}
              title={filtered.length === 0 ? 'No tickets match the current filters' : 'Export the filtered tickets to Excel'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
              </svg>
              {generatingReport ? 'Generating…' : 'Create Report'}
            </button>
          </div>
        </div>

        {error && <div className="raise-banner error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Summary cards */}
        <div className="stat-grid stat-grid-4">
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Total Tickets</div>
            <div className="stat-value mono">{stats.total}</div>
            <div className="stat-foot">All time</div>
          </div>
          <div className="stat-card" data-tone="amber">
            <div className="stat-label">Open</div>
            <div className="stat-value mono">{stats.open}</div>
            <div className="stat-foot">Awaiting action</div>
          </div>
          <div className="stat-card" data-tone="blue">
            <div className="stat-label">In Progress</div>
            <div className="stat-value mono">{stats.inProgress}</div>
            <div className="stat-foot">Being worked on</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Resolved / Closed</div>
            <div className="stat-value mono">{stats.resolvedClosed}</div>
            <div className="stat-foot">Completed</div>
          </div>
        </div>

        {/* Search + filters */}
        <div className="filter-bar">
          <div className="search-field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              placeholder="Search by subject, customer, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={statusTab}
            onChange={(e) => setStatusTab(e.target.value)}
            style={selectStyle}
          >
            {STATUS_TABS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select
            className="filter-select"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Products</option>
            {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            type="date"
            className="filter-select"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            style={selectStyle}
            title="From date"
          />
          <input
            type="date"
            className="filter-select"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            style={selectStyle}
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setDateFrom(''); setDateTo('') }}
              style={{ height: 38 }}
            >
              Clear dates
            </button>
          )}
        </div>

        {/* Table */}
        <section className="panel">
          <div className="panel-body table-wrap" style={{ paddingTop: 18 }}>
            <table className="tickets">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Raised By</th>
                  <th>Category</th>
                  <th>Product</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Staff</th>
                  <th>Remarks</th>
                  <th>Raised On</th>
                  <th>Closed On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={11}>Loading tickets…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={11}>No tickets found.</td></tr>
                )}
                {!loading && filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="tid">{shortId(t.id)}</div>
                      <div className="subj">{t.subject}</div>
                    </td>
                    <td>
                      <div className="cust-cell">
                        <div className="cust-avatar">{initials(t.raised_by?.full_name)}</div>
                        <div>
                          <div className="cust-name">{t.raised_by?.full_name || '—'}</div>
                          <div className="cust-email">{t.raised_by?.phone_number || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{t.category}</td>
                    <td>{t.product || '—'}</td>
                    <td>
                      <span className={`priority ${PRIORITY_KEY[t.priority] || ''}`} style={chipNoWrapStyle}>
                        <span className="dot" />{t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={STATUS_CHIP[t.status] || 'chip open'} style={chipNoWrapStyle}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.assigned_staff?.full_name || <span style={{ color: 'var(--text-faint)' }}>Unassigned</span>}</td>
                    <td><RemarkTooltip text={t.current_remark || t.escalation_note} /></td>
                    <td className="sla ok">{formatDateTime(t.created_at)}</td>
                    <td className="sla ok">{closedOn(t)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-action" title="View" onClick={() => setViewTicket(t)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" />
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

      {viewTicket && (
        <TicketModal
          ticket={viewTicket}
          onClose={() => setViewTicket(null)}
          onUpdated={(updated) => {
            patchLocal(updated.id, updated)
            setViewTicket(updated)
          }}
        />
      )}
    </main>
  )
}

const selectStyle = {
  height: 38,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  padding: '0 10px',
  fontSize: 13,
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
}

// Ticket detail modal — full details plus a status updater (PATCH tickets/<id>/).
function TicketModal({ ticket, onClose, onUpdated }) {
  const [status, setStatus] = useState(ticket.status)
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Status history is admin-only; fetched lazily only for admins.
  const isAdmin = getRole() === 'admin'
  const [statusHistory, setStatusHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    setHistoryLoading(true)
    api.get(`tickets/${ticket.id}/status-history/`)
      .then(({ data }) => { if (!cancelled) setStatusHistory(data) })
      .catch(() => { if (!cancelled) setStatusHistory([]) })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id, isAdmin])

  const handleUpdateStatus = async () => {
    if (status === ticket.status || !remark.trim()) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { data } = await api.patch(`tickets/${ticket.id}/status/`, { status, remark: remark.trim() })
      onUpdated(data)
      setRemark('')
      setSaved(true)
    } catch (err) {
      setError(
        err.response?.data?.detail
        || err.response?.data?.remark?.[0]
        || 'Could not update status. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Ticket Details</div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="detail-section-title">Overview</div>
          <div className="detail-grid">
            <div className="detail-row"><span className="k">Ticket ID</span><span className="v mono">{shortId(ticket.id)}</span></div>
            <div className="detail-row"><span className="k">Subject</span><span className="v">{ticket.subject}</span></div>
            <div className="detail-row"><span className="k">Category</span><span className="v">{ticket.category}</span></div>
            <div className="detail-row"><span className="k">Product</span><span className="v">{ticket.product || '—'}</span></div>
            <div className="detail-row"><span className="k">Priority</span><span className="v">{ticket.priority}</span></div>
            <div className="detail-row">
              <span className="k">Status</span>
              <span className="v">
                <span className={STATUS_CHIP[ticket.status] || 'chip open'} style={chipNoWrapStyle}>
                  {ticket.status}
                </span>
              </span>
            </div>
            <div className="detail-row"><span className="k">Raised On</span><span className="v">{formatDateTime(ticket.created_at)}</span></div>
            <div className="detail-row"><span className="k">Closed On</span><span className="v">{closedOn(ticket)}</span></div>
            <div className="detail-row"><span className="k">Last Updated</span><span className="v">{formatDateTime(ticket.updated_at)}</span></div>
          </div>

          <div className="detail-section-title">Raised By</div>
          <div className="detail-grid">
            <div className="detail-row"><span className="k">Name</span><span className="v">{ticket.raised_by?.full_name || '—'}</span></div>
            <div className="detail-row"><span className="k">Phone</span><span className="v">{ticket.raised_by?.phone_number || '—'}</span></div>
            <div className="detail-row"><span className="k">Role</span><span className="v">{ticket.raised_by?.role || '—'}</span></div>
          </div>

          <div className="detail-section-title">Assigned Staff</div>
          {ticket.assigned_staff ? (
            <div className="detail-grid">
              <div className="detail-row"><span className="k">Name</span><span className="v">{ticket.assigned_staff.full_name || '—'}</span></div>
              <div className="detail-row"><span className="k">Phone</span><span className="v">{ticket.assigned_staff.phone_number || '—'}</span></div>
              <div className="detail-row"><span className="k">Role</span><span className="v">{ticket.assigned_staff.role || '—'}</span></div>
            </div>
          ) : (
            <div className="panel-sub">Not yet assigned to any staff member.</div>
          )}

          <div className="detail-section-title">Description</div>
          <div className="remarks-box">{ticket.description}</div>

          {(ticket.current_remark || ticket.escalation_note) && (
            <>
              <div className="detail-section-title">Current Remark</div>
              <div className="remarks-box">{ticket.current_remark || ticket.escalation_note}</div>
            </>
          )}

          {isAdmin && (
            <>
              <div className="detail-section-title">Status History</div>
              {historyLoading ? (
                <div className="ticket-modal-status" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading history…</div>
              ) : statusHistory.length === 0 ? (
                <div className="ticket-modal-status" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No status changes yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {statusHistory.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        border: '1px solid var(--line, #e5e7eb)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 600 }}>
                        <span className={STATUS_CHIP[h.from_status] || 'chip open'} style={{ ...chipNoWrapStyle, fontSize: 11 }}>{h.from_status}</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span className={STATUS_CHIP[h.to_status] || 'chip open'} style={{ ...chipNoWrapStyle, fontSize: 11 }}>{h.to_status}</span>
                      </div>
                      {h.remark && <div style={{ marginTop: 6 }}>{h.remark}</div>}
                      <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                        {h.changed_by?.full_name || h.changed_by?.phone_number || 'Unknown'} · {formatDateTime(h.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {ticket.attachments?.length > 0 && (
            <>
              <div className="detail-section-title">Attachments</div>
              <div className="product-chip-list">
                {ticket.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={attachmentUrl(a.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="product-chip"
                  >
                    {a.file.split('/').pop()}
                  </a>
                ))}
              </div>
            </>
          )}

          {/* ---------------- Status update (highlighted) ---------------- */}
          <div
            style={{
              marginTop: 24,
              padding: '18px 20px 20px',
              borderRadius: 12,
              border: '1.5px solid #1f8a83',
              background: 'rgba(31, 138, 131, 0.06)',
            }}
          >
            <div className="detail-section-title" style={{ marginTop: 0, color: '#1f8a83' }}>
              Update Status
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              {STATUSES.map((s) => (
                <span
                  key={s}
                  onClick={() => { setStatus(s); setSaved(false) }}
                  className={STATUS_CHIP[s] || 'chip open'}
                  style={{
                    cursor: 'pointer',
                    outline: status === s ? '2px solid #1f8a83' : 'none',
                    outlineOffset: 2,
                    ...chipNoWrapStyle,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
            {status !== ticket.status && (
              <textarea
                placeholder={`Add a remark for moving this ticket to "${status}" (required)`}
                value={remark}
                onChange={(e) => { setRemark(e.target.value); setSaved(false) }}
                rows={3}
                style={{ width: '100%', resize: 'vertical', marginBottom: 12 }}
              />
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleUpdateStatus}
                disabled={saving || status === ticket.status || !remark.trim()}
              >
                {saving ? 'Saving…' : 'Update Status'}
              </button>
              {saved && <span style={{ fontSize: 12.5, color: '#1f8a83', fontWeight: 600 }}>Updated ✓</span>}
            </div>
            {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default AllTickets