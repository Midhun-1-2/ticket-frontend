import React, { useRef, useState } from 'react'
import axios from 'axios'
import '/src/login.css'

const PIN_LENGTH = 4

// Trims an array of per-box characters down to its leading contiguous run
// (stops at the first empty slot) and joins it. This is what keeps
// "value" unambiguous — digits typed out of order past a gap (e.g. a user
// clicks box 4 directly while boxes 1-3 are still empty) just don't count
// toward the PIN yet, rather than silently being included or dropped in a
// way that wouldn't match what's on screen.
function contiguousValue(chars) {
  const gap = chars.findIndex((d) => !d)
  return (gap === -1 ? chars : chars.slice(0, gap)).join('')
}

// Six-box segmented PIN entry — mirrors the digit-box treatment already
// used for the login screen's captcha (auth-captcha-box), so this modal
// reads as the same product instead of a generic browser form. Typing
// auto-advances via an imperative .focus() call; deliberately does NOT
// also redirect focus on click/focus events, since that combination
// caused the auto-advance's own focus() call to re-trigger a redirect
// against a stale digits snapshot and skip a box.
function PinBoxes({ id, value, onChange, autoFocus, state }) {
  const refs = useRef([])
  const digits = value.split('')

  function focusBox(i) {
    refs.current[i]?.focus()
  }

  function handleChange(i, raw) {
    const d = raw.replace(/\D/g, '').slice(-1)
    if (!d) return
    const next = Array.from({ length: PIN_LENGTH }, (_, idx) => digits[idx] || '')
    next[i] = d
    onChange(contiguousValue(next))
    if (i < PIN_LENGTH - 1) focusBox(i + 1)
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = Array.from({ length: PIN_LENGTH }, (_, idx) => digits[idx] || '')
      if (next[i]) {
        next[i] = ''
        onChange(contiguousValue(next))
      } else if (i > 0) {
        next[i - 1] = ''
        onChange(contiguousValue(next))
        focusBox(i - 1)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focusBox(i - 1)
    } else if (e.key === 'ArrowRight' && i < PIN_LENGTH - 1) {
      focusBox(i + 1)
    }
  }

  function handlePaste(i, e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!text) return
    e.preventDefault()
    const next = Array.from({ length: PIN_LENGTH }, (_, idx) => digits[idx] || '')
    let idx = i
    for (const ch of text) {
      if (idx >= PIN_LENGTH) break
      next[idx] = ch
      idx++
    }
    onChange(contiguousValue(next))
    focusBox(Math.min(idx, PIN_LENGTH - 1))
  }

  return (
    <div className={`mpin-boxes${state ? ` is-${state}` : ''}`} role="group" aria-labelledby={id}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`mpin-box${digits[i] ? ' is-filled' : ''}`}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}

function CreateMpinModal({ phone, password, onSuccess, onClose }) {
  const [mpin, setMpin] = useState('')
  const [confirmMpin, setConfirmMpin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const bothFilled = mpin.length === PIN_LENGTH && confirmMpin.length === mpin.length
  const matchState = !bothFilled ? null : mpin === confirmMpin ? 'match' : 'mismatch'

  async function handleCreate(e) {
    e.preventDefault()
    setError('')

    if (mpin.length < PIN_LENGTH) {
      setError('Enter a 4-digit M-PIN.')
      return
    }
    if (mpin !== confirmMpin) {
      setError('M-PINs do not match.')
      return
    }

    setLoading(true)
    try {
      await axios.post('http://127.0.0.1:8000/mpin/create/', {
        phone_number: phone,
        password: password,
        mpin: mpin,
        confirm_mpin: confirmMpin,
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create M-PIN. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mpin-overlay">
      <div className="mpin-card">
        <div className="mpin-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="mpin-head">
          <div className="mpin-eyebrow">First-time setup</div>
          <h3 className="mpin-title">Create Your M-PIN</h3>
          <p className="mpin-sub">
            Set a 4-digit PIN &mdash; you'll use it to sign in going forward instead of your password.
          </p>
        </div>

        <form className="mpin-form" onSubmit={handleCreate}>
          <div className="mpin-field">
            <span id="mpin-new-label" className="mpin-label">New M-PIN</span>
            <PinBoxes id="mpin-new-label" value={mpin} onChange={setMpin} autoFocus />
          </div>

          <div className="mpin-field">
            <span id="mpin-confirm-label" className="mpin-label">
              Confirm M-PIN
              {matchState === 'match' && (
                <span className="mpin-match-tag is-match">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  Matches
                </span>
              )}
              {matchState === 'mismatch' && (
                <span className="mpin-match-tag is-mismatch">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  Doesn't match
                </span>
              )}
            </span>
            <PinBoxes id="mpin-confirm-label" value={confirmMpin} onChange={setConfirmMpin} state={matchState} />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Saving…' : 'Create M-PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateMpinModal
