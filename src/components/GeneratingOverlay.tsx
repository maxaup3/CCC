import React, { useMemo } from 'react';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface GeneratingOverlayProps {
  position: { x: number; y: number };
  width: number;
  height: number;
  progress: number;
  taskId: string;
  elapsedTime?: number;
  estimatedTime?: number;
}

const GeneratingOverlay: React.FC<GeneratingOverlayProps> = ({
  position,
  width,
  height,
  progress,
  elapsedTime = 0,
  estimatedTime = 0,
}) => {
  const { isLight } = useThemedStyles();

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  // 计算剩余时间
  const remainingTime = useMemo(() => {
    if (!estimatedTime) return null;
    const remaining = estimatedTime * (1 - progress / 100);
    return remaining > 0 ? remaining : 0;
  }, [estimatedTime, progress]);

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: width,
        height: height,
        zIndex: 1000,
        pointerEvents: 'none',
        background: isLight
          ? 'rgba(255, 255, 255, 0.6)'
          : 'rgba(0, 0, 0, 0.45)',
        borderRadius: 0,
        overflow: 'hidden',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        padding: '24px 32px',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* 旋转加载指示器 */}
      <div
        style={{
          width: 28,
          height: 28,
          border: isLight
            ? '2.5px solid rgba(0, 0, 0, 0.1)'
            : '2.5px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: isLight
            ? 'rgba(0, 0, 0, 0.5)'
            : 'rgba(255, 255, 255, 0.6)',
          borderRadius: '50%',
          animation: 'genOverlaySpin 0.8s linear infinite',
        }}
      />

      {/* 百分比 + 剩余时间 */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          letterSpacing: '0.01em',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>{Math.round(progress)}%</span>
        {remainingTime !== null && estimatedTime > 0 && remainingTime > 0 && (
          <>
            <span style={{ opacity: 0.35 }}>·</span>
            <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 12 }}>
              {formatTime(remainingTime)}
            </span>
          </>
        )}
      </div>

      {/* 进度条 */}
      <div
        style={{
          width: '100%',
          maxWidth: 200,
          height: 3,
          background: isLight
            ? 'rgba(0, 0, 0, 0.08)'
            : 'rgba(255, 255, 255, 0.1)',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: isLight
              ? 'rgba(0, 0, 0, 0.35)'
              : 'rgba(255, 255, 255, 0.5)',
            borderRadius: 1.5,
            transition: 'width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />
      </div>

      <style>
        {`
          @keyframes genOverlaySpin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default React.memo(GeneratingOverlay);
