import { useState, useMemo, useEffect } from 'react'
import { timesOverlap } from '../utils/time'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function DesignerCellEditor({
  cell,
  periods = [],
  subjects = [],
  faculty = [],
  busyMap = {},
  expectedVersion,
  onSave,
  onClear,
  onClose,
}) {
  const { day, startTime, slot } = cell
  const [subjectId, setSubjectId] = useState(slot?.subjectId ? String(slot.subjectId) : '')
  const [facultyId, setFacultyId] = useState(slot?.facultyId ? String(slot.facultyId) : '')
  const [batchBFacultyId, setBatchBFacultyId] = useState(slot?.batchBFacultyId ? String(slot.batchBFacultyId) : '')
  const [room, setRoom] = useState(slot?.room || '')
  const [spanCount, setSpanCount] = useState(1)
  const [facultySearch, setFacultySearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [clashes, setClashes] = useState([])

  // Find period starting at this startTime
  const currentPeriodIdx = periods.findIndex((p) => p.startTime === startTime)
  const currentPeriod = currentPeriodIdx >= 0 ? periods[currentPeriodIdx] : null

  // Determine span options (up to 3 periods without passing end of day)
  const spanOptions = useMemo(() => {
    if (currentPeriodIdx < 0) {
      return [{ count: 1, endTime: cell.endTime || '10:00', label: '1 Period' }]
    }

    const options = []
    for (let count = 1; count <= 3; count++) {
      const targetIdx = currentPeriodIdx + count - 1
      if (targetIdx < periods.length) {
        const targetPeriod = periods[targetIdx]
        options.push({
          count,
          endTime: targetPeriod.endTime,
          label: count === 1 ? `1 Period (${currentPeriod.startTime}–${targetPeriod.endTime})` : `${count} Periods [Lab] (${currentPeriod.startTime}–${targetPeriod.endTime})`,
        })
      }
    }
    return options
  }, [currentPeriodIdx, periods, cell.endTime, currentPeriod])

  // Initialize span count from existing slot endTime
  useEffect(() => {
    if (slot?.endTime && spanOptions.length > 0) {
      const matched = spanOptions.find((opt) => opt.endTime === slot.endTime)
      if (matched) {
        setSpanCount(matched.count)
      }
    }
  }, [slot, spanOptions])

  // Effective end time based on selected span
  const currentSpan = spanOptions.find((opt) => opt.count === spanCount) || spanOptions[0]
  const effectiveEndTime = currentSpan ? currentSpan.endTime : (cell.endTime || '09:50')

  // Selected subject break status
  const selectedSubject = useMemo(() => {
    if (!subjectId) return null
    return subjects.find((s) => s.id === Number(subjectId)) || null
  }, [subjectId, subjects])

  const isBreak = selectedSubject?.isBreak || selectedSubject?.code === 'LUNCH'

  // If break subject selected, clear faculty
  useEffect(() => {
    if (isBreak) {
      setFacultyId('')
      setBatchBFacultyId('')
    }
  }, [isBreak])

  // Check busy status for a faculty member during this cell's window
  function getFacultyConflict(fId) {
    if (!fId || !busyMap[fId]) return null
    const busySlots = busyMap[fId]
    const targetRange = { startTime, endTime: effectiveEndTime }

    for (const b of busySlots) {
      if (b.day === day && timesOverlap(targetRange, b)) {
        return b
      }
    }
    return null
  }

  // Filtered faculty list
  const filteredFaculty = useMemo(() => {
    const q = facultySearch.trim().toLowerCase()
    return faculty.filter((f) => {
      if (!q) return true
      return (
        f.name.toLowerCase().includes(q) ||
        (f.staffId && f.staffId.toLowerCase().includes(q)) ||
        (f.department && f.department.toLowerCase().includes(q))
      )
    })
  }, [faculty, facultySearch])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    setClashes([])
    setSaving(true)

    try {
      await onSave({
        day,
        startTime,
        endTime: effectiveEndTime,
        room: room.trim() || null,
        subjectId: subjectId ? Number(subjectId) : null,
        facultyId: isBreak ? null : (facultyId ? Number(facultyId) : null),
        batchBFacultyId: isBreak ? null : (batchBFacultyId ? Number(batchBFacultyId) : null),
        expectedVersion,
      })
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save cell')
      if (err.clashes && Array.isArray(err.clashes)) {
        setClashes(err.clashes)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Clear this timetable slot?')) return
    setErrorMsg(null)
    setSaving(true)
    try {
      await onClear({ day, startTime, expectedVersion })
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to clear cell')
    } finally {
      setSaving(false)
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="designer-modal-backdrop" onClick={onClose}>
      <div
        className="designer-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <header className="designer-modal-header">
          <div>
            <h3 id="editor-title">
              {slot ? 'Edit Timetable Slot' : 'Assign Timetable Slot'}
            </h3>
            <p className="designer-cell-time-indicator">
              <strong>{DAY_NAMES[day]}</strong> &middot; {startTime} &ndash; {effectiveEndTime}
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </header>

        {errorMsg && (
          <div className="notice-banner notice-banner--danger" role="alert">
            <p><strong>Save Blocked:</strong> {errorMsg}</p>
            {clashes.length > 0 && (
              <ul className="designer-clash-list">
                {clashes.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="designer-cell-form">
          {/* Subject Field */}
          <div className="form-group">
            <label htmlFor="slot-subject-select">Subject / Course *</label>
            <select
              id="slot-subject-select"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            >
              <option value="">&mdash; Choose Subject &mdash;</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} &mdash; {s.name} {s.isBreak ? '(Break)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Span Control for Labs */}
          {spanOptions.length > 1 && (
            <div className="form-group">
              <label htmlFor="slot-span-select">Slot Duration / Period Span</label>
              <select
                id="slot-span-select"
                value={spanCount}
                onChange={(e) => setSpanCount(Number(e.target.value))}
              >
                {spanOptions.map((opt) => (
                  <option key={opt.count} value={opt.count}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Faculty (Batch A) */}
          {!isBreak && (
            <>
              <div className="form-group">
                <label htmlFor="slot-faculty-select">Faculty (Primary / Batch A)</label>
                {faculty.length > 10 && (
                  <input
                    type="search"
                    placeholder="Filter faculty list..."
                    className="faculty-search-input"
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                  />
                )}
                <select
                  id="slot-faculty-select"
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                >
                  <option value="">&mdash; Unassigned (T&amp;P / Self Study) &mdash;</option>
                  {filteredFaculty.map((f) => {
                    const conflict = getFacultyConflict(f.id)
                    const isSelfAssigned = slot?.facultyId === f.id
                    const isBusy = conflict && !isSelfAssigned

                    return (
                      <option
                        key={f.id}
                        value={f.id}
                        disabled={Boolean(isBusy)}
                      >
                        {f.name} &mdash; Staff ID: {f.staffId || '—'} {f.department ? `(${f.department})` : ''}
                        {isBusy ? ` [BUSY: ${conflict.classLabel}]` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Batch B Faculty for Labs */}
              {spanCount > 1 && (
                <div className="form-group">
                  <label htmlFor="slot-batchb-select">Batch B Faculty (For Lab Sessions)</label>
                  <select
                    id="slot-batchb-select"
                    value={batchBFacultyId}
                    onChange={(e) => setBatchBFacultyId(e.target.value)}
                  >
                    <option value="">&mdash; No Batch B Faculty &mdash;</option>
                    {filteredFaculty.map((f) => {
                      const conflict = getFacultyConflict(f.id)
                      const isSelfAssigned = slot?.batchBFacultyId === f.id
                      const isBusy = conflict && !isSelfAssigned
                      const isSameAsBatchA = facultyId && Number(facultyId) === f.id

                      return (
                        <option
                          key={f.id}
                          value={f.id}
                          disabled={Boolean(isBusy || isSameAsBatchA)}
                        >
                          {f.name} &mdash; Staff ID: {f.staffId || '—'}
                          {isSameAsBatchA ? ' [Already Batch A]' : isBusy ? ` [BUSY: ${conflict.classLabel}]` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}
            </>
          )}

          {isBreak && (
            <p className="form-hint" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              Break subjects do not have faculty assigned.
            </p>
          )}

          {/* Room / Lab */}
          <div className="form-group">
            <label htmlFor="slot-room-input">Room / Location (Optional)</label>
            <input
              id="slot-room-input"
              type="text"
              className="text-input"
              placeholder="e.g. 1302 or Lab 3"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="designer-modal-actions">
            {slot && (
              <button
                type="button"
                className="button button--danger-text"
                onClick={handleClear}
                disabled={saving}
              >
                Clear Slot
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="button button--secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Apply & Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
