import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'

export default function CRLogin() {
  const navigate = useNavigate()
  const { user, login, loading: authLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'CR') {
        navigate('/cr/dashboard', { replace: true })
      } else if (user.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true })
      }
    }
  }, [user, authLoading, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('Please provide both username and password.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const session = await login(username.trim(), password)
      if (session?.user?.role === 'CR') {
        navigate('/cr/dashboard')
      } else if (session?.user?.role === 'ADMIN') {
        navigate('/admin/dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="login-page" aria-labelledby="cr-login-heading">
      <div className="login-card">
        <Link className="back-link" to="/">← All classes</Link>
        <p className="kicker">Class Representative</p>
        <h1 id="cr-login-heading">Sign in to your class workspace</h1>
        <p className="login-desc">
          Authorized class representatives can create date-specific timetable overrides and review upcoming schedule modifications.
        </p>

        {error && (
          <div className="form-error-alert" role="alert">
            <span aria-hidden="true">⚠</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="cr-username" className="field-label">Username</label>
            <input
              id="cr-username"
              type="text"
              className="text-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. cr1"
              autoComplete="username"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cr-password" className="field-label">Password</label>
            <input
              id="cr-password"
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

          <button type="submit" className="button auth-submit-btn" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in to workspace →'}
          </button>
        </form>

        <div className="login-footer-hint">
          <p>
            Default seed credentials: <code>cr1</code> / <code>crpass</code>
          </p>
          <p>
            Are you an administrator? <Link to="/admin/login">Admin sign-in</Link>
          </p>
        </div>
      </div>
    </section>
  )
}
