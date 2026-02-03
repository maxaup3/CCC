import React from 'react';
import Toast, { ToastType } from './Toast';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onRetry?: () => void;
  retryCount?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove, onRetry }) => {
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            position: 'fixed',
            top: 20 + index * 70,
            right: 20,
            zIndex: 10000 + index,
          }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
            onRetry={toast.onRetry ? () => {
              onRetry?.(toast.id);
              toast.onRetry?.();
            } : undefined}
            showRetryButton={!!toast.onRetry}
            retryCount={toast.retryCount}
          />
        </div>
      ))}
    </>
  );
};

export default React.memo(ToastContainer);

