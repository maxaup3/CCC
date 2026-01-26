import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { VideoCapability } from '../types';
import { Typography, Spacing } from '../styles/constants';
import { useTheme, getThemeStyles, isLightTheme as checkLightTheme } from '../contexts/ThemeContext';

interface CapabilitySelectorProps {
  selectedCapability: VideoCapability;
  onSelect: (capability: VideoCapability) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const CapabilitySelector: React.FC<CapabilitySelectorProps> = ({
  selectedCapability,
  onSelect,
  onClose,
  position,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { themeMode } = useTheme();
  const theme = getThemeStyles(themeMode);

  // 判断是否为浅色主题
  const isLightTheme = checkLightTheme(themeMode);

  const capabilities: Array<{ id: VideoCapability; name: string; description: string }> = [
    {
      id: 'text-to-video',
      name: '文生视频',
      description: '从文本描述生成视频',
    },
    {
      id: 'image-to-video',
      name: '图生视频',
      description: '从参考图生成视频',
    },
    {
      id: 'first-last-frame',
      name: '首尾帧',
      description: '根据首尾两帧生成视频',
    },
  ];

  const dropdownContent = (
    <div
      ref={containerRef}
      data-capability-dropdown
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(calc(-100% - 8px))',
        width: 200,
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
      }}
    >
      {capabilities.map((capability) => {
        const isSelected = capability.id === selectedCapability;
        return (
          <div
            key={capability.id}
            onClick={() => {
              onSelect(capability.id);
              onClose();
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: `${Spacing.xs}px ${Spacing.sm}px`,
              background: 'transparent',
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
            {/* 能力名称 */}
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isLightTheme
                  ? (isSelected ? theme.textPrimary : theme.textPrimary)
                  : (isSelected ? theme.textPrimary : 'rgba(255, 255, 255, 0.85)'),
                fontFamily: Typography.englishBody.fontFamily,
              }}
            >
              {capability.name}
            </span>
            {/* 能力描述 */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: isLightTheme ? theme.textTertiary : 'rgba(255, 255, 255, 0.45)',
                fontFamily: Typography.englishBody.fontFamily,
              }}
            >
              {capability.description}
            </span>
          </div>
        );
      })}
    </div>
  );

  return createPortal(dropdownContent, document.body);
};

export default CapabilitySelector;
