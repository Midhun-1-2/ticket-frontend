import { useEffect, useState } from 'react'
import api from '../api'
import '../profile.css'

const STAFF_ROLES = ['staff', 'admin']

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Edit basic details
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  // Change M-PIN flow: 'idle' | 'otp' | 'newpin' | 'done'
  const [mpinStep, setMpinStep] = useState('idle')
  const [otp, setOtp] = useState('')
  const [newMpin, setNewMpin] = useState('')
  const [confirmMpin, setConfirmMpin] = useState('')
  const [mpinBusy, setMpinBusy] = useState(false)
  const [mpinError, setMpinError] = useState('')
  const [mpinInfo, setMpinInfo] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function loadProfile() {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await api.get('profile/')
      setProfile(data)
      setForm({ full_name: data.full_name || '', email: data.email || '' })
    } catch (err) {
      setLoadError('Could not load your profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    setForm({ full_name: profile.full_name || '', email: profile.email || '' })
    setSaveError('')
    setSaveSuccess('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setSaveError('')
  }

  async function saveEdit() {
    if (!form.full_name.trim()) {
      setSaveError('Name is required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const { data } = await api.patch('profile/', form)
      setProfile(data)
      setEditing(false)
      setSaveSuccess('Profile updated.')
      setTimeout(() => setSaveSuccess(''), 3000)

      // Sync full_name to localStorage so Header re-reads it immediately.
      localStorage.setItem('full_name', data.full_name || '')
      window.dispatchEvent(new Event('profile-updated'))
    } catch (err) {
      const detail =
        err.response?.data?.email?.[0] ||
        err.response?.data?.full_name?.[0] ||
        err.response?.data?.detail ||
        'Could not save changes.'
      setSaveError(detail)
    } finally {
      setSaving(false)
    }
  }

  function resetMpinFlow() {
    setMpinStep('idle')
    setOtp('')
    setNewMpin('')
    setConfirmMpin('')
    setMpinError('')
    setMpinInfo('')
  }

  async function requestOtp() {
    setMpinBusy(true)
    setMpinError('')
    try {
      await api.post('mpin/change/request-otp/')
      setMpinStep('otp')
      setMpinInfo('OTP sent to your registered email.')
      setResendCooldown(60)
    } catch (err) {
      setMpinError(err.response?.data?.detail || 'Could not send OTP. Try again.')
    } finally {
      setMpinBusy(false)
    }
  }

  async function verifyOtp() {
    if (otp.length !== 4) {
      setMpinError('Enter the 4-digit OTP.')
      return
    }
    setMpinBusy(true)
    setMpinError('')
    try {
      await api.post('mpin/change/verify-otp/', { otp })
      setMpinStep('newpin')
      setMpinInfo('')
    } catch (err) {
      setMpinError(err.response?.data?.detail || 'Incorrect OTP.')
    } finally {
      setMpinBusy(false)
    }
  }

  async function submitNewMpin() {
    if (newMpin.length !== 4 || confirmMpin.length !== 4) {
      setMpinError('M-PIN must be exactly 4 digits.')
      return
    }
    if (newMpin !== confirmMpin) {
      setMpinError('M-PINs do not match.')
      return
    }
    setMpinBusy(true)
    setMpinError('')
    try {
      await api.post('mpin/change/', { new_mpin: newMpin, confirm_mpin: confirmMpin })
      setMpinStep('done')
      setProfile((p) => (p ? { ...p, has_mpin: true } : p))
    } catch (err) {
      setMpinError(err.response?.data?.detail || 'Could not change M-PIN.')
    } finally {
      setMpinBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="main">
        <div className="content">
          <p className="profile-loading">Loading your profile…</p>
        </div>
      </main>
    )
  }

  if (loadError || !profile) {
    return (
      <main className="main">
        <div className="content">
          <p className="profile-error">{loadError || 'Profile unavailable.'}</p>
          <button className="btn btn-ghost" onClick={loadProfile}>Retry</button>
        </div>
      </main>
    )
  }

  const isStaffLike = STAFF_ROLES.includes(profile.role)

  return (
    <main className="main">
      <div className="content">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">ACCOUNT · PROFILE</div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-desc">View and manage your account details.</p>
          </div>
        </div>

        <div className="profile-stack">
          {/* ---------------- Basic Details ---------------- */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Basic Details</div>
              {!editing && (
                <button className="btn btn-ghost" onClick={startEdit}>Edit</button>
              )}
            </div>

            <div className="panel-body">
              {saveSuccess && <div className="alert-banner success">{saveSuccess}</div>}
              {saveError && <div className="alert-banner error">{saveError}</div>}

              {editing ? (
                <div className="profile-edit-grid">
                  <div className="form-field">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="profile-view-grid">
                  <div className="profile-field">
                    <span className="profile-field-label">Full Name</span>
                    <span className="profile-field-value">{profile.full_name || '—'}</span>
                  </div>

                  <div className="profile-field">
                    <span className="profile-field-label">Email</span>
                    <span className="profile-field-value">{profile.email || '—'}</span>
                  </div>

                  <div className="profile-field">
                    <span className="profile-field-label">Phone Number</span>
                    <span className="profile-field-value">{profile.phone_number}</span>
                    <span className="profile-field-hint">Contact an admin to change your login number.</span>
                  </div>

                  <div className="profile-field">
                    <span className="profile-field-label">Role</span>
                    <span className="chip closed" style={{ textTransform: 'capitalize', width: 'fit-content' }}>
                      {profile.role}
                    </span>
                  </div>

                  {isStaffLike && profile.department_name && (
                    <div className="profile-field">
                      <span className="profile-field-label">Department</span>
                      <span className="profile-field-value">{profile.department_name}</span>
                    </div>
                  )}

                  {isStaffLike && profile.designation_name && (
                    <div className="profile-field">
                      <span className="profile-field-label">Designation</span>
                      <span className="profile-field-value">{profile.designation_name}</span>
                    </div>
                  )}

                  <div className="profile-field">
                    <span className="profile-field-label">Member Since</span>
                    <span className="profile-field-value">{formatDate(profile.date_joined)}</span>
                  </div>
                </div>
              )}

              {editing && (
                <div className="profile-actions">
                  <button className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- M-PIN ---------------- */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">M-PIN</div>
              <span className={`chip ${profile.has_mpin ? 'resolved' : 'overdue'}`}>
                {profile.has_mpin ? 'Set' : 'Not set'}
              </span>
            </div>

            <div className="panel-body">
              {mpinError && <div className="alert-banner error">{mpinError}</div>}
              {mpinInfo && mpinStep === 'otp' && (
                <div className="alert-banner success">{mpinInfo}</div>
              )}

              {mpinStep === 'idle' && (
                <>
                  <p className="profile-field-hint" style={{ marginBottom: 14 }}>
                    Changing your M-PIN sends a one-time code to your registered email for verification.
                  </p>
                  <button className="btn btn-primary" onClick={requestOtp} disabled={mpinBusy}>
                    {mpinBusy ? 'Sending OTP…' : 'Change M-PIN'}
                  </button>
                </>
              )}

              {mpinStep === 'otp' && (
                <div className="profile-mpin-step">
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label>Enter the 4-digit OTP sent to your email</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="profile-otp-input"
                      placeholder="0000"
                    />
                  </div>
                  <div className="profile-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="btn btn-ghost" onClick={resetMpinFlow} disabled={mpinBusy}>Cancel</button>
                    <button
                      className="btn btn-ghost"
                      onClick={requestOtp}
                      disabled={mpinBusy || resendCooldown > 0}
                    >
                      {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}
                    </button>
                    <button className="btn btn-primary" onClick={verifyOtp} disabled={mpinBusy}>
                      {mpinBusy ? 'Verifying…' : 'Verify OTP'}
                    </button>
                  </div>
                </div>
              )}

              {mpinStep === 'newpin' && (
                <div className="profile-mpin-step">
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label>New M-PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={newMpin}
                      onChange={(e) => setNewMpin(e.target.value.replace(/\D/g, ''))}
                      className="profile-otp-input"
                      placeholder="••••"
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
                      className="profile-otp-input"
                      placeholder="••••"
                    />
                  </div>
                  <div className="profile-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="btn btn-ghost" onClick={resetMpinFlow} disabled={mpinBusy}>Cancel</button>
                    <button className="btn btn-primary" onClick={submitNewMpin} disabled={mpinBusy}>
                      {mpinBusy ? 'Saving…' : 'Save M-PIN'}
                    </button>
                  </div>
                </div>
              )}

              {mpinStep === 'done' && (
                <div className="profile-mpin-step">
                  <div className="alert-banner success">
                    M-PIN changed successfully. Use it next time you log in.
                  </div>
                  <button className="btn btn-ghost" onClick={resetMpinFlow} style={{ width: 'fit-content' }}>
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}