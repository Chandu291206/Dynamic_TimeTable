import FacultyAvatar from './FacultyAvatar.jsx'

export default function TimetableCell({ slot, onOpen, isCurrent = false }) {
  const isLunch = slot.subject?.name?.trim().toUpperCase() === 'LUNCH'
  const subject = isLunch ? 'LUNCH ' : (slot.subject?.name || '---')
  const faculty = isLunch ? '' : (slot.faculty?.name || 'TBA')
  const time = `${slot.startTime} – ${slot.endTime}`

  return (
    <button
      type="button"
      className={`timetable-cell${slot.isOverride ? ' is-override' : ''}${isCurrent ? ' is-current' : ''}${isLunch ? ' is-lunch' : ''}`}
      onClick={() => (!isLunch && onOpen ? onOpen(slot) : undefined)}
      disabled={isLunch}
      aria-label={`${isCurrent ? 'Now in session: ' : ''}${time}, ${subject}, ${faculty}.${isLunch ? '' : ' View class details'}`}
    >
      <div className={`timetable-cell-avatar-wrap${isLunch ? ' timetable-cell-avatar-wrap--lunch' : ''}`}>
        {isLunch ? (
          <span className="cell-lunch-glyph" role="img" aria-label="Lunch">
            🍽️
          </span>
        ) : (
          <FacultyAvatar faculty={slot.faculty} size="cell" />
        )}
      </div>
      <div className="timetable-cell-beside">
        <div className="cell-top-meta">
          <span className="cell-time-tag">{time}</span>
          <div className="cell-badges">
            {isCurrent && <span className="current-badge">Now</span>}
            {slot.isOverride && <span className="override-badge">Override</span>}
          </div>
        </div>
        <span className="cell-subject">{subject}</span>
        <span className="cell-faculty-name">{faculty}</span>
      </div>
      {!isLunch && <span className="cell-arrow" aria-hidden="true">↗</span>}
    </button>
  )
}
