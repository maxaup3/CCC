import React, { useEffect, useState } from 'react';
import { useTheme, isLightTheme as checkLightTheme } from '../contexts/ThemeContext';

interface LoadingScreenProps {
  onComplete?: () => void;
  onFadeStart?: () => void; // 渐出开始时的回调
  duration?: number; // 总持续时间（包含渐出）
  fadeOutDuration?: number; // 渐出动画时长
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onComplete,
  onFadeStart,
  duration = 1500,
  fadeOutDuration = 500, // 默认 500ms 渐出
}) => {
  const { themeMode } = useTheme();
  const [isFadingOut, setIsFadingOut] = useState(false);

  const isLightTheme = checkLightTheme(themeMode);

  useEffect(() => {
    // 在总时长减去渐出时长后开始渐出
    const fadeOutStartTime = Math.max(duration - fadeOutDuration, 500);

    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
      onFadeStart?.();
    }, fadeOutStartTime);

    // 总时长后完成
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, fadeOutDuration, onComplete, onFadeStart]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        pointerEvents: 'none',
        animation: isFadingOut
          ? `loading-fade-out ${fadeOutDuration}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
          : 'loading-fade-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }}
    >
      {/* 加载中文字 */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 500,
          color: isLightTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.05em',
          animation: isFadingOut ? 'none' : 'fade-pulse 2s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textShadow: isLightTheme
            ? '0 2px 8px rgba(102, 126, 234, 0.15)'
            : '0 2px 12px rgba(139, 155, 255, 0.3)',
        }}
      >
        Loading
        <span
          style={{
            display: 'inline-flex',
            width: '24px',
            justifyContent: 'flex-start',
          }}
        >
          <span style={{ animation: isFadingOut ? 'none' : 'dots 1.5s steps(4) infinite' }}></span>
        </span>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes loading-fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes loading-fade-out {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(1.02);
          }
        }

        @keyframes fade-pulse {
          0%, 100% {
            opacity: 0.5;
            transform: translateY(0px);
          }
          50% {
            opacity: 1;
            transform: translateY(-2px);
          }
        }

        @keyframes dots {
          0% {
            content: '';
            opacity: 0;
          }
          25% {
            content: '.';
            opacity: 1;
          }
          50% {
            content: '..';
            opacity: 1;
          }
          75% {
            content: '...';
            opacity: 1;
          }
          100% {
            content: '...';
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
