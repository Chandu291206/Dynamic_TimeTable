import { useEffect, useMemo, useState } from 'react'
import { getTimetableLogs } from '../api/admin.js'

function formatTimestamp(ts) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return String(ts)
  }
}

function getActionBadge(action) {
  const norm = (action || '').toUpperCase()
  if (norm.includes('OVERWRITE') || norm.includes('OVERRIDE')) {
    return <span className="log-badge log-badge--override">Overwrite</span>
  }
  if (norm.includes('UPLOAD') || norm.includes('IMPORT')) {
    return <span className="log-badge log-badge--upload">Upload</span>
  }
  if (norm.includes('CREATE')) {
    return <span className="log-badge log-badge--create">Created</span>
  }
  if (norm.includes('DELETE') || norm.includes('CLEAR')) {
    return <span className="log-badge log-badge--delete">Deleted</span>
  }
  return <span className="log-badge log-badge--update">Updated</span>
}

export default function TimetableLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [filterAction, setFilterAction] = useState('ALL')

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getTimetableLogs()
      setLogs(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load timetable change logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterAction !== 'ALL') {
        const act = (log.action || '').toUpperCase()
        if (filterAction === 'OVERWRITE' && !act.includes('OVERRIDE') && !act.includes('OVERWRITE')) return false
        if (filterAction === 'UPLOAD' && !act.includes('UPLOAD') && !act.includes('IMPORT')) return false
        if (filterAction === 'SLOT' && !act.includes('SLOT')) return false
        if (filterAction === 'CLEAR' && !act.includes('CLEAR') && !act.includes('DELETE')) return false
      }
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase()
        const text = [
          log.action,
          log.performedBy,
          log.year ? `year ${log.year}` : '',
          log.branch,
          log.section,
          log.day,
          log.date,
          log.details,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return text.includes(q)
      }
      return true
    })
  }, [logs, filterAction, filterQuery])

  return (
    <div className="admin-management-card">
      <div className="admin-management-header">
        <div>
          <h2>Timetable Audit & Modification Logs</h2>
          <p className="admin-management-desc">
            Complete chronological record of all timetable uploads, overwrites, slot updates, and deletions across academic years.
          </p>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={fetchLogs}
          disabled={loading}
          title="Refresh change logs"
        >
          {loading ? 'Refreshing…' : '↻ Refresh Logs'}
        </button>
      </div>

      {error && (
        <div className="message-box message-box--error" role="alert">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="logs-filter-toolbar">
        <div className="logs-search-box">
          <input
            type="search"
            placeholder="Search by class, user, subject, day..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="input-field"
            aria-label="Filter logs"
          />
        </div>
        <div className="logs-type-tabs" role="tablist" aria-label="Filter by action type">
          {[
            { id: 'ALL', label: 'All Activities' },
            { id: 'OVERWRITE', label: 'Overwrites' },
            { id: 'UPLOAD', label: 'JSON Uploads' },
            { id: 'SLOT', label: 'Slot Edits' },
            { id: 'CLEAR', label: 'Cleared/Deleted' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`logs-type-btn ${filterAction === tab.id ? 'active' : ''}`}
              onClick={() => setFilterAction(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="logs-count-badge">
          <b>{filteredLogs.length}</b> {filteredLogs.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {loading && logs.length === 0 ? (
        <div className="schedule-state schedule-loading">
          <span className="loading-rule" aria-hidden="true" />
          <p>Retrieving timetable modification logs…</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="logs-empty-state">
          <p className="kicker">No modifications found</p>
          <h3>No timetable updates match your search filter.</h3>
          <p>Changes will appear here automatically whenever any administrator or CR edits, uploads, or overrides timetable slots.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table logs-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: '180px' }}>Timestamp</th>
                <th scope="col" style={{ width: '120px' }}>Action</th>
                <th scope="col" style={{ width: '160px' }}>Class / Section</th>
                <th scope="col" style={{ width: '140px' }}>Day & Date</th>
                <th scope="col" style={{ width: '140px' }}>Updated By</th>
                <th scope="col">Details & Changes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const yearLabel = log.year ? `Year ${log.year}` : ''
                const classTitle = [yearLabel, log.branch, log.section ? `Sec ${log.section}` : '']
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <tr key={log.id} className="log-row">
                    <td className="log-timestamp-cell">
                      <span className="log-ts-formatted">{formatTimestamp(log.timestamp)}</span>
                    </td>
                    <td className="log-action-cell">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="log-class-cell">
                      {classTitle ? (
                        <div className="log-class-chip">
                          <b>{classTitle}</b>
                        </div>
                      ) : (
                        <span className="log-muted-text">Global / General</span>
                      )}
                    </td>
                    <td className="log-day-date-cell">
                      {log.day && <div className="log-day-text">{log.day}</div>}
                      {log.date && <div className="log-date-text">{log.date}</div>}
                      {!log.day && !log.date && <span className="log-muted-text">—</span>}
                    </td>
                    <td className="log-user-cell">
                      <div className="log-user-badge">
                        <span className="user-icon" aria-hidden="true">👤</span>
                        <b>{log.performedBy || 'Admin'}</b>
                      </div>
                    </td>
                    <td className="log-details-cell">
                      <div className="log-details-text">{log.details || log.action}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
