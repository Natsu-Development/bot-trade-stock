import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUiStore } from '../../store';

const toastIcons = {
  success: <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />,
  error: <XCircle className="w-5 h-5" style={{ color: 'var(--danger)' }} />,
  warning: <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warning)' }} />,
  info: <Info className="w-5 h-5" style={{ color: 'var(--accent-cyan)' }} />,
};

export function Toast() {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          style={{
            borderColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.3)' :
                       toast.type === 'error' ? 'rgba(244, 63, 94, 0.3)' :
                       toast.type === 'warning' ? 'rgba(245, 158, 11, 0.3)' :
                       'rgba(0, 212, 255, 0.3)',
          }}
        >
          <div className="toast-icon">{toastIcons[toast.type]}</div>
          <div className="toast-message">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="toast-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
