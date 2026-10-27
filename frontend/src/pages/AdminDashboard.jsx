import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClassManagement from '../admin/ClassManagement.jsx'
import CRManagement from '../admin/CRManagement.jsx'
import FacultyManagement from '../admin/FacultyManagement.jsx'
import SlotManagement from '../admin/SlotManagement.jsx'
import SubjectManagement from '../admin/SubjectManagement.jsx'
import TimetableLogs from '../admin/TimetableLogs.jsx'
import useAuth from '../hooks/useAuth.js'

const TABS = [
  { id: 'faculty', label: 'Faculty Directory', icon: '👥' },
  { id: 'subjects', label: 'Subjects', icon: '📚' },
  { id: 'classes', label: 'Classes', icon: '🏛' },
  { id: 'slots', label: 'Timetable Slots', icon: '⏱' },
  { id: 'logs', label: 'Timetable Logs', icon: '📋' },
  { id: 'crs', label: 'CR Accounts', icon: '🎓' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, loading: authLoading, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('faculty')

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
    <section className="admin-dashboard-page" aria-labelledby="admin-dash-heading">
      <div className="admin-dashboard-wrap">
        {/* Admin Header */}
        <header className="admin-dashboard-header">
          <div className="admin-header-left">
            <p className="kicker kicker--admin">System Administration</p>
            <h1 id="admin-dash-heading">Administrator Console</h1>
            <div className="admin-assigned-tag">
              <span>Signed in as:</span>
              <b>{user?.username || 'Administrator'}</b>
              <span className="role-tag">Superadmin</span>
            </div>
          </div>

          <div className="admin-header-actions">
            <Link className="button button--secondary" to="/">
              Public Timetables ↗
            </Link>
            <button type="button" className="button sign-out-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="admin-nav-tabs" role="tablist" aria-label="Administrator Management Areas">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`admin-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab Content Panel */}
        <main className="admin-tab-content" role="tabpanel">
          {activeTab === 'faculty' && <FacultyManagement />}
          {activeTab === 'subjects' && <SubjectManagement />}
          {activeTab === 'classes' && <ClassManagement />}
          {activeTab === 'slots' && <SlotManagement />}
          {activeTab === 'logs' && <TimetableLogs />}
          {activeTab === 'crs' && <CRManagement />}
        </main>
      </div>
    </section>
  )
}
