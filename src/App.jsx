import React, { useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { BrowserRouter, Route, Routes, Outlet } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
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
        </Route>

        <Route path='/' element={<Login />} />

        <Route path='*' element={<div style={{ padding: 24 }}>Page coming soon</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App