import { apiGet, apiPost } from './client.js'

export const getFacultyDashboard = (options) => apiGet('/api/faculty/dashboard', options)
export const scrapeMyFacultyProfile = (options) => apiPost('/api/faculty/scrape-profile', {}, options)
