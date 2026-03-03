import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogIcon } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Icons } from '../icons/Icons'

interface UsernameDialogProps {
  isOpen: boolean
  setConfigId: (id: string) => Promise<boolean>
}

export function UsernameDialog({ isOpen, setConfigId }: UsernameDialogProps) {
  const [username, setUsername] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogIcon><Icons.Users /></DialogIcon>
          Welcome to Trading Bot
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          <div className="flex items-start gap-3 p-4 bg-[var(--bg-elevated)] rounded-md border border-[var(--border-dim)]">
            <Icons.Info className="w-5 h-5 text-[var(--neon-cyan)] flex-shrink-0 mt-0.5" />
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              Enter your username to access your trading configuration and continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="mb-4">
              <label htmlFor="username-input" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Username
              </label>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={handleInputChange}
                placeholder="e.g., trader_jane"
                className="w-full px-4 py-3.5 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-md font-mono text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-150 focus:outline-none focus:border-[var(--neon-cyan)] focus:ring-[3px] focus:ring-[var(--neon-cyan-dim)] disabled:opacity-50"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
              />
              {error && (
                <div className="flex items-center gap-2 mt-2.5 px-3.5 py-2.5 bg-[var(--neon-bear-dim)] rounded-sm text-[var(--neon-bear)] text-[13px]">
                  <Icons.Info className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <p className="-mt-2 text-xs text-[var(--text-muted)]">
              Use 2-50 characters (letters, numbers, hyphens, underscores)
            </p>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-transparent border-t-current rounded-full animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
