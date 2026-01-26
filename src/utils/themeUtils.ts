/**
 * 主题相关工具函数
 * 提取重复的主题相关逻辑
 */

/**
 * 获取图标 filter (用于主题适配)
 * 浅色主题：深色图标
 * 深色主题：白色图标
 */
export const getIconFilter = (isLight: boolean): string => {
  return isLight ? 'brightness(0.3)' : 'brightness(0) invert(1)';
};

/**
 * 获取带透明度的图标 filter
 */
export const getIconFilterWithOpacity = (isLight: boolean, opacity: number = 0.85): string => {
  return isLight
    ? `brightness(0.3) opacity(${opacity})`
    : `brightness(0) invert(1) opacity(${opacity})`;
};

/**
 * 获取图标样式对象
 */
export const getIconStyle = (isLight: boolean, size: number = 20, opacity: number = 0.85): React.CSSProperties => ({
  width: size,
  height: size,
  filter: getIconFilter(isLight),
  opacity,
});

/**
 * 主题感知颜色映射
 */
export const ThemeColors = {
  light: {
    bg: {
      primary: '#F5F5F5',
      secondary: '#FFFFFF',
      tertiary: '#FAFAFA',
      hover: 'rgba(0, 0, 0, 0.05)',
      hoverMedium: 'rgba(0, 0, 0, 0.08)',
      hoverStrong: 'rgba(0, 0, 0, 0.12)',
      active: 'rgba(56, 189, 255, 0.15)',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.85)',
      secondary: 'rgba(0, 0, 0, 0.65)',
      tertiary: 'rgba(0, 0, 0, 0.45)',
      disabled: 'rgba(0, 0, 0, 0.25)',
    },
    border: {
      default: 'rgba(0, 0, 0, 0.08)',
      hover: 'rgba(0, 0, 0, 0.15)',
    },
    divider: 'rgba(0, 0, 0, 0.06)',
  },
  dark: {
    bg: {
      primary: '#2A2A2A',
      secondary: '#181818',
      tertiary: '#1F1F1F',
      hover: 'rgba(255, 255, 255, 0.08)',
      hoverMedium: 'rgba(255, 255, 255, 0.12)',
      hoverStrong: 'rgba(255, 255, 255, 0.15)',
      active: 'rgba(56, 189, 255, 0.2)',
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.65)',
      tertiary: 'rgba(255, 255, 255, 0.45)',
      disabled: 'rgba(255, 255, 255, 0.25)',
    },
    border: {
      default: 'rgba(255, 255, 255, 0.1)',
      hover: 'rgba(255, 255, 255, 0.2)',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
} as const;

type ThemeKey = 'light' | 'dark';
type ColorCategory = keyof typeof ThemeColors.light;
type BgLevel = keyof typeof ThemeColors.light.bg;
type TextLevel = keyof typeof ThemeColors.light.text;
type BorderLevel = keyof typeof ThemeColors.light.border;

/**
 * 获取主题感知的颜色
 */
export function getThemeColor(isLight: boolean, category: 'bg', level: BgLevel): string;
export function getThemeColor(isLight: boolean, category: 'text', level: TextLevel): string;
export function getThemeColor(isLight: boolean, category: 'border', level: BorderLevel): string;
export function getThemeColor(isLight: boolean, category: 'divider'): string;
export function getThemeColor(
  isLight: boolean,
  category: ColorCategory | 'divider',
  level?: string
): string {
  const theme = isLight ? ThemeColors.light : ThemeColors.dark;

  if (category === 'divider') {
    return theme.divider;
  }

  const categoryColors = theme[category as ColorCategory];
  if (typeof categoryColors === 'string') {
    return categoryColors;
  }

  return (categoryColors as Record<string, string>)[level!] || '';
}

/**
 * 获取文字颜色 (简化版)
 */
export const getTextColor = (isLight: boolean, level: 'primary' | 'secondary' | 'tertiary' = 'primary'): string => {
  return getThemeColor(isLight, 'text', level);
};

/**
 * 获取背景颜色 (简化版)
 */
export const getBgColor = (isLight: boolean, level: 'primary' | 'secondary' | 'hover' = 'primary'): string => {
  return getThemeColor(isLight, 'bg', level);
};
