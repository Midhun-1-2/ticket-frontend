import React from 'react'
import { useLocation, Link } from "react-router-dom";

function Header() {
  const location = useLocation();
  const isActive = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  return (
    <>
      <div className="scrim" data-scrim></div>

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
            <Link to="/" className={isActive("/")}>
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
        </ul>

        <div className="nav-group-label">Triage</div>
        <ul className="nav">
          <li className="nav-item">
            <Link to="/ticket-assignment/" className={isActive("/ticket-assignment/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4M7 4l-3 3M7 4l3 3"/><path d="M17 8v12M17 20l3-3M17 20l-3-3"/></svg>
              <span className="label">Ticket Assignment</span>
              <span className="nav-count warn">12</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/account-approvals/" className={isActive("/account-approvals/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>
              <span className="label">Account Approvals</span>
              <span className="nav-count critical">4</span>
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
            <Link to="/staff-management/" className={isActive("/staff-management/")}>
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
            <a href="#" className="nav-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
              <span className="label">Log Out</span>
            </a>
          </li>
        </ul>

        <div className="sidebar-footer">
          <a href="#" className="role-card">
            <div className="avatar">RJ</div>
            <div className="role-info">
              <div className="role-name">Rahul Jose</div>
              <div className="role-title">System Admin</div>
            </div>
          </a>
        </div>
      </aside>

      {/* ================= TOPBAR ================= */}
      <header className="topbar">
        <button className="icon-btn menu-btn" data-menu-toggle aria-label="Toggle navigation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <button className="icon-btn" data-collapse-toggle aria-label="Collapse sidebar" style={{ display: "none" }} data-desktop-only>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div className="search-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Search tickets, customers, staff…" />
          <span className="search-hint">⌘K</span>
        </div>

        <div className="topbar-right">
          <button className="icon-btn notif-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="notif-dot"></span>
          </button>
          <div className="topbar-divider"></div>
          <div className="topbar-profile">
            <div className="avatar">RJ</div>
            <div className="role-info">
              <div className="role-name">Rahul Jose</div>
              <div className="role-title">Admin</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default Header;