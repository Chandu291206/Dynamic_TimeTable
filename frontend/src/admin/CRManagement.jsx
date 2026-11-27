import { useEffect, useMemo, useState } from 'react'
import {
  assignCRClass,
  createAccount,
  deleteAccount,
  getAdminAccounts,
  getAdminClasses,
  getAdminFaculty,
  updateAccount,
} from '../api/admin.js'

const ROLE_LABELS = {
  FACULTY: 'Faculty',
  HOD: 'HOD',
  CR: 'CR',
}

export default function CRManagement() {
  const [accounts, setAccounts] = useState([])
  const [classes, setClasses] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Add Form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addRole, setAddRole] = useState('FACULTY')
  const [addUsername, setAddUsername] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addClassId, setAddClassId] = useState('')
  const [addFacultyId, setAddFacultyId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reassign Class Modal (for CR)
  const [reassignTarget, setReassignTarget] = useState(null)
  const [newClassId, setNewClassId] = useState('')

  // Password Reset Modal
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [accRes, classesRes, facRes] = await Promise.all([
        getAdminAccounts(),
        getAdminClasses(),
        getAdminFaculty(),
      ])
      setAccounts(accRes.data || [])
      const classList = classesRes.data || []
      const facList = facRes.data || []
      setClasses(classList)
      setFacultyList(facList)
      if (classList.length > 0 && !addClassId) {
        setAddClassId(classList[0].id)
      }
      if (facList.length > 0 && !addFacultyId) {
        setAddFacultyId(facList[0].id)
      }
    } catch (err) {
      setError(err.message || 'Failed to load account records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return accounts.filter((acc) => {
      if (roleFilter !== 'ALL' && acc.role !== roleFilter) return false
      if (q) {
        const haystack = [
          acc.username,
          acc.role,
          acc.class?.label,
          acc.faculty?.name,
          acc.faculty?.staffId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [accounts, roleFilter, searchQuery])

  const handleCreateAccount = async (event) => {
    event.preventDefault()
    if (!addUsername.trim() || !addPassword) {
      setError('User ID / Username and password are required.')
      return
    }
    if (addRole === 'CR' && !addClassId) {
      setError('Please select an assigned class for the CR account.')
      return
    }
    if (addRole === 'FACULTY' && !addFacultyId) {
      setError('Please select a faculty profile to link to this Faculty account.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await createAccount({
        username: addUsername.trim(),
        password: addPassword,
        role: addRole,
        classId: addRole === 'CR' ? Number(addClassId) : null,
        facultyId: addRole === 'FACULTY' ? Number(addFacultyId) : null,
        isActive: true,
      })
      setSuccess(`${ROLE_LABELS[addRole] || addRole} account '${addUsername.trim()}' created successfully.`)
      setAddUsername('')
      setAddPassword('')
      setShowAddForm(false)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not create account.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (acc) => {
    setError('')
    setSuccess('')
    try {
      await updateAccount(acc.id, { isActive: !acc.isActive })
      setSuccess(`Account '${acc.username}' is now ${!acc.isActive ? 'Active' : 'Deactivated'}.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not update account.')
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
      await updateAccount(resetTarget.id, { password: newPassword })
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

  const handleDeleteAccount = async (acc) => {
    if (!window.confirm(`Are you sure you want to remove ${ROLE_LABELS[acc.role] || acc.role} account '${acc.username}'?`)) return

    setError('')
    setSuccess('')
    try {
      await deleteAccount(acc.id)
      setSuccess(`Account '${acc.username}' removed.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not delete account.')
    }
  }

  return (
    <div className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-title">Manage Accounts</h2>
          <p className="admin-subtitle">
            Create and manage login credentials for Faculty, HOD, and Class Representative (CR) roles.
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="button" onClick={() => setShowAddForm(true)}>
            + Create Account
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

      {/* Create Account Modal */}
      {showAddForm && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <header className="admin-modal-header">
              <h3>Create User Account</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setShowAddForm(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleCreateAccount} className="admin-form">
              <div className="form-group">
                <label htmlFor="acc-role" className="field-label">Role *</label>
                <select
                  id="acc-role"
                  className="select-input"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  disabled={submitting}
                >
                  <option value="FACULTY">Faculty (Assigned Classes & Profile)</option>
                  <option value="HOD">HOD (Full Administrator Access)</option>
                  <option value="CR">CR (Class Representative Overrides)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="acc-user" className="field-label">User ID / Username *</label>
                <input
                  id="acc-user"
                  type="text"
                  className="text-input"
                  placeholder={addRole === 'FACULTY' ? 'e.g. fac_1542' : addRole === 'HOD' ? 'e.g. hod_cse' : 'e.g. cr_aiml_b'}
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="acc-pass" className="field-label">Password *</label>
                <input
                  id="acc-pass"
                  type="password"
                  className="text-input"
                  placeholder="Minimum 6 characters"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>

              {addRole === 'FACULTY' && (
                <div className="form-group">
                  <label htmlFor="acc-faculty-sel" className="field-label">Link Faculty Profile *</label>
                  <select
                    id="acc-faculty-sel"
                    className="select-input"
                    value={addFacultyId}
                    onChange={(e) => setAddFacultyId(e.target.value)}
                    required
                    disabled={submitting}
                  >
                    {facultyList.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} ({fac.staffId || 'No ID'}) {fac.department ? `· ${fac.department}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {addRole === 'CR' && (
                <div className="form-group">
                  <label htmlFor="acc-class-sel" className="field-label">Assigned Class *</label>
                  <select
                    id="acc-class-sel"
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
              )}

              {addRole === 'HOD' && (
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#5c554c' }}>
                  HOD accounts receive full administrative privileges across all timetable, faculty, and account controls.
                </p>
              )}

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

      {/* Reassign Class Modal (CR) */}
      {reassignTarget && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <header className="admin-modal-header">
              <h3>Reassign Class for {reassignTarget.username}</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setReassignTarget(null)}
                aria-label="Close modal"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleReassignClass} className="admin-form">
              <div className="form-group">
                <label htmlFor="reassign-class-sel" className="field-label">Select New Class</label>
                <select
                  id="reassign-class-sel"
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
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Updating…' : 'Save Assignment'}
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
                aria-label="Close modal"
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
                  minLength={6}
                  placeholder="Enter new password"
                  disabled={submitting}
                />
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setResetTarget(null)}
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

      {/* Filter Bar */}
      {!loading && accounts.length > 0 && (
        <div className="faculty-filter-bar" role="search" aria-label="Filter managed accounts">
          <div className="faculty-filter-search">
            <input
              type="search"
              className="text-input"
              placeholder="Search by username, role, class, or faculty…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search accounts"
            />
          </div>
          <div className="faculty-filter-select">
            <select
              className="select-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
            >
              <option value="ALL">All Roles</option>
              <option value="FACULTY">Faculty</option>
              <option value="HOD">HOD</option>
              <option value="CR">CR</option>
            </select>
          </div>
          <div className="faculty-filter-meta">
            <span className="badge-count">{filteredAccounts.length} / {accounts.length}</span>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      {loading ? (
        <div className="schedule-state schedule-loading">
          <span className="loading-rule" aria-hidden="true" />
          <p>Loading accounts…</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="admin-empty-card">
          <h3>No accounts configured</h3>
          <p>Click "+ Create Account" to assign login credentials for Faculty, HOD, or CR users.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">User ID / Username</th>
                <th scope="col">Role</th>
                <th scope="col">Linked Assignment</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc) => (
                <tr key={acc.id}>
                  <td><b>{acc.username}</b></td>
                  <td>
                    <span className="role-tag">{ROLE_LABELS[acc.role] || acc.role}</span>
                  </td>
                  <td>
                    {acc.role === 'CR' ? (
                      acc.class ? <span className="admin-class-badge">{acc.class.label}</span> : <span className="muted-text">Unassigned</span>
                    ) : acc.role === 'FACULTY' ? (
                      acc.faculty ? (
                        <span>
                          <b>{acc.faculty.name}</b> <code style={{ marginLeft: '0.25rem' }}>{acc.faculty.staffId}</code>
                        </span>
                      ) : <span className="muted-text">Unlinked</span>
                    ) : (
                      <span className="muted-text">Full Admin Access</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${acc.isActive ? 'active' : 'inactive'}`}>
                      {acc.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="text-right table-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleToggleActive(acc)}
                    >
                      {acc.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    {acc.role === 'CR' && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setReassignTarget(acc)
                          setNewClassId(acc.classId || (classes[0]?.id || ''))
                        }}
                      >
                        Reassign
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setResetTarget(acc)
                        setNewPassword('')
                      }}
                    >
                      Reset Pass
                    </button>
                    <button
                      type="button"
                      className="text-button text-button--danger"
                      onClick={() => handleDeleteAccount(acc)}
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
