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
import './style.css'
import { initApp } from './script.js'

function MainLayout() {
  return (
    <div className="app-shell">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}

// Login.jsx stores these as flat localStorage keys after a successful
// login (matching the backend's issue_tokens() response) — same keys
// Header.jsx already reads from.
const getRole = () => localStorage.getItem('role') || ''

// Presence of an access token is the same signal api.js's request
// interceptor already relies on to decide whether to attach
// Authorization headers — reusing it here keeps "am I logged in" defined
// in exactly one place's worth of meaning, even though it's checked in
// two files. logout()/clearSession() in api.js removes 'access', so this
// flips false immediately on logout, including for any tab still open.
const isLoggedIn = () => !!localStorage.getItem('access')

// Guards every route nested under it (Dashboard, All Tickets, Profile,
// etc.) — if there's no access token, bounce to the login page instead of
// rendering the protected page's shell. Doesn't try to validate the
// token itself (expired/invalid tokens are handled by api.js's response
// interceptor + refresh flow); this is just the "never even show the
// page without SOME token" guard for direct URL access.
//
// Redirects to "/login" rather than "/" — "/" is now the public landing
// page, not the login form, so bouncing here still puts the person
// straight in front of a login form instead of a marketing page.
function RequireAuth({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }
  return children
}

// Inverse guard for the landing + login routes — if someone who's
// already logged in navigates to "/" or "/login" directly (bookmark,
// typed URL, browser back), send them straight to their dashboard
// instead of showing marketing copy or the login form again.
function RedirectIfAuthed({ children }) {
  if (isLoggedIn()) {
    return <Navigate to="/dashboard/" replace />
  }
  return children
}

// Per-page role gate — sits INSIDE RequireAuth (so we already know
// there's a valid session by the time this runs), and checks the role
// against an explicit allow-list per route. Unlike RequireAuth, this
// doesn't redirect: someone who's logged in but hitting a page their
// role isn't permitted to see should get an explicit "Permission
// Denied" rather than being silently bounced elsewhere, since a
// redirect could look like the page just doesn't exist / is broken.
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

        {/* Public landing page — first thing anyone hits at "/".
            Already-authenticated visitors get bounced straight to their
            dashboard instead of seeing marketing copy. */}
        <Route
          path='/'
          element={
            <RedirectIfAuthed>
              <LandingPage />
            </RedirectIfAuthed>
          }
        />

        {/* Login moved off "/" and onto its own path now that "/" is
            the landing page. */}
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