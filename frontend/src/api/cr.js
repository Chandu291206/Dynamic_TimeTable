import { apiGet, apiPost, apiDelete } from './client.js'

export async function getCRDashboard(options) {
  const response = await apiGet('/api/cr/dashboard', options)
  return response?.data
}

export async function getCROverrides(days = 7, options) {
  const response = await apiGet(`/api/cr/overrides?days=${encodeURIComponent(days)}`, options)
  return response?.data
}

export async function createCROverride(overrideData, options) {
  const response = await apiPost('/api/cr/overrides', overrideData, options)
  return response?.data
}

export async function deleteCROverride(id, options) {
  return apiDelete(`/api/cr/overrides/${encodeURIComponent(id)}`, options)
}
