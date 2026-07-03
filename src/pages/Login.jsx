import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import api from '/src/api.js'
import '/src/login.css'
import CreateMpinModal from '/src/CreateMpinModal.jsx'

function Login() {
  const navigate = useNavigate()

  const [phone, setPhone] = useState('')
  const [credential, setCredential] = useState('')
  const [role, setRole] = useState(null)
  const [hasMpin, setHasMpin] = useState(false)
  const [phoneChecked, setPhoneChecked] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showMpinSetup, setShowMpinSetup] = useState(false)
  const [pendingPassword, setPendingPassword] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Plain JS auto-dismiss — runs whenever toastMessage changes.
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  function handlePhoneChange(e) {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(value)
    setError('')
    setCredential('')

    if (value.length === 10) {
      detectRole(value)
    } else {
      setRole(null)
      setHasMpin(false)
      setPhoneChecked(false)
    }
  }

  async function detectRole(phoneNumber) {
    try {
      const { data } = await axios.post(
        'http://127.0.0.1:8000/detect-role/',
        { phone_number: phoneNumber }
      )
      setRole(data.exists ? data.role : null)
      setHasMpin(Boolean(data.has_mpin))
      setPhoneChecked(true)
    } catch {
      setRole(null)
      setHasMpin(false)
      setPhoneChecked(true)
    }
  }

  function redirectByRole(userRole) {
    if (userRole === 'admin') navigate('/dashboard/')
    else if (userRole === 'staff') navigate('/staff/dashboard/')
    else navigate('/dashboard/')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (phone.length !== 10) {
      setError('Enter a valid 10-digit phone number.')
      return
    }
    if (!credential || (hasMpin && credential.length < 4)) {
      setError(hasMpin ? 'Enter your M-PIN.' : 'Enter your password.')
      return
    }

    setLoading(true)
    try {
      const payload = hasMpin
        ? { phone_number: phone, mpin: credential }
        : { phone_number: phone, password: credential }

      const { data } = await api.post('login/', payload)

      if (data.mpin_required) {
        setPendingPassword(credential)
        setShowMpinSetup(true)
        return
      }

      localStorage.setItem('access', data.access)
      localStorage.setItem('refresh', data.refresh)
      localStorage.setItem('role', data.role)

      redirectByRole(data.role)
    } catch (err) {
      const detail = err.response?.data?.detail

      if (detail === 'pending_approval') {
        setPendingApproval(true)
      } else if (err.response) {
        setError(detail || `Incorrect phone number or ${hasMpin ? 'M-PIN' : 'password'}.`)
      } else {
        setError('Could not reach the server. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleMpinCreated() {
    setShowMpinSetup(false)
    setHasMpin(true)
    setCredential('')
    setPendingPassword('')
    setToastMessage('M-PIN created! Please log in with your new M-PIN.')
  }

  return (
    <div className="auth-screen">

      {toastMessage && (
        <div className="toast toast-success">
          <span className="toast-message">{toastMessage}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage('')}
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">TD</div>
          <div className="brand-text">
            <div className="brand-name">Ticket Desk</div>
            <div className="brand-sub">Sign in to your account</div>
          </div>
        </div>

        {pendingApproval ? (
          <div className="auth-notice">
            <div className="auth-notice-title">Account Pending Approval</div>
            <p className="auth-notice-body">
              Your account is pending admin approval. You will be notified once approved.
            </p>
            <button
              type="button"
              className="btn btn-ghost auth-back-btn"
              onClick={() => setPendingApproval(false)}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>

            <label className="auth-field">
              <span className="auth-label">Phone Number</span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Enter 10-digit phone number"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={10}
                autoComplete="tel"
                required
              />
            </label>

            {role && (
              <div className="auth-role-detected">
                Role detected: <span>{role}</span>
              </div>
            )}

            {phoneChecked && (
              <label className="auth-field">
                <span className="auth-label">{hasMpin ? 'M-PIN' : 'Password'}</span>
                <input
                  type="password"
                  inputMode={hasMpin ? 'numeric' : 'text'}
                  placeholder={hasMpin ? 'Enter your M-PIN' : 'Enter your password'}
                  value={credential}
                  onChange={(e) => {
                    const v = hasMpin
                      ? e.target.value.replace(/\D/g, '').slice(0, 6)
                      : e.target.value
                    setCredential(v)
                  }}
                  maxLength={hasMpin ? 6 : undefined}
                  autoComplete="current-password"
                  required
                />
              </label>
            )}

            {hasMpin && (
            <div className="auth-row">
                <a href="/forgot-mpin/" className="auth-link">
                Forgot M-PIN?
                </a>
            </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading || !phoneChecked}
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>

            <p className="auth-signup">
              Don't have an account? <Link to="/onboarding" className="auth-link">Sign up</Link>
            </p>
          </form>
        )}
      </div>

      {showMpinSetup && (
        <CreateMpinModal
          phone={phone}
          password={pendingPassword}
          onSuccess={handleMpinCreated}
          onClose={() => setShowMpinSetup(false)}
        />
      )}
    </div>
  )
}

export default Login