import React, { useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import './style.css'
import { initApp } from './script.js'

function App() {

  useEffect(() => {
    initApp()
  }, [])

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Header />
        <Routes>
          <Route path='/' element={<Dashboard />} />
          <Route path='*' element={<div style={{ padding: 24 }}>Page coming soon</div>} />
        </Routes>
      </div>
      <Footer />
    </BrowserRouter>
  )
}

export default App