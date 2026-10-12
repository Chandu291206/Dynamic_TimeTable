import { useEffect, useId, useRef } from 'react'
import FacultyAvatar from './FacultyAvatar.jsx'

export default function FacultyDetailsDialog({ slot, day, onClose, triggerRef }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const faculty = slot?.faculty

  useEffect(() => {
    if (!slot) return undefined
    const triggeringElement = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      triggeringElement?.focus()
    }
  }, [slot, onClose, triggerRef])

  if (!slot) return null
  const fields = [
    ['Staff ID', faculty?.staffId],
    ['Designation', faculty?.designation],
    ['Department', faculty?.department],
    ['Qualification', faculty?.qualification],
    ['Email', faculty?.email],
    ['Phone', faculty?.phone],
  ].filter(([, value]) => value)

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="faculty-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex="-1" ref={dialogRef}>
      <button type="button" className="dialog-close" onClick={onClose} aria-label="Close class details">×</button>
      <p className="dialog-eyebrow">Faculty & session</p>
      <div className="dialog-profile"><FacultyAvatar faculty={faculty} size="large" /><div><h2 id={titleId}>{faculty?.name || 'Faculty to be announced'}</h2>{faculty?.designation && <p>{faculty.designation}</p>}</div></div>
      <dl className="dialog-details">
        <div><dt>Subject</dt><dd>{slot.subject?.name || '---'}</dd></div>
        <div><dt>Session</dt><dd>{day} · {slot.startTime} – {slot.endTime}</dd></div>
        {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        {faculty?.profileSourceUrl && (
          <div>
            <dt>Web Profile</dt>
            <dd>
              <a
                href={faculty.profileSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="badge-profile-link"
              >
                🔗 View Official Web Profile ↗
              </a>
            </dd>
          </div>
        )}
        {slot.isOverride && <div className="dialog-override"><dt>Schedule note</dt><dd><span className="override-badge">Override</span> Updated for this date</dd></div>}
      </dl>
    </section>
  </div>
}
