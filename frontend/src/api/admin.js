import { apiDelete, apiGet, apiPost, apiPut, apiUrl } from './client.js'

// Faculty
export const getAdminFaculty = (options) => apiGet('/api/admin/faculty', options)
export const getAdminFacultySyncStatus = (options) => apiGet('/api/admin/faculty/sync/status', options)
export const triggerFacultySync = (options) => apiPost('/api/admin/faculty/sync', {}, options)
export const scrapeFacultyWeb = (id = null, options) => {
  const endpoint = id ? `/api/admin/faculty/${id}/scrape-web` : '/api/admin/faculty/scrape-web'
  return apiPost(endpoint, {}, options)
}
export const createFaculty = (data, options) => apiPost('/api/admin/faculty', data, options)
export const updateFaculty = (id, data, options) => apiPut(`/api/admin/faculty/${id}`, data, options)
export const deleteFaculty = (id, options) => apiDelete(`/api/admin/faculty/${id}`, options)
export const proxyPdfUrl = (url) => apiUrl(`/api/admin/faculty/proxy-pdf?url=${encodeURIComponent(url)}`)
export const extractPdfText = (payload, options) => apiPost('/api/admin/faculty/extract-pdf-text', payload, options)

// Subjects
export const getAdminSubjects = (options) => apiGet('/api/admin/subjects', options)
export const createSubject = (data, options) => apiPost('/api/admin/subjects', data, options)
export const updateSubject = (id, data, options) => apiPut(`/api/admin/subjects/${id}`, data, options)
export const deleteSubject = (id, options) => apiDelete(`/api/admin/subjects/${id}`, options)

// Classes
export const getAdminClasses = (options) => apiGet('/api/admin/classes', options)
export const createClass = (data, options) => apiPost('/api/admin/classes', data, options)
export const uploadTimetable = (data, options) => apiPost('/api/admin/timetable/upload', data, options)
export const updateClass = (id, data, options) => apiPut(`/api/admin/classes/${id}`, data, options)
export const clearClassTimetable = (id, options) => apiDelete(`/api/admin/classes/${id}/timetable`, options)
export const deleteClass = (id, options) => apiDelete(`/api/admin/classes/${id}`, options)

// Slots
export const getAdminSlots = (classId, options) => {
  const query = classId ? `?classId=${encodeURIComponent(classId)}` : ''
  return apiGet(`/api/admin/slots${query}`, options)
}
export const createSlot = (data, options) => apiPost('/api/admin/slots', data, options)
export const updateSlot = (id, data, options) => apiPut(`/api/admin/slots/${id}`, data, options)
export const deleteSlot = (id, options) => apiDelete(`/api/admin/slots/${id}`, options)

// Accounts (CR, Faculty, HOD)
export const getAdminCRs = (options) => apiGet('/api/admin/crs', options)
export const createCR = (data, options) => apiPost('/api/admin/crs', data, options)
export const updateCR = (id, data, options) => apiPut(`/api/admin/crs/${id}`, data, options)
export const assignCRClass = (id, classId, options) => apiPut(`/api/admin/crs/${id}/class`, { classId }, options)
export const deleteCR = (id, options) => apiDelete(`/api/admin/crs/${id}`, options)

export const getAdminAccounts = (options) => apiGet('/api/admin/accounts', options)
export const createAccount = (data, options) => apiPost('/api/admin/accounts', data, options)
export const updateAccount = (id, data, options) => apiPut(`/api/admin/accounts/${id}`, data, options)
export const deleteAccount = (id, options) => apiDelete(`/api/admin/accounts/${id}`, options)

// Logs
export const getTimetableLogs = (options) => apiGet('/api/admin/logs', options)

// Periods
export const getAdminPeriods = (options) => apiGet('/api/admin/periods', options)

// Conflicts & Faculty Availability
export const getAdminConflicts = (options) => apiGet('/api/admin/conflicts', options)
export const getFacultyBusyMap = (excludeClassId = null, options) => {
  const query = excludeClassId ? `?excludeClassId=${encodeURIComponent(excludeClassId)}` : ''
  return apiGet(`/api/admin/faculty-busy-map${query}`, options)
}

// Timetable Designer (Phase 5)
export const createDesignerDraft = (data, options) => apiPost('/api/admin/designer/drafts', data, options)
export const getDesignerDrafts = (options) => apiGet('/api/admin/designer/drafts', options)
export const getDesignerDraft = (draftId, options) => apiGet(`/api/admin/designer/drafts/${draftId}`, options)
export const updateDesignerCell = (draftId, data, options) => apiPut(`/api/admin/designer/drafts/${draftId}/cells`, data, options)
export const clearDesignerCell = (draftId, data, options) => apiDelete(`/api/admin/designer/drafts/${draftId}/cells`, { ...options, body: data })
export const getDesignerAvailability = (draftId, options) => apiGet(`/api/admin/designer/drafts/${draftId}/availability`, options)
export const validateDesignerDraft = (draftId, options) => apiPost(`/api/admin/designer/drafts/${draftId}/validate`, {}, options)
export const publishDesignerDraft = (draftId, options) => apiPost(`/api/admin/designer/drafts/${draftId}/publish`, {}, options)
export const discardDesignerDraft = (draftId, options) => apiDelete(`/api/admin/designer/drafts/${draftId}`, options)

// Live Monitor & Master Matrix
export const getAdminLiveMonitor = (params = {}, options) => {
  const query = new URLSearchParams()
  if (params.date) query.set('date', params.date)
  if (params.time) query.set('time', params.time)
  if (params.year) query.set('year', params.year)
  const qs = query.toString() ? `?${query.toString()}` : ''
  return apiGet(`/api/admin/monitor/live${qs}`, options)
}

export const getAdminMasterMatrix = (params = {}, options) => {
  const query = new URLSearchParams()
  if (params.year) query.set('year', params.year)
  if (params.day !== undefined && params.day !== null && params.day !== 'ALL') query.set('day', params.day)
  if (params.date) query.set('date', params.date)
  const qs = query.toString() ? `?${query.toString()}` : ''
  return apiGet(`/api/admin/monitor/master-matrix${qs}`, options)
}

