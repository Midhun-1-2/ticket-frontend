import React, { useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { BrowserRouter, Route, Routes, Outlet } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Login from './pages/Login.jsx'
import CategoryMaster from './pages/CategoryMaster.jsx'
import RaiseTicket from './pages/RaiseTicket.jsx'
import StaffManagement from './pages/StaffManagement.jsx'
import AccountApproval from './pages/AccountApprovals.jsx'
import Customers from './pages/Customers.jsx'
import TicketAssignment from './pages/TicketAssignment.jsx'
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

function App() {
  useEffect(() => {
    initApp()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path='/dashboard/' element={<Dashboard />} />
          <Route path='/categories/' element={<CategoryMaster />} />
          <Route path='/raise-ticket/' element={<RaiseTicket />} />
          <Route path='/staffmanagement/' element={<StaffManagement />} />
          <Route path='/accountapproval/' element={<AccountApproval />} />
          <Route path='/customers/' element={<Customers />} />
          <Route path='/ticket-assignment/' element={<TicketAssignment />} />
        </Route>

        <Route path='/onboarding' element={<Onboarding />} />
        <Route path='/' element={<Login />} />

        <Route path='*' element={<div style={{ padding: 24 }}>Page coming soon</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App