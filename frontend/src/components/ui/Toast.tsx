import { createRoot } from 'react-dom/client'
import { Icons } from '../icons/Icons'
import './Toast.css'

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

function ToastComponent({ message, type = 'info', onClose }: ToastProps) {
  const iconMap = {
    success: <Icons.CheckCircle />,
    error: <Icons.XCircle />,
    warning: <Icons.Alert />,
    info: <Icons.Info />,
  }

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{iconMap[type]}</div>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Close">
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
    toastContainer.className = 'toast-container'
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
    element.classList.add('toast-removing')
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
  wrapper.className = 'toast-wrapper'
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
