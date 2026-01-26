/**
 * 自定义 Theme Hook
 * 简化组件中的主题使用，减少重复代码
 */
import { useTheme, getThemeStyles, isLightTheme } from '../contexts/ThemeContext';

export const useThemeContext = () => {
  const { themeMode, setThemeMode } = useTheme();
  const theme = getThemeStyles(themeMode);
  const isLight = isLightTheme(themeMode);

  return {
    theme,
    isLight,
    themeMode,
    setThemeMode,
  };
};

export default useThemeContext;
