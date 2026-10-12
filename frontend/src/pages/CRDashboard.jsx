import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCRDashboard, deleteCROverride } from '../api/cr.js'
import FacultyDetailsDialog from '../components/FacultyDetailsDialog.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import OverrideForm from '../components/cr/OverrideForm.jsx'
import OverrideList from '../components/cr/OverrideList.jsx'
import TimetableGrid from '../components/TimetableGrid.jsx'
import useAuth from '../hooks/useAuth.js'
import { useToast } from '../components/Toast.jsx'

export default function CRDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, loading: authLoading, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const triggerRef = useRef(null)

  const reloadData = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/cr/login', { replace: true })
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    setLoading(true)
    setError('')

    getCRDashboard({ signal: controller.signal })
      .then((dashboardData) => {
        setData(dashboardData)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || 'Could not load CR dashboard data.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [user, refreshKey])

  const handleSignOut = async () => {
    await logout()
    toast.info('Signed out of CR workspace')
    navigate('/cr/login')
  }

  const confirmDeleteOverride = async () => {
    if (!deleteTargetId) return
    try {
      await deleteCROverride(deleteTargetId)
      toast.success('Timetable override removed successfully')
      reloadData()
    } catch (err) {
      toast.error(err.message || 'Failed to remove override')
    } finally {
      setDeleteTargetId(null)
    }
  }

  if (authLoading || (loading && !data)) {
    return (
      <section className="cr-dashboard-page" aria-busy="true">
        <div className="cr-dashboard-wrap">
          <div className="schedule-state schedule-loading" role="status">
            <span className="loading-rule" aria-hidden="true" />
            <p>Loading your class representative workspace…</p>
          </div>
        </div>
      </section>
    )
  }

  if (error && !data) {
    return (
      <section className="cr-dashboard-page">
        <div className="cr-dashboard-wrap">
          <div className="schedule-state schedule-error" role="alert">
            <p><b>Could not connect to workspace:</b> {error}</p>
            <button type="button" className="button" onClick={reloadData}>Try again</button>
          </div>
        </div>
      </section>
    )
  }

  const classInfo = data?.class || { id: user?.classId, label: 'Assigned Class' }
  const upcomingOverrides = data?.upcomingOverrides || []
  const todayTimetable = data?.timetable?.slots || []
  const subjects = data?.subjects || []
  const faculty = data?.faculty || []

  return (
    <section className="cr-dashboard-page" aria-labelledby="cr-dashboard-heading">
      <div className="cr-dashboard-wrap">
        {/* Top Header Banner */}
        <header className="cr-dashboard-header">
          <div className="cr-header-left">
            <p className="kicker">Class Representative Workspace</p>
            <h1 id="cr-dashboard-heading">Welcome, {user?.username || 'CR'}</h1>
            <div className="cr-assigned-tag">
              <span>Assigned Class:</span>
              <b>{classInfo.label}</b>
            </div>
          </div>

          <div className="cr-header-actions">
            <Link className="button view-tt-btn" to={`/timetable/${classInfo.id}`}>
              View Public Timetable ↗
            </Link>
            <button type="button" className="button button--secondary sign-out-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {/* Dashboard Grid Layout */}
        <div className="cr-dashboard-layout">
          {/* Left Column: Create Override */}
          <div className="cr-primary-column">
            <OverrideForm
              subjects={subjects}
              faculty={faculty}
              onCreated={(created) => {
                toast.success(`Override scheduled for ${created.date} (${created.startTime} – ${created.endTime})`)
                reloadData()
              }}
            />

            {/* Today's Timetable Preview */}
            <div className="today-preview-card">
              <header className="today-preview-header">
                <div>
                  <p className="kicker">Live Schedule</p>
                  <h2 className="section-title">Today’s Class Timetable</h2>
                </div>
                <Link to={`/timetable/${classInfo.id}`} className="text-button">
                  Full timetable →
                </Link>
              </header>

              {todayTimetable.length === 0 ? (
                <div className="empty-preview-state">
                  <p>No active sessions scheduled for today, or today is a non-teaching day.</p>
                </div>
              ) : (
                <TimetableGrid
                  slots={todayTimetable}
                  onOpen={(slot) => {
                    triggerRef.current = document.activeElement
                    setSelectedSlot(slot)
                  }}
                  isToday={true}
                />
              )}
            </div>
          </div>

          {/* Right Column: Upcoming Overrides List */}
          <aside className="cr-secondary-column" aria-label="Upcoming schedule overrides">
            <OverrideList
              overrides={upcomingOverrides}
              loading={loading}
              onDelete={(id) => setDeleteTargetId(id)}
            />
          </aside>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        title="Remove Timetable Override?"
        message="Are you sure you want to delete this override? The standard weekly recurring timetable slot will take effect once deleted."
        confirmText="Delete Override"
        cancelText="Keep Override"
        danger={true}
        onConfirm={confirmDeleteOverride}
        onCancel={() => setDeleteTargetId(null)}
      />

      <FacultyDetailsDialog
        slot={selectedSlot}
        day="Today"
        onClose={() => setSelectedSlot(null)}
        triggerRef={triggerRef}
      />
    </section>
  )
}
