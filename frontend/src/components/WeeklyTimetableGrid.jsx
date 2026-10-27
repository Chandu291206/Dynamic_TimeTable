import FacultyAvatar from './FacultyAvatar.jsx'

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(`${dateStr}T12:00:00`)
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d)
  } catch {
    return dateStr
  }
}

function formatDayFull(dateStr, dayName) {
  if (!dateStr) return dayName
  try {
    const d = new Date(`${dateStr}T12:00:00`)
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return dayName
  }
}

function formatEffectiveDate(startStr) {
  if (!startStr) return 'Current Semester'
  try {
    const d = new Date(`${startStr}T12:00:00`)
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return startStr
  }
}

function formatTheoryRoom(theory, fallback = 'Room 1302') {
  if (!theory) return fallback
  if (typeof theory === 'string') return theory.startsWith('Room') ? theory : `Room ${theory}`
  if (typeof theory === 'object') {
    const rooms = Array.from(new Set(Object.values(theory).filter(Boolean)))
    if (rooms.length === 0) return fallback
    return `Room ${rooms.join(' / ')}`
  }
  return String(theory)
}

export default function WeeklyTimetableGrid({
  weeklyData,
  onOpen,
  todayIso,
}) {
  const classInfo = weeklyData?.class
  const periods = weeklyData?.periods || []
  const days = weeklyData?.days || []
  const courses = weeklyData?.courses || []
  const weekStart = weeklyData?.weekStart

  // Extract lunch period from class metadata if available
  const lunchHours = classInfo?.working_hours?.lunch || '12:20-12:55'
  const [lunchStart, lunchEnd] = lunchHours.split('-')

  // Build effective periods list, ensuring lunch break is inserted in order if missing
  let basePeriods = periods.length > 0 ? [...periods] : [
    { startTime: '09:00', endTime: '09:50', period: 1 },
    { startTime: '09:50', endTime: '10:40', period: 2 },
    { startTime: '10:40', endTime: '11:30', period: 3 },
    { startTime: '11:30', endTime: '12:20', period: 4 },
    { startTime: lunchStart, endTime: lunchEnd, period: 'LUNCH', isLunch: true },
    { startTime: '12:55', endTime: '13:45', period: 5 },
    { startTime: '13:45', endTime: '14:35', period: 6 },
    { startTime: '14:35', endTime: '15:25', period: 7 },
  ]

  const hasLunchPeriod = basePeriods.some(
    (p) =>
      p.isLunch ||
      p.period === 'LUNCH' ||
      (p.startTime === lunchStart && p.endTime === lunchEnd) ||
      (p.startTime === '12:20' && p.endTime === '12:55')
  )

  if (!hasLunchPeriod && lunchStart && lunchEnd) {
    basePeriods.push({
      startTime: lunchStart,
      endTime: lunchEnd,
      period: 'LUNCH',
      isLunch: true,
    })
  }

  const effectivePeriods = [...basePeriods].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  )

  function isLunchPeriod(p) {
    if (!p) return false
    if (p.isLunch || p.period === 'LUNCH') return true
    if (p.startTime === lunchStart && p.endTime === lunchEnd) return true
    if (p.startTime === '12:20' && (p.endTime === '12:55' || p.endTime === '13:00')) return true
    return false
  }

  // Default almanac entries matching GRIET academic calendar
  const almanacEntries = [
    { event: 'Commencement of Semester Classwork', timeline: 'July 2026' },
    { event: 'I Spell of Instructions', timeline: '8 Weeks' },
    { event: 'I Mid-term Examinations', timeline: '3 Days' },
    { event: 'II Spell of Instructions (incl. Vacation)', timeline: '9 Weeks' },
    { event: 'II Mid-term Examinations', timeline: '3 Days' },
    { event: 'Preparation Holidays & Semester End Exams', timeline: '3 Weeks' },
  ]

  return (
    <div className="weekly-institutional-container">
      {/* College / Class Official Timetable Header Banner */}
      <div className="weekly-banner-header">
        <div className="weekly-banner-item weekly-banner-ay">
          <span className="banner-kicker">Academic Year</span>
          <span className="banner-value">AY : 2026 - 27</span>
        </div>
        <div className="weekly-banner-item weekly-banner-class">
          <span className="banner-title">
            {classInfo?.label || 'College Class Timetable'}
          </span>
        </div>
        <div className="weekly-banner-item weekly-banner-wef">
          <span className="banner-kicker">w.e.f.</span>
          <span className="banner-value">{formatEffectiveDate(weekStart)}</span>
        </div>
        <div className="weekly-banner-item weekly-banner-room">
          <span className="banner-kicker">Hall / Lab</span>
          <span className="banner-value">Theory: {formatTheoryRoom(classInfo?.classroom?.theory)}</span>
        </div>
      </div>

      {/* Structured Day-by-Day Matrix (Days as Rows, Periods as Columns) */}
      <div className="weekly-matrix-scroll-wrap">
        <table className="weekly-matrix-table" aria-label="Entire week timetable matrix">
          <thead>
            <tr>
              <th scope="col" className="matrix-th-day">
                DAY
              </th>
              {effectivePeriods.map((period, pIdx) => {
                const isLunchCol = isLunchPeriod(period)
                return (
                  <th
                    key={`${period.startTime}-${period.endTime}-${pIdx}`}
                    scope="col"
                    className={`matrix-th-period ${isLunchCol ? 'matrix-th-lunch' : ''}`}
                  >
                    <span className="matrix-th-period-label">
                      {isLunchCol ? 'LUNCH' : `PERIOD ${period.period || pIdx + 1}`}
                    </span>
                    <span className="matrix-th-time">
                      {period.startTime} - {period.endTime}
                    </span>
                    {isLunchCol && <span className="matrix-th-sub">Break</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {days.map((dayObj) => {
              const isToday = dayObj.date === todayIso
              const fullDayLabel = formatDayFull(dayObj.date, dayObj.dayName)
              const shortDate = formatDateShort(dayObj.date)

              return (
                <tr
                  key={`${dayObj.day}-${dayObj.date}`}
                  className={`matrix-row ${isToday ? 'matrix-row--today' : ''}`}
                >
                  {/* Row Header: Day Name */}
                  <th scope="row" className="matrix-td-day">
                    <div className="matrix-day-cell-inner">
                      <span className="matrix-day-name">{dayObj.dayName}</span>
                      <span className="matrix-day-date">{shortDate}</span>
                      {isToday && <span className="today-badge">Today</span>}
                    </div>
                  </th>

                  {/* Period Cells */}
                  {effectivePeriods.map((period, pIdx) => {
                    const isLunchCol = isLunchPeriod(period)

                    if (isLunchCol) {
                      return (
                        <td
                          key={`lunch-${pIdx}`}
                          className="matrix-td-cell matrix-td-lunch"
                        >
                          <span className="matrix-lunch-label">LUNCH</span>
                        </td>
                      )
                    }

                    // Match non-lunch slot that corresponds to this period
                    const slot = dayObj.slots?.find(
                      (s) =>
                        s.subject?.name?.trim().toUpperCase() !== 'LUNCH' &&
                        (s.startTime === period.startTime ||
                          (s.startTime <= period.startTime && s.endTime >= period.endTime))
                    )

                    if (!slot) {
                      return (
                        <td
                          key={`empty-${pIdx}`}
                          className="matrix-td-cell matrix-td-empty"
                        >
                          <span className="matrix-empty-dash">—</span>
                        </td>
                      )
                    }

                    const subjectName = slot.subject?.name || '---'
                    const facultyName = slot.faculty?.name || ''

                    return (
                      <td
                        key={`${slot.id}-${pIdx}`}
                        className={`matrix-td-cell matrix-td-session ${
                          slot.isOverride ? 'matrix-td-override' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="matrix-slot-btn"
                          onClick={() => onOpen(slot, fullDayLabel)}
                          title={`${subjectName} (${slot.startTime} - ${slot.endTime}) · Click for faculty details`}
                          aria-label={`${subjectName}, ${slot.startTime} to ${slot.endTime}, faculty ${facultyName || 'TBA'}`}
                        >
                          <div className="matrix-slot-content">
                            <span className="matrix-slot-subject">{subjectName}</span>
                            {slot.faculty && (
                              <div className="matrix-slot-faculty">
                                <FacultyAvatar faculty={slot.faculty} size="small" />
                                <span className="matrix-slot-faculty-name" title={facultyName}>
                                  {facultyName}
                                </span>
                              </div>
                            )}
                            {slot.isOverride && (
                              <span className="override-badge matrix-override-badge">
                                Override
                              </span>
                            )}
                          </div>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Institutional Section: Course Directory & Almanac Tables */}
      <div className="weekly-bottom-grid">
        {/* Course Details Table (Course Code / Shortform, Course Name, Faculty) */}
        <section className="weekly-bottom-card" aria-labelledby="courses-heading">
          <div className="bottom-card-header">
            <h2 id="courses-heading" className="bottom-card-title">
              Course & Faculty Directory
            </h2>
            <span className="bottom-card-count">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'} listed
            </span>
          </div>

          <div className="bottom-table-wrap">
            <table className="directory-table">
              <thead>
                <tr>
                  <th scope="col">Course / Subject</th>
                  <th scope="col">Faculty Name</th>
                  <th scope="col">Staff ID / Designation</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="directory-empty">
                      No course assignments available.
                    </td>
                  </tr>
                ) : (
                  courses.map((course) => (
                    <tr key={course.id || course.name}>
                      <td className="directory-course-name">
                        <b>{course.name}</b>
                      </td>
                      <td className="directory-faculty-name">
                        {course.faculty ? (
                          <div className="directory-faculty-cell">
                            <FacultyAvatar faculty={course.faculty} size="small" />
                            {course.faculty.profileSourceUrl ? (
                              <a
                                href={course.faculty.profileSourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="faculty-link-inline"
                                title={`View ${course.faculty.name}'s official GRIET profile`}
                              >
                                {course.faculty.name} ↗
                              </a>
                            ) : (
                              <span>{course.faculty.name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="directory-muted">To be announced</span>
                        )}
                      </td>
                      <td className="directory-meta">
                        {course.faculty?.staffId ? (
                          <span className="directory-staff-id">
                            ID: {course.faculty.staffId}
                          </span>
                        ) : (
                          course.faculty?.designation || '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Academic Schedule & Almanac Table */}
        <section className="weekly-bottom-card" aria-labelledby="almanac-heading">
          <div className="bottom-card-header">
            <h2 id="almanac-heading" className="bottom-card-title">
              Academic Almanac & Schedule
            </h2>
            <span className="bottom-card-count">Semester Milestones</span>
          </div>

          <div className="bottom-table-wrap">
            <table className="directory-table almanac-table">
              <thead>
                <tr>
                  <th scope="col">Academic Milestone</th>
                  <th scope="col">Schedule / Duration</th>
                </tr>
              </thead>
              <tbody>
                {almanacEntries.map((entry, idx) => (
                  <tr key={idx}>
                    <td className="almanac-event">
                      <b>{entry.event}</b>
                    </td>
                    <td className="almanac-timeline">{entry.timeline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
