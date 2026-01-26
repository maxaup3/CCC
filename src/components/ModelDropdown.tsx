import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Model } from '../types';
import { Colors, Typography, BorderRadius, Spacing } from '../styles/constants';
import { useTheme, getThemeStyles, isLightTheme as checkLightTheme } from '../contexts/ThemeContext';

interface ModelDropdownProps {
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const ModelDropdown: React.FC<ModelDropdownProps> = ({
  models,
  selectedModel,
  onSelect,
  onClose,
  position,
}) => {
  const { themeMode } = useTheme();
  const theme = getThemeStyles(themeMode);
  const containerRef = useRef<HTMLDivElement>(null);

  // 判断是否为浅色主题
  const isLightTheme = checkLightTheme(themeMode);

  // 点击外部关闭由父组件处理，这里不需要


  const dropdownContent = (
    <div
      ref={containerRef}
      data-model-dropdown
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(calc(-100% - 8px))', // 向上偏移100%高度 + 8px间距
        width: 240, // 精确匹配设计稿
        background: isLightTheme ? '#F5F5F5' : '#2A2A2A',
        backdropFilter: 'none',
        border: theme.panelBorder,
        borderRadius: 8,
        boxShadow: theme.panelShadow,
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: Spacing.xs, // 4px padding
        pointerEvents: 'auto', // 确保可以交互
        visibility: 'visible', // 确保可见
        opacity: 1, // 确保不透明
      }}
    >
      {models.slice(0, 5).map((model) => {
        const isSelected = model.id === selectedModel;
        return (
          <div
            key={model.id}
            onClick={() => {
              onSelect(model.id);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: Spacing.sm, // 8px gap (精确匹配设计稿)
              padding: `${Spacing.xs}px ${Spacing.sm}px`, // 4px 8px (精确匹配设计稿)
              background: 'transparent',
              borderRadius: BorderRadius.small, // 4px
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isLightTheme ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* 文本内容 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: Typography.englishHeading.fontSize.small, // 14px
                  fontWeight: Typography.englishHeading.fontWeight, // 600
                  color: isLightTheme ? theme.textPrimary : Colors.text.primary,
                  fontFamily: Typography.englishHeading.fontFamily,
                  lineHeight: '1.4285714285714286em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {model.name}
              </span>
              <span
                style={{
                  fontSize: 11, // H(En)/11 (精确匹配设计稿)
                  fontWeight: Typography.englishHeading.fontWeight, // 600
                  color: isLightTheme ? theme.textSecondary : Colors.text.secondary,
                  fontFamily: Typography.englishBody.fontFamily, // Roboto
                  lineHeight: '1.2727272727272727em', // 精确匹配设计稿
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {model.description || '模型一句话介绍'}
              </span>
            </div>
            {/* 预估时间 */}
            {model.estimatedTime && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: isLightTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)',
                  fontFamily: Typography.englishBody.fontFamily,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {model.estimatedTime}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  // 使用 Portal 渲染到 body，避免受父元素 transform 影响
  return createPortal(dropdownContent, document.body);
};

export default ModelDropdown;

