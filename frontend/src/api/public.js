import { apiGet } from './client.js'

export const getClasses = (options) => apiGet('/api/classes', options)
export const getApiHealth = (options) => apiGet('/api/health', options)
export const getTimetable = (classId, date, options) => apiGet(`/api/timetable/${encodeURIComponent(classId)}?date=${encodeURIComponent(date)}`, options)
export const getWeeklyTimetable = (classId, date, options) => apiGet(`/api/timetable/${encodeURIComponent(classId)}/weekly?date=${encodeURIComponent(date)}`, options)
export const getTimetableJson = (classId, options) => apiGet(`/api/timetable/${encodeURIComponent(classId)}/json`, options)
