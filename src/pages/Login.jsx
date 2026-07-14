import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '/src/api.js'
import '/src/login.css'
import '/src/style.css'
import CreateMpinModal from '/src/CreateMpinModal.jsx'
import ForgotMpinModal from '/src/ForgotMpinModal.jsx'

function Login() {
  const navigate = useNavigate()

  const [phone, setPhone] = useState('')
  const [credential, setCredential] = useState('')
  const [role, setRole] = useState(null)
  const [hasMpin, setHasMpin] = useState(false)
  const [phoneChecked, setPhoneChecked] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(false)
  const [rejectedReason, setRejectedReason] = useState('')
  const [showRejectedReason, setShowRejectedReason] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showMpinSetup, setShowMpinSetup] = useState(false)
  const [pendingPassword, setPendingPassword] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [showForgotMpin, setShowForgotMpin] = useState(false)

  // Simple 4-digit numeric captcha, generated client-side (UX deterrent, not a security boundary).
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaNoise, setCaptchaNoise] = useState([])
  const [captchaInput, setCaptchaInput] = useState('')

  function generateCaptcha() {
    const code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
    const noise = code.split('').map((d) => ({
      d,
      rot: (Math.random() * 16 - 8).toFixed(1),
      ty: (Math.random() * 6 - 3).toFixed(1),
    }))
    setCaptchaCode(code)
    setCaptchaNoise(noise)
    setCaptchaInput('')
  }

  useEffect(() => {
    generateCaptcha()
  }, [])

  // Post-submit UI phase: 'idle' -> 'success' -> 'exiting' -> navigate.
  const [transitionPhase, setTransitionPhase] = useState('idle')

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
    setRejectedReason('')
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
      const { data } = await api.post(
        'detect-role/',
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
    else if (userRole === 'staff') navigate('/dashboard/')
    else navigate('/dashboard/')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setRejectedReason('')

    if (phone.length !== 10) {
      setError('Enter a valid 10-digit phone number.')
      return
    }
    if (!credential || (hasMpin && credential.length < 4)) {
      setError(hasMpin ? 'Enter your M-PIN.' : 'Enter your password.')
      return
    }
    if (captchaInput.length !== 4 || captchaInput !== captchaCode) {
      setError('Captcha does not match. Please try again.')
      generateCaptcha()
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

      // Persist auth/session data for Header.jsx / GlobalSearch.jsx to use.
      localStorage.setItem('access', data.access)
      localStorage.setItem('refresh', data.refresh)
      localStorage.setItem('role', data.role)
      localStorage.setItem('full_name', data.full_name || '')
      localStorage.setItem('phone_number', data.phone_number || '')

      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reducedMotion) {
        redirectByRole(data.role)
        return
      }

      // Success — swap button label for a checkmark, then crossfade out and navigate.
      setTransitionPhase('success')
      setTimeout(() => {
        setTransitionPhase('exiting')
        setTimeout(() => {
          redirectByRole(data.role)
        }, 520)
      }, 340)
    } catch (err) {
      const detail = err.response?.data?.detail

      if (detail === 'pending_approval') {
        setPendingApproval(true)
      } else if (detail === 'account_rejected') {
        setError('Your account registration has been rejected by admin.')
        setRejectedReason(err.response?.data?.reason || '')
      } else if (detail === 'account_deactivated') {
        setError('This account has been deactivated. Contact an admin for access.')
      } else if (err.response) {
        setError(detail || `Incorrect phone number or ${hasMpin ? 'M-PIN' : 'password'}.`)
      } else {
        setError('Could not reach the server. Please try again.')
      }
      // A failed login attempt still consumes the captcha — regenerate so
      // the same code can't be reused across repeated attempts.
      generateCaptcha()
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

  function handleMpinReset() {
    setShowForgotMpin(false)
    setCredential('')
    setToastMessage('M-PIN reset! Please log in with your new M-PIN.')
  }

  // Spawns a short-lived decorative ripple element at the click point.
  function spawnRipple(e) {
    const button = e.currentTarget
    if (button.disabled) return
    const rect = button.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 1.4
    const ripple = document.createElement('span')
    ripple.className = 'auth-submit-ripple'
    ripple.style.width = ripple.style.height = `${size}px`
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`
    button.appendChild(ripple)
    setTimeout(() => ripple.remove(), 650)
  }

  return (
    <>
      {/* Branded crossfade overlay shown while transitioning away after login. */}
      <div className={`auth-transition-overlay${transitionPhase === 'exiting' ? ' is-active' : ''}`} aria-hidden="true">
        <img className="auth-transition-mark" src="/logo.png" alt="TIXA" />
      </div>

      <div className={`auth-screen${transitionPhase === 'exiting' ? ' is-transitioning' : ''}`}>

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

      <div className="auth-shell">

        {/* Branded panel — presentational sidebar echoing the app shell. */}
        <aside className="auth-visual" aria-hidden="true">
          <div className="auth-visual-glow"></div>

          <div className="auth-visual-top">
            <img className="brand-mark" src="/logo.png" alt="TIXA" />
            <div className="brand-text">
              <div className="brand-name">TIXA</div>
              <div className="brand-sub">Admin Console</div>
            </div>
          </div>

          <div className="auth-visual-mid">
            <h1 className="auth-visual-title">
              <span className="word" style={{ '--i': 0 }}>Every</span>{' '}
              <span className="word" style={{ '--i': 1 }}>ticket,</span>
              <br />
              <span className="word" style={{ '--i': 2 }}>tracked</span>{' '}
              <span className="word" style={{ '--i': 3 }}>in</span>{' '}
              <span className="word" style={{ '--i': 4 }}>real</span>{' '}
              <span className="word" style={{ '--i': 5 }}>time.</span>
            </h1>
            <p className="auth-visual-desc">
              One dashboard for your whole support queue — assignment,
              escalation and resolution, all in sync.
            </p>

            <ul className="auth-feature-list">
              <li>
                <span className="auth-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                Live ticket queue &amp; SLA tracking
              </li>
              <li>
                <span className="auth-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                Race-safe assignment &amp; transfers
              </li>
              <li>
                <span className="auth-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                Staff performance at a glance
              </li>
            </ul>
          </div>

          <div className="auth-visual-ticker">
            <span className="ticker-dot"></span> LIVE QUEUE
            <span className="auth-visual-ticker-sep"></span>
            Synced just now
          </div>
        </aside>

        {/* Mobile-only condensed hero, shown when .auth-visual is hidden below 860px. */}
        <div className="auth-mobile-hero" aria-hidden="true">
          <div className="auth-mobile-hero-top">
            <img className="brand-mark" src="/logo.png" alt="TIXA" />
            <div>
              <div className="brand-name">TIXA</div>
              <div className="brand-sub">Admin Console</div>
            </div>
          </div>
          <h2 className="auth-mobile-hero-title">
            <span className="word" style={{ '--i': 0 }}>Every</span>{' '}
            <span className="word" style={{ '--i': 1 }}>ticket,</span>{' '}
            <span className="word" style={{ '--i': 2 }}>tracked</span>{' '}
            <span className="word" style={{ '--i': 3 }}>in</span>{' '}
            <span className="word" style={{ '--i': 4 }}>real</span>{' '}
            <span className="word" style={{ '--i': 5 }}>time.</span>
          </h2>
          <div className="auth-mobile-hero-ticker">
            <span className="ticker-dot"></span> LIVE QUEUE <span className="sep">·</span> Synced just now
          </div>
        </div>

        {/* Actual form panel — logic and structure unchanged. */}
        <div className="auth-card-wrap">
          <div className="auth-card">

            <div className="auth-card-head">
              <div className="page-eyebrow">Welcome back</div>
              <h2 className="auth-card-title">Sign in</h2>
              <p className="auth-card-sub">Enter your phone number to continue.</p>
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

                {/* Role Detected is only surfaced for admin/staff accounts. */}
                {(role === 'admin' || role === 'staff') && (
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
                          ? e.target.value.replace(/\D/g, '').slice(0, 4)
                          : e.target.value
                        setCredential(v)
                      }}
                      maxLength={hasMpin ? 4 : undefined}
                      autoComplete="current-password"
                      required
                    />
                  </label>
                )}

                {/* 4-digit numeric captcha, regenerated on refresh or failed attempt. */}
                {phoneChecked && (
                  <div className="auth-field auth-captcha">
                    <span className="auth-label">Verification Code</span>
                    <div className="auth-captcha-row">
                      <div className="auth-captcha-box" aria-label={`Captcha code`}>
                        {captchaNoise.map((item, i) => (
                          <span
                            key={i}
                            className="auth-captcha-digit"
                            style={{ transform: `rotate(${item.rot}deg) translateY(${item.ty}px)` }}
                          >
                            {item.d}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="auth-captcha-refresh"
                        onClick={generateCaptcha}
                        aria-label="Get a new code"
                        title="Get a new code"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                          <path d="M21 3v6h-6" />
                        </svg>
                      </button>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter the 4 digits above"
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      autoComplete="off"
                      required
                    />
                  </div>
                )}

                {hasMpin && (
                <div className="auth-row">
                    <button
                      type="button"
                      className="auth-link"
                      style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                      onClick={() => setShowForgotMpin(true)}
                    >
                      Forgot M-PIN?
                    </button>
                </div>
                )}

                {error && (
                  <div className="auth-error">
                    {error}
                    {rejectedReason && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="auth-link"
                          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
                          onClick={() => setShowRejectedReason(true)}
                        >
                          Read more
                        </button>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary auth-submit"
                  disabled={loading || !phoneChecked || transitionPhase !== 'idle'}
                  onMouseDown={spawnRipple}
                >
                  {transitionPhase !== 'idle' ? (
                    <svg className="btn-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <>
                      <span className="btn-label">{loading ? 'Signing in…' : 'Login'}</span>
                      <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                      </svg>
                    </>
                  )}
                </button>

                <p className="auth-signup">
                  Don't have an account? <Link to="/onboarding" className="auth-link">Sign up</Link>
                </p>
              </form>
            )}
          </div>
        </div>

      </div>

      {showMpinSetup && (
        <CreateMpinModal
          phone={phone}
          password={pendingPassword}
          onSuccess={handleMpinCreated}
          onClose={() => setShowMpinSetup(false)}
        />
      )}

      {showForgotMpin && (
        <ForgotMpinModal
          phone={phone}
          onSuccess={handleMpinReset}
          onClose={() => setShowForgotMpin(false)}
        />
      )}

      {showRejectedReason && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowRejectedReason(false) }}>
          <div className="modal-box narrow">
            <div className="modal-head">
              <div className="modal-title">Reason for Rejection</div>
              <button type="button" className="modal-close" onClick={() => setShowRejectedReason(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                {rejectedReason || 'No reason was provided by the admin.'}
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-primary" onClick={() => setShowRejectedReason(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </>
  )
}

export default Login