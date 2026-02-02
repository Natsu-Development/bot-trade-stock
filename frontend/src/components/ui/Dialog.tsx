import { ReactNode, useEffect } from 'react'
import { Icons } from '../icons/Icons'
import './Dialog.css'

interface DialogProps {
  isOpen: boolean
  onClose?: () => void
  children: ReactNode
  className?: string
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

interface DialogHeaderProps {
  children: ReactNode
  icon?: ReactNode
  action?: ReactNode
}

interface DialogBodyProps {
  children: ReactNode
  className?: string
}

interface DialogFooterProps {
  children: ReactNode
  align?: 'left' | 'center' | 'right' | 'space-between'
}

export function Dialog({
  isOpen,
  onClose,
  children,
  className = '',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: DialogProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && onClose) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevent body scroll when dialog is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, closeOnEscape, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && onClose) {
      onClose()
    }
  }

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className={`dialog ${className}`}>
        {children}
      </div>
    </div>
  )
}

Dialog.Header = function DialogHeader({ children, icon, action }: DialogHeaderProps) {
  return (
    <div className="dialog-header">
      <div className="dialog-title">
        {icon && <div className="dialog-icon">{icon}</div>}
        {children}
      </div>
      {action && <div className="dialog-action">{action}</div>}
    </div>
  )
}

Dialog.Body = function DialogBody({ children, className = '' }: DialogBodyProps) {
  return <div className={`dialog-body ${className}`}>{children}</div>
}

Dialog.Footer = function DialogFooter({ children, align = 'right' }: DialogFooterProps) {
  return (
    <div className={`dialog-footer dialog-footer-${align}`}>
      {children}
    </div>
  )
}

Dialog.CloseButton = function DialogCloseButton({ onClick }: { onClick?: () => void }) {
  return (
    <button className="dialog-close-btn" onClick={onClick} aria-label="Close dialog">
      <Icons.X />
    </button>
  )
}
