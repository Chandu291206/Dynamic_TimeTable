import { useState } from 'react'
import { createCROverride } from '../../api/cr.js'

function todayIso() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const standardTimeSlots = [
  { label: '09:00', value: '09:00' },
  { label: '09:50', value: '09:50' },
  { label: '10:40', value: '10:40' },
  { label: '11:30', value: '11:30' },
  { label: '12:20', value: '12:20' },
  { label: '13:10', value: '13:10' },
  { label: '14:00', value: '14:00' },
  { label: '14:50', value: '14:50' },
  { label: '15:40', value: '15:40' },
  { label: '16:30', value: '16:30' },
]

export default function OverrideForm({ subjects = [], faculty = [], onCreated }) {
  const [date, setDate] = useState(todayIso)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:50')
  const [subjectId, setSubjectId] = useState('')
  const [facultyId, setFacultyId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clientErrors, setClientErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const validate = () => {
    const errors = {}
    if (!date) {
      errors.date = 'Date is required.'
    } else {
      const day = new Date(`${date}T12:00:00`).getDay()
      if (day === 0) {
        errors.date = 'Sundays have no teaching slots to override.'
      }
    }

    if (!startTime) {
      errors.startTime = 'Start time is required.'
    }
    if (!endTime) {
      errors.endTime = 'End time is required.'
    }
    if (startTime && endTime && startTime >= endTime) {
      errors.endTime = 'End time must be later than start time.'
    }

    setClientErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setApiError('')
    setSuccessMessage('')

    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = {
        date,
        startTime,
        endTime,
        subjectId: subjectId ? Number(subjectId) : null,
        facultyId: facultyId ? Number(facultyId) : null,
      }

      const created = await createCROverride(payload)
      setSuccessMessage(`Override created successfully for ${created.date} (${created.startTime} – ${created.endTime}).`)
      if (onCreated) {
        onCreated(created)
      }
    } catch (err) {
      setApiError(err.message || 'Failed to create override.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="override-form-card">
      <header className="override-form-header">
        <h2 className="section-title">Create Timetable Override</h2>
        <p className="section-subtitle">
          Propose an adjustment for your class. Overrides must overlap at least one scheduled class session.
        </p>
      </header>

      {successMessage && (
        <div className="form-success-alert" role="status">
          <span aria-hidden="true">✓</span>
          <p>{successMessage}</p>
        </div>
      )}

      {apiError && (
        <div className="form-error-alert" role="alert">
          <span aria-hidden="true">⚠</span>
          <p>{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="cr-form" noValidate>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="override-date" className="field-label">Date *</label>
            <input
              id="override-date"
              type="date"
              className="text-input"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setClientErrors((prev) => ({ ...prev, date: '' }))
              }}
              required
              disabled={submitting}
            />
            {clientErrors.date && <p className="field-error">{clientErrors.date}</p>}
          </div>

          <div className="form-group time-group">
            <label htmlFor="override-start-time" className="field-label">Start Time *</label>
            <input
              id="override-start-time"
              type="time"
              className="text-input"
              value={startTime}
              list="common-times"
              onChange={(e) => {
                setStartTime(e.target.value)
                setClientErrors((prev) => ({ ...prev, startTime: '', endTime: '' }))
              }}
              required
              disabled={submitting}
            />
            {clientErrors.startTime && <p className="field-error">{clientErrors.startTime}</p>}
          </div>

          <div className="form-group time-group">
            <label htmlFor="override-end-time" className="field-label">End Time *</label>
            <input
              id="override-end-time"
              type="time"
              className="text-input"
              value={endTime}
              list="common-times"
              onChange={(e) => {
                setEndTime(e.target.value)
                setClientErrors((prev) => ({ ...prev, endTime: '' }))
              }}
              required
              disabled={submitting}
            />
            {clientErrors.endTime && <p className="field-error">{clientErrors.endTime}</p>}
          </div>

          <datalist id="common-times">
            {standardTimeSlots.map((slot) => (
              <option key={slot.value} value={slot.value} />
            ))}
          </datalist>

          <div className="form-group">
            <label htmlFor="override-subject" className="field-label">
              Subject <span className="field-hint">(Optional)</span>
            </label>
            <select
              id="override-subject"
              className="select-input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={submitting}
            >
              <option value="">-- No subject / Self-study --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="override-faculty" className="field-label">
              Faculty <span className="field-hint">(Optional)</span>
            </label>
            <select
              id="override-faculty"
              className="select-input"
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              disabled={submitting}
            >
              <option value="">-- No faculty / TBA --</option>
              {faculty.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} {fac.department ? `(${fac.department})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button override-submit-btn" disabled={submitting}>
            {submitting ? 'Creating override…' : 'Create Override'}
          </button>
        </div>
      </form>
    </div>
  )
}
