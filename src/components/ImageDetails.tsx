import React from 'react';
import { ImageLayer } from '../types';
import { useTheme, getThemeStyles, isLightTheme } from '../contexts/ThemeContext';
import { Colors } from '../styles/constants';

interface ImageDetailsProps {
  layer: ImageLayer;
  onClose: () => void;
  onLayerUpdate: (layerId: string, updates: Partial<ImageLayer>) => void;
}

const ImageDetails: React.FC<ImageDetailsProps> = ({ layer, onClose, onLayerUpdate: _onLayerUpdate }) => {
  const { themeStyle } = useTheme();
  const theme = getThemeStyles(themeStyle);
  const isLight = isLightTheme(themeStyle);

  // 使用与 LayerPanel 相同的主题背景
  const textPrimary = Colors.text.primary;
  const textSecondary = Colors.text.secondary;
  const textTertiary = Colors.text.tertiary;
  const cardBg = Colors.background.secondary;
  const cardBgLight = Colors.background.tertiary;
  const hoverBg = Colors.background.hover;
  const iconColor = isLight ? '#333333' : '#FFFFFF';

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        bottom: 20,
        right: 20,
        width: 244,
        background: theme.panelBackground,
        backdropFilter: theme.panelBackdrop,
        border: themeStyle === 'cyberpunk' ? 'none' : theme.panelBorder,
        borderImage: themeStyle === 'cyberpunk' ? (theme as any).panelBorderImage : undefined,
        borderRadius: parseInt(theme.panelBorderRadius),
        boxShadow: theme.panelShadow,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      } as React.CSSProperties}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 8px',
          height: 44,
          flexShrink: 0,
          borderBottom: `1px solid ${Colors.border.default}`,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: textPrimary, fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
          Details
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease-in-out',
            borderRadius: '50%',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = hoverBg}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 文件名 */}
        <div
          style={{
            padding: 8,
            background: cardBg,
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 400, color: textSecondary, marginBottom: 4, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
            Files Name
          </div>
          <div style={{ fontSize: 12, fontWeight: 400, color: textPrimary, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
            {layer.name}
          </div>
        </div>

        {/* 描述 */}
        <div
          style={{
            padding: 8,
            background: cardBg,
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 400, color: textSecondary, marginBottom: 8, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
            Description
          </div>
          <div style={{ fontSize: 12, fontWeight: 400, color: textPrimary, marginBottom: 8, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
            {layer.description || 'A life-sized wooden sculpture of a giant panda, carved with visible chisel marks, textured fur details, painted in black and white, standing on a clean indoor gallery floor, contemporary art style, studio lighting, high resolution'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(layer.tags || ['TAG', 'TAG', 'TAG', 'TAG']).map((tag, index) => (
              <div
                key={index}
                style={{
                  padding: '4px 8px',
                  background: cardBg,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 400,
                  color: textTertiary,
                  fontFamily: 'PingFang SC, -apple-system, sans-serif',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* 媒体信息 */}
        <div
          style={{
            padding: 8,
            background: cardBg,
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 400, color: textSecondary, marginBottom: 8, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
            Media
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: cardBgLight,
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 400, color: textSecondary, fontFamily: 'Roboto, -apple-system, sans-serif' }}>Aspect Ratio</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: textPrimary, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
                {layer.aspectRatio || '16 : 9'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: cardBgLight,
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 400, color: textSecondary, fontFamily: 'Roboto, -apple-system, sans-serif' }}>Resolution</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: textPrimary, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
                {layer.resolution || `${layer.width} x ${layer.height}`}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: cardBgLight,
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 400, color: textSecondary, fontFamily: 'Roboto, -apple-system, sans-serif' }}>Date Added</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: textPrimary, fontFamily: 'Roboto, -apple-system, sans-serif' }}>
                {layer.dateAdded || '2025/04/27 14:39'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDetails;
