import { useEffect, useState } from 'react'
import {
  assignCRClass,
  createCR,
  deleteCR,
  getAdminClasses,
  getAdminCRs,
  updateCR,
} from '../api/admin.js'

export default function CRManagement() {
  const [crs, setCrs] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Add Form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addUsername, setAddUsername] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addClassId, setAddClassId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reassign Modal
  const [reassignTarget, setReassignTarget] = useState(null)
  const [newClassId, setNewClassId] = useState('')

  // Password Reset Modal
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [crsRes, classesRes] = await Promise.all([getAdminCRs(), getAdminClasses()])
      setCrs(crsRes.data || [])
      const classList = classesRes.data || []
      setClasses(classList)
      if (classList.length > 0 && !addClassId) {
        setAddClassId(classList[0].id)
      }
    } catch (err) {
      setError(err.message || 'Failed to load CR records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateCR = async (event) => {
    event.preventDefault()
    if (!addUsername.trim() || !addPassword || !addClassId) {
      setError('Username, password, and assigned class are required.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await createCR({
        username: addUsername.trim(),
        password: addPassword,
        classId: Number(addClassId),
        isActive: true,
      })
      setSuccess(`CR account '${addUsername.trim()}' created successfully.`)
      setAddUsername('')
      setAddPassword('')
      setShowAddForm(false)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not create CR account.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (cr) => {
    setError('')
    setSuccess('')
    try {
      await updateCR(cr.id, { isActive: !cr.isActive })
      setSuccess(`CR '${cr.username}' is now ${!cr.isActive ? 'Active' : 'Deactivated'}.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not update CR account.')
    }
  }

  const handleReassignClass = async (event) => {
    event.preventDefault()
    if (!reassignTarget || !newClassId) return

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await assignCRClass(reassignTarget.id, Number(newClassId))
      setSuccess(`Reassigned ${reassignTarget.username} to new class.`)
      setReassignTarget(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to reassign class.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (!resetTarget || !newPassword) return

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await updateCR(resetTarget.id, { password: newPassword })
      setSuccess(`Password for ${resetTarget.username} has been reset.`)
      setResetTarget(null)
      setNewPassword('')
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCR = async (cr) => {
    if (!window.confirm(`Are you sure you want to remove CR account '${cr.username}'?`)) return

    setError('')
    setSuccess('')
    try {
      await deleteCR(cr.id)
      setSuccess(`CR account '${cr.username}' removed.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not delete CR account.')
    }
  }

  return (
    <div className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-title">CR Account Management</h2>
          <p className="admin-subtitle">
            Create and maintain Class Representative student credentials and class authorization assignments.
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="button" onClick={() => setShowAddForm(true)}>
            + Create CR Account
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

      {/* Create CR Modal */}
      {showAddForm && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <header className="admin-modal-header">
              <h3>Create CR Account</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setShowAddForm(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleCreateCR} className="admin-form">
              <div className="form-group">
                <label htmlFor="cr-user" className="field-label">Username *</label>
                <input
                  id="cr-user"
                  type="text"
                  className="text-input"
                  placeholder="e.g. cr_aiml_b"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="cr-pass" className="field-label">Initial Password *</label>
                <input
                  id="cr-pass"
                  type="password"
                  className="text-input"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="cr-class-sel" className="field-label">Assigned Class *</label>
                <select
                  id="cr-class-sel"
                  className="select-input"
                  value={addClassId}
                  onChange={(e) => setAddClassId(e.target.value)}
                  required
                  disabled={submitting}
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.label}</option>
                  ))}
                </select>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setShowAddForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Class Modal */}
      {reassignTarget && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <header className="admin-modal-header">
              <h3>Reassign Class for {reassignTarget.username}</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setReassignTarget(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleReassignClass} className="admin-form">
              <div className="form-group">
                <label htmlFor="reassign-class" className="field-label">Select New Class</label>
                <select
                  id="reassign-class"
                  className="select-input"
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  required
                  disabled={submitting}
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.label}</option>
                  ))}
                </select>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setReassignTarget(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Reassigning…' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <header className="admin-modal-header">
              <h3>Reset Password for {resetTarget.username}</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setResetTarget(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleResetPassword} className="admin-form">
              <div className="form-group">
                <label htmlFor="reset-new-password" className="field-label">New Password *</label>
                <input
                  id="reset-new-password"
                  type="password"
                  className="text-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setResetTarget(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Resetting…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CR Table */}
      {loading ? (
        <div className="schedule-state schedule-loading">
          <span className="loading-rule" aria-hidden="true" />
          <p>Loading CR accounts…</p>
        </div>
      ) : crs.length === 0 ? (
        <div className="admin-empty-card">
          <h3>No Class Representative accounts</h3>
          <p>Click "+ Create CR Account" to grant class representation privileges to a student.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Username</th>
                <th scope="col">Assigned Class</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crs.map((cr) => (
                <tr key={cr.id}>
                  <td>
                    <b>{cr.username}</b>
                  </td>
                  <td>
                    {cr.class ? (
                      <span className="admin-class-badge">{cr.class.label}</span>
                    ) : (
                      <span className="muted-text">Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${cr.isActive ? 'active' : 'inactive'}`}>
                      {cr.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="text-right table-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleToggleActive(cr)}
                    >
                      {cr.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setReassignTarget(cr)
                        setNewClassId(cr.classId || (classes[0]?.id || ''))
                      }}
                    >
                      Reassign
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setResetTarget(cr)
                        setNewPassword('')
                      }}
                    >
                      Reset Pass
                    </button>
                    <button
                      type="button"
                      className="text-button text-button--danger"
                      onClick={() => handleDeleteCR(cr)}
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
