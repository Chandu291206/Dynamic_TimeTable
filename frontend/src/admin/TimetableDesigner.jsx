import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getAdminClasses,
  getAdminSubjects,
  getAdminFaculty,
  getDesignerDrafts,
  getDesignerDraft,
  createDesignerDraft,
  updateDesignerCell,
  clearDesignerCell,
  getDesignerAvailability,
  validateDesignerDraft,
  publishDesignerDraft,
  discardDesignerDraft,
} from '../api/admin.js'
import DesignerCellEditor from './DesignerCellEditor.jsx'
import FacultyAvatar from '../components/FacultyAvatar.jsx'
import { useToast } from '../components/Toast.jsx'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function TimetableDesigner({ classId: propClassId }) {
  const { classId: routeClassId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const selectedClassId = propClassId || routeClassId || ''

  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [faculty, setFaculty] = useState([])

  const [currentDraft, setCurrentDraft] = useState(null)
  const [periods, setPeriods] = useState([])
  const [busyMap, setBusyMap] = useState({})
  const [validation, setValidation] = useState({ isValid: true, clashes: [] })

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

  // Cell editor modal state
  const [editingCell, setEditingCell] = useState(null)

  // Publish confirmation modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [publishWarnings, setPublishWarnings] = useState([])

  // Load baseline resources (classes, subjects, faculty)
  useEffect(() => {
    let mounted = true
    async function loadMeta() {
      try {
        const [clsRes, subjRes, facRes] = await Promise.all([
          getAdminClasses(),
          getAdminSubjects(),
          getAdminFaculty(),
        ])
        if (mounted) {
          setClasses(clsRes.data || [])
          setSubjects(subjRes.data || [])
          setFaculty(facRes.data || [])
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load metadata')
      }
    }
    loadMeta()
    return () => { mounted = false }
  }, [])

  // Load draft for selected class
  const loadDraftForClass = useCallback(async (targetClassId) => {
    if (!targetClassId) {
      setCurrentDraft(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Find open draft for class
      const draftsRes = await getDesignerDrafts()
      const openDraft = (draftsRes.data || []).find(
        (d) => Number(d.classId) === Number(targetClassId) && d.status === 'OPEN'
      )

      if (openDraft) {
        // Load detailed draft data
        const draftDetailRes = await getDesignerDraft(openDraft.id)
        setCurrentDraft(draftDetailRes.data.draft)
        setPeriods(draftDetailRes.data.periods || [])
        setValidation(draftDetailRes.data.validation || { isValid: true, clashes: [] })

        // Load availability busy map
        const availRes = await getDesignerAvailability(openDraft.id)
        setBusyMap(availRes.data?.busyMap || {})
      } else {
        setCurrentDraft(null)
      }
    } catch (err) {
      setError(err.message || 'Failed to load timetable draft')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDraftForClass(selectedClassId)
  }, [selectedClassId, loadDraftForClass])

  const handleClassChange = (newId) => {
    if (propClassId) {
      loadDraftForClass(newId)
    } else {
      navigate(`/admin/designer/${newId}`)
    }
  }

  // Create draft
  const handleCreateDraft = async (startFrom) => {
    if (!selectedClassId) return
    setActionLoading(true)
    try {
      const res = await createDesignerDraft({
        classId: Number(selectedClassId),
        startFrom,
      })
      showToast('Timetable draft created', 'success')
      await loadDraftForClass(selectedClassId)
    } catch (err) {
      showToast(err.message || 'Failed to create draft', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Save cell from editor
  const handleSaveCell = async (cellPayload) => {
    if (!currentDraft) return
    const res = await updateDesignerCell(currentDraft.id, cellPayload)

    showToast('Slot updated', 'success')

    // Refresh draft details
    await loadDraftForClass(selectedClassId)
  }

  // Clear cell from editor
  const handleClearCell = async (clearPayload) => {
    if (!currentDraft) return
    await clearDesignerCell(currentDraft.id, clearPayload)
    showToast('Slot cleared', 'success')
    await loadDraftForClass(selectedClassId)
  }

  // Run full validation check
  const handleValidate = async () => {
    if (!currentDraft) return
    setActionLoading(true)
    try {
      const res = await validateDesignerDraft(currentDraft.id)
      setValidation(res.data)
      if (res.data.isValid) {
        showToast('Draft is clean with zero clashes!', 'success')
      } else {
        showToast(`Found ${res.data.totalClashes} conflict(s). Review conflict banner.`, 'warning')
      }
    } catch (err) {
      showToast(err.message || 'Validation failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Publish draft
  const handlePublish = async () => {
    if (!currentDraft) return
    setActionLoading(true)
    try {
      const res = await publishDesignerDraft(currentDraft.id)
      showToast(res.message || 'Timetable published successfully!', 'success')
      setPublishWarnings(res.data?.impactWarnings || [])
      setPublishModalOpen(true)
      await loadDraftForClass(selectedClassId)
    } catch (err) {
      if (err.clashes && err.clashes.length > 0) {
        setValidation({ isValid: false, clashes: err.clashes })
      }
      showToast(err.message || 'Publish failed due to conflicts', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Discard draft
  const handleDiscard = async () => {
    if (!currentDraft) return
    if (!window.confirm('Are you sure you want to discard this draft? Unsaved changes will be lost.')) return
    setActionLoading(true)
    try {
      await discardDesignerDraft(currentDraft.id)
      showToast('Draft discarded', 'info')
      await loadDraftForClass(selectedClassId)
    } catch (err) {
      showToast(err.message || 'Failed to discard draft', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Compute faculty workload breakdown from current draft slots
  const facultyLoad = useMemo(() => {
    if (!currentDraft?.slots) return []
    const countMap = {}

    for (const slot of currentDraft.slots) {
      // Calculate how many periods this slot spans
      let duration = 1
      if (periods.length > 0) {
        const startIdx = periods.findIndex((p) => p.startTime === slot.startTime)
        const endIdx = periods.findIndex((p) => p.endTime === slot.endTime)
        if (startIdx >= 0 && endIdx >= startIdx) {
          duration = endIdx - startIdx + 1
        }
      }

      if (slot.facultyId) {
        if (!countMap[slot.facultyId]) {
          countMap[slot.facultyId] = {
            id: slot.facultyId,
            name: slot.faculty?.name || `#${slot.facultyId}`,
            staffId: slot.faculty?.staffId,
            periods: 0,
            courses: new Set(),
          }
        }
        countMap[slot.facultyId].periods += duration
        if (slot.subject?.code) countMap[slot.facultyId].courses.add(slot.subject.code)
      }

      if (slot.batchBFacultyId) {
        if (!countMap[slot.batchBFacultyId]) {
          countMap[slot.batchBFacultyId] = {
            id: slot.batchBFacultyId,
            name: slot.batchBFaculty?.name || `#${slot.batchBFacultyId}`,
            staffId: slot.batchBFaculty?.staffId,
            periods: 0,
            courses: new Set(),
          }
        }
        countMap[slot.batchBFacultyId].periods += duration
        if (slot.subject?.code) countMap[slot.batchBFacultyId].courses.add(slot.subject.code)
      }
    }

    return Object.values(countMap).sort((a, b) => b.periods - a.periods)
  }, [currentDraft, periods])

  const selectedClass = classes.find((c) => String(c.id) === String(selectedClassId))

  return (
    <section className="designer-page" aria-label="Timetable Designer">
      {/* Top Controls & Class Selector */}
      <div className="designer-header-bar">
        <div className="designer-class-picker-wrap">
          <label htmlFor="designer-class-select" className="designer-label">Select Class:</label>
          <select
            id="designer-class-select"
            className="designer-class-select"
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
          >
            <option value="">&mdash; Choose Class &mdash;</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || `Year ${c.year} - ${c.branch} - ${c.section}`} ({c.academicYear})
              </option>
            ))}
          </select>
        </div>

        {currentDraft && (
          <div className="designer-draft-status">
            <span className="badge badge--success">Draft v{currentDraft.version}</span>
            <span className="designer-status-tag">Status: <strong>{currentDraft.status}</strong></span>
            <span className="designer-muted-date">Updated: {new Date(currentDraft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}

        {currentDraft && (
          <div className="designer-actions-toolbar">
            <button
              type="button"
              className="button button--secondary"
              onClick={handleValidate}
              disabled={actionLoading}
              title="Validate entire timetable draft against other classes"
            >
              Validate
            </button>
            <button
              type="button"
              className="button button--danger-outline"
              onClick={handleDiscard}
              disabled={actionLoading}
              title="Discard this draft and revert changes"
            >
              Discard
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={handlePublish}
              disabled={actionLoading || !validation.isValid}
              title={validation.isValid ? 'Publish timetable to live system' : 'Fix conflicts before publishing'}
            >
              {actionLoading ? 'Publishing...' : 'Publish Timetable'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="notice-banner notice-banner--danger" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Clashes Notification Bar */}
      {validation.clashes && validation.clashes.length > 0 && (
        <div className="notice-banner notice-banner--danger" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <strong>{validation.clashes.length} Timetable Conflict(s) Detected:</strong>
          </div>
          <ul className="designer-clash-list">
            {validation.clashes.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* No Class Selected State */}
      {!selectedClassId && (
        <div className="designer-empty-state">
          <p>Please select a class above to open or create a timetable draft.</p>
        </div>
      )}

      {/* Class Selected but No Draft State */}
      {selectedClassId && !loading && !currentDraft && (
        <div className="designer-no-draft-card">
          <div className="no-draft-icon">🎨</div>
          <h3>No Active Draft for {selectedClass?.label || 'Selected Class'}</h3>
          <p>Create a draft to design and customize this class's weekly schedule with automatic clash prevention.</p>
          <div className="no-draft-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => handleCreateDraft('published')}
              disabled={actionLoading}
            >
              Start From Published Timetable
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => handleCreateDraft('blank')}
              disabled={actionLoading}
            >
              Start With Blank Timetable
            </button>
          </div>
        </div>
      )}

      {/* Interactive Matrix Grid */}
      {currentDraft && periods.length > 0 && (
        <div className="designer-grid-container">
          <div className="weekly-matrix-scroll-wrap">
            <table className="weekly-matrix-table">
              <thead>
                <tr>
                  <th scope="col" className="matrix-th-day">Day</th>
                  {periods.map((p, idx) => (
                    <th
                      key={p.id || idx}
                      scope="col"
                      className={`matrix-th-period ${p.isBreak ? 'matrix-th-lunch' : ''}`}
                    >
                      <span className="matrix-th-period-label">
                        {p.isBreak ? 'BREAK' : (p.name || `P${p.periodNumber || idx + 1}`)}
                      </span>
                      <span className="matrix-th-time">
                        {p.startTime}&ndash;{p.endTime}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_NAMES.map((dayName, dayIdx) => {
                  const daySlots = currentDraft.slots.filter((s) => s.day === dayIdx)

                  // Track spanned periods to skip rendered cells
                  const skippedPeriodIndices = new Set()

                  return (
                    <tr key={dayIdx} className="matrix-row">
                      <th scope="row" className="matrix-td-day">
                        <div className="matrix-day-cell-inner">
                          <span className="matrix-day-name">{dayName}</span>
                        </div>
                      </th>

                      {periods.map((period, pIdx) => {
                        if (skippedPeriodIndices.has(pIdx)) {
                          return null
                        }

                        // Check if a slot starts exactly at this period's start time
                        const slot = daySlots.find((s) => s.startTime === period.startTime)

                        if (slot) {
                          // Calculate period span
                          const endIdx = periods.findIndex((p) => p.endTime === slot.endTime)
                          let span = 1
                          if (endIdx >= pIdx) {
                            span = endIdx - pIdx + 1
                            for (let i = pIdx + 1; i <= endIdx; i++) {
                              skippedPeriodIndices.add(i)
                            }
                          }

                          // Check if slot has conflict
                          const isClashing = validation.clashes.some(
                            (c) => c.day === dayIdx && (c.candidate?.startTime === slot.startTime || c.startTime === slot.startTime)
                          )

                          const subject = slot.subject
                          const faculty = slot.faculty
                          const batchB = slot.batchBFaculty
                          const isBreak = subject?.isBreak || subject?.code === 'LUNCH'

                          return (
                            <td
                              key={pIdx}
                              colSpan={span}
                              className={`matrix-td-cell matrix-td-session ${isBreak ? 'matrix-td-lunch' : ''} ${isClashing ? 'matrix-td-cell--clash' : ''}`}
                            >
                              <button
                                type="button"
                                className="matrix-slot-btn"
                                onClick={() => setEditingCell({ day: dayIdx, startTime: period.startTime, endTime: slot.endTime, slot })}
                                title={`Click to edit ${subject?.code || 'Slot'} (${slot.startTime}–${slot.endTime})`}
                              >
                                {isBreak ? (
                                  <div style={{ textAlign: 'center', padding: '0.5rem', fontWeight: 800 }}>
                                    {subject?.code || 'BREAK'}
                                  </div>
                                ) : (
                                  <div className="matrix-slot-cell-row">
                                    <div className="matrix-slot-avatar-wrap">
                                      <FacultyAvatar faculty={faculty} size="cell" />
                                    </div>
                                    <div className="matrix-slot-beside">
                                      <span className="matrix-slot-subject">
                                        {subject?.code || '---'}
                                      </span>
                                      <span className="matrix-slot-faculty-name" title={faculty?.name || 'Unassigned'}>
                                        {faculty?.name || 'Unassigned'}
                                      </span>
                                      {batchB && (
                                        <span className="designer-batch-b-tag" title={`Batch B: ${batchB.name}`}>
                                          B: {batchB.name.split(' ').slice(0, 2).join(' ')}
                                        </span>
                                      )}
                                      {span > 1 && (
                                        <span className="override-badge" style={{ background: '#546e7a' }}>
                                          Lab ({span}P)
                                        </span>
                                      )}
                                      {isClashing && (
                                        <span className="badge badge--danger" style={{ fontSize: '0.65rem' }}>
                                          Conflict
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </button>
                            </td>
                          )
                        }

                        // Empty period cell
                        return (
                          <td
                            key={pIdx}
                            className="matrix-td-cell matrix-td-empty"
                          >
                            <button
                              type="button"
                              className="matrix-slot-btn matrix-slot-btn--add"
                              onClick={() => setEditingCell({ day: dayIdx, startTime: period.startTime, endTime: period.endTime, slot: null })}
                              title={`Assign session for ${dayName} ${period.startTime}–${period.endTime}`}
                            >
                              <span className="designer-add-plus">+</span>
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Faculty Teaching Load Card */}
          <div className="weekly-bottom-grid" style={{ marginTop: '1.5rem' }}>
            <section className="weekly-bottom-card" aria-labelledby="load-heading">
              <div className="bottom-card-header">
                <h2 id="load-heading" className="bottom-card-title">
                  Faculty Teaching Load in this Draft
                </h2>
                <span className="bottom-card-count">
                  {facultyLoad.length} faculty assigned
                </span>
              </div>
              <div className="bottom-table-wrap">
                <table className="directory-table">
                  <thead>
                    <tr>
                      <th scope="col">Faculty Name</th>
                      <th scope="col">Staff ID</th>
                      <th scope="col">Assigned Courses</th>
                      <th scope="col">Total Periods / Week</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyLoad.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="directory-empty">
                          No faculty assigned to draft yet.
                        </td>
                      </tr>
                    ) : (
                      facultyLoad.map((f) => (
                        <tr key={f.id}>
                          <td className="directory-faculty-name">
                            <strong>{f.name}</strong>
                          </td>
                          <td className="directory-meta">
                            {f.staffId || '—'}
                          </td>
                          <td>
                            {Array.from(f.courses).join(', ') || '—'}
                          </td>
                          <td>
                            <span className="badge badge--primary" style={{ fontWeight: 700 }}>
                              {f.periods} {f.periods === 1 ? 'period' : 'periods'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Cell Editor Modal Dialog */}
      {editingCell && (
        <DesignerCellEditor
          cell={editingCell}
          periods={periods}
          subjects={subjects}
          faculty={faculty}
          busyMap={busyMap}
          expectedVersion={currentDraft?.version}
          onSave={handleSaveCell}
          onClear={handleClearCell}
          onClose={() => setEditingCell(null)}
        />
      )}

      {/* Post-Publish Impact Warnings Modal */}
      {publishModalOpen && (
        <div className="designer-modal-backdrop" onClick={() => setPublishModalOpen(false)}>
          <div className="designer-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="designer-modal-header">
              <h3>Timetable Successfully Published! 🎉</h3>
              <button type="button" className="close-btn" onClick={() => setPublishModalOpen(false)}>&times;</button>
            </header>
            <div style={{ padding: '1rem 0' }}>
              <p>The updated schedule is now active on the public timetables portal.</p>
              {publishWarnings.length > 0 ? (
                <div className="notice-banner notice-banner--warning" style={{ marginTop: '1rem' }}>
                  <strong>Override Impact Notice:</strong>
                  <p>The following future-dated CR overrides no longer overlap any timetable slot in the published schedule:</p>
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                    {publishWarnings.map((w, idx) => (
                      <li key={idx}>
                        <strong>{w.date} ({w.startTime}&ndash;{w.endTime})</strong>: {w.subjectName} ({w.facultyName})
                      </li>
                    ))}
                  </ul>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    These overrides remain preserved in the system for administrative review.
                  </p>
                </div>
              ) : (
                <p style={{ color: 'var(--pine)', fontWeight: 600, marginTop: '0.5rem' }}>
                  All future overrides remain fully aligned with the published slots.
                </p>
              )}
            </div>
            <div className="designer-modal-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => setPublishModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
