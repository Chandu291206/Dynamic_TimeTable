import { useEffect, useState } from 'react'
import { createSubject, deleteSubject, getAdminSubjects, updateSubject } from '../api/admin.js'

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [editingSubject, setEditingSubject] = useState(null)
  const [editName, setEditName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadSubjects = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminSubjects()
      setSubjects(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load subjects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubjects()
  }, [])

  const handleAddSubject = async (event) => {
    event.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await createSubject({ name: name.trim() })
      setSuccess(`Subject '${name.trim()}' added successfully.`)
      setName('')
      await loadSubjects()
    } catch (err) {
      setError(err.message || 'Could not add subject.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEdit = (subject) => {
    setEditingSubject(subject)
    setEditName(subject.name)
    setError('')
    setSuccess('')
  }

  const handleUpdateSubject = async (event) => {
    event.preventDefault()
    if (!editName.trim() || !editingSubject) return

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await updateSubject(editingSubject.id, { name: editName.trim() })
      setSuccess(`Subject updated to '${editName.trim()}'.`)
      setEditingSubject(null)
      await loadSubjects()
    } catch (err) {
      setError(err.message || 'Could not update subject.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSubject = async (subject) => {
    if (!window.confirm(`Are you sure you want to delete subject '${subject.name}'?`)) return

    setError('')
    setSuccess('')
    try {
      await deleteSubject(subject.id)
      setSuccess(`Subject '${subject.name}' deleted.`)
      await loadSubjects()
    } catch (err) {
      setError(err.message || 'Could not delete subject. It is referenced by timetable slots.')
    }
  }

  return (
    <div className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-title">Subject Management</h2>
          <p className="admin-subtitle">
            Configure academic courses and subjects available for scheduling and timetable overrides.
          </p>
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
        {/* Left Column: Add / Edit Form Card */}
        <div className="admin-form-panel">
          {editingSubject ? (
            <div className="admin-card">
              <header className="admin-card-header">
                <h3>Edit Subject</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditingSubject(null)}
                >
                  Cancel
                </button>
              </header>
              <form onSubmit={handleUpdateSubject} className="admin-form">
                <div className="form-group">
                  <label htmlFor="edit-subject-name" className="field-label">Subject Name *</label>
                  <input
                    id="edit-subject-name"
                    type="text"
                    className="text-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="button" disabled={submitting}>
                    {submitting ? 'Updating…' : 'Update Subject'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="admin-card">
              <header className="admin-card-header">
                <h3>Add New Subject</h3>
              </header>
              <form onSubmit={handleAddSubject} className="admin-form">
                <div className="form-group">
                  <label htmlFor="add-subject-name" className="field-label">Subject Name *</label>
                  <input
                    id="add-subject-name"
                    type="text"
                    className="text-input"
                    placeholder="e.g. FLAT, CN, AI LAB"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="button" disabled={submitting}>
                    {submitting ? 'Adding…' : '+ Add Subject'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Existing Subjects Table */}
        <div className="admin-table-panel">
          <div className="admin-card">
            <header className="admin-card-header">
              <h3>Existing Subjects</h3>
              <span className="badge-count">{subjects.length} total</span>
            </header>

            {loading ? (
              <div className="schedule-state schedule-loading">
                <span className="loading-rule" aria-hidden="true" />
                <p>Loading subjects…</p>
              </div>
            ) : subjects.length === 0 ? (
              <div className="admin-empty-card">
                <p>No subjects added yet. Create your first subject using the form.</p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Subject Name</th>
                      <th scope="col" className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((sub) => (
                      <tr key={sub.id}>
                        <td><code>#{sub.id}</code></td>
                        <td><b>{sub.name}</b></td>
                        <td className="text-right table-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => handleStartEdit(sub)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-button text-button--danger"
                            onClick={() => handleDeleteSubject(sub)}
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
        </div>
      </div>
    </div>
  )
}
