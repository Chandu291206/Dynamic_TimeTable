import { useEffect, useState } from 'react'
import {
  createFaculty,
  deleteFaculty,
  getAdminFaculty,
  getAdminFacultySyncStatus,
  scrapeFacultyWeb,
  triggerFacultySync,
  updateFaculty,
} from '../api/admin.js'
import FacultyAvatar from '../components/FacultyAvatar.jsx'

export default function FacultyManagement() {
  const [facultyList, setFacultyList] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [scrapingWeb, setScrapingWeb] = useState(false)
  const [scrapingId, setScrapingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    designation: '',
    qualification: '',
    staffId: '',
    email: '',
    phone: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [facRes, syncRes] = await Promise.all([
        getAdminFaculty(),
        getAdminFacultySyncStatus().catch(() => null),
      ])
      setFacultyList(facRes.data || [])
      setSyncStatus(syncRes?.data || null)
    } catch (err) {
      setError(err.message || 'Failed to load faculty records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    setSuccess('')
    try {
      const res = await triggerFacultySync()
      setSuccess(`Faculty synchronization completed: ${res.data?.created ?? 0} created, ${res.data?.updated ?? 0} updated, ${res.data?.unchanged ?? 0} unchanged.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Faculty synchronization failed.')
    } finally {
      setSyncing(false)
    }
  }

  const handleScrapeWeb = async (id = null) => {
    if (id) {
      setScrapingId(id)
    } else {
      setScrapingWeb(true)
    }
    setError('')
    setSuccess('')
    try {
      const res = await scrapeFacultyWeb(id)
      const matched = res.data?.matchedCount ?? 0
      const updated = res.data?.updatedCount ?? 0
      const photos = res.data?.imagesDownloaded ?? 0
      setSuccess(`Web profile scraping finished: matched ${matched} faculty, updated ${updated} records, downloaded ${photos} photos.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Web scraping failed.')
    } finally {
      setScrapingWeb(false)
      setScrapingId(null)
    }
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData({
      name: '',
      department: '',
      designation: '',
      qualification: '',
      staffId: '',
      email: '',
      phone: '',
    })
    setShowForm(true)
  }

  const handleOpenEdit = (faculty) => {
    setEditingId(faculty.id)
    setFormData({
      name: faculty.name || '',
      department: faculty.department || '',
      designation: faculty.designation || '',
      qualification: faculty.qualification || '',
      staffId: faculty.staffId || '',
      email: faculty.email || '',
      phone: faculty.phone || '',
    })
    setShowForm(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!formData.name.trim()) {
      setError('Faculty name is required.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        await updateFaculty(editingId, formData)
        setSuccess(`Faculty '${formData.name}' updated successfully.`)
      } else {
        await createFaculty(formData)
        setSuccess(`Faculty '${formData.name}' added successfully.`)
      }
      setShowForm(false)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not save faculty record.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'? This cannot be undone.`)) {
      return
    }
    setError('')
    setSuccess('')
    try {
      await deleteFaculty(id)
      setSuccess(`Faculty '${name}' removed.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not delete faculty member. They may be referenced in scheduled slots.')
    }
  }

  return (
    <div className="admin-section">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-title">Faculty Management</h2>
          <p className="admin-subtitle">
            Manage institutional faculty records or synchronize live details from the official college staff database.
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => handleScrapeWeb(null)}
            disabled={scrapingWeb || syncing}
            title="Scrape faculty profiles, images, and emails from online department directories"
          >
            {scrapingWeb ? 'Scraping Web…' : '🌐 Scrape Web Profiles & Photos'}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={handleSync}
            disabled={syncing || scrapingWeb}
          >
            {syncing ? 'Synchronizing…' : '↻ Sync From Official GRIET Website'}
          </button>
          <button type="button" className="button" onClick={handleOpenAdd}>
            + Add Faculty
          </button>
        </div>
      </header>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="sync-status-strip">
          <span className="sync-dot" data-status={syncStatus.status} />
          <span>
            <b>Last Sync:</b> {syncStatus.status}
            {syncStatus.finishedAt && ` · ${new Date(syncStatus.finishedAt).toLocaleString()}`}
          </span>
          <span className="sync-counts">
            Created: <b>{syncStatus.created ?? 0}</b> | Updated: <b>{syncStatus.updated ?? 0}</b> | Unchanged: <b>{syncStatus.unchanged ?? 0}</b> | Failed: <b>{syncStatus.failed ?? 0}</b>
          </span>
        </div>
      )}

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

      {/* Faculty Add / Edit Modal / Form Drawer */}
      {showForm && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <header className="admin-modal-header">
              <h3>{editingId ? 'Edit Faculty Member' : 'Add New Faculty Member'}</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleSave} className="admin-form">
              <div className="form-grid">
                <div className="form-group">
                  <label className="field-label" htmlFor="fac-name">Full Name *</label>
                  <input
                    id="fac-name"
                    type="text"
                    className="text-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" htmlFor="fac-dept">Department</label>
                  <input
                    id="fac-dept"
                    type="text"
                    className="text-input"
                    placeholder="e.g. CSE-AIML"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" htmlFor="fac-desig">Designation</label>
                  <input
                    id="fac-desig"
                    type="text"
                    className="text-input"
                    placeholder="e.g. Assistant Professor"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" htmlFor="fac-qual">Qualification</label>
                  <input
                    id="fac-qual"
                    type="text"
                    className="text-input"
                    placeholder="e.g. M.Tech, Ph.D"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" htmlFor="fac-staffid">Staff ID</label>
                  <input
                    id="fac-staffid"
                    type="text"
                    className="text-input"
                    placeholder="e.g. 1542"
                    value={formData.staffId}
                    onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" htmlFor="fac-email">Email</label>
                  <input
                    id="fac-email"
                    type="email"
                    className="text-input"
                    placeholder="name@griet.ac.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" htmlFor="fac-phone">Phone</label>
                  <input
                    id="fac-phone"
                    type="tel"
                    className="text-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                  />
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
                  {submitting ? 'Saving…' : editingId ? 'Update Faculty' : 'Create Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table of Faculty Records */}
      {loading ? (
        <div className="schedule-state schedule-loading">
          <span className="loading-rule" aria-hidden="true" />
          <p>Loading faculty records…</p>
        </div>
      ) : facultyList.length === 0 ? (
        <div className="admin-empty-card">
          <h3>No faculty records</h3>
          <p>You can add faculty records manually or click "Sync From Official GRIET Website" to import them automatically.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Avatar</th>
                <th scope="col">Name</th>
                <th scope="col">Department</th>
                <th scope="col">Designation</th>
                <th scope="col">Staff ID</th>
                <th scope="col">Email</th>
                <th scope="col">Web Profile</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {facultyList.map((faculty) => (
                <tr key={faculty.id}>
                  <td>
                    <FacultyAvatar faculty={faculty} size="small" />
                  </td>
                  <td><b>{faculty.name}</b></td>
                  <td>{faculty.department || '—'}</td>
                  <td>{faculty.designation || '—'}</td>
                  <td><code>{faculty.staffId || '—'}</code></td>
                  <td>{faculty.email ? <a href={`mailto:${faculty.email}`} className="text-link">{faculty.email}</a> : '—'}</td>
                  <td>
                    {faculty.profileSourceUrl ? (
                      <a
                        href={faculty.profileSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="badge-profile-link"
                        title={`Open official web profile for ${faculty.name}`}
                      >
                        🔗 Official Profile ↗
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-right table-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleScrapeWeb(faculty.id)}
                      disabled={scrapingId === faculty.id || scrapingWeb}
                      title="Scrape web profile and photo for this faculty member"
                    >
                      {scrapingId === faculty.id ? 'Scraping…' : '🌐 Scrape'}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleOpenEdit(faculty)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-button text-button--danger"
                      onClick={() => handleDelete(faculty.id, faculty.name)}
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
