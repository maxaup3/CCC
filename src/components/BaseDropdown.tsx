/**
 * 通用下拉菜单组件
 * 用于 ModeSelector, CapabilitySelector, ModelDropdown 等
 */
import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Typography, Spacing } from '../styles/constants';
import { useThemedStyles } from '../hooks/useThemedStyles';

export interface DropdownItem<T extends string = string> {
  id: T;
  name: string;
  description?: string;
  extra?: React.ReactNode;
}

export interface BaseDropdownProps<T extends string = string> {
  items: DropdownItem<T>[];
  selectedId?: T;
  onSelect: (id: T) => void;
  onClose: () => void;
  position: { top: number; left: number };
  width?: number;
  dataAttribute?: string;
}

function BaseDropdown<T extends string = string>({
  items,
  selectedId,
  onSelect,
  onClose,
  position,
  width = 200,
  dataAttribute,
}: BaseDropdownProps<T>) {
  const { isLight, theme } = useThemedStyles();
  const containerRef = useRef<HTMLDivElement>(null);

  // 动态创建 data 属性对象
  const dataAttr = dataAttribute ? { [`data-${dataAttribute}`]: true } : {};

  const dropdownContent = (
    <div
      ref={containerRef}
      {...dataAttr}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(calc(-100% - 8px))',
        width,
        background: isLight ? '#F5F5F5' : '#2A2A2A',
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
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        return (
          <div
            key={item.id}
            onClick={() => {
              onSelect(item.id);
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
              e.currentTarget.style.background = isLight
                ? 'rgba(0, 0, 0, 0.06)'
                : 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* 名称行 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isLight
                    ? theme.textPrimary
                    : isSelected
                    ? theme.textPrimary
                    : 'rgba(255, 255, 255, 0.85)',
                  fontFamily: Typography.englishBody.fontFamily,
                }}
              >
                {item.name}
              </span>
              {item.extra}
            </div>
            {/* 描述 */}
            {item.description && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: isLight ? theme.textTertiary : 'rgba(255, 255, 255, 0.45)',
                  fontFamily: Typography.englishBody.fontFamily,
                }}
              >
                {item.description}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return createPortal(dropdownContent, document.body);
}

export default React.memo(BaseDropdown) as typeof BaseDropdown;
