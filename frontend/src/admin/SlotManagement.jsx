import { useEffect, useState } from 'react'
import {
  createSlot,
  deleteSlot,
  getAdminClasses,
  getAdminFaculty,
  getAdminSlots,
  getAdminSubjects,
  updateSlot,
} from '../api/admin.js'

const DAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
]

export default function SlotManagement() {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [faculty, setFaculty] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editingSlotId, setEditingSlotId] = useState(null)
  const [formData, setFormData] = useState({
    day: 0,
    startTime: '09:00',
    endTime: '09:50',
    subjectId: '',
    facultyId: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Initial load of classes, subjects, faculty
  useEffect(() => {
    Promise.all([getAdminClasses(), getAdminSubjects(), getAdminFaculty()])
      .then(([clsRes, subRes, facRes]) => {
        const clsList = clsRes.data || []
        setClasses(clsList)
        setSubjects(subRes.data || [])
        setFaculty(facRes.data || [])
        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].id)
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to initialize timetable slot management.')
      })
  }, [])

  // Load slots whenever selectedClassId changes
  const loadSlots = async () => {
    if (!selectedClassId) return
    setLoading(true)
    setError('')
    try {
      const res = await getAdminSlots(selectedClassId)
      setSlots(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load timetable slots.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSlots()
  }, [selectedClassId])

  const filteredSlots = slots.filter((slot) => slot.day === selectedDay)

  const handleOpenAdd = () => {
    setEditingSlotId(null)
    setFormData({
      day: selectedDay,
      startTime: '09:00',
      endTime: '09:50',
      subjectId: '',
      facultyId: '',
    })
    setShowForm(true)
  }

  const handleOpenEdit = (slot) => {
    setEditingSlotId(slot.id)
    setFormData({
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectId: slot.subjectId || '',
      facultyId: slot.facultyId || '',
    })
    setShowForm(true)
  }

  const handleSaveSlot = async (event) => {
    event.preventDefault()
    if (!selectedClassId) {
      setError('Please select a class.')
      return
    }
    if (formData.startTime >= formData.endTime) {
      setError('End time must be after start time.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        classId: Number(selectedClassId),
        day: Number(formData.day),
        startTime: formData.startTime,
        endTime: formData.endTime,
        subjectId: formData.subjectId ? Number(formData.subjectId) : null,
        facultyId: formData.facultyId ? Number(formData.facultyId) : null,
      }

      if (editingSlotId) {
        await updateSlot(editingSlotId, payload)
        setSuccess(`Slot updated successfully (${payload.startTime} – ${payload.endTime}).`)
      } else {
        await createSlot(payload)
        setSuccess(`Slot created successfully (${payload.startTime} – ${payload.endTime}).`)
      }
      setShowForm(false)
      await loadSlots()
    } catch (err) {
      setError(err.message || 'Could not save timetable slot.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSlot = async (slot) => {
    if (!window.confirm(`Delete slot ${slot.startTime} – ${slot.endTime}?`)) return

    setError('')
    setSuccess('')
    try {
      await deleteSlot(slot.id)
      setSuccess('Slot removed.')
      await loadSlots()
    } catch (err) {
      setError(err.message || 'Could not delete slot.')
    }
  }

  return (
    <div className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-title">Recurring Timetable Slot Management</h2>
          <p className="admin-subtitle">
            Configure weekly recurring timetable schedules and faculty assignments for each class.
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="button" onClick={handleOpenAdd} disabled={!selectedClassId}>
            + Add Period Slot
          </button>
        </div>
      </header>

      {error && (
        <div className="form-error-alert" role="alert">
          <span aria-hidden="true">⚠</span>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="form-success-alert" role="status">
          <span aria-hidden="true">✓</span>
          <p>{success}</p>
        </div>
      )}

      {/* Class Selector Bar */}
      <div className="admin-filter-bar">
        <label htmlFor="slot-class-select" className="field-label">Selected Class:</label>
        <select
          id="slot-class-select"
          className="select-input"
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.label}</option>
          ))}
        </select>
      </div>

      {/* Day Selector Tabs */}
      <div className="admin-day-tabs" role="tablist" aria-label="Timetable Days">
        {DAYS.map((d) => (
          <button
            key={d.value}
            type="button"
            role="tab"
            aria-selected={selectedDay === d.value}
            className={`admin-day-tab ${selectedDay === d.value ? 'active' : ''}`}
            onClick={() => setSelectedDay(d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <header className="admin-modal-header">
              <h3>{editingSlotId ? 'Edit Timetable Slot' : 'Add Timetable Slot'}</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleSaveSlot} className="admin-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="slot-day" className="field-label">Weekday *</label>
                  <select
                    id="slot-day"
                    className="select-input"
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: Number(e.target.value) })}
                    disabled={submitting}
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="slot-start-time" className="field-label">Start Time (HH:MM) *</label>
                  <input
                    id="slot-start-time"
                    type="time"
                    className="text-input"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="slot-end-time" className="field-label">End Time (HH:MM) *</label>
                  <input
                    id="slot-end-time"
                    type="time"
                    className="text-input"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="slot-subject" className="field-label">Subject</label>
                  <select
                    id="slot-subject"
                    className="select-input"
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">-- No Subject / Free --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="slot-faculty" className="field-label">Faculty</label>
                  <select
                    id="slot-faculty"
                    className="select-input"
                    value={formData.facultyId}
                    onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">-- No Faculty / TBA --</option>
                    {faculty.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} {f.department ? `(${f.department})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Saving…' : editingSlotId ? 'Update Slot' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slots Table for Selected Class & Day */}
      {loading ? (
        <div className="schedule-state schedule-loading">
          <span className="loading-rule" aria-hidden="true" />
          <p>Loading slots…</p>
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="admin-empty-card">
          <h3>No sessions scheduled for {DAYS[selectedDay]?.label}</h3>
          <p>Click "+ Add Period Slot" to add regular classes to this timetable day.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Time Window</th>
                <th scope="col">Subject</th>
                <th scope="col">Assigned Faculty</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlots.map((slot) => (
                <tr key={slot.id}>
                  <td>
                    <b>{slot.startTime} – {slot.endTime}</b>
                  </td>
                  <td>
                    <span className="slot-subject-badge">{slot.subject?.name || '---'}</span>
                  </td>
                  <td>
                    {slot.faculty?.name || <span className="muted-text">TBA</span>}
                  </td>
                  <td className="text-right table-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleOpenEdit(slot)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-button text-button--danger"
                      onClick={() => handleDeleteSlot(slot)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
