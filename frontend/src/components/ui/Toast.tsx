import { createRoot } from 'react-dom/client'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left'
}

interface ToastProps extends ToastOptions {
  onClose: () => void
}

const typeStyles = {
  success: {
    border: 'border-l-[3px] border-l-[var(--neon-bull)]',
    icon: 'text-[var(--neon-bull)]',
  },
  error: {
    border: 'border-l-[3px] border-l-[var(--neon-bear)]',
    icon: 'text-[var(--neon-bear)]',
  },
  warning: {
    border: 'border-l-[3px] border-l-[var(--neon-amber)]',
    icon: 'text-[var(--neon-amber)]',
  },
  info: {
    border: 'border-l-[3px] border-l-[var(--neon-cyan)]',
    icon: 'text-[var(--neon-cyan)]',
  },
}

function ToastComponent({ message, type = 'info', onClose }: ToastProps) {
  const iconMap = {
    success: <Icons.CheckCircle />,
    error: <Icons.XCircle />,
    warning: <Icons.Alert />,
    info: <Icons.Info />,
  }

  const styles = typeStyles[type]

  return (
    <div className={cn(
      'flex items-center gap-3 min-w-[300px] max-w-[420px] px-4 py-3.5',
      'bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.4)]',
      'animate-slide-in-from-right',
      styles.border
    )}>
      <div className={cn('flex items-center justify-center w-5 h-5 shrink-0 [&_svg]:w-5 [&_svg]:h-5', styles.icon)}>
        {iconMap[type]}
      </div>
      <span className="flex-1 text-[13px] font-medium text-[var(--text-primary)]">{message}</span>
      <button
        className="flex items-center justify-center w-5 h-5 p-0 bg-transparent border-none rounded text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] [&_svg]:w-3.5 [&_svg]:h-3.5"
        onClick={onClose}
        aria-label="Close"
      >
        <Icons.X />
      </button>
    </div>
  )
}

let toastContainer: HTMLDivElement | null = null
let activeToasts: Array<{ id: number; element: HTMLDivElement }> = []
let toastIdCounter = 0

function getOrCreateContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'fixed top-6 right-6 z-[2000] flex flex-col gap-3 pointer-events-none'
    toastContainer.setAttribute('role', 'region')
    toastContainer.setAttribute('aria-live', 'polite')
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

function removeToast(id: number) {
  const index = activeToasts.findIndex(t => t.id === id)
  if (index !== -1) {
    const { element } = activeToasts[index]
    element.style.animation = 'slide-out-to-right 0.3s ease-out forwards'
    setTimeout(() => {
      element.remove()
      activeToasts = activeToasts.filter(t => t.id !== id)
      if (activeToasts.length === 0 && toastContainer) {
        toastContainer.remove()
        toastContainer = null
      }
    }, 300)
  }
}

export function toast(options: ToastOptions) {
  const container = getOrCreateContainer()
  const id = ++toastIdCounter

  const wrapper = document.createElement('div')
  wrapper.className = 'pointer-events-auto'
  container.appendChild(wrapper)

  const root = createRoot(wrapper)
  activeToasts.push({ id, element: wrapper })

  const handleClose = () => removeToast(id)

  root.render(<ToastComponent {...options} onClose={handleClose} />)

  // Auto-dismiss after duration
  const duration = options.duration ?? 3000
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }

  return id
}

// Convenience methods
toast.success = (message: string, duration?: number) => toast({ message, type: 'success', duration })
toast.error = (message: string, duration?: number) => toast({ message, type: 'error', duration })
toast.warning = (message: string, duration?: number) => toast({ message, type: 'warning', duration })
toast.info = (message: string, duration?: number) => toast({ message, type: 'info', duration })
