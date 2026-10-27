import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClasses } from '../api/public.js'
import { formatDefaultTheoryRoom } from '../utils/roomUtils.js'

export default function AllTimetablesPage() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [yearFilter, setYearFilter] = useState('ALL')
  const [branchQuery, setBranchQuery] = useState('')
  const [viewMode, setViewMode] = useState('matrix') // 'matrix' | 'table'
  const [expandedBranches, setExpandedBranches] = useState({})

  const toggleBranch = (yearNum, branchName) => {
    setExpandedBranches((prev) => {
      const current = prev[yearNum]
      if (current === branchName) {
        const next = { ...prev }
        delete next[yearNum]
        return next
      }
      return { ...prev, [yearNum]: branchName }
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getClasses({ signal: controller.signal })
      .then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
        setClasses(list)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || 'Failed to retrieve classes.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (yearFilter !== 'ALL' && String(cls.year) !== String(yearFilter)) {
        return false
      }
      if (branchQuery.trim()) {
        const q = branchQuery.trim().toLowerCase()
        const matchBranch = (cls.branch || '').toLowerCase().includes(q)
        const matchSec = (cls.section || '').toLowerCase().includes(q)
        const matchLabel = (cls.label || '').toLowerCase().includes(q)
        if (!matchBranch && !matchSec && !matchLabel) return false
      }
      return true
    })
  }, [classes, yearFilter, branchQuery])

  // Group classes by Year -> Branch -> Array of sections for Matrix layout
  const matrixData = useMemo(() => {
    const years = [1, 2, 3, 4]
    const grouped = {}

    years.forEach((y) => {
      grouped[y] = {}
    })

    filteredClasses.forEach((cls) => {
      const y = cls.year || 1
      if (!grouped[y]) grouped[y] = {}
      const b = cls.branch || 'General'
      if (!grouped[y][b]) grouped[y][b] = []
      grouped[y][b].push(cls)
    })

    // Sort sections within each branch
    Object.keys(grouped).forEach((y) => {
      Object.keys(grouped[y]).forEach((b) => {
        grouped[y][b].sort((a, bCls) => String(a.section).localeCompare(String(bCls.section)))
      })
    })

    return grouped
  }, [filteredClasses])


  return (
    <section className="timetable-page timetables-directory-page" aria-labelledby="all-timetables-heading">
      <div className="timetable-wrap timetable-wrap--wide">
        {/* Top bar with back link */}
        <div className="timetable-top-bar">
          <Link className="back-link" to="/">
            ← Back to Home
          </Link>

          <div className="view-mode-toggle" role="tablist" aria-label="Directory Layout View">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'matrix'}
              className={`view-mode-btn ${viewMode === 'matrix' ? 'is-active' : ''}`}
              onClick={() => setViewMode('matrix')}
            >
              Matrix Grid
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'table'}
              className={`view-mode-btn ${viewMode === 'table' ? 'is-active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Columns Table
            </button>
          </div>
        </div>

        {/* Directory Header Banner */}
        <header className="timetable-header timetable-header-sticky" style={{ marginBottom: '1.75rem' }}>
          <div className="timetable-title-group">
            <div className="timetable-meta-badges">
              <span className="kicker">Institutional Catalogue</span>
              <span className="today-badge">{classes.length} Published Schedules</span>
            </div>
            <h1 id="all-timetables-heading">All Timetables</h1>
            <p className="weekday-display">
              Official academic timetable matrix organized by Year, Branch, and Section.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="timetable-controls directory-controls">
            <div className="directory-search">
              <input
                type="search"
                placeholder="Search branch or section..."
                value={branchQuery}
                onChange={(e) => setBranchQuery(e.target.value)}
                className="input-field"
                aria-label="Filter timetable options"
              />
            </div>
          </div>
        </header>

        {/* Year Filter Tabs */}
        <div className="directory-year-bar">
          <span className="year-bar-label">Filter by Year:</span>
          <div className="directory-year-tabs">
            {[
              { id: 'ALL', label: 'All Years' },
              { id: '1', label: 'Year I' },
              { id: '2', label: 'Year II' },
              { id: '3', label: 'Year III' },
              { id: '4', label: 'Year IV' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`directory-year-btn ${yearFilter === tab.id ? 'active' : ''}`}
                onClick={() => setYearFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="directory-match-count">
            Showing <b>{filteredClasses.length}</b> of {classes.length} classes
          </span>
        </div>

        {error && (
          <div className="message-box message-box--error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="schedule-state schedule-loading">
            <span className="loading-rule" aria-hidden="true" />
            <p>Loading institutional timetable matrix…</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="schedule-state schedule-empty">
            <div className="empty-state-badge" aria-hidden="true">📅</div>
            <p className="kicker">No matches found</p>
            <h2>No timetables found for the selected filter.</h2>
            <p>Try clearing your branch search query or selecting "All Years".</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setYearFilter('ALL')
                setBranchQuery('')
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'matrix' ? (
          /* MATRIX GRID VIEW: Dynamic Year rows with Branch pills (e.g. CSE:10) that expand below with card dealing */
          <div className="timetable-matrix-container">
            <table className="timetables-matrix-table" aria-label="Academic Timetable Matrix">
              <thead>
                <tr>
                  <th scope="col" className="matrix-col-year">
                    Year of Study
                  </th>
                  <th scope="col" className="matrix-col-branches">
                    Academic Branches & Sections (Click a branch to view sections)
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4]
                  .filter((y) => yearFilter === 'ALL' || String(y) === String(yearFilter))
                  .map((yearNum) => {
                    const branchesInYear = Object.keys(matrixData[yearNum] || {})
                    if (branchesInYear.length === 0) {
                      return (
                        <tr key={yearNum} className="matrix-table-row">
                          <th scope="row" className="matrix-cell-year">
                            <span className="year-pill">Year {yearNum}</span>
                          </th>
                          <td className="matrix-empty-cell">
                            No classes scheduled for Year {yearNum}
                          </td>
                        </tr>
                      )
                    }

                    const totalSectionsInYear = branchesInYear.reduce(
                      (sum, b) => sum + (matrixData[yearNum][b]?.length || 0),
                      0
                    )
                    const activeBranch = expandedBranches[yearNum]
                    const isAnyExpanded = Boolean(activeBranch && matrixData[yearNum][activeBranch])

                    return (
                      <Fragment key={yearNum}>
                        <tr className={`matrix-table-row matrix-year-row ${isAnyExpanded ? 'is-year-expanded' : ''}`}>
                          <th scope="row" className="matrix-cell-year">
                            <div className="year-cell-content">
                              <span className="year-num-badge">Year {yearNum}</span>
                              <span className="year-roman">
                                {yearNum === 1 ? 'I' : yearNum === 2 ? 'II' : yearNum === 3 ? 'III' : 'IV'}
                              </span>
                              <span className="year-stat-meta">
                                {branchesInYear.length} {branchesInYear.length === 1 ? 'branch' : 'branches'} · {totalSectionsInYear} {totalSectionsInYear === 1 ? 'sec' : 'secs'}
                              </span>
                            </div>
                          </th>

                          <td className="matrix-cell-branches">
                            <div className="matrix-branch-row-inner">
                              <div className="branch-pills-cluster" role="group" aria-label={`Year ${yearNum} Branches`}>
                                {branchesInYear.map((branchName) => {
                                  const sectionClasses = matrixData[yearNum][branchName] || []
                                  const isExpanded = activeBranch === branchName
                                  return (
                                    <button
                                      key={branchName}
                                      type="button"
                                      className={`branch-pill-btn ${isExpanded ? 'is-active' : ''}`}
                                      onClick={() => toggleBranch(yearNum, branchName)}
                                      aria-expanded={isExpanded}
                                      aria-controls={`deck-${yearNum}-${branchName}`}
                                      title={`${isExpanded ? 'Collapse' : 'Expand'} ${branchName} sections`}
                                    >
                                      <span className="branch-code">{branchName}</span>
                                      <span className="branch-count-badge">:{sectionClasses.length}</span>
                                      <span className="branch-indicator-chevron" aria-hidden="true">
                                        {isExpanded ? '▲' : '▼'}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>

                              <span className="branch-row-hint">
                                {activeBranch ? (
                                  <>Showing <b>{activeBranch}</b> sections below</>
                                ) : (
                                  <>Click any branch to view sections</>
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Expansion row displaying section cards with spreading card dealing effect */}
                        {isAnyExpanded && (
                          <tr className="matrix-drawer-row">
                            <td colSpan={2} className="matrix-drawer-cell">
                              <div
                                id={`deck-${yearNum}-${activeBranch}`}
                                className="card-dealer-drawer"
                                key={`${yearNum}-${activeBranch}`}
                              >
                                <div className="dealer-drawer-bar">
                                  <div className="dealer-drawer-info">
                                    <span className="dealer-deck-pill">
                                      🗂️ {activeBranch} Dept
                                    </span>
                                    <h3 className="dealer-drawer-title">
                                      Year {yearNum} · {activeBranch} Department ({matrixData[yearNum][activeBranch].length} {matrixData[yearNum][activeBranch].length === 1 ? 'Section' : 'Sections'})
                                    </h3>
                                    <span className="dealer-instruction">
                                      Select a section card to open its timetable
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="dealer-close-btn"
                                    onClick={() => toggleBranch(yearNum, activeBranch)}
                                    title={`Collapse ${activeBranch}`}
                                  >
                                    Close ✕
                                  </button>
                                </div>

                                <div
                                  className="dealer-cards-deck"
                                  role="list"
                                  aria-label={`${activeBranch} sections`}
                                >
                                  {matrixData[yearNum][activeBranch].map((cls, idx) => {
                                    const theoryRoom = formatDefaultTheoryRoom(cls.metadata?.classroom?.theory)
                                    const rotValues = [-4, -2, 0, 2, 4, -3, 3]
                                    const dealRot = rotValues[idx % rotValues.length]
                                    const dealDelay = idx * 55

                                    return (
                                      <Link
                                        key={cls.id}
                                        to={`/timetable/${cls.id}`}
                                        className="dealer-card"
                                        style={{
                                          '--deal-idx': idx,
                                          '--deal-delay': `${dealDelay}ms`,
                                          '--deal-rot': `${dealRot}deg`,
                                        }}
                                        role="listitem"
                                        title={`View ${cls.label} Timetable`}
                                      >
                                        <div className="dealer-card-top">
                                          <span className="dealer-section-tag">
                                            Section {cls.section}
                                          </span>
                                          <span className="dealer-card-badge-num">
                                            #{idx + 1}
                                          </span>
                                        </div>

                                        <div className="dealer-card-body">
                                          <h4 className="dealer-class-label">{cls.label}</h4>
                                          {theoryRoom ? (
                                            <span className="dealer-room-badge">
                                              Room {theoryRoom}
                                            </span>
                                          ) : (
                                            <span className="dealer-room-badge is-tba">
                                              Room TBA
                                            </span>
                                          )}
                                          <p className="dealer-term-text">
                                            {cls.semester || cls.academicYear || 'Academic Year'}
                                          </p>
                                        </div>

                                        <div className="dealer-card-footer">
                                          <span className="dealer-action-text">View timetable</span>
                                          <span className="dealer-action-arrow" aria-hidden="true">→</span>
                                        </div>
                                      </Link>
                                    )
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          /* COLUMNS TABLE VIEW: Year, Branch, Section as distinct columns with Options */
          <div className="admin-table-wrapper directory-table-wrap">
            <table className="admin-table directory-columns-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '130px' }}>Year</th>
                  <th scope="col" style={{ width: '180px' }}>Branch</th>
                  <th scope="col" style={{ width: '130px' }}>Section</th>
                  <th scope="col" style={{ width: '220px' }}>Academic Term</th>
                  <th scope="col" style={{ width: '160px' }}>Room / Hall</th>
                  <th scope="col" className="text-right">Action Option</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((cls) => {
                  const theoryRoom = formatDefaultTheoryRoom(cls.metadata?.classroom?.theory, 'Theory Hall')
                  return (
                    <tr key={cls.id} className="directory-row">
                      <td>
                        <span className="table-year-badge">Year {cls.year}</span>
                      </td>
                      <td>
                        <b className="directory-branch-text">{cls.branch}</b>
                      </td>
                      <td>
                        <span className="directory-section-badge">Section {cls.section}</span>
                      </td>
                      <td>
                        <span className="directory-semester-text">
                          {cls.semester || cls.academicYear || 'Current Academic Year'}
                        </span>
                      </td>
                      <td>
                        <span className="directory-room-text">{theoryRoom}</span>
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/timetable/${cls.id}`}
                          className="button button--small directory-view-btn"
                        >
                          View Timetable →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
