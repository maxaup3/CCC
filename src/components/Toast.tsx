import React, { useEffect } from 'react';
import { Typography, BorderRadius, Shadows } from '../styles/constants';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
  onRetry?: () => void;
  showRetryButton?: boolean;
  retryCount?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 3000,
  onClose,
  onRetry,
  showRetryButton = false,
  retryCount = 0,
}) => {
  useEffect(() => {
    // 如果有重试按钮或正在重试，不自动关闭
    if (showRetryButton && retryCount === 0) {
      return
    }

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose, showRetryButton, retryCount]);

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          background: 'rgba(34, 197, 94, 0.15)',
          border: 'rgba(34, 197, 94, 0.3)',
          text: 'rgba(34, 197, 94, 0.9)',
          icon: '#22C55E',
        };
      case 'error':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          border: 'rgba(239, 68, 68, 0.3)',
          text: 'rgba(239, 68, 68, 0.9)',
          icon: '#EF4444',
        };
      default:
        return {
          background: 'rgba(56, 189, 255, 0.15)',
          border: 'rgba(56, 189, 255, 0.3)',
          text: 'rgba(56, 189, 255, 0.9)',
          icon: '#38BDFF',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        padding: '12px 20px',
        background: colors.background,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${colors.border}`,
        borderRadius: BorderRadius.xlarge,
        boxShadow: Shadows.medium,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 200,
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <style>
        {`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
      {type === 'success' && (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke={colors.icon} strokeWidth="2" />
          <path d="M6 10L9 13L14 7" stroke={colors.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {type === 'error' && (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke={colors.icon} strokeWidth="2" />
          <path d="M7 7L13 13M13 7L7 13" stroke={colors.icon} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {type === 'info' && (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke={colors.icon} strokeWidth="2" />
          <path d="M10 7V10M10 13H10.01" stroke={colors.icon} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        <span
          style={{
            fontSize: Typography.englishBody.fontSize.medium,
            fontWeight: Typography.englishBody.fontWeight,
            color: colors.text,
            fontFamily: Typography.englishBody.fontFamily,
            flex: 1,
          }}
        >
          {message}
          {retryCount > 0 && (
            <span style={{ opacity: 0.7, marginLeft: 8 }}>
              (重试 {retryCount})
            </span>
          )}
        </span>
        {showRetryButton && onRetry && (
          <button
            onClick={() => {
              onRetry()
            }}
            style={{
              background: colors.icon,
              border: 'none',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1'
            }}
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(Toast);

