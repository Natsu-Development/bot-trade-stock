import { createRoot } from 'react-dom/client'
import { useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogIcon,
} from './dialog'
import { Button } from './button'
import { Icons, type IconName } from '@/components/icons/Icons'

/**
 * Themed, KIT-styled replacement for the native `window.confirm` / `window.alert`
 * popups. Imperative API mirroring `toast()` — no provider or JSX wiring needed:
 *
 *   const ok = await confirm({ title: 'Delete?', danger: true })
 *   await alertDialog({ title: 'Saved', message: 'Your preset was saved.' })
 */
export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmText?: string
  cancelText?: string
  /** Destructive action → bear-colored confirm button + bear icon chip. */
  danger?: boolean
  icon?: IconName
}

type Mode = 'confirm' | 'alert'

interface ModalProps extends ConfirmOptions {
  mode: Mode
  onResolve: (result: boolean) => void
}

function ConfirmModal({
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  danger = false,
  icon,
  mode,
  onResolve,
}: ModalProps) {
  const [open, setOpen] = useState(true)

  // Close first so the exit animation can play, then resolve + unmount.
  const close = (result: boolean) => {
    setOpen(false)
    setTimeout(() => onResolve(result), 200)
  }

  const IconComp = icon ? Icons[icon] : null
  const confirmLabel = confirmText ?? (mode === 'alert' ? 'OK' : 'Confirm')

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close(false)}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {IconComp && (
              <DialogIcon
                className={danger ? 'bg-[var(--neon-bear-dim)] text-[var(--neon-bear)]' : undefined}
              >
                <IconComp />
              </DialogIcon>
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          {message && <DialogDescription>{message}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          {mode === 'confirm' && (
            <Button variant="ghost" onClick={() => close(false)}>
              {cancelText}
            </Button>
          )}
          <Button variant={danger ? 'bear' : 'primary'} onClick={() => close(true)} autoFocus>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function mount(mode: Mode, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)
    const root = createRoot(wrapper)
    const handleResolve = (result: boolean) => {
      root.unmount()
      wrapper.remove()
      resolve(result)
    }
    root.render(<ConfirmModal {...options} mode={mode} onResolve={handleResolve} />)
  })
}

/** Themed replacement for `window.confirm` — resolves true on confirm, false on cancel/dismiss. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return mount('confirm', options)
}

/** Themed replacement for `window.alert` — single OK button; resolves when dismissed. */
export function alertDialog(options: Omit<ConfirmOptions, 'cancelText' | 'danger'>): Promise<void> {
  return mount('alert', options).then(() => undefined)
}
