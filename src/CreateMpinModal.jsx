import React, { useState } from 'react'
import axios from 'axios'
import '/src/login.css'

function CreateMpinModal({ phone, password, onSuccess, onClose }) {
  const [mpin, setMpin] = useState('')
  const [confirmMpin, setConfirmMpin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')

    if (mpin.length < 4) {
      setError('M-PIN must be at least 4 digits.')
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
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-head">
          <h3 className="modal-title">Create Your M-PIN</h3>
          <p className="modal-sub">
            This is your first login. Set a 4–6 digit M-PIN — you'll use it to log in going forward.
          </p>
        </div>

        <form className="modal-form" onSubmit={handleCreate}>
          <label className="auth-field">
            <span className="auth-label">New M-PIN</span>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter 4–6 digit PIN"
              value={mpin}
              onChange={(e) => setMpin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Confirm M-PIN</span>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Re-enter your PIN"
              value={confirmMpin}
              onChange={(e) => setConfirmMpin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
            />
          </label>

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