import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAdminLiveMonitor, getAdminMasterMatrix } from '../api/admin.js'
import useAuth from '../hooks/useAuth.js'
import FacultyAvatar from '../components/FacultyAvatar.jsx'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const QUICK_PERIODS = [
  { label: 'P1 (09:00)', time: '09:20' },
  { label: 'P2 (09:50)', time: '10:15' },
  { label: 'P3 (10:40)', time: '11:00' },
  { label: 'Lunch (11:30)', time: '11:45' },
  { label: 'P4 (12:10)', time: '12:30' },
  { label: 'P5 (01:00)', time: '01:25' },
  { label: 'P6 (01:50)', time: '02:15' },
  { label: 'P7 (02:40)', time: '03:00' },
]

function getLocalTimeString() {
  const now = new Date()
  return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getLocalDateString() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

export default function LiveMonitorPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading, logout } = useAuth()

  // Observation time state
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [selectedTime, setSelectedTime] = useState(getLocalTimeString())
  const [wallClock, setWallClock] = useState(new Date())

  // View & filtering
  const [activeView, setActiveView] = useState('live') // 'live' | 'matrix' | 'rooms'
  const [yearFilter, setYearFilter] = useState('ALL') // 'ALL' | '1' | '2' | '3' | '4'
  const [searchQuery, setSearchQuery] = useState('')
  const [matrixDayFilter, setMatrixDayFilter] = useState('ALL') // 'ALL' | '0'..'5'
  const [expandedBranches, setExpandedBranches] = useState({})

  // Data state
  const [liveData, setLiveData] = useState(null)
  const [matrixData, setMatrixData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Auth gate
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      navigate('/admin/login', { replace: true })
    }
  }, [authLoading, user, navigate])

  // Live wall clock timer (ticks every second)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setWallClock(now)
      if (isLiveMode) {
        setSelectedTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }))
        setSelectedDate(now.toISOString().slice(0, 10))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [isLiveMode])

  // Fetch Live Data
  const fetchLiveData = useCallback(async () => {
    try {
      setError(null)
      const res = await getAdminLiveMonitor({
        date: selectedDate,
        time: selectedTime,
        year: yearFilter,
      })
      if (res?.success) {
        setLiveData(res.data)
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch live monitoring data')
    }
  }, [selectedDate, selectedTime, yearFilter])

  // Fetch Master Matrix Data
  const fetchMatrixData = useCallback(async () => {
    try {
      const res = await getAdminMasterMatrix({
        year: yearFilter,
        day: matrixDayFilter,
        date: selectedDate,
      })
      if (res?.success) {
        setMatrixData(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch master matrix:', err)
    }
  }, [yearFilter, matrixDayFilter, selectedDate])

  // Primary data loading effect
  useEffect(() => {
    let mounted = true
    setLoading(true)

    const p = activeView === 'matrix' ? fetchMatrixData() : fetchLiveData()
    p.finally(() => {
      if (mounted) setLoading(false)
    })

    return () => { mounted = false }
  }, [activeView, fetchLiveData, fetchMatrixData])

  // Periodic polling when in live mode
  useEffect(() => {
    if (!autoRefresh || !isLiveMode) return
    const interval = setInterval(() => {
      fetchLiveData()
    }, 25000)
    return () => clearInterval(interval)
  }, [autoRefresh, isLiveMode, fetchLiveData])

  // Switch to real-time now
  const handleResetToNow = () => {
    const now = new Date()
    setIsLiveMode(true)
    setSelectedDate(now.toISOString().slice(0, 10))
    setSelectedTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }))
  }

  // Set a specific simulated time
  const handleSetTime = (newTime, newDate) => {
    setIsLiveMode(false)
    if (newTime) setSelectedTime(newTime)
    if (newDate) setSelectedDate(newDate)
  }

  const toggleBranch = (yearNum, branchName) => {
    setExpandedBranches((prev) => {
      const current = prev[yearNum]
      if (current === branchName) {
        const next = { ...prev }
        delete next[yearNum]
        return next
      }
      return { ...prev, [yearNum]: branchName }
    })
  }

  // Filtered live sessions
  const filteredLiveSessions = useMemo(() => {
    if (!liveData?.liveSessions) return []
    const q = searchQuery.trim().toLowerCase()
    return liveData.liveSessions.filter((s) => {
      if (yearFilter !== 'ALL' && String(s.year) !== String(yearFilter)) return false
      if (!q) return true
      const matchBranch = (s.branch || '').toLowerCase().includes(q)
      const matchSec = (s.section || '').toLowerCase().includes(q)
      const matchSubject = (s.subject?.code || '').toLowerCase().includes(q) || (s.subject?.name || '').toLowerCase().includes(q)
      const matchFaculty = (s.faculty?.name || '').toLowerCase().includes(q) || (s.batchBFaculty?.name || '').toLowerCase().includes(q)
      const matchRoom = (s.room || '').toLowerCase().includes(q)
      return matchBranch || matchSec || matchSubject || matchFaculty || matchRoom
    })
  }, [liveData, yearFilter, searchQuery])

  // Group live sessions by Year
  const liveSessionsByYear = useMemo(() => {
    const map = { 1: [], 2: [], 3: [], 4: [] }
    for (const session of filteredLiveSessions) {
      const y = session.year || 1
      if (!map[y]) map[y] = []
      map[y].push(session)
    }
    return map
  }, [filteredLiveSessions])

  const handleSignOut = async () => {
    await logout()
    navigate('/admin/login')
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <section className="admin-dashboard-page" aria-busy="true">
        <div className="admin-dashboard-wrap">
          <div className="schedule-state schedule-loading">
            <span className="loading-rule" aria-hidden="true" />
            <p>Authenticating admin session…</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-dashboard-page live-monitor-page" aria-labelledby="live-monitor-heading">
      <div className="admin-dashboard-wrap admin-dashboard-wrap--wide">
        {/* Top Header */}
        <header className="admin-dashboard-header">
          <div className="admin-header-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="live-pulsing-dot" aria-hidden="true" />
              <p className="kicker kicker--admin" style={{ margin: 0 }}>GRIET Live Operations Monitor</p>
            </div>
            <h1 id="live-monitor-heading">Classroom Live Tracker & Master Schedule</h1>
            <p className="monitor-subtext">
              Real-time institutional classroom observation, active room allocations & year-wise timetable matrix.
            </p>
          </div>

          <div className="admin-header-actions">
            <Link className="button button--secondary" to="/admin/dashboard">
              &larr; Admin Console
            </Link>
            <Link className="button button--secondary" to="/admin/designer">
              Interactive Designer &rarr;
            </Link>
            <button type="button" className="button sign-out-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {/* Real-time Clock & Simulation Time Control Bar */}
        <div className="monitor-control-strip">
          <div className="monitor-clock-card">
            <div className="monitor-clock-header">
              <span className={`status-badge-live ${isLiveMode ? 'status-badge-live--active' : 'status-badge-live--sim'}`}>
                {isLiveMode ? '● REAL-TIME STREAM' : '⏱ SIMULATED OBSERVATION'}
              </span>
              <button
                type="button"
                className={`button button--mini ${isLiveMode ? 'button--disabled' : 'button--primary'}`}
                onClick={handleResetToNow}
                title="Reset to current real-time clock"
                disabled={isLiveMode}
              >
                Jump to Live Now
              </button>
            </div>
            <div className="monitor-clock-display">
              <span className="clock-digits">
                {isLiveMode ? wallClock.toLocaleTimeString('en-GB') : `${selectedTime}:00`}
              </span>
              <span className="clock-sublabel">
                {isLiveMode
                  ? wallClock.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
                  : `${selectedDate} (${liveData?.dayName || 'Day'})`}
              </span>
            </div>
          </div>

          {/* Time & Date Scrub Controls */}
          <div className="monitor-scrub-controls">
            <div className="scrub-row">
              <div className="scrub-field">
                <label htmlFor="monitor-date-input">Observe Date:</label>
                <input
                  id="monitor-date-input"
                  type="date"
                  className="input-field"
                  value={selectedDate}
                  onChange={(e) => handleSetTime(null, e.target.value)}
                />
              </div>

              <div className="scrub-field">
                <label htmlFor="monitor-time-input">Observe Time (HH:MM):</label>
                <input
                  id="monitor-time-input"
                  type="time"
                  className="input-field"
                  value={selectedTime}
                  onChange={(e) => handleSetTime(e.target.value, null)}
                />
              </div>

              <div className="scrub-field" style={{ alignSelf: 'flex-end' }}>
                <label className="checkbox-label" title="Automatically poll server every 25 seconds">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  Auto-refresh (25s)
                </label>
              </div>
            </div>

            {/* Quick Period Buttons */}
            <div className="quick-periods-row">
              <span className="quick-periods-label">Jump to Period:</span>
              <div className="quick-period-pills">
                {QUICK_PERIODS.map((qp) => (
                  <button
                    key={qp.time}
                    type="button"
                    className={`quick-period-btn ${selectedTime === qp.time ? 'active' : ''}`}
                    onClick={() => handleSetTime(qp.time, null)}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary Counters */}
        {liveData?.summary && (
          <div className="monitor-kpi-grid">
            <div className="kpi-card kpi-card--green">
              <div className="kpi-icon">🟢</div>
              <div className="kpi-content">
                <span className="kpi-value">{liveData.summary.classesInSession}</span>
                <span className="kpi-title">Classes Currently in Session</span>
                <span className="kpi-meta">out of {liveData.summary.totalClasses} registered classes</span>
              </div>
            </div>

            <div className="kpi-card kpi-card--blue">
              <div className="kpi-icon">👨‍🏫</div>
              <div className="kpi-content">
                <span className="kpi-value">{liveData.summary.facultyTeaching}</span>
                <span className="kpi-title">Faculty Actively Teaching</span>
                <span className="kpi-meta">in live classrooms & laboratories</span>
              </div>
            </div>

            <div className="kpi-card kpi-card--purple">
              <div className="kpi-icon">🚪</div>
              <div className="kpi-content">
                <span className="kpi-value">{liveData.summary.roomsOccupied}</span>
                <span className="kpi-title">Rooms Occupied</span>
                <span className="kpi-meta">theory halls & laboratories in use</span>
              </div>
            </div>

            <div className="kpi-card kpi-card--amber">
              <div className="kpi-icon">⚡</div>
              <div className="kpi-content">
                <span className="kpi-value">{liveData.summary.activeOverridesToday}</span>
                <span className="kpi-title">Active Schedule Overrides</span>
                <span className="kpi-meta">CR adjustments applied today</span>
              </div>
            </div>
          </div>
        )}

        {/* View Mode Tabs & Filters */}
        <div className="monitor-tab-bar">
          <div className="view-mode-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'live'}
              className={`view-mode-btn ${activeView === 'live' ? 'is-active' : ''}`}
              onClick={() => setActiveView('live')}
            >
              📡 Live Ongoing Radar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'matrix'}
              className={`view-mode-btn ${activeView === 'matrix' ? 'is-active' : ''}`}
              onClick={() => setActiveView('matrix')}
            >
              📅 Year-wise Master Schedule Matrix
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'rooms'}
              className={`view-mode-btn ${activeView === 'rooms' ? 'is-active' : ''}`}
              onClick={() => setActiveView('rooms')}
            >
              🏢 Room Utilization Directory
            </button>
          </div>

          <div className="monitor-filter-group">
            <input
              type="search"
              placeholder="Filter by Room, Branch, Subject or Faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ width: '280px' }}
            />

            {/* Year Filter Buttons */}
            <div className="directory-year-tabs" style={{ margin: 0 }}>
              {[
                { id: 'ALL', label: 'All Years' },
                { id: '1', label: 'Year I' },
                { id: '2', label: 'Year II' },
                { id: '3', label: 'Year III' },
                { id: '4', label: 'Year IV' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`directory-year-btn ${yearFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setYearFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="notice-banner notice-banner--danger" role="alert">
            <p>{error}</p>
          </div>
        )}

        {/* VIEW 1: LIVE ONGOING RADAR */}
        {activeView === 'live' && (
          <div className="monitor-live-view">
            {loading ? (
              <div className="schedule-state schedule-loading">
                <span className="loading-rule" aria-hidden="true" />
                <p>Scanning active classrooms and teaching sessions…</p>
              </div>
            ) : filteredLiveSessions.length === 0 ? (
              <div className="schedule-empty-state">
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🌙</div>
                <h3>No Classes Currently In Session for {liveData?.dayName || 'this time'} ({selectedTime})</h3>
                <p>
                  Either classes have concluded for the day, or it is a break/weekend. You can inspect active academic periods by clicking below:
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => handleSetTime('10:15', '2026-10-05')}
                  >
                    Simulate Monday 10:15 AM
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => handleSetTime('14:15', '2026-10-05')}
                  >
                    Simulate Monday 02:15 PM
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => setActiveView('matrix')}
                  >
                    View Complete Weekly Matrix &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <div className="monitor-years-container">
                {[1, 2, 3, 4]
                  .filter((y) => yearFilter === 'ALL' || String(y) === String(yearFilter))
                  .map((yearNum) => {
                    const sessions = liveSessionsByYear[yearNum] || []
                    if (sessions.length === 0) return null

                    return (
                      <section key={yearNum} className="monitor-year-section">
                        <div className="monitor-year-header">
                          <span className="year-pill" style={{ fontSize: '1rem', padding: '0.35rem 0.8rem' }}>
                            Year {yearNum}
                          </span>
                          <span className="monitor-year-count">
                            {sessions.length} {sessions.length === 1 ? 'class' : 'classes'} in session right now
                          </span>
                        </div>

                        <div className="live-cards-grid">
                          {sessions.map((session) => {
                            const isBreak = session.subject?.isBreak || session.subject?.code === 'LUNCH'
                            const nextUp = session.nextUpcoming

                            return (
                              <article
                                key={`${session.classId}-${session.startTime}`}
                                className={`live-class-card ${session.isOverride ? 'live-class-card--override' : ''} ${isBreak ? 'live-class-card--break' : ''}`}
                              >
                                {/* Card Top: Class Label + Room Pill */}
                                <div className="live-card-top">
                                  <div className="live-card-class-badge">
                                    <strong>{session.branch}-{session.section}</strong>
                                    <span className="live-card-year">Y{session.year}</span>
                                  </div>

                                  <div className="live-room-pill" title={`Allocated room: ${session.room}`}>
                                    <span className="room-icon">🚪</span>
                                    <span className="room-text">{session.room || 'TBA'}</span>
                                  </div>
                                </div>

                                {/* Subject & Time */}
                                <div className="live-card-subject">
                                  <div className="live-subject-code">
                                    {session.subject?.code || '---'}
                                    {session.subject?.electiveTag && (
                                      <span className="elective-tag-badge" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
                                        {session.subject.electiveTag}
                                      </span>
                                    )}
                                    {session.isOverride && (
                                      <span className="badge badge--warning" style={{ fontSize: '0.65rem', marginLeft: '0.4rem' }}>
                                        ⚡ Substitute
                                      </span>
                                    )}
                                  </div>
                                  <div className="live-subject-name" title={session.subject?.name || ''}>
                                    {session.subject?.name || 'Academic Session'}
                                  </div>
                                </div>

                                {/* Subtle, de-emphasized time & slim progress indicator */}
                                <div className="live-time-subtle-wrap">
                                  <div className="live-time-subtle-meta">
                                    <span className="live-time-clock">⏱ {session.startTime} &ndash; {session.endTime}</span>
                                    <span className="live-time-remaining-pill">{session.remaining}m left</span>
                                  </div>
                                  <div className="live-progress-hairline-track" title={`${session.progressPercent}% elapsed`}>
                                    <div
                                      className="live-progress-hairline-fill"
                                      style={{ width: `${session.progressPercent}%` }}
                                      role="progressbar"
                                      aria-valuenow={session.progressPercent}
                                      aria-valuemin="0"
                                      aria-valuemax="100"
                                    />
                                  </div>
                                </div>

                                {/* PROMINENT FACULTY SPOTLIGHT */}
                                <div className="live-faculty-spotlight">
                                  {isBreak ? (
                                    <div className="live-break-tag">Scheduled Break / Recess</div>
                                  ) : session.faculty ? (
                                    <div className="live-instructors-container">
                                      {/* Primary / Batch A Faculty */}
                                      <div className="live-instructor-profile">
                                        {session.batchBFaculty && (
                                          <span className="instructor-batch-tag">Batch A</span>
                                        )}
                                        <div className="live-instructor-content">
                                          <div className="live-avatar-wrapper">
                                            <FacultyAvatar faculty={session.faculty} size="medium" />
                                          </div>
                                          <div className="live-faculty-meta">
                                            <div className="live-faculty-header">
                                              <span className="live-faculty-kicker">Faculty In-Charge</span>
                                              {session.faculty.staffId && (
                                                <span className="live-staff-id-badge">ID: {session.faculty.staffId}</span>
                                              )}
                                            </div>
                                            <div className="live-faculty-name" title={session.faculty.name}>
                                              {session.faculty.name}
                                            </div>
                                            <div className="live-faculty-sub" title={session.faculty.department || 'Faculty'}>
                                              {session.faculty.designation ? `${session.faculty.designation} · ` : ''}
                                              {session.faculty.department || 'Faculty'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Co-teacher / Batch B Faculty */}
                                      {session.batchBFaculty && (
                                        <div className="live-instructor-profile live-instructor-profile--batch-b">
                                          <span className="instructor-batch-tag instructor-batch-tag--b">Batch B</span>
                                          <div className="live-instructor-content">
                                            <div className="live-avatar-wrapper">
                                              <FacultyAvatar faculty={session.batchBFaculty} size="medium" />
                                            </div>
                                            <div className="live-faculty-meta">
                                              <div className="live-faculty-header">
                                                <span className="live-faculty-kicker">Co-Faculty / Lab In-Charge</span>
                                                {session.batchBFaculty.staffId && (
                                                  <span className="live-staff-id-badge">ID: {session.batchBFaculty.staffId}</span>
                                                )}
                                              </div>
                                              <div className="live-faculty-name" title={session.batchBFaculty.name}>
                                                {session.batchBFaculty.name}
                                              </div>
                                              <div className="live-faculty-sub" title={session.batchBFaculty.department || 'Faculty'}>
                                                {session.batchBFaculty.designation ? `${session.batchBFaculty.designation} · ` : ''}
                                                {session.batchBFaculty.department || 'Faculty'}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="live-faculty-unassigned">No Faculty Assigned</div>
                                  )}
                                </div>

                                {/* Footer: Next Upcoming Class */}
                                {nextUp && (
                                  <div className="live-card-footer">
                                    <span className="next-up-kicker">Next up ({nextUp.startTime}):</span>
                                    <span className="next-up-subject">
                                      {nextUp.subject?.code || '---'} in <b>{nextUp.room || 'TBA'}</b>
                                    </span>
                                  </div>
                                )}
                              </article>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: MASTER WEEK-WISE SCHEDULE MATRIX */}
        {activeView === 'matrix' && (
          <div className="monitor-matrix-view">
            {/* Day Filter Subtabs */}
            <div className="directory-year-bar" style={{ marginBottom: '1rem' }}>
              <span className="year-bar-label">Day of Week:</span>
              <div className="directory-year-tabs">
                {[{ id: 'ALL', label: 'Full Week (Mon–Sat)' }, ...DAY_NAMES.map((d, i) => ({ id: String(i), label: d }))].map((dayTab) => (
                  <button
                    key={dayTab.id}
                    type="button"
                    className={`directory-year-btn ${matrixDayFilter === dayTab.id ? 'active' : ''}`}
                    onClick={() => setMatrixDayFilter(dayTab.id)}
                  >
                    {dayTab.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="schedule-state schedule-loading">
                <span className="loading-rule" aria-hidden="true" />
                <p>Loading master schedule matrix with room allocations…</p>
              </div>
            ) : !matrixData?.years ? (
              <div className="schedule-empty-state">
                <p>No master timetable schedules available.</p>
              </div>
            ) : (
              <div className="timetable-matrix-container">
                <table className="timetables-matrix-table" aria-label="Master Academic Timetable Matrix">
                  <thead>
                    <tr>
                      <th scope="col" className="matrix-col-year">Year of Study</th>
                      <th scope="col" className="matrix-col-branches">
                        Academic Branches & Sections (Click branch pill to view schedule & rooms)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4]
                      .filter((y) => yearFilter === 'ALL' || String(y) === String(yearFilter))
                      .map((yearNum) => {
                        const branchesInYear = Object.keys(matrixData.years[yearNum] || {})
                        if (branchesInYear.length === 0) {
                          return (
                            <tr key={yearNum} className="matrix-table-row">
                              <th scope="row" className="matrix-cell-year">
                                <span className="year-pill">Year {yearNum}</span>
                              </th>
                              <td className="matrix-empty-cell">No classes registered for Year {yearNum}</td>
                            </tr>
                          )
                        }

                        const activeBranch = expandedBranches[yearNum]
                        const isExpanded = Boolean(activeBranch && matrixData.years[yearNum][activeBranch])

                        return (
                          <div key={yearNum} style={{ display: 'contents' }}>
                            <tr className={`matrix-table-row matrix-year-row ${isExpanded ? 'is-year-expanded' : ''}`}>
                              <th scope="row" className="matrix-cell-year">
                                <div className="year-cell-content">
                                  <span className="year-num-badge">Year {yearNum}</span>
                                </div>
                              </th>
                              <td className="matrix-cell-branches">
                                <div className="branch-pills-wrap">
                                  {branchesInYear.map((bName) => {
                                    const classList = matrixData.years[yearNum][bName] || []
                                    const isCurrent = activeBranch === bName
                                    return (
                                      <button
                                        key={bName}
                                        type="button"
                                        className={`matrix-branch-pill ${isCurrent ? 'is-selected' : ''}`}
                                        onClick={() => toggleBranch(yearNum, bName)}
                                        aria-expanded={isCurrent}
                                      >
                                        <span className="branch-pill-name">{bName}</span>
                                        <span className="branch-pill-count">{classList.length} sec</span>
                                        <span className="branch-pill-chevron">{isCurrent ? '▲' : '▼'}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Section Timetable Cards with Room Numbers */}
                            {isExpanded && (
                              <tr className="matrix-expanded-row">
                                <td colSpan="2" className="matrix-expanded-cell">
                                  <div className="matrix-expanded-header">
                                    <h4>Year {yearNum} &bull; {activeBranch} Department Timetables</h4>
                                    <span className="matrix-close-btn" onClick={() => toggleBranch(yearNum, activeBranch)}>
                                      &times; Close
                                    </span>
                                  </div>

                                  <div className="section-schedules-stack">
                                    {(matrixData.years[yearNum][activeBranch] || []).map((cls) => (
                                      <div key={cls.id} className="section-schedule-card">
                                        <div className="section-card-header">
                                          <div className="section-title-wrap">
                                            <span className="section-tag">Section {cls.section}</span>
                                            <span className="section-room-tag">
                                              Default Theory Room: <strong>{cls.defaultRoom}</strong>
                                            </span>
                                          </div>
                                          <Link
                                            to={`/admin/designer/${cls.id}`}
                                            className="button button--mini button--secondary"
                                            title="Open in Timetable Designer"
                                          >
                                            Open in Designer &rarr;
                                          </Link>
                                        </div>

                                        {/* Weekly Mini-Grid with Rooms on every cell */}
                                        <div className="section-matrix-table-wrap">
                                          <table className="mini-schedule-table">
                                            <thead>
                                              <tr>
                                                <th scope="col" style={{ width: '100px' }}>Day</th>
                                                {(matrixData.periods || []).map((p, pIdx) => (
                                                  <th key={pIdx} scope="col">
                                                    <div>{p.isBreak ? 'BREAK' : (p.name || `P${p.periodNumber || pIdx + 1}`)}</div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.8 }}>
                                                      {p.startTime}&ndash;{p.endTime}
                                                    </div>
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(cls.days || []).map((d) => (
                                                <tr key={d.day}>
                                                  <th scope="row" className="day-col-header">{d.dayName}</th>
                                                  {(matrixData.periods || []).map((period, pIdx) => {
                                                    const slot = d.slots.find((s) => s.startTime === period.startTime)
                                                    if (!slot) {
                                                      return <td key={pIdx} className="mini-slot-empty">&mdash;</td>
                                                    }
                                                    const isBreak = slot.subject?.isBreak || slot.subject?.code === 'LUNCH'
                                                    return (
                                                      <td
                                                        key={pIdx}
                                                        className={`mini-slot-cell ${isBreak ? 'mini-slot-break' : ''}`}
                                                      >
                                                        <div className="mini-slot-code">
                                                          {slot.subject?.code || '---'}
                                                          {slot.subject?.electiveTag && (
                                                            <span className="elective-tag-badge mini-elective-tag" style={{ marginLeft: '0.25rem', fontSize: '0.6rem' }}>
                                                              {slot.subject.electiveTag}
                                                            </span>
                                                          )}
                                                        </div>
                                                        <div className="mini-slot-room-badge" title="Physical Room">
                                                          {slot.room || 'TBA'}
                                                        </div>
                                                        {slot.faculty && (
                                                          <div className="mini-slot-faculty" title={slot.faculty.name}>
                                                            {slot.faculty.name.split(' ').slice(0, 2).join(' ')}
                                                          </div>
                                                        )}
                                                      </td>
                                                    )
                                                  })}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </div>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: ROOM UTILIZATION DIRECTORY */}
        {activeView === 'rooms' && (
          <div className="monitor-rooms-view">
            {loading ? (
              <div className="schedule-state schedule-loading">
                <span className="loading-rule" aria-hidden="true" />
                <p>Auditing room occupancy across campus…</p>
              </div>
            ) : !liveData?.roomOccupancy || liveData.roomOccupancy.length === 0 ? (
              <div className="schedule-empty-state">
                <p>No active classrooms or laboratories currently registered as occupied at {selectedTime}.</p>
              </div>
            ) : (
              <div className="rooms-grid">
                {liveData.roomOccupancy.map((roomItem) => (
                  <div key={roomItem.room} className="room-occupancy-card">
                    <div className="room-card-header">
                      <div className="room-number-wrap">
                        <span className="room-icon-large">🚪</span>
                        <h3 className="room-number">{roomItem.room}</h3>
                      </div>
                      <span className="badge badge--success">OCCUPIED</span>
                    </div>

                    <div className="room-card-sessions">
                      {roomItem.sessions.map((sess, idx) => (
                        <div key={idx} className="room-session-entry">
                          <div className="room-session-class">
                            <strong>{sess.classLabel}</strong>
                            <span className="room-session-time">{sess.startTime} &ndash; {sess.endTime}</span>
                          </div>
                          <div className="room-session-subject">
                            {sess.subject?.code}: {sess.subject?.name}
                          </div>
                          <div className="room-session-faculty">
                            {sess.faculty ? `Teacher: ${sess.faculty.name}` : 'Unassigned'}
                            {sess.batchBFaculty ? ` & ${sess.batchBFaculty.name}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
