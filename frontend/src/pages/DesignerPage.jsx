import { useEffect } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import TimetableDesigner from '../admin/TimetableDesigner.jsx'
import useAuth from '../hooks/useAuth.js'

export default function DesignerPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading, logout } = useAuth()

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      navigate('/admin/login', { replace: true })
    }
  }, [authLoading, user, navigate])

  const handleSignOut = async () => {
    await logout()
    navigate('/admin/login')
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <section className="admin-dashboard-page" aria-busy="true">
        <div className="admin-dashboard-wrap">
          <div className="schedule-state schedule-loading" role="status">
            <span className="loading-rule" aria-hidden="true" />
            <p>Verifying administrative credentials…</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-dashboard-page" aria-labelledby="designer-page-heading">
      <div className="admin-dashboard-wrap">
        <header className="admin-dashboard-header">
          <div className="admin-header-left">
            <p className="kicker kicker--admin">Interactive Timetable Suite</p>
            <h1 id="designer-page-heading">Timetable Designer</h1>
            <div className="admin-assigned-tag">
              <span>Signed in as:</span>
              <b>{user?.username || 'Administrator'}</b>
              <span className="role-tag">Superadmin</span>
            </div>
          </div>

          <div className="admin-header-actions">
            <Link className="button button--secondary" to="/admin/dashboard">
              &larr; Admin Console
            </Link>
            <button type="button" className="button sign-out-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="admin-tab-content">
          <TimetableDesigner classId={classId} />
        </main>
      </div>
    </section>
  )
}
