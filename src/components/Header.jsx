import React, { useState, useEffect } from 'react'
import { useLocation, Link } from "react-router-dom";
import api, { logout } from "../api"; // adjust this path if Header.jsx lives somewhere else relative to api.js
import GlobalSearch from "./GlobalSearch"; // adjust path to match where you place GlobalSearch.jsx

// Same assumption as GlobalSearch.jsx / TicketAssignment.jsx: login stores
// { role, full_name } in localStorage under these exact keys (matching the
// backend's issue_tokens() response shape). Adjust here if your AuthContext
// stores it differently.
const getFullName = () => localStorage.getItem('full_name') || 'User';
const getRole = () => localStorage.getItem('role') || '';

const ROLE_LABELS = {
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
};

function formatRole(role) {
  return ROLE_LABELS[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member');
}

// "Rahul Jose" -> "RJ", single-word names -> first two letters, "" -> "?"
function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Header() {
  const location = useLocation();
  const isActive = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  const fullName = getFullName();
  const role = getRole();
  const roleLabel = formatRole(role);
  const initials = getInitials(fullName);

  // Live count of pending Account Approvals.
  const [pendingApprovals, setPendingApprovals] = useState(null);

  // Live count of pending Ticket Assignment offers.
  const [pendingAssignments, setPendingAssignments] = useState(null);

  // Prevents a double-click from firing two logout requests at once.
  const [loggingOut, setLoggingOut] = useState(false);

  // ---------------------------------------------------------------------
  // Mobile off-canvas sidebar. On desktop (>880px) the sidebar is always
  // visible and expands on hover via pure CSS (see style.css) — there's
  // no button for that, hovering the sidebar itself is the trigger.
  // The hamburger only exists for the mobile off-canvas case, and is only
  // rendered at all (not just hidden) when isMobile is true, so it can
  // never show up on a desktop-width screen even if CSS is out of sync.
  // ---------------------------------------------------------------------
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 880px)').matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 880px)');
    const handleChange = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileNavOpen(false); // left mobile width — make sure off-canvas isn't left open
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', mobileNavOpen);
  }, [mobileNavOpen]);

  // Close the mobile off-canvas menu whenever the route changes, so
  // tapping a nav link doesn't leave the overlay open on the next page.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingCount() {
      try {
        const { data } = await api.get("onboarding/pending/");
        if (!cancelled) setPendingApprovals(Array.isArray(data) ? data.length : 0);
      } catch (err) {
        // Fail quietly — the badge just won't show rather than breaking the header.
        if (!cancelled) setPendingApprovals(null);
      }
    }

    loadPendingCount();
    const interval = setInterval(loadPendingCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingAssignmentCount() {
      try {
        const { data } = await api.get("ticket-assignments/pending-count/");
        if (!cancelled) setPendingAssignments(typeof data.count === "number" ? data.count : 0);
      } catch (err) {
        // Fail quietly — the badge just won't show rather than breaking the header.
        if (!cancelled) setPendingAssignments(null);
      }
    }

    loadPendingAssignmentCount();
    const interval = setInterval(loadPendingAssignmentCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location.pathname]);

  const handleLogout = async (e) => {
    e.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout(); // blacklists the refresh token server-side, then redirects to /login/
    } catch (err) {
      // logout() already clears local session and redirects even on
      // failure, so there's nothing further to handle here.
    }
  };

  return (
    <>
      <div
        className="scrim"
        onClick={() => setMobileNavOpen(false)}
        aria-hidden={!mobileNavOpen}
      ></div>

      {/* ================= SIDEBAR ================= */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TD</div>
          <div className="brand-text">
            <div className="brand-name">Ticket Desk</div>
            <div className="brand-sub">Admin Console</div>
          </div>
        </div>

        <div className="nav-group-label">Overview</div>
        <ul className="nav">
          <li className="nav-item">
            <Link to="/dashboard/" className={isActive("/dashboard/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
              <span className="label">Dashboard</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/all-tickets/" className={isActive("/all-tickets/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
              <span className="label">All Tickets</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/raise-ticket/" className={isActive("/raise-ticket/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              <span className="label">Raise Ticket</span>
            </Link>
          </li>
        </ul>

        <div className="nav-group-label">Triage</div>
        <ul className="nav">
          <li className="nav-item">
            <Link to="/ticket-assignment/" className={isActive("/ticket-assignment/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4M7 4l-3 3M7 4l3 3"/><path d="M17 8v12M17 20l3-3M17 20l-3-3"/></svg>
              <span className="label">Ticket Assignment</span>
              {pendingAssignments !== null && pendingAssignments > 0 && (
                <span className="nav-count warn">{pendingAssignments}</span>
              )}
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/accountapproval/" className={isActive("/accountapproval/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>
              <span className="label">Account Approvals</span>
              {pendingApprovals !== null && pendingApprovals > 0 && (
                <span className="nav-count critical">{pendingApprovals}</span>
              )}
            </Link>
          </li>
        </ul>

        <div className="nav-group-label">Manage</div>
        <ul className="nav">
          <li className="nav-item">
            <Link to="/customers/" className={isActive("/customers/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="label">Customers</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/staffmanagement/" className={isActive("/staffmanagement/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/><path d="M12 11v2"/></svg>
              <span className="label">Staff Management</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/categories/" className={isActive("/categories/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l3.59-3.59a2 2 0 0 0 0-2.83Z"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>
              <span className="label">Categories</span>
            </Link>
          </li>
        </ul>

        <div className="nav-group-label">System</div>
        <ul className="nav">
          <li className="nav-item">
            <a href="#" className="nav-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.06Z"/></svg>
              <span className="label">Settings</span>
            </a>
          </li>
          <li className="nav-item">
            <a href="#" className="nav-link" onClick={handleLogout} aria-disabled={loggingOut}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
              <span className="label">{loggingOut ? "Logging out…" : "Log Out"}</span>
            </a>
          </li>
        </ul>

        <div className="sidebar-footer">
          <a href="#" className="role-card">
            <div className="avatar">{initials}</div>
            <div className="role-info">
              <div className="role-name">{fullName}</div>
              <div className="role-title">{roleLabel}</div>
            </div>
          </a>
        </div>
      </aside>

      {/* ================= TOPBAR ================= */}
      <header className="topbar">
        {isMobile && (
          <button
            className="icon-btn menu-btn"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            )}
          </button>
        )}

        <GlobalSearch />

        <div className="topbar-right">
          <button className="icon-btn notif-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="notif-dot"></span>
          </button>
          <div className="topbar-divider"></div>
          <div className="topbar-profile">
            <div className="avatar">{initials}</div>
            <div className="role-info">
              <div className="role-name">{fullName}</div>
              <div className="role-title">{roleLabel}</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default Header;