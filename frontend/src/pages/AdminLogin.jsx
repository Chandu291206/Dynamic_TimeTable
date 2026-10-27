import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { user, login, loading: authLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true })
      } else if (user.role === 'CR') {
        navigate('/cr/dashboard', { replace: true })
      }
    }
  }, [user, authLoading, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('Username and password are required.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const session = await login(username.trim(), password)
      if (session?.user?.role === 'ADMIN') {
        navigate('/admin/dashboard')
      } else if (session?.user?.role === 'CR') {
        navigate('/cr/dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Administrator sign-in failed. Check credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="login-page" aria-labelledby="admin-login-heading">
      <div className="login-card login-card--admin">
        <Link className="back-link" to="/">← All classes</Link>
        <p className="kicker kicker--admin">System Administration</p>
        <h1 id="admin-login-heading">Sign in to Administrator Portal</h1>
        <p className="login-desc">
          Manage faculty directories, course subjects, academic classes, timetable slots, and Class Representative accounts.
        </p>

        {error && (
          <div className="form-error-alert" role="alert">
            <span aria-hidden="true">⚠</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="admin-username" className="field-label">Administrator Username</label>
            <input
              id="admin-username"
              type="text"
              className="text-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              autoComplete="username"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password" className="field-label">Password</label>
            <input
              id="admin-password"
              type="password"
              className="text-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={submitting}
            />
          </div>

          <button type="submit" className="button auth-submit-btn button--admin" disabled={submitting}>
            {submitting ? 'Verifying credentials…' : 'Access Administrator Console →'}
          </button>
        </form>

        <div className="login-footer-hint">
          <p>
            Default bootstrap credentials: <code>admin</code> / <code>adminpass</code>
          </p>
          {/* <p>
            Looking for Class Representative workspace? <Link to="/cr/login">CR Sign-in</Link>
          </p> */}
        </div>
      </div>
    </section>
  )
}
