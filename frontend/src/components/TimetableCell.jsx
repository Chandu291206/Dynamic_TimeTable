import FacultyAvatar from './FacultyAvatar.jsx'

export default function TimetableCell({ slot, onOpen, isCurrent = false }) {
  const subject = slot.subject?.name || '---'
  const faculty = slot.faculty?.name || 'TBA'
  const time = `${slot.startTime} – ${slot.endTime}`

  return (
    <button
      type="button"
      className={`timetable-cell${slot.isOverride ? ' is-override' : ''}${isCurrent ? ' is-current' : ''}`}
      onClick={() => onOpen(slot)}
      aria-label={`${isCurrent ? 'Now in session: ' : ''}${time}, ${subject}, ${faculty}. View class details`}
    >
      <span className="cell-time">{time}</span>
      <span className="cell-subject">{subject}</span>
      <span className="cell-faculty">
        <FacultyAvatar faculty={slot.faculty} />
        <span>{faculty}</span>
      </span>
      <div className="cell-badges">
        {isCurrent && <span className="current-badge">Now</span>}
        {slot.isOverride && <span className="override-badge">Override</span>}
      </div>
      <span className="cell-arrow" aria-hidden="true">↗</span>
    </button>
  )
}
