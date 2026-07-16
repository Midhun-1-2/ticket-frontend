import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api'
import './attachment-preview.css'

// Extension -> { label, color }, used for the tile badge of non-image files
// (a real thumbnail only makes sense for images — everything else gets a
// consistent, colour-coded "type card" instead). Mirrors RaiseTicket.jsx's
// upload-time preview so an attachment looks the same before and after upload.
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
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'])

function getFileKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  return FILE_KIND_BY_EXT[ext] || DEFAULT_FILE_KIND
}

function getPreviewKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'txt') return 'text'
  return 'none'
}

const BACKEND_ORIGIN = api.defaults.baseURL.replace(/\/+$/, '')
function attachmentUrl(path) {
  if (!path) return '#'
  return path.startsWith('http') ? path : `${BACKEND_ORIGIN}${path}`
}

const getRole = () => localStorage.getItem('role') || ''

// Fetches the file as a blob before triggering the download — the media
// files are served from a different origin than the frontend, and a plain
// `<a download>` is ignored by the browser for cross-origin URLs.
async function downloadAttachment(url, name) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    // Fallback — opens the file directly if the fetch/blob step fails.
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// Thumbnail grid + zoom popup for already-uploaded ticket attachments —
// the read-only counterpart of RaiseTicket.jsx's upload-time preview.
function AttachmentThumbnails({ attachments }) {
  const [zoomedFile, setZoomedFile] = useState(null) // { url, name, kind } | null
  const [textPreview, setTextPreview] = useState('')
  const [textPreviewLoading, setTextPreviewLoading] = useState(false)
  const [textPreviewError, setTextPreviewError] = useState(false)

  useEffect(() => {
    if (!zoomedFile) return
    const handleEscape = (e) => { if (e.key === 'Escape') setZoomedFile(null) }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [zoomedFile])

  if (!attachments || attachments.length === 0) return null

  const openPreview = (name, url, kind) => {
    setZoomedFile({ url, name, kind })
    if (kind === 'text') {
      setTextPreview('')
      setTextPreviewError(false)
      setTextPreviewLoading(true)
      fetch(url)
        .then((res) => { if (!res.ok) throw new Error('fetch failed'); return res.text() })
        .then((text) => { setTextPreview(text); setTextPreviewLoading(false) })
        .catch(() => { setTextPreviewError(true); setTextPreviewLoading(false) })
    }
  }

  return (
    <>
      <div className="atp-grid">
        {attachments.map((a) => {
          const name = a.file.split('/').pop()
          const url = attachmentUrl(a.file)
          const kind = getPreviewKind(name)
          const badge = kind === 'image' ? null : getFileKind(name)
          return (
            <div className="atp-tile" key={a.id}>
              <button
                type="button"
                className="atp-tile-thumb"
                onClick={() => openPreview(name, url, kind)}
                aria-label={`Preview ${name}`}
                title="Click to preview"
              >
                {kind === 'image' ? (
                  <img className="atp-thumb-img" src={url} alt="" />
                ) : (
                  <span className="atp-tile-badge" style={{ background: badge.color }}>{badge.label}</span>
                )}
              </button>
              <div className="atp-tile-name" title={name}>{name}</div>
            </div>
          )
        })}
      </div>

      {zoomedFile && createPortal(
        <div className="modal-overlay atp-zoom-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setZoomedFile(null) }}>
          <div className={`atp-zoom-box ${zoomedFile.kind === 'pdf' || zoomedFile.kind === 'text' ? 'atp-zoom-box-tall' : ''}`}>
            <div className="atp-zoom-head">
              <span className="atp-zoom-name">{zoomedFile.name}</span>
              <div className="atp-zoom-head-actions">
                {(getRole() === 'admin' || getRole() === 'staff') && (
                  <button
                    type="button"
                    className="atp-download-btn"
                    onClick={() => downloadAttachment(zoomedFile.url, zoomedFile.name)}
                    aria-label="Download"
                    title="Download"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
                  </button>
                )}
                <button type="button" className="modal-close" onClick={() => setZoomedFile(null)} aria-label="Close">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {zoomedFile.kind === 'image' && (
              <img className="atp-zoom-full" src={zoomedFile.url} alt={zoomedFile.name} />
            )}

            {zoomedFile.kind === 'pdf' && (
              <iframe className="atp-pdf-frame" src={zoomedFile.url} title={zoomedFile.name} />
            )}

            {zoomedFile.kind === 'text' && (
              <div className="atp-text-body">
                {textPreviewLoading ? (
                  <p className="atp-text-loading">Loading…</p>
                ) : textPreviewError ? (
                  <p className="atp-text-loading">Couldn't load this file's text.</p>
                ) : (
                  <pre className="atp-text-pre">{textPreview}</pre>
                )}
              </div>
            )}

            {zoomedFile.kind === 'none' && (
              <div className="atp-zoom-fallback">
                <span
                  className="atp-tile-badge atp-tile-badge-lg"
                  style={{ background: getFileKind(zoomedFile.name).color }}
                >
                  {getFileKind(zoomedFile.name).label}
                </span>
                <p>
                  Preview isn't available for this file type.<br />
                  <a href={zoomedFile.url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default AttachmentThumbnails
