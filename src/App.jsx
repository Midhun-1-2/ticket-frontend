import React, { useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { BrowserRouter, Route, Routes, Outlet, Navigate, Link } from 'react-router-dom'
import CustomerDashboard from './pages/CustomerDashboard.jsx'
import StaffDashboard from './pages/StaffDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Login from './pages/Login.jsx'
import LandingPage from './pages/LandingPage.jsx'
import CategoryMaster from './pages/CategoryMaster.jsx'
import RaiseTicket from './pages/RaiseTicket.jsx'
import StaffManagement from './pages/StaffManagement.jsx'
import AccountApproval from './pages/AccountApprovals.jsx'
import Customers from './pages/Customers.jsx'
import TicketAssignment from './pages/TicketAssignment.jsx'
import ProductMaster from './pages/ProductMaster.jsx'
import AllTickets from './pages/AllTickets.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import api from './api.js'
import './style.css'
import { initApp } from './script.js'

function MainLayout() {
  // Periodic authenticated ping so a tab that's just sitting open (not
  // otherwise making API calls) still discovers within seconds that its
  // session was ended — "logout from all devices" on the login screen, or
  // a newer login elsewhere superseding it — instead of only finding out
  // the next time it happens to hit a real endpoint. The 401 handling
  // (refresh, then clearSession() if still rejected) already lives in
  // api.js's interceptor; this just gives it something to trip on.
  useEffect(() => {
    const check = () => { api.get('session-check/').catch(() => {}) }
    const id = setInterval(check, 5000)
    // Also check the instant this tab regains focus/visibility — covers
    // switching back to a tab that's been sitting in the background,
    // without waiting for the next scheduled tick.
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  return (
    <div className="app-shell">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}

// Reads the logged-in user's role from localStorage.
const getRole = () => localStorage.getItem('role') || ''

// Checks whether an access token is present in localStorage.
const isLoggedIn = () => !!localStorage.getItem('access')

// Route guard: redirects to /login if there's no access token.
function RequireAuth({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }
  return children
}

// Inverse guard: sends already-logged-in users away from landing/login to their dashboard.
function RedirectIfAuthed({ children }) {
  if (isLoggedIn()) {
    return <Navigate to="/dashboard/" replace />
  }
  return children
}

// Per-page role gate — shows Permission Denied if the user's role isn't in the allow-list.
function RequireRole({ allow, children }) {
  const role = getRole()
  if (!allow.includes(role)) {
    return <PermissionDenied />
  }
  return children
}

function PermissionDenied() {
  return (
    <main className="main">
      <div className="content">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">ACCESS · RESTRICTED</div>
            <h1 className="page-title">Permission Denied</h1>
            <p className="page-desc">
              Your account role doesn't have access to this page.
            </p>
          </div>
        </div>

        <div className="alert-banner error" style={{ maxWidth: 480 }}>
          If you believe this is a mistake, contact an admin.
        </div>

        <Link
          to="/dashboard/"
          className="btn btn-primary"
          style={{ marginTop: 16, width: 'fit-content' }}
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}

// Single /dashboard/ route that renders the right dashboard for whoever is logged in,
// so nav links, redirects after login, etc. don't need to know about roles.
function RoleDashboard() {
  const role = getRole()

  if (!role) {
    return <div style={{ padding: 24 }}>You need to be logged in to view the dashboard.</div>
  }

  switch (role) {
    case 'admin':
      return <AdminDashboard />
    case 'staff':
      return <StaffDashboard />
    case 'customer':
      return <CustomerDashboard />
    default:
      return <div style={{ padding: 24 }}>Unrecognized user role: "{role}"</div>
  }
}

function App() {
  useEffect(() => {
    initApp()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          {/* All three roles */}
          <Route path='/dashboard/' element={<RoleDashboard />} />
          <Route
            path='/all-tickets/'
            element={
              <RequireRole allow={['admin', 'staff', 'customer']}>
                <AllTickets />
              </RequireRole>
            }
          />
          <Route
            path='/profile/'
            element={
              <RequireRole allow={['admin', 'staff', 'customer']}>
                <ProfilePage />
              </RequireRole>
            }
          />

          {/* Customer only */}
          <Route
            path='/raise-ticket/'
            element={
              <RequireRole allow={['customer']}>
                <RaiseTicket />
              </RequireRole>
            }
          />

          {/* Admin + Staff */}
          <Route
            path='/ticket-assignment/'
            element={
              <RequireRole allow={['admin', 'staff']}>
                <TicketAssignment />
              </RequireRole>
            }
          />

          {/* Admin only */}
          <Route
            path='/categories/'
            element={
              <RequireRole allow={['admin']}>
                <CategoryMaster />
              </RequireRole>
            }
          />
          <Route
            path='/accountapproval/'
            element={
              <RequireRole allow={['admin']}>
                <AccountApproval />
              </RequireRole>
            }
          />
          <Route
            path='/customers/'
            element={
              <RequireRole allow={['admin']}>
                <Customers />
              </RequireRole>
            }
          />
          <Route
            path='/products/'
            element={
              <RequireRole allow={['admin']}>
                <ProductMaster />
              </RequireRole>
            }
          />
          <Route
            path='/staffmanagement/'
            element={
              <RequireRole allow={['admin']}>
                <StaffManagement />
              </RequireRole>
            }
          />
        </Route>

        <Route path='/onboarding' element={<Onboarding />} />

        {/* Public landing page at "/". */}
        <Route
          path='/'
          element={
            <RedirectIfAuthed>
              <LandingPage />
            </RedirectIfAuthed>
          }
        />

        {/* Login page. */}
        <Route
          path='/login'
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />

        <Route path='*' element={<div style={{ padding: 24 }}>Page coming soon</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App