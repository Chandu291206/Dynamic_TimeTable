const TOKEN_KEY = 'tt_auth_token'

const PROD_API_BASE = 'https://timetable-backend-hjhq.onrender.com'
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? PROD_API_BASE : '')
).replace(/\/+$/, '')

export function apiUrl(path = '') {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalized}`
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {}, signal } = options
  const token = getAuthToken()
  const reqHeaders = { ...headers }

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`
  }

  let formattedBody = body
  if (body !== undefined && !(body instanceof FormData)) {
    reqHeaders['Content-Type'] = 'application/json'
    formattedBody = JSON.stringify(body)
  }

  const url = apiUrl(path)
  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: formattedBody,
    credentials: 'include',
    signal,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.code = data?.error?.code
    error.fields = data?.error?.fields
    error.clashes = data?.error?.clashes
    error.data = data
    throw error
  }

  return data
}

export const apiGet = (path, options) => request(path, { ...options, method: 'GET' })
export const apiPost = (path, body, options) => request(path, { ...options, method: 'POST', body })
export const apiPut = (path, body, options) => request(path, { ...options, method: 'PUT', body })
export const apiDelete = (path, options) => request(path, { ...options, method: 'DELETE' })
