import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  isOpen,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.()
      }}
    >
      <div
        ref={dialogRef}
        className={`confirm-dialog ${danger ? 'confirm-dialog--danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        tabIndex={-1}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="confirm-dialog-desc">
          {message}
        </p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
