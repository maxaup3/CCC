import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { GenerationMode } from '../types';
import { Colors, Typography, Spacing } from '../styles/constants';
import { useTheme, getThemeStyles, isLightTheme as checkLightTheme } from '../contexts/ThemeContext';

interface ModeSelectorProps {
  selectedMode: GenerationMode;
  onSelect: (mode: GenerationMode) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelect,
  onClose,
  position,
}) => {
  const { themeMode } = useTheme();
  const theme = getThemeStyles(themeMode);
  const containerRef = useRef<HTMLDivElement>(null);

  // 判断是否为浅色主题
  const isLightTheme = checkLightTheme(themeMode);

  const modes: Array<{ id: GenerationMode; name: string; description: string }> = [
    {
      id: 'image',
      name: '图像生成',
      description: '生成静态图片',
    },
    {
      id: 'video',
      name: '视频生成',
      description: '生成动态视频',
    },
  ];

  const dropdownContent = (
    <div
      ref={containerRef}
      data-mode-dropdown
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(calc(-100% - 8px))',
        width: 180,
        background: isLightTheme ? '#F5F5F5' : '#2A2A2A',
        backdropFilter: 'none',
        border: theme.panelBorder,
        borderRadius: 8,
        boxShadow: theme.panelShadow,
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: Spacing.xs,
        pointerEvents: 'auto',
        visibility: 'visible',
        opacity: 1,
        transition: 'all 0.2s ease',
      }}
    >
      {modes.map((mode) => {
        const isSelected = mode.id === selectedMode;
        return (
          <div
            key={mode.id}
            onClick={() => {
              onSelect(mode.id);
              onClose();
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: `${Spacing.xs}px ${Spacing.sm}px`,
              background: 'transparent',
              border: 'none',
              borderRadius: parseInt(theme.buttonBorderRadius),
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isLightTheme ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* 模式名称 */}
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isLightTheme
                  ? (isSelected ? theme.textPrimary : theme.textPrimary)
                  : (isSelected ? Colors.text.primary : 'rgba(255, 255, 255, 0.85)'),
                fontFamily: Typography.englishBody.fontFamily,
              }}
            >
              {mode.name}
            </span>
            {/* 模式描述 */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: isLightTheme ? theme.textTertiary : 'rgba(255, 255, 255, 0.45)',
                fontFamily: Typography.englishBody.fontFamily,
              }}
            >
              {mode.description}
            </span>
          </div>
        );
      })}
    </div>
  );

  return createPortal(dropdownContent, document.body);
};

export default ModeSelector;
