function formatDate(dateStr) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${dateStr}T12:00:00`))
  } catch {
    return dateStr
  }
}

export default function OverrideList({ overrides = [], loading = false, onDelete }) {
  if (loading) {
    return (
      <div className="override-list-card">
        <h2 className="section-title">Upcoming Overrides</h2>
        <div className="schedule-state schedule-loading" role="status">
          <span className="loading-rule" aria-hidden="true" />
          <p>Loading upcoming class overrides…</p>
        </div>
      </div>
    )
  }

  const handleDelete = (id, label) => {
    if (window.confirm(`Are you sure you want to delete this override for ${label}? The regular timetable slot will be restored.`)) {
      onDelete?.(id)
    }
  }

  return (
    <div className="override-list-card">
      <header className="override-list-header">
        <h2 className="section-title">Upcoming Overrides</h2>
        <span className="badge-count">{overrides.length} scheduled</span>
      </header>

      {overrides.length === 0 ? (
        <div className="empty-overrides-state">
          <div className="empty-icon" aria-hidden="true">📅</div>
          <h3>No upcoming overrides</h3>
          <p>Your class is currently following the regular recurring timetable with no overrides applied for the next 7 days.</p>
        </div>
      ) : (
        <ul className="override-items-list" aria-label="Upcoming timetable overrides">
          {overrides.map((override) => {
            const subjectName = override.subject?.name || '---'
            const facultyName = override.faculty?.name || 'TBA'
            const timeString = `${override.startTime} – ${override.endTime}`
            const dateDisplay = formatDate(override.date)

            return (
              <li key={override.id} className="override-item">
                <div className="override-item-left">
                  <span className="override-badge">Override</span>
                  <div className="override-item-date">
                    <b>{dateDisplay}</b>
                    <span className="override-time">{timeString}</span>
                  </div>
                </div>

                <div className="override-item-details">
                  <span className="override-subject">{subjectName}</span>
                  <span className="override-faculty">Faculty: {facultyName}</span>
                </div>

                {onDelete && (
                  <button
                    type="button"
                    className="button button--danger override-delete-btn"
                    title="Delete override"
                    onClick={() => handleDelete(override.id, `${dateDisplay} (${timeString})`)}
                    aria-label={`Delete override for ${dateDisplay} ${timeString}`}
                  >
                    Delete
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
