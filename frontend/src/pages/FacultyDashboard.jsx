import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getFacultyDashboard, scrapeMyFacultyProfile } from '../api/faculty.js'
import FacultyAvatar from '../components/FacultyAvatar.jsx'
import { useToast } from '../components/Toast.jsx'
import useAuth from '../hooks/useAuth.js'

const DAYS = [
  { day: 0, name: 'Monday', short: 'Mon' },
  { day: 1, name: 'Tuesday', short: 'Tue' },
  { day: 2, name: 'Wednesday', short: 'Wed' },
  { day: 3, name: 'Thursday', short: 'Thu' },
  { day: 4, name: 'Friday', short: 'Fri' },
  { day: 5, name: 'Saturday', short: 'Sat' },
]

export default function FacultyDashboard() {
  const navigate = useNavigate()
  const { user, loading: authLoading, logout } = useAuth()
  const { showToast } = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [error, setError] = useState('')
  const [activeView, setActiveView] = useState('timetable') // 'timetable' | 'slots'

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getFacultyDashboard()
      setData(res.data)
    } catch (err) {
      setError(err.message || 'Failed to load your faculty schedule.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/admin/login', { replace: true })
      } else if (user.role === 'ADMIN' || user.role === 'HOD') {
        navigate('/admin/dashboard', { replace: true })
      } else if (user.role === 'CR') {
        navigate('/cr/dashboard', { replace: true })
      } else if (user.role === 'FACULTY') {
        loadDashboard()
      }
    }
  }, [authLoading, user, navigate, loadDashboard])

  const handleScrapeProfile = async () => {
    setScraping(true)
    setError('')
    try {
      const res = await scrapeMyFacultyProfile()
      setData((prev) => (prev ? { ...prev, faculty: res.data?.faculty || prev.faculty } : prev))
      showToast('Your official faculty profile and photo have been refreshed.', 'success')
    } catch (err) {
      setError(err.message || 'Failed to scrape your profile from GRIET website.')
    } finally {
      setScraping(false)
    }
  }

  const handleSignOut = async () => {
    await logout()
    navigate('/admin/login')
  }

  const periods = useMemo(() => {
    const base = data?.periods || []
    if (base.length > 0) return base
    const map = new Map()
    for (const s of data?.slots || []) {
      const key = `${s.startTime}-${s.endTime}`
      if (!map.has(key)) map.set(key, { startTime: s.startTime, endTime: s.endTime })
    }
    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [data])

  const slotLookup = useMemo(() => {
    const map = new Map()
    for (const s of data?.slots || []) {
      const key = `${s.day}|${s.startTime}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return map
  }, [data])

  if (authLoading || loading) {
    return (
      <section className="admin-dashboard-page" aria-busy="true">
        <div className="admin-dashboard-wrap">
          <div className="schedule-state schedule-loading" role="status">
            <span className="loading-rule" aria-hidden="true" />
            <p>Loading your faculty timetable…</p>
          </div>
        </div>
      </section>
    )
  }

  const faculty = data?.faculty
  const slots = data?.slots || []

  return (
    <section className="admin-dashboard-page" aria-labelledby="faculty-dash-heading">
      <div className="admin-dashboard-wrap">
        <header className="admin-dashboard-header">
          <div className="admin-header-left">
            <p className="kicker">Faculty Workspace</p>
            <h1 id="faculty-dash-heading">{faculty?.name || user?.username || 'Faculty Dashboard'}</h1>
            <div className="admin-assigned-tag">
              <span>Staff ID:</span>
              <b>{faculty?.staffId || '—'}</b>
              {faculty?.department && <span className="role-tag">{faculty.department}</span>}
              {faculty?.designation && <span className="badge-count">{faculty.designation}</span>}
            </div>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={handleScrapeProfile}
              disabled={scraping}
            >
              {scraping ? 'Scraping Profile…' : '🌐 Scrape My Profile'}
            </button>
            <Link className="button button--secondary" to="/timetables">
              All Timetables ↗
            </Link>
            <button type="button" className="button sign-out-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="form-error-alert" role="alert" style={{ marginBottom: '1rem' }}>
            <span aria-hidden="true">⚠</span>
            <p>{error}</p>
          </div>
        )}

        {/* Faculty Profile Card */}
        {faculty && (
          <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.25rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <FacultyAvatar faculty={faculty} size="large" />
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem' }}>{faculty.name}</h2>
                <p style={{ margin: 0, color: '#5c554c', fontSize: '0.92rem' }}>
                  {[faculty.designation, faculty.department, faculty.qualification].filter(Boolean).join(' · ') || 'Faculty Member'}
                </p>
                {faculty.email && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                    <a href={`mailto:${faculty.email}`} className="text-link">{faculty.email}</a>
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="badge-count">{slots.length} assigned {slots.length === 1 ? 'slot' : 'slots'}</span>
              {faculty.profileSourceUrl && (
                <a
                  href={faculty.profileSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button--secondary"
                >
                  Official GRIET Profile ↗
                </a>
              )}
            </div>
          </div>
        )}

        {/* View Toggle */}
        <nav className="admin-nav-tabs" role="tablist" aria-label="Faculty Schedule Views">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'timetable'}
            className={`admin-nav-tab ${activeView === 'timetable' ? 'active' : ''}`}
            onClick={() => setActiveView('timetable')}
          >
            <span className="tab-icon" aria-hidden="true">📅</span>
            <span>Timetable Layout</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'slots'}
            className={`admin-nav-tab ${activeView === 'slots' ? 'active' : ''}`}
            onClick={() => setActiveView('slots')}
          >
            <span className="tab-icon" aria-hidden="true">⏱</span>
            <span>Timetable Slots ({slots.length})</span>
          </button>
        </nav>

        <main className="admin-tab-content" role="tabpanel">
          {slots.length === 0 ? (
            <div className="admin-empty-card">
              <h3>No classes assigned yet</h3>
              <p>You currently have no timetable slots assigned to your faculty profile.</p>
            </div>
          ) : activeView === 'timetable' ? (
            <div className="admin-table-wrapper">
              <table className="admin-table" aria-label="Faculty Weekly Timetable">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    {periods.map((p) => (
                      <th key={`${p.startTime}-${p.endTime}`} scope="col">
                        <div>{p.name || `P${p.period || ''}`}</div>
                        <small style={{ fontWeight: 400, color: '#6b6358' }}>
                          {p.startTime}–{p.endTime}
                        </small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d.day}>
                      <td><b>{d.name}</b></td>
                      {periods.map((p) => {
                        const cellSlots = slotLookup.get(`${d.day}|${p.startTime}`) || []
                        return (
                          <td key={`${d.day}-${p.startTime}`} style={{ verticalAlign: 'top', minWidth: '140px' }}>
                            {cellSlots.length === 0 ? (
                              <span style={{ color: '#b5aa99' }}>—</span>
                            ) : (
                              cellSlots.map((s) => (
                                <div
                                  key={s.id}
                                  style={{
                                    padding: '0.4rem 0.5rem',
                                    background: '#fbf8f3',
                                    border: '1px solid #e2d8c7',
                                    borderRadius: '6px',
                                    marginBottom: '0.25rem',
                                    fontSize: '0.82rem',
                                  }}
                                >
                                  <div>
                                    <b>{s.subject?.code || s.subject?.name || 'Class'}</b>
                                    {s.batch !== 'All' && (
                                      <span className="badge-count" style={{ marginLeft: '0.35rem', fontSize: '0.7rem' }}>
                                        {s.batch}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ color: '#4a433b', marginTop: '0.15rem' }}>
                                    {s.class ? (
                                      <Link to={`/timetable/${s.class.id}`} className="text-link">
                                        Y{s.class.year} · {s.class.branch} · Sec {s.class.section}
                                      </Link>
                                    ) : '—'}
                                  </div>
                                  {s.room && (
                                    <div style={{ color: '#6e655a', fontSize: '0.76rem' }}>
                                      Room {s.room}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-table-wrapper admin-table-scroll">
              <table className="admin-table" aria-label="Assigned Timetable Slots">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Time</th>
                    <th scope="col">Year</th>
                    <th scope="col">Class / Branch</th>
                    <th scope="col">Section</th>
                    <th scope="col">Subject</th>
                    <th scope="col">Room</th>
                    <th scope="col">Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.dayName}</b></td>
                      <td><code>{s.startTime} – {s.endTime}</code></td>
                      <td>{s.class ? `Year ${s.class.year}` : '—'}</td>
                      <td>
                        {s.class ? (
                          <Link to={`/timetable/${s.class.id}`} className="text-link">
                            {s.class.branch}
                          </Link>
                        ) : '—'}
                      </td>
                      <td>{s.class ? `Sec ${s.class.section}` : '—'}</td>
                      <td>
                        <b>{s.subject?.code || '—'}</b>
                        {s.subject?.name && s.subject.name !== s.subject.code && (
                          <span style={{ color: '#5c554c', marginLeft: '0.4rem' }}>{s.subject.name}</span>
                        )}
                      </td>
                      <td>{s.room || 'TBA'}</td>
                      <td><span className="badge-count">{s.batch}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </section>
  )
}
