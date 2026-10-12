import { apiGet, apiPost, clearAuthToken, setAuthToken } from './client.js'

export async function login(username, password) {
  const response = await apiPost('/api/auth/login', { username, password })
  if (response?.data?.token) {
    setAuthToken(response.data.token)
  }
  return response.data
}

export async function logout() {
  try {
    await apiPost('/api/auth/logout')
  } finally {
    clearAuthToken()
  }
}

export async function getMe() {
  const response = await apiGet('/api/auth/me')
  return response?.data?.user
}
