/**
 * 主题感知的颜色方案
 * 统一管理重复出现的主题颜色组合
 */

// 按钮和交互元素的悬停背景色
export const HoverColors = {
  // 轻度悬停 - 用于按钮、菜单项
  light: {
    subtle: 'rgba(0, 0, 0, 0.04)',
    default: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.06)',
    strong: 'rgba(0, 0, 0, 0.08)',
    intense: 'rgba(0, 0, 0, 0.12)',
    selected: 'rgba(0, 0, 0, 0.15)',
  },
  dark: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    default: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.1)',
    strong: 'rgba(255, 255, 255, 0.12)',
    intense: 'rgba(255, 255, 255, 0.15)',
    selected: 'rgba(255, 255, 255, 0.2)',
  },
} as const;

// 文字颜色
export const TextColors = {
  light: {
    primary: 'rgba(0, 0, 0, 0.85)',
    secondary: 'rgba(0, 0, 0, 0.65)',
    tertiary: 'rgba(0, 0, 0, 0.45)',
    quaternary: 'rgba(0, 0, 0, 0.25)',
    disabled: 'rgba(0, 0, 0, 0.25)',
  },
  dark: {
    primary: 'rgba(255, 255, 255, 0.95)',
    secondary: 'rgba(255, 255, 255, 0.85)',
    tertiary: 'rgba(255, 255, 255, 0.65)',
    quaternary: 'rgba(255, 255, 255, 0.45)',
    disabled: 'rgba(255, 255, 255, 0.25)',
  },
} as const;

// 边框颜色
export const BorderColors = {
  light: {
    subtle: 'rgba(0, 0, 0, 0.04)',
    default: 'rgba(0, 0, 0, 0.06)',
    medium: 'rgba(0, 0, 0, 0.08)',
    strong: 'rgba(0, 0, 0, 0.15)',
  },
  dark: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.1)',
    strong: 'rgba(255, 255, 255, 0.15)',
  },
} as const;

// 分隔线颜色
export const DividerColors = {
  light: 'rgba(0, 0, 0, 0.08)',
  dark: 'rgba(255, 255, 255, 0.1)',
} as const;

/**
 * 获取主题感知的悬停颜色
 */
export const getHoverColor = (isLight: boolean, intensity: keyof typeof HoverColors.light = 'default') => {
  return isLight ? HoverColors.light[intensity] : HoverColors.dark[intensity];
};

/**
 * 获取主题感知的文字颜色
 */
export const getTextColor = (isLight: boolean, level: keyof typeof TextColors.light = 'primary') => {
  return isLight ? TextColors.light[level] : TextColors.dark[level];
};

/**
 * 获取主题感知的边框颜色
 */
export const getBorderColor = (isLight: boolean, intensity: keyof typeof BorderColors.light = 'default') => {
  return isLight ? BorderColors.light[intensity] : BorderColors.dark[intensity];
};

/**
 * 获取主题感知的分隔线颜色
 */
export const getDividerColor = (isLight: boolean) => {
  return isLight ? DividerColors.light : DividerColors.dark;
};

export default {
  HoverColors,
  TextColors,
  BorderColors,
  DividerColors,
  getHoverColor,
  getTextColor,
  getBorderColor,
  getDividerColor,
};
