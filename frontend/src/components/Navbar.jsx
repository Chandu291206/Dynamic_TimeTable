import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getApiHealth } from '../api/public.js'
import useAuth from '../hooks/useAuth.js'

export default function Navbar() {
  const [state, setState] = useState('checking')
  const [label, setLabel] = useState('API checking')
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const controller = new AbortController()
    getApiHealth({ signal: controller.signal })
      .then((data) => {
        setState(data.status === 'ok' ? 'ready' : 'error')
        setLabel(data.status === 'ok' ? 'API ready' : 'API response issue')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState('error')
          setLabel('API offline')
        }
      })
    return () => controller.abort()
  }, [])

  return (
    <header className="site-header">
      <nav className="nav-wrap" aria-label="Primary navigation">
        <NavLink className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">TT</span>
          <span>Timetable</span>
        </NavLink>

        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>

        <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
          <NavLink to="/">Classes</NavLink>
          {user?.role === 'CR' ? (
            <NavLink to="/cr/dashboard">CR Dashboard</NavLink>
          ) : (
            <NavLink to="/cr/login">CR Login</NavLink>
          )}
          {user?.role === 'ADMIN' ? (
            <NavLink to="/admin/dashboard">Admin Dashboard</NavLink>
          ) : (
            <NavLink to="/admin/login">Admin Login</NavLink>
          )}
          <span className="api-status" data-state={state} role="status">
            <i className="status-dot" aria-hidden="true" />
            {label}
          </span>
        </div>
      </nav>
    </header>
  )
}
