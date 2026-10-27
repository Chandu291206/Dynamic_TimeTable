import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FacultyDetailsDialog from '../components/FacultyDetailsDialog.jsx'
import TimetableGrid from '../components/TimetableGrid.jsx'
import TimetableSkeleton from '../components/TimetableSkeleton.jsx'
import WeeklyTimetableGrid from '../components/WeeklyTimetableGrid.jsx'
import useTimetable from '../hooks/useTimetable.js'
import useWeeklyTimetable from '../hooks/useWeeklyTimetable.js'

function todayIso() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function formatDay(date) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function formatWeekRange(startStr, endStr) {
  if (!startStr || !endStr) return ''
  try {
    const start = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${startStr}T12:00:00`))
    const end = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${endStr}T12:00:00`))
    return `Week of ${start} – ${end}`
  } catch {
    return `${startStr} to ${endStr}`
  }
}

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

function isCurrentWeek(startStr, endStr) {
  const today = todayIso()
  return startStr && endStr && today >= startStr && today <= endStr
}

export default function TimetablePage() {
  const { classId } = useParams()
  const [viewMode, setViewMode] = useState('day') // 'day' | 'week'
  const [date, setDate] = useState(todayIso)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedSlotDay, setSelectedSlotDay] = useState('')
  const triggerRef = useRef(null)

  const daily = useTimetable(viewMode === 'day' ? classId : null, date)
  const weekly = useWeeklyTimetable(viewMode === 'week' ? classId : null, date)

  const activeStatus = viewMode === 'day' ? daily.status : weekly.status
  const activeRetry = viewMode === 'day' ? daily.retry : weekly.retry
  const classLabel = (viewMode === 'day' ? daily.data?.class?.label : weekly.data?.class?.label) || 'Class timetable'

  const currentToday = todayIso()
  const isToday = date === currentToday
  const dayLabel = formatDay(date)
  const isSunday = new Date(`${date}T12:00:00`).getDay() === 0

  const weekRangeLabel = formatWeekRange(weekly.data?.weekStart, weekly.data?.weekEnd)
  const isThisWeek = isCurrentWeek(weekly.data?.weekStart, weekly.data?.weekEnd)

  const totalWeeklySessions = weekly.data?.days?.reduce((acc, d) => acc + (d.slots?.length || 0), 0) || 0
  const hasWeeklyOverrides = weekly.data?.days?.some((d) => d.slots?.some((s) => s.isOverride)) || false

  const openDetails = (slot, dayOverride) => {
    triggerRef.current = document.activeElement
    setSelectedSlot(slot)
    setSelectedSlotDay(dayOverride || dayLabel)
  }

  return (
    <section className={`timetable-page ${viewMode === 'week' ? 'timetable-page--week' : ''}`} aria-labelledby="timetable-heading">
      <div className={`timetable-wrap ${viewMode === 'week' ? 'timetable-wrap--week' : ''}`}>
        <div className="timetable-top-bar">
          <Link className="back-link" to="/">
            ← All classes
          </Link>

          <div className="view-mode-toggle" role="tablist" aria-label="Timetable view mode">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'day'}
              className={`view-mode-btn ${viewMode === 'day' ? 'is-active' : ''}`}
              onClick={() => setViewMode('day')}
            >
              Day view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'week'}
              className={`view-mode-btn ${viewMode === 'week' ? 'is-active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Entire week
            </button>
          </div>
        </div>

        <header className="timetable-header timetable-header-sticky">
          <div className="timetable-title-group">
            <div className="timetable-meta-badges">
              <span className="kicker">
                {viewMode === 'day' ? 'Daily schedule' : 'Weekly schedule'}
              </span>
              {viewMode === 'day' && isToday && <span className="today-badge">Today</span>}
              {viewMode === 'week' && isThisWeek && <span className="today-badge">This week</span>}
            </div>
            <h1 id="timetable-heading">{classLabel}</h1>
            <p className="weekday-display">
              {viewMode === 'day' ? dayLabel : weekRangeLabel || 'Full week schedule'}
            </p>
          </div>

          <div className="timetable-controls">
            <div className="date-nav-buttons">
              <button
                type="button"
                className="date-nav-btn"
                onClick={() => setDate((curr) => shiftDate(curr, viewMode === 'day' ? -1 : -7))}
                title={viewMode === 'day' ? 'Previous day' : 'Previous week'}
                aria-label={viewMode === 'day' ? 'Previous day' : 'Previous week'}
              >
                ‹
              </button>
              {viewMode === 'day' && !isToday && (
                <button
                  type="button"
                  className="today-shortcut-btn"
                  onClick={() => setDate(todayIso())}
                  title="Jump to today's schedule"
                >
                  Today
                </button>
              )}
              {viewMode === 'week' && !isThisWeek && (
                <button
                  type="button"
                  className="today-shortcut-btn"
                  onClick={() => setDate(todayIso())}
                  title="Jump to current week"
                >
                  This week
                </button>
              )}
              <button
                type="button"
                className="date-nav-btn"
                onClick={() => setDate((curr) => shiftDate(curr, viewMode === 'day' ? 1 : 7))}
                title={viewMode === 'day' ? 'Next day' : 'Next week'}
                aria-label={viewMode === 'day' ? 'Next day' : 'Next week'}
              >
                ›
              </button>
            </div>

            <label className="date-field">
              <span>{viewMode === 'day' ? 'Schedule date' : 'Reference date'}</span>
              <input
                type="date"
                required
                value={date}
                onChange={(event) => {
                  if (event.target.value) {
                    setDate(event.target.value)
                  }
                }}
              />
            </label>
          </div>
        </header>

        {activeStatus === 'loading' && <TimetableSkeleton rows={5} />}

        {activeStatus === 'error' && (
          <div className="schedule-state schedule-error" role="alert">
            <p className="kicker">Connection error</p>
            <h2>The timetable could not be reached.</h2>
            <p>Check your network connection and try again.</p>
            <button type="button" className="button" onClick={activeRetry}>
              Retry loading
            </button>
          </div>
        )}

        {activeStatus === 'notFound' && (
          <div className="schedule-state">
            <p className="kicker">Class unavailable</p>
            <h2>We couldn’t find this class.</h2>
            <p>
              The link may be out of date. Return to the class list and choose a
              published timetable.
            </p>
            <Link className="button" to="/">
              Browse classes
            </Link>
          </div>
        )}

        {/* DAY VIEW CONTENT */}
        {viewMode === 'day' && activeStatus === 'ready' && (isSunday || daily.data.slots.length === 0) && (
          <div className="schedule-state schedule-empty">
            <div className="empty-state-badge" aria-hidden="true">
              {isSunday ? '☀' : '📅'}
            </div>
            <p className="kicker">{isSunday ? 'Sunday' : 'No sessions listed'}</p>
            <h2>{isSunday ? 'No teaching is scheduled today.' : 'The day is clear.'}</h2>
            <p>
              {isSunday
                ? 'Academic timetable runs Monday through Saturday. Look ahead or toggle to Entire Week to view scheduled classes.'
                : 'No recurring or override sessions have been scheduled for this date. Check another date or switch to Entire Week.'}
            </p>
            <div className="empty-state-actions">
              {isSunday ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => setDate((curr) => shiftDate(curr, 1))}
                >
                  View Monday schedule →
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  onClick={() => setViewMode('week')}
                >
                  View entire week →
                </button>
              )}
              <Link className="button button--secondary" to="/">
                Choose another class
              </Link>
            </div>
          </div>
        )}

        {viewMode === 'day' && activeStatus === 'ready' && !isSunday && daily.data.slots.length > 0 && (
          <>
            <div className="schedule-summary-bar">
              <p className="schedule-count">
                <b>{daily.data.slots.length}</b>{' '}
                {daily.data.slots.length === 1 ? 'session' : 'sessions'} in order of start time{' '}
                <span aria-hidden="true">·</span> Click any session for faculty profile & details
              </p>
              {daily.data.slots.some((s) => s.isOverride) && (
                <span className="override-legend-indicator">
                  <span className="legend-dot is-override" aria-hidden="true" />
                  Contains date-specific override
                </span>
              )}
            </div>
            <TimetableGrid
              slots={daily.data.slots}
              onOpen={(slot) => openDetails(slot, dayLabel)}
              isToday={isToday}
            />
          </>
        )}

        {/* WEEK VIEW CONTENT */}
        {viewMode === 'week' && activeStatus === 'ready' && totalWeeklySessions === 0 && (
          <div className="schedule-state schedule-empty">
            <div className="empty-state-badge" aria-hidden="true">
              📅
            </div>
            <p className="kicker">Empty week</p>
            <h2>No teaching sessions scheduled for this week.</h2>
            <p>
              There are no classes found in the weekly timetable for the week of{' '}
              {weekly.data?.weekStart} to {weekly.data?.weekEnd}.
            </p>
            <div className="empty-state-actions">
              <button
                type="button"
                className="button"
                onClick={() => setDate(todayIso())}
              >
                Go to current week
              </button>
              <Link className="button button--secondary" to="/">
                Choose another class
              </Link>
            </div>
          </div>
        )}

        {viewMode === 'week' && activeStatus === 'ready' && totalWeeklySessions > 0 && (
          <>
            <div className="schedule-summary-bar">
              <p className="schedule-count">
                <b>{totalWeeklySessions}</b> total {totalWeeklySessions === 1 ? 'session' : 'sessions'} across Monday – Saturday{' '}
                <span aria-hidden="true">·</span> Click any class card for full faculty profile & room info
              </p>
              {hasWeeklyOverrides && (
                <span className="override-legend-indicator">
                  <span className="legend-dot is-override" aria-hidden="true" />
                  Contains date-specific override
                </span>
              )}
            </div>
            <WeeklyTimetableGrid
              weeklyData={weekly.data}
              onOpen={openDetails}
              todayIso={currentToday}
            />
          </>
        )}
      </div>

      <FacultyDetailsDialog
        slot={selectedSlot}
        day={selectedSlotDay || dayLabel}
        onClose={() => setSelectedSlot(null)}
        triggerRef={triggerRef}
      />
    </section>
  )
}
