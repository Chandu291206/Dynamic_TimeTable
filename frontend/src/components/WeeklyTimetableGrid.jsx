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

  // Fallback periods if none provided in data
  const effectivePeriods = periods.length > 0 ? periods : [
    { startTime: '09:00', endTime: '09:50' },
    { startTime: '09:50', endTime: '10:40' },
    { startTime: '10:40', endTime: '11:30' },
    { startTime: '11:30', endTime: '12:20' },
    { startTime: '12:20', endTime: '13:10' },
    { startTime: '14:00', endTime: '14:50' },
    { startTime: '14:50', endTime: '15:40' },
    { startTime: '15:40', endTime: '16:30' },
  ]

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
          <span className="banner-value">Theory: Room 1302</span>
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
                const isLunchPeriod =
                  period.startTime === '12:20' ||
                  period.startTime === '12:55' ||
                  (period.startTime >= '12:20' && period.endTime <= '13:30')
                return (
                  <th
                    key={`${period.startTime}-${period.endTime}-${pIdx}`}
                    scope="col"
                    className={`matrix-th-period ${isLunchPeriod ? 'matrix-th-lunch' : ''}`}
                  >
                    <span className="matrix-th-time">
                      {period.startTime} - {period.endTime}
                    </span>
                    {isLunchPeriod && <span className="matrix-th-sub">Lunch Break</span>}
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
                    // Match slot that corresponds to this period
                    const slot = dayObj.slots?.find(
                      (s) =>
                        s.startTime === period.startTime ||
                        (s.startTime <= period.startTime && s.endTime >= period.endTime)
                    )

                    const isLunchSlot =
                      slot?.subject?.name?.trim().toUpperCase() === 'LUNCH' ||
                      (!slot &&
                        (period.startTime === '12:20' ||
                          period.startTime === '12:55' ||
                          (period.startTime >= '12:20' && period.endTime <= '13:10')))

                    if (isLunchSlot) {
                      return (
                        <td
                          key={`lunch-${pIdx}`}
                          className="matrix-td-cell matrix-td-lunch"
                        >
                          <span className="matrix-lunch-label">LUNCH</span>
                        </td>
                      )
                    }

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
