import React, { createContext, useContext, useState, ReactNode } from 'react';

// 简化为只有亮色和暗色两种模式
export type ThemeMode = 'light' | 'dark';

// 为了兼容现有代码，保留 ThemeStyle 类型别名
export type ThemeStyle = ThemeMode;

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  // 兼容旧 API
  themeStyle: ThemeStyle;
  setThemeStyle: (style: ThemeStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  return (
    <ThemeContext.Provider value={{
      themeMode,
      setThemeMode,
      // 兼容旧 API
      themeStyle: themeMode,
      setThemeStyle: setThemeMode,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// 辅助函数：判断是否为浅色主题
export const isLightTheme = (mode: ThemeMode | ThemeStyle): boolean => {
  return mode === 'light';
};

// 简化的主题配置 - 只有亮色和暗色
export const getThemeStyles = (mode: ThemeMode | ThemeStyle) => {
  if (mode === 'light') {
    return {
      // 背景
      appBackground: '#F8F9FF',
      canvasBackground: 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)',

      // 卡片/面板
      panelBackground: 'rgba(255, 255, 255, 0.95)',
      panelBackdrop: 'blur(20px)',
      panelBorder: '1px solid rgba(0, 0, 0, 0.08)',
      panelBorderRadius: '12px',
      panelShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',

      // 按钮
      buttonBackground: 'rgba(0, 0, 0, 0.04)',
      buttonBackgroundHover: 'rgba(0, 0, 0, 0.08)',
      buttonBackgroundActive: 'rgba(56, 189, 255, 0.15)',
      buttonBorder: '1px solid rgba(0, 0, 0, 0.08)',
      buttonBorderActive: '1px solid rgba(56, 189, 255, 0.4)',
      buttonBorderRadius: '8px',

      // 文字
      textPrimary: '#131314',
      textSecondary: 'rgba(19, 19, 20, 0.65)',
      textTertiary: 'rgba(19, 19, 20, 0.45)',
      textAccent: '#38BDFF',

      // 输入框
      inputBackground: 'rgba(255, 255, 255, 0.8)',
      inputBackdrop: 'blur(10px)',
      inputBorder: '1px solid rgba(0, 0, 0, 0.1)',
      inputBorderFocus: '1px solid rgba(56, 189, 255, 0.5)',
      inputBorderRadius: '8px',

      // 渐变
      accentGradient: 'linear-gradient(135deg, #38BDFF 0%, #7C3AED 100%)',

      // 画布交互元素
      selectionStroke: '#38BDFF',
      selectionFill: 'rgba(56, 189, 255, 0.1)',
      handleFill: '#38BDFF',
      handleStroke: '#FFFFFF',
      gridColor: 'rgba(102, 126, 234, 0.06)',

      // 生成中效果
      generatingBorder: '2px solid rgba(56, 189, 255, 0.5)',
      generatingGlow: '0 0 20px rgba(56, 189, 255, 0.2)',
      generatingPulseColor: 'rgba(56, 189, 255, 0.1)',
    };
  }

  // 暗色主题（默认）
  return {
    // 背景
    appBackground: '#0a0b14',
    canvasBackground: 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)',

    // 卡片/面板
    panelBackground: 'rgba(30, 30, 30, 0.95)',
    panelBackdrop: 'blur(20px)',
    panelBorder: '1px solid rgba(255, 255, 255, 0.1)',
    panelBorderRadius: '12px',
    panelShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',

    // 按钮
    buttonBackground: 'transparent',
    buttonBackgroundHover: 'rgba(255, 255, 255, 0.12)',
    buttonBackgroundActive: 'rgba(56, 189, 255, 0.2)',
    buttonBorder: 'none',
    buttonBorderActive: '1px solid rgba(56, 189, 255, 0.4)',
    buttonBorderRadius: '6px',

    // 文字
    textPrimary: 'rgba(255, 255, 255, 0.9)',
    textSecondary: 'rgba(255, 255, 255, 0.65)',
    textTertiary: 'rgba(255, 255, 255, 0.45)',
    textAccent: '#38BDFF',

    // 输入框
    inputBackground: 'rgba(255, 255, 255, 0.05)',
    inputBackdrop: 'none',
    inputBorder: '1px solid rgba(255, 255, 255, 0.1)',
    inputBorderFocus: '1px solid rgba(56, 189, 255, 0.5)',
    inputBorderRadius: '8px',

    // 渐变
    accentGradient: 'linear-gradient(135deg, #38BDFF 0%, #7C3AED 100%)',

    // 画布交互元素
    selectionStroke: '#38BDFF',
    selectionFill: 'rgba(56, 189, 255, 0.08)',
    handleFill: '#38BDFF',
    handleStroke: '#FFFFFF',
    gridColor: 'rgba(102, 126, 234, 0.08)',

    // 生成中效果
    generatingBorder: '2px solid rgba(56, 189, 255, 0.5)',
    generatingGlow: '0 0 20px rgba(56, 189, 255, 0.3)',
    generatingPulseColor: 'rgba(56, 189, 255, 0.1)',
  };
};
