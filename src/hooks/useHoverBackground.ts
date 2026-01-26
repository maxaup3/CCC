/**
 * 通用 hover 背景效果 Hook
 * 减少组件中重复的 onMouseEnter/onMouseLeave 逻辑
 */
import { useCallback } from 'react';

export interface HoverBackgroundOptions {
  isLight: boolean;
  defaultBg?: string;
  hoverBgLight?: string;
  hoverBgDark?: string;
}

/**
 * 返回通用的 hover 事件处理函数
 */
export const useHoverBackground = (options: HoverBackgroundOptions) => {
  const {
    isLight,
    defaultBg = 'transparent',
    hoverBgLight = 'rgba(0, 0, 0, 0.06)',
    hoverBgDark = 'rgba(255, 255, 255, 0.08)',
  } = options;

  const hoverBg = isLight ? hoverBgLight : hoverBgDark;

  const onMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = hoverBg;
  }, [hoverBg]);

  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = defaultBg;
  }, [defaultBg]);

  return { onMouseEnter, onMouseLeave, hoverBg, defaultBg };
};

/**
 * 获取静态的 hover 处理函数（不使用 hook，用于性能敏感场景）
 */
export const getHoverHandlers = (isLight: boolean, defaultBg = 'transparent') => {
  const hoverBg = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';

  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = hoverBg;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = defaultBg;
    },
  };
};

export default useHoverBackground;
