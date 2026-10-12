import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', durationMs = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])

    if (durationMs > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, durationMs)
    }
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-item--${t.type}`} role="status">
            <span className="toast-icon" aria-hidden="true">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : 'ℹ'}
            </span>
            <p className="toast-message">{t.message}</p>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    // Graceful fallback so components don't crash if rendered outside provider
    return {
      success: (msg) => console.log('[Toast SUCCESS]', msg),
      error: (msg) => console.error('[Toast ERROR]', msg),
      info: (msg) => console.log('[Toast INFO]', msg),
    }
  }
  return context
}
