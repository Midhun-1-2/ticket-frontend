import React, { useEffect, useState } from 'react'
import api from '/src/api.js'

// step: 'request' -> 'otp' -> 'newpin' -> 'done'
function ForgotMpinModal({ phone, onClose, onSuccess }) {
  const [step, setStep] = useState('request')
  const [phoneNumber, setPhoneNumber] = useState(phone || '')
  const [otp, setOtp] = useState('')
  const [newMpin, setNewMpin] = useState('')
  const [confirmMpin, setConfirmMpin] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  function handlePhoneInput(e) {
    setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
  }

  async function requestOtp() {
    if (phoneNumber.length !== 10) {
      setError('Enter a valid 10-digit phone number.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('mpin/forgot/request-otp/', { phone_number: phoneNumber })
      setMaskedEmail(data.masked_email || '')
      setStep('otp')
      setResendCooldown(60)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'pending_approval') {
        setError('This account is still pending admin approval.')
      } else if (detail === 'account_deactivated') {
        setError('This account has been deactivated. Contact an admin.')
      } else {
        setError(detail || 'Could not send OTP. Check the phone number and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp() {
    if (otp.length !== 4) {
      setError('Enter the 4-digit OTP.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post('mpin/forgot/verify-otp/', { phone_number: phoneNumber, otp })
      setStep('newpin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Incorrect OTP.')
    } finally {
      setBusy(false)
    }
  }

  async function resetMpin() {
    if (newMpin.length !== 4 || confirmMpin.length !== 4) {
      setError('M-PIN must be exactly 4 digits.')
      return
    }
    if (newMpin !== confirmMpin) {
      setError('M-PINs do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post('mpin/forgot/reset/', {
        phone_number: phoneNumber,
        new_mpin: newMpin,
        confirm_mpin: confirmMpin,
      })
      setStep('done')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reset M-PIN.')
    } finally {
      setBusy(false)
    }
  }

  function handleDone() {
    onSuccess?.()
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal-box narrow">
        <div className="modal-head">
          <div className="modal-title">Forgot M-PIN</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="alert-banner error">{error}</div>}

          {step === 'request' && (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 14 }}>
                We'll send a one-time code to the email address registered on this account.
              </p>
              <div className="form-field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={handlePhoneInput}
                  maxLength={10}
                  placeholder="10-digit phone number"
                />
              </div>
            </>
          )}

          {step === 'otp' && (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 14 }}>
                {maskedEmail
                  ? <>OTP sent to <strong>{maskedEmail}</strong>.</>
                  : 'OTP sent to your registered email.'}
              </p>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Enter 4-digit OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  style={{ letterSpacing: '.4em', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 18 }}
                />
              </div>
            </>
          )}

          {step === 'newpin' && (
            <>
              <div className="form-field">
                <label>New M-PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newMpin}
                  onChange={(e) => setNewMpin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  style={{ letterSpacing: '.4em', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 18 }}
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Confirm New M-PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmMpin}
                  onChange={(e) => setConfirmMpin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  style={{ letterSpacing: '.4em', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 18 }}
                />
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="alert-banner success">
              M-PIN reset successfully. You can now log in with it.
            </div>
          )}
        </div>

        <div className="modal-foot">
          {step === 'request' && (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={requestOtp} disabled={busy}>
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={requestOtp}
                disabled={busy || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}
              </button>
              <button type="button" className="btn btn-primary" onClick={verifyOtp} disabled={busy}>
                {busy ? 'Verifying…' : 'Verify OTP'}
              </button>
            </>
          )}

          {step === 'newpin' && (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={resetMpin} disabled={busy}>
                {busy ? 'Saving…' : 'Reset M-PIN'}
              </button>
            </>
          )}

          {step === 'done' && (
            <button type="button" className="btn btn-primary" onClick={handleDone}>
              Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotMpinModal
