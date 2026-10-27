import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { convertTimetableWorkbook } from '../utils/excelTimetableConverter.js'
import { uploadTimetable } from '../api/admin.js'

export default function UploadExcelModal({ isOpen, onClose, onSuccess }) {
  const [fileName, setFileName] = useState('')
  const [classesData, setClassesData] = useState(null)
  const [parsingError, setParsingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleFile = async (file) => {
    if (!file) return
    setFileName(file.name)
    setParsingError('')
    setUploadError('')
    setClassesData(null)

    try {
      console.log('[UploadExcel] Reading file:', file.name, 'size:', file.size)
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const xlsxObj = XLSX.read ? XLSX : (XLSX.default || XLSX)
      const workbook = xlsxObj.read(bytes, { type: 'array' })
      console.log('[UploadExcel] Workbook sheet names:', workbook?.SheetNames)

      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        setParsingError('The selected Excel file contains no valid sheets.')
        return
      }

      const parsedClasses = convertTimetableWorkbook(workbook)
      console.log('[UploadExcel] parsedClasses count:', parsedClasses?.length)

      if (!parsedClasses || parsedClasses.length === 0) {
        setParsingError(
          'Could not extract timetable data from the Excel sheets. Please verify the sheet headers match the institutional timetable format.'
        )
        return
      }

      setClassesData(parsedClasses)
    } catch (err) {
      console.error('[UploadExcel] Error processing workbook:', err)
      setParsingError(`Failed to process Excel workbook: ${err.message || String(err)}`)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDownloadJson = () => {
    if (!classesData) return
    const jsonStr = JSON.stringify(classesData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName ? fileName.replace(/\.[^/.]+$/, '') + '.json' : 'converted_timetables.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!classesData || classesData.length === 0) {
      setUploadError('Please select a valid Excel timetable file first.')
      return
    }

    setSubmitting(true)
    setUploadError('')

    try {
      const res = await uploadTimetable(classesData)
      const message = res?.message || `Successfully imported ${classesData.length} classes from Excel.`
      if (typeof onSuccess === 'function') {
        onSuccess(message, res?.data)
      }
      onClose()
    } catch (err) {
      const fieldErrors = err?.fields
        ? Object.entries(err.fields)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('; ')
        : ''
      setUploadError(String(err?.message || 'Failed to upload converted timetable.') + (fieldErrors ? ` — ${fieldErrors}` : ''))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = () => {
    setFileName('')
    setClassesData(null)
    setParsingError('')
    setUploadError('')
    setShowJsonPreview(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalCourses = classesData
    ? classesData.reduce((acc, c) => acc + (Array.isArray(c.courses) ? c.courses.length : 0), 0)
    : 0

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="faculty-dialog upload-timetable-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-excel-title"
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close upload dialog">
          ×
        </button>

        <p className="dialog-eyebrow">Academic Excel Workbook Import</p>
        <h2 id="upload-excel-title" className="admin-title" style={{ marginTop: 0, marginBottom: '0.4rem' }}>
          Upload & Convert Timetable (.xlsx)
        </h2>
        <p className="admin-subtitle" style={{ marginBottom: '1.25rem' }}>
          Automatically converts departmental Excel timetable sheets into structured timetable objects for database import or JSON export.
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
            <label className="field-label" htmlFor="timetable-excel-input">
              Select Timetable Excel File (.xlsx)
            </label>
            <div
              className="file-drop-zone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                id="timetable-excel-input"
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                disabled={submitting}
                className="file-hidden-input"
              />
              <label htmlFor="timetable-excel-input" className="file-drop-label">
                <span className="file-icon" aria-hidden="true">📊</span>
                <span className="file-prompt">
                  {fileName ? <b>Selected: {fileName}</b> : 'Click or drag & drop an Excel (.xlsx) timetable file'}
                </span>
                <span className="file-hint">
                  Automatically parses all sheets, schedules, periods, coordinators, labs & almanac
                </span>
              </label>
            </div>
          </div>

          {/* Parsed Preview Card */}
          {classesData && classesData.length > 0 && (
            <div className="upload-preview-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span className="preview-heading" style={{ margin: 0 }}>
                  ✓ Converted {classesData.length} Classes from Excel
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={handleDownloadJson}
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem' }}
                    title="Download converted timetable as JSON file"
                  >
                    📥 Download JSON
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem' }}
                  >
                    {showJsonPreview ? 'Hide JSON' : 'View JSON'}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={handleClear}
                    style={{ fontSize: '0.74rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="preview-stats-grid">
                <div className="preview-stat-card">
                  <span className="preview-stat-label">Academic Year</span>
                  <span className="preview-stat-value">{classesData[0].academic_year || 'N/A'}</span>
                </div>
                <div className="preview-stat-card">
                  <span className="preview-stat-label">Semester</span>
                  <span className="preview-stat-value">{classesData[0].semester || 'N/A'}</span>
                </div>
                <div className="preview-stat-card">
                  <span className="preview-stat-label">Classes Detected</span>
                  <span className="preview-stat-value">{classesData.length} Classes</span>
                </div>
                <div className="preview-stat-card">
                  <span className="preview-stat-label">Total Courses</span>
                  <span className="preview-stat-value">{totalCourses} Subjects</span>
                </div>
                <div className="preview-stat-card">
                  <span className="preview-stat-label">Effective From</span>
                  <span className="preview-stat-value">{classesData[0].effective_from || 'N/A'}</span>
                </div>
                <div className="preview-stat-card">
                  <span className="preview-stat-label">Periods / Day</span>
                  <span className="preview-stat-value">{classesData[0].working_hours?.periods?.length || 7} Periods</span>
                </div>
              </div>

              {/* Class Chips */}
              <div style={{ marginTop: '0.75rem' }}>
                <span className="preview-stat-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  Classes to Import:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {classesData.map((c, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '0.25rem 0.55rem',
                        background: '#f4ede1',
                        border: '1px solid #dcd1be',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        color: 'var(--ink)',
                      }}
                    >
                      {c.branch} {c.classroom?.class_coordinator ? `(Coord: ${c.classroom.class_coordinator})` : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Collapsible JSON string */}
              {showJsonPreview && (
                <div style={{ marginTop: '1rem' }}>
                  <label className="field-label">Converted JSON Payload (Array of Objects):</label>
                  <textarea
                    readOnly
                    rows={8}
                    className="text-input"
                    style={{ fontFamily: 'monospace', fontSize: '0.74rem', whiteSpace: 'pre', background: '#fff' }}
                    value={JSON.stringify(classesData, null, 2)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="dialog-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button"
              disabled={submitting || !classesData || classesData.length === 0}
            >
              {submitting ? 'Importing Classes...' : `🚀 Import ${classesData ? classesData.length : ''} Classes into Database`}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
