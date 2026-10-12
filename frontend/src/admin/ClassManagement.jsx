import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearClassTimetable, createClass, deleteClass, getAdminClasses, updateClass } from '../api/admin.js'
import UploadTimetableModal from './UploadTimetableModal.jsx'

export default function ClassManagement() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingClass, setEditingClass] = useState(null)
  const [formData, setFormData] = useState({ year: 3, branch: '', section: '' })
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadClasses = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminClasses()
      setClasses(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load classes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])

  const handleOpenAdd = () => {
    setEditingClass(null)
    setFormData({ year: 3, branch: '', section: '' })
    setError('')
    setSuccess('')
  }

  const handleStartEdit = (classRoom) => {
    setEditingClass(classRoom)
    setFormData({
      year: classRoom.year,
      branch: classRoom.branch,
      section: classRoom.section,
    })
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!formData.branch.trim() || !formData.section.trim()) {
      setError('Year, branch, and section are all required.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        year: Number(formData.year),
        branch: formData.branch.trim().toUpperCase(),
        section: formData.section.trim().toUpperCase(),
      }

      if (editingClass) {
        await updateClass(editingClass.id, payload)
        setSuccess(`Class '${editingClass.label}' updated successfully.`)
        setEditingClass(null)
      } else {
        await createClass(payload)
        setSuccess(`Class 'Y${payload.year} - ${payload.branch} - ${payload.section}' created.`)
        setFormData({ year: 3, branch: '', section: '' })
      }
      await loadClasses()
    } catch (err) {
      setError(err.message || 'Could not save class.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearTimetable = async (classRoom) => {
    if (!window.confirm(`Are you sure you want to clear the timetable for '${classRoom.label}'? All timetable slots and schedule entries for this class will be removed, but the class room itself will remain.`)) {
      return
    }

    setError('')
    setSuccess('')
    try {
      const res = await clearClassTimetable(classRoom.id)
      setSuccess(res.message || `Timetable for '${classRoom.label}' cleared successfully.`)
      await loadClasses()
    } catch (err) {
      setError(err.message || 'Could not clear timetable.')
    }
  }

  const handleDeleteClass = async (classRoom) => {
    if (!window.confirm(`Are you sure you want to delete '${classRoom.label}'? The class room and all its associated timetable slots will be permanently removed.`)) {
      return
    }

    setError('')
    setSuccess('')
    try {
      await deleteClass(classRoom.id)
      setSuccess(`Class '${classRoom.label}' deleted.`)
      await loadClasses()
    } catch (err) {
      setError(err.message || 'Could not delete class.')
    }
  }

  return (
    <div className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-title">Class Management</h2>
          <p className="admin-subtitle">
            Create, view, and configure academic batches and sections in the institution.
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              setError('')
              setSuccess('')
              setShowUploadModal(true)
            }}
          >
            📁 Upload Timetable JSON
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

      <div className="admin-two-column-layout">
        {/* Form Card */}
        <div className="admin-form-panel">
          <div className="admin-card">
            <header className="admin-card-header">
              <h3>{editingClass ? `Edit ${editingClass.label}` : 'Create New Class'}</h3>
              {editingClass && (
                <button type="button" className="text-button" onClick={handleOpenAdd}>
                  Cancel
                </button>
              )}
            </header>
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="form-group">
                <label htmlFor="class-year" className="field-label">Year of Study (1 – 4) *</label>
                <select
                  id="class-year"
                  className="select-input"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  disabled={submitting}
                >
                  <option value={1}>Year 1</option>
                  <option value={2}>Year 2</option>
                  <option value={3}>Year 3</option>
                  <option value={4}>Year 4</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="class-branch" className="field-label">Branch / Department *</label>
                <input
                  id="class-branch"
                  type="text"
                  className="text-input"
                  placeholder="e.g. AIML, CSE, ECE, IT"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="class-section" className="field-label">Section *</label>
                <input
                  id="class-section"
                  type="text"
                  className="text-input"
                  placeholder="e.g. A, B, C"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Saving…' : editingClass ? 'Update Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Existing Classes List */}
        <div className="admin-table-panel">
          <div className="admin-card">
            <header className="admin-card-header">
              <h3>Institutional Classes</h3>
              <span className="badge-count">{classes.length} active</span>
            </header>

            {loading ? (
              <div className="schedule-state schedule-loading">
                <span className="loading-rule" aria-hidden="true" />
                <p>Loading classes…</p>
              </div>
            ) : classes.length === 0 ? (
              <div className="admin-empty-card">
                <p>No classes registered yet. Create your first academic class.</p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Class Label</th>
                      <th scope="col">Year</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Section</th>
                      <th scope="col" className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls) => (
                      <tr key={cls.id}>
                        <td><b>{cls.label}</b></td>
                        <td>Year {cls.year}</td>
                        <td>{cls.branch}</td>
                        <td>Sec {cls.section}</td>
                        <td className="text-right table-actions">
                          <Link to={`/timetable/${cls.id}`} className="text-button" target="_blank">
                            Timetable ↗
                          </Link>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => handleClearTimetable(cls)}
                            title="Clear all timetable slots for this class"
                          >
                            Clear Timetable
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => handleStartEdit(cls)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-button text-button--danger"
                            onClick={() => handleDeleteClass(cls)}
                            title="Permanently delete this class and its schedule"
                          >
                            Delete Class
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <UploadTimetableModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={(msg) => {
          setSuccess(msg)
          loadClasses()
        }}
      />
    </div>
  )
}
