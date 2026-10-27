import { useState, useRef } from 'react'
import { uploadTimetable } from '../api/admin.js'

export default function UploadTimetableModal({ isOpen, onClose, onSuccess }) {
  const [jsonText, setJsonText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState(null)
  const [parsingError, setParsingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const safeStr = (v, fallback = 'N/A') => {
    if (v === null || v === undefined) return fallback
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  const parseAndPreview = (text, name = '') => {
    setJsonText(text)
    setParsingError('')
    setUploadError('')
    if (name) setFileName(name)

    if (!text.trim()) {
      setPreview(null)
      return
    }

    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object') {
        setParsingError('The file does not contain a valid JSON object.')
        setPreview(null)
        return
      }

      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          setParsingError('The selected JSON array is empty.')
          setPreview(null)
          return
        }

        const invalidIdx = parsed.findIndex(
          (p) => !p || typeof p !== 'object' || !p.semester || !p.branch || !p.timetable || !p.working_hours
        )
        if (invalidIdx !== -1) {
          setParsingError(
            `Entry #${invalidIdx + 1} in the array is missing required timetable fields ("semester", "branch", "working_hours", or "timetable").`
          )
          setPreview(null)
          return
        }

        const totalCourses = parsed.reduce((acc, p) => acc + (Array.isArray(p.courses) ? p.courses.length : 0), 0)
        const totalPeriods = parsed.reduce((acc, p) => acc + (Array.isArray(p.working_hours?.periods) ? p.working_hours.periods.length : 0), 0)

        setPreview({
          isBatch: true,
          batchCount: parsed.length,
          academicYear: safeStr(parsed[0].academic_year),
          semester: `Batch: ${parsed.length} Classes`,
          branch: parsed.map((p) => p.branch).join(', '),
          effectiveFrom: safeStr(parsed[0].effective_from),
          theoryRoom: `${parsed.length} class schedules combined`,
          totalDays: 6,
          totalCourses,
          totalPeriods,
        })
        return
      }

      if (!parsed.semester || !parsed.branch || !parsed.timetable || !parsed.working_hours) {
        setParsingError('JSON must include "semester", "branch", "working_hours", and "timetable".')
        setPreview(null)
        return
      }

      const totalDays = (parsed.timetable && typeof parsed.timetable === 'object') ? Object.keys(parsed.timetable).length : 0
      const totalCourses = Array.isArray(parsed.courses) ? parsed.courses.length : 0
      const totalPeriods = Array.isArray(parsed.working_hours?.periods) ? parsed.working_hours.periods.length : 0

      setPreview({
        isBatch: false,
        academicYear: safeStr(parsed.academic_year),
        semester: safeStr(parsed.semester),
        branch: safeStr(parsed.branch),
        effectiveFrom: safeStr(parsed.effective_from),
        theoryRoom: safeStr(parsed.classroom?.theory),
        totalDays,
        totalCourses,
        totalPeriods,
      })
    } catch (err) {
      setParsingError(`Invalid JSON syntax: ${err.message}`)
      setPreview(null)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        parseAndPreview(content, file.name)
      }
    }
    reader.onerror = () => {
      setUploadError('Failed to read selected file.')
    }
    reader.readAsText(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!jsonText.trim()) {
      setUploadError('Please select a JSON file or paste timetable JSON text.')
      return
    }

    let payload = null
    try {
      payload = JSON.parse(jsonText)
    } catch (err) {
      setUploadError(`Cannot parse JSON: ${err.message}`)
      return
    }

    setSubmitting(true)
    setUploadError('')

    try {
      const res = await uploadTimetable(payload)
      const message = res?.message || 'Timetable uploaded successfully.'
      if (typeof onSuccess === 'function') {
        try {
          onSuccess(message, res?.data)
        } catch (callErr) {
          console.error('onSuccess callback error:', callErr)
        }
      }
      onClose()
    } catch (err) {
      const fieldErrors = err?.fields ? Object.entries(err.fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : ''
      setUploadError(String(err?.message || 'Failed to upload timetable.') + (fieldErrors ? ` — ${fieldErrors}` : ''))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = () => {
    setJsonText('')
    setFileName('')
    setPreview(null)
    setParsingError('')
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="faculty-dialog upload-timetable-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-dialog-title">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close upload dialog">
          ×
        </button>

        <p className="dialog-eyebrow">Academic Timetable Import</p>
        <h2 id="upload-dialog-title" className="admin-title" style={{ marginTop: 0, marginBottom: '0.4rem' }}>
          Upload Class Timetable
        </h2>
        <p className="admin-subtitle" style={{ marginBottom: '1.25rem' }}>
          Import or sync any class's weekly schedule using the standard institutional JSON schema.
        </p>

        {uploadError && (
          <div className="form-error-alert" role="alert" style={{ marginBottom: '1rem' }}>
            <span aria-hidden="true">⚠</span>
            <p>{uploadError}</p>
          </div>
        )}

        {parsingError && (
          <div className="form-error-alert" role="alert" style={{ marginBottom: '1rem' }}>
            <span aria-hidden="true">⚠</span>
            <p>{parsingError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-form">
          {/* File Picker Zone */}
          <div className="form-group">
            <label className="field-label" htmlFor="timetable-file-input">
              Select Timetable JSON File
            </label>
            <div className="file-drop-zone">
              <input
                id="timetable-file-input"
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                disabled={submitting}
                className="file-hidden-input"
              />
              <label htmlFor="timetable-file-input" className="file-drop-label">
                <span className="file-icon" aria-hidden="true">📁</span>
                <span className="file-prompt">
                  {fileName ? <b>Selected: {fileName}</b> : 'Click or browse to select a .json timetable file'}
                </span>
                <span className="file-hint">Supports full institutional JSON schema</span>
              </label>
            </div>
          </div>

          {/* Or Paste JSON Area */}
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="field-label" htmlFor="timetable-json-text">
                Or Paste Timetable JSON Content
              </label>
              {jsonText && (
                <button type="button" className="text-button" onClick={handleClear} style={{ fontSize: '0.72rem' }}>
                  Clear
                </button>
              )}
            </div>
            <textarea
              id="timetable-json-text"
              rows={8}
              className="text-input"
              style={{ fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'pre' }}
              placeholder='{ "academic_year": "2026-27", "semester": "II Year I Semester", "branch": "CSE I", ... }'
              value={jsonText}
              onChange={(e) => parseAndPreview(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Parsed Preview Card */}
          {preview && (
            <div className="upload-preview-box">
              <span className="preview-heading">
                {preview.isBatch
                  ? `✓ Detected Combined Batch File (${preview.batchCount} Class Timetables)`
                  : '✓ Detected Timetable Details'}
              </span>
              <div className="preview-grid">
                <div>
                  <span className="preview-label">{preview.isBatch ? 'Classes in File' : 'Class'}</span>
                  <b className="preview-val">
                    {preview.isBatch ? `${preview.batchCount} Classes (${preview.branch})` : `${preview.branch} (${preview.semester})`}
                  </b>
                </div>
                <div>
                  <span className="preview-label">Academic Year</span>
                  <b className="preview-val">{preview.academicYear}</b>
                </div>
                <div>
                  <span className="preview-label">Room / Hall</span>
                  <b className="preview-val">{preview.theoryRoom}</b>
                </div>
                <div>
                  <span className="preview-label">Schedule Breakdown</span>
                  <b className="preview-val">
                    {preview.isBatch
                      ? `${preview.batchCount} Timetables · ${preview.totalCourses} Total Courses · ${preview.totalPeriods} Period Definitions`
                      : `${preview.totalDays} Days · ${preview.totalPeriods} Periods · ${preview.totalCourses} Courses`}
                  </b>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="button"
              disabled={submitting || !preview || Boolean(parsingError)}
            >
              {submitting ? 'Importing…' : 'Import & Sync Timetable'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
