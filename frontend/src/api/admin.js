import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

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
export const proxyPdfUrl = (url) => `/api/admin/faculty/proxy-pdf?url=${encodeURIComponent(url)}`
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

// CRs
export const getAdminCRs = (options) => apiGet('/api/admin/crs', options)
export const createCR = (data, options) => apiPost('/api/admin/crs', data, options)
export const updateCR = (id, data, options) => apiPut(`/api/admin/crs/${id}`, data, options)
export const assignCRClass = (id, classId, options) => apiPut(`/api/admin/crs/${id}/class`, { classId }, options)
export const deleteCR = (id, options) => apiDelete(`/api/admin/crs/${id}`, options)

// Logs
export const getTimetableLogs = (options) => apiGet('/api/admin/logs', options)
