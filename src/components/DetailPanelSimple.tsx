import React, { useState } from 'react';
import { ImageLayer } from '../types';
import { Colors, Typography, BorderRadius, Spacing } from '../styles/constants';
import iconCopy from '../assets/icons/copy.svg?url';
import iconClose from '../assets/icons/close.svg?url';
import { getResolutionLevel } from '../utils/imageUtils';
import { useThemedStyles } from '../hooks/useThemedStyles';

/**
 * 方案3: Simplified Panel 样式
 * - 保持右侧面板形式，但更加轻量
 * - 减少内容，去除分组，更紧凑的布局
 * - 半透明背景，更现代的视觉效果
 */
interface DetailPanelSimpleProps {
  layer: ImageLayer;
  onClose: () => void;
  onLayerUpdate?: (layerId: string, updates: Partial<ImageLayer>) => void;
}

const DetailPanelSimple: React.FC<DetailPanelSimpleProps> = ({ layer, onClose, onLayerUpdate }) => {
  const { isLight, colors, iconFilter } = useThemedStyles();
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(layer.name || '');

  // 处理名称双击编辑
  const handleNameDoubleClick = () => {
    setIsEditingName(true);
    setEditingName(layer.name || '');
  };

  // 处理名称提交
  const handleNameSubmit = () => {
    if (editingName.trim() && onLayerUpdate) {
      onLayerUpdate(layer.id, { name: editingName.trim() });
    }
    setIsEditingName(false);
  };

  // 处理键盘事件
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditingName(layer.name || '');
    }
  };

  // 复制提示词
  const handleCopyPrompt = () => {
    if (layer.generationConfig?.prompt) {
      navigator.clipboard.writeText(layer.generationConfig.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const bgColor = colors.background.secondary;
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.tertiary;
  const borderColor = colors.stroke.primary;
  const hoverBg = colors.interactive.hover;

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        top: 60,
        width: 220,
        maxHeight: 'calc(100vh - 100px)',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        boxShadow: isLight
          ? '0 4px 24px rgba(0, 0, 0, 0.08)'
          : '0 4px 24px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(24px)',
        zIndex: 1000,
        overflow: 'hidden',
        animation: 'slideIn 0.2s ease',
      }}
    >
      {/* 紧凑的 Header - 与 LayerPanel 保持一致 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 8px',
          height: 44,
          flexShrink: 0,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditingName ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              autoFocus
              style={{
                width: '100%',
                background: isLight ? Colors.background.primary : 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${isLight ? Colors.border.active : 'rgba(255, 255, 255, 0.2)'}`,
                borderRadius: BorderRadius.small,
                padding: `${Spacing.xs}px ${Spacing.sm}px`,
                fontSize: 14,
                fontWeight: 600,
                color: textPrimary,
                outline: 'none',
                fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <span
              onDoubleClick={handleNameDoubleClick}
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: textPrimary,
                fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title="双击编辑名称"
            >
              {layer.name || '图片详情'}
            </span>
          )}
        </div>
        {/* 关闭按钮 - 与 LayerPanel 保持一致 */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          onClick={onClose}
          style={{ cursor: 'pointer', transition: 'opacity 0.2s', flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <path d="M4 4L12 12M12 4L4 12" stroke={textPrimary} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Content */}
      <div style={{ padding: 8, overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
        {/* 提示词 - 可展开 */}
        {layer.generationConfig?.prompt && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                Prompt
              </span>
              <button
                onClick={handleCopyPrompt}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  borderRadius: 4,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <img
                  src={iconCopy}
                  alt="复制"
                  style={{
                    width: 11,
                    height: 11,
                    filter: iconFilter,
                    opacity: 0.6,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: copied ? '#4CAF50' : textSecondary,
                  }}
                >
                  {copied ? '✓' : '复制'}
                </span>
              </button>
            </div>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: textPrimary,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 80,
                overflow: 'auto',
                padding: 8,
                background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                borderRadius: 6,
              }}
            >
              {layer.generationConfig.prompt}
            </p>
          </div>
        )}

        {/* 信息列表 - 紧凑的行式布局 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <InfoRow
            label="比例"
            value={layer.generationConfig?.aspectRatio || `${layer.width}:${layer.height}`}
            isLight={isLight}
          />
          <InfoRow
            label="分辨率"
            value={getResolutionLevel(layer.width, layer.height)}
            isLight={isLight}
          />
          <InfoRow
            label="尺寸"
            value={`${layer.width} × ${layer.height}`}
            isLight={isLight}
          />
          <InfoRow
            label="类型"
            value={layer.type === 'video' ? '视频' : '图片'}
            isLight={isLight}
          />
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

// 信息行组件 - 使用 React.memo 避免不必要的重渲染
const InfoRow: React.FC<{ label: string; value: string; isLight: boolean }> = React.memo(({
  label,
  value,
  isLight,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 0',
    }}
  >
    <span
      style={{
        fontSize: 11,
        color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: 12,
        color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)',
        fontWeight: 500,
      }}
    >
      {value}
    </span>
  </div>
));

export default React.memo(DetailPanelSimple);
