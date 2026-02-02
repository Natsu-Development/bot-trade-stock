import { useState, useCallback, useEffect } from 'react'
import { Dialog } from '../ui/Dialog'
import { Icons } from '../icons/Icons'
import './UsernameDialog.css'

interface UsernameDialogProps {
  isOpen: boolean
  setConfigId: (id: string) => Promise<boolean>
}

export function UsernameDialog({ isOpen, setConfigId }: UsernameDialogProps) {
  const [username, setUsername] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setUsername('')
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!username.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    const success = await setConfigId(username.trim())

    if (!success) {
      setError('Failed to set up your configuration. Please try again.')
    }

    setIsSubmitting(false)
  }, [username, isSubmitting, setConfigId])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
    setError(null)
  }, [])

  const isValid = username.trim().length >= 2

  return (
    <Dialog isOpen={isOpen} closeOnOverlayClick={false} closeOnEscape={false}>
      <Dialog.Header icon={<Icons.Users />}>
        Welcome to Trading Bot
      </Dialog.Header>

      <Dialog.Body className="username-dialog-body">
        <div className="username-dialog-intro">
          <Icons.Info />
          <p>Enter your username to access your trading configuration and continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="username-dialog-form">
          <div className="form-group">
            <label htmlFor="username-input" className="form-label">
              Username
            </label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={handleInputChange}
              placeholder="e.g., trader_jane"
              className="form-input"
              autoComplete="username"
              autoFocus
              disabled={isSubmitting}
            />
            {error && (
              <div className="username-dialog-error">
                <Icons.Info />
                {error}
              </div>
            )}
          </div>

          <div className="username-dialog-hint">
            Use 2-50 characters (letters, numbers, hyphens, underscores)
          </div>
        </form>
      </Dialog.Body>

      <Dialog.Footer align="right">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleSubmit()}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="btn-spinner" />
              Verifying...
            </>
          ) : (
            'Continue'
          )}
        </button>
      </Dialog.Footer>
    </Dialog>
  )
}
