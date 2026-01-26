/**
 * Hover 状态处理 Hook
 * 统一处理 onMouseEnter/onMouseLeave 事件
 */
import React from 'react';

/**
 * 获取 hover 背景色处理函数
 */
export const useHoverBackground = (
  isLight: boolean,
  options?: {
    enterColor?: string;
    leaveColor?: string;
  }
) => {
  const defaultEnterColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)';
  const enterColor = options?.enterColor ?? defaultEnterColor;
  const leaveColor = options?.leaveColor ?? 'transparent';

  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = enterColor;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = leaveColor;
    },
  };
};

/**
 * 获取 hover transform 处理函数 (缩放效果)
 */
export const useHoverScale = (scale: number = 1.05) => {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = `scale(${scale})`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'scale(1)';
    },
  };
};

/**
 * 组合多个 hover 效果
 */
export const useHoverEffect = (
  isLight: boolean,
  options?: {
    enterBg?: string;
    leaveBg?: string;
    scale?: number;
  }
) => {
  const bgHandlers = useHoverBackground(isLight, {
    enterColor: options?.enterBg,
    leaveColor: options?.leaveBg,
  });

  if (options?.scale) {
    const scaleHandlers = useHoverScale(options.scale);
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        bgHandlers.onMouseEnter(e);
        scaleHandlers.onMouseEnter(e);
      },
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        bgHandlers.onMouseLeave(e);
        scaleHandlers.onMouseLeave(e);
      },
    };
  }

  return bgHandlers;
};

export default useHoverBackground;
