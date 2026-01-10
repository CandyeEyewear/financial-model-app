/**
 * Toast Notification System
 * Accessible toast notifications with auto-dismiss
 */
import React, { createContext, useContext, useState, useCallback, useId } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// Toast Context
const ToastContext = createContext(null);

/**
 * Toast Provider - Wrap your app with this to enable toasts
 * 
 * @example
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 */
export function ToastProvider({ children, position = 'bottom-right' }) {
  const [toasts, setToasts] = useState([]);
  
  const addToast = useCallback((toast) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    const newToast = {
      id,
      duration: 5000,
      ...toast,
    };
    
    setToasts((prev) => [...prev, newToast]);
    
    // Auto-dismiss
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
    
    return id;
  }, []);
  
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  
  const toast = useCallback((message, options = {}) => {
    return addToast({ message, type: 'info', ...options });
  }, [addToast]);
  
  toast.success = (message, options = {}) => addToast({ message, type: 'success', ...options });
  toast.error = (message, options = {}) => addToast({ message, type: 'error', ...options });
  toast.warning = (message, options = {}) => addToast({ message, type: 'warning', ...options });
  toast.info = (message, options = {}) => addToast({ message, type: 'info', ...options });
  
  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
  };
  
  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      
      {/* Toast Container */}
      <div
        className={`
          fixed z-toast
          ${positionClasses[position]}
          flex flex-col gap-2
          pointer-events-none
        `}
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastItem 
            key={t.id} 
            {...t} 
            onClose={() => removeToast(t.id)} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * useToast hook - Access toast functions from any component
 * 
 * @example
 * const { toast } = useToast();
 * toast.success('Operation completed!');
 */
export function useToast() {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
}

/**
 * Individual Toast Item
 */
function ToastItem({
  id,
  message,
  title,
  type = 'info',
  action,
  onClose,
}) {
  const toastId = useId();
  
  // Type configuration
  const typeConfig = {
    success: {
      bg: 'bg-success-600',
      icon: CheckCircle,
      iconLabel: 'Success',
    },
    error: {
      bg: 'bg-danger-600',
      icon: AlertCircle,
      iconLabel: 'Error',
    },
    warning: {
      bg: 'bg-warning-600',
      icon: AlertTriangle,
      iconLabel: 'Warning',
    },
    info: {
      bg: 'bg-info-600',
      icon: Info,
      iconLabel: 'Information',
    },
  };
  
  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;
  
  return (
    <div
      role="alert"
      aria-labelledby={`${toastId}-title`}
      className={`
        ${config.bg}
        text-white
        px-4 py-3
        rounded-card
        shadow-dropdown
        w-[calc(100vw-2rem)] max-w-[400px] sm:min-w-[300px]
        pointer-events-auto
        animate-slide-in-up
      `}
    >
      <div className="flex items-start gap-3">
        <Icon 
          className="w-5 h-5 flex-shrink-0 mt-0.5" 
          aria-hidden="true"
        />
        
        <div className="flex-1 min-w-0">
          {title && (
            <div 
              id={`${toastId}-title`}
              className="font-semibold text-sm mb-0.5"
            >
              {title}
            </div>
          )}
          <div className="text-sm opacity-95">{message}</div>
          
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-sm font-semibold underline hover:no-underline"
            >
              {action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Standalone Toast component for simple use cases
 */
export function Toast({
  message,
  type = 'success',
  show,
  onClose,
  duration = 3000,
  className = '',
}) {
  React.useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);
  
  if (!show) return null;
  
  const typeConfig = {
    success: {
      bg: 'bg-success-600',
      icon: CheckCircle,
    },
    error: {
      bg: 'bg-danger-600',
      icon: AlertCircle,
    },
    warning: {
      bg: 'bg-warning-600',
      icon: AlertTriangle,
    },
    info: {
      bg: 'bg-info-600',
      icon: Info,
    },
  };
  
  const config = typeConfig[type] || typeConfig.success;
  const Icon = config.icon;
  
  return (
    <div
      role="alert"
      className={`
        fixed bottom-4 right-4 z-toast
        ${config.bg}
        text-white
        px-4 py-3
        rounded-card
        shadow-dropdown
        flex items-center gap-3
        animate-slide-in-up
        ${className}
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default Toast;
