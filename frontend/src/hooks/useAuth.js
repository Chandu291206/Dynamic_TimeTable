import { useCallback, useEffect, useState } from 'react'
import { getMe, login as authLogin, logout as authLogout } from '../api/auth.js'
import { getAuthToken } from '../api/client.js'

export default function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    getMe()
      .then((userData) => {
        setUser(userData)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = useCallback(async (username, password) => {
    const session = await authLogin(username, password)
    setUser(session.user)
    return session
  }, [])

  const logout = useCallback(async () => {
    await authLogout()
    setUser(null)
  }, [])

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: Boolean(user),
    isCR: user?.role === 'CR',
    isAdmin: user?.role === 'ADMIN',
  }
}
