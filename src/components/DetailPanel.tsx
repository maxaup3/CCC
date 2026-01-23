import React from 'react';
import { ImageLayer } from '../types';
import { useTheme, getThemeStyles, isLightTheme } from '../contexts/ThemeContext';
import iconClose from '../assets/icons/close.svg?url';
import iconInfo from '../assets/icons/info_circle.svg?url';

interface DetailPanelProps {
  layer: ImageLayer;
  onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ layer, onClose }) => {
  const { themeStyle } = useTheme();
  const themeStyles = getThemeStyles(themeStyle);
  const isLight = isLightTheme(themeStyle);

  // 获取图片创建时间
  const dateAdded = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/\//g, '/');

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        top: 60,
        width: 244,
        height: 'calc(100vh - 80px)',
        maxHeight: 'calc(100vh - 80px)',
        background: isLight ? '#f5f5f5' : 'rgba(30, 30, 30, 0.95)',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        boxShadow: '0 0 16px rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(20px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={iconInfo}
            alt="Details"
            style={{
              width: 16,
              height: 16,
              filter: isLight ? 'brightness(0.3)' : 'brightness(0) invert(1)',
            }}
          />
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              lineHeight: '24px',
              color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
              margin: 0,
            }}
          >
            Details
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 16,
            height: 16,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={iconClose}
            alt="Close"
            style={{
              width: 16,
              height: 16,
              filter: isLight ? 'brightness(0.3)' : 'brightness(0) invert(1)',
              opacity: 0.65,
            }}
          />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Files Name */}
        <div
          style={{
            background: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 6,
            padding: 12,
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 400,
              fontFamily: 'Roboto, sans-serif',
              lineHeight: '16px',
              color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
              margin: 0,
            }}
          >
            {layer.name || '未命名'}
          </p>
        </div>

        {/* Description */}
        {layer.generationConfig?.prompt && (
          <div
            style={{
              background: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)',
              borderRadius: 6,
              padding: '8px 12px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  fontFamily: 'Roboto, sans-serif',
                  lineHeight: '16px',
                  color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                  margin: 0,
                }}
              >
                Description
              </p>
            </div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 400,
                fontFamily: 'Roboto, sans-serif',
                lineHeight: '16px',
                color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {layer.generationConfig.prompt}
            </p>
          </div>
        )}

        {/* Media Info */}
        <div
          style={{
            background: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 8,
            padding: '8px 9px 8px 9px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ padding: '0 4px' }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 400,
                fontFamily: 'Roboto, sans-serif',
                lineHeight: '16px',
                color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                margin: 0,
              }}
            >
              Media
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Aspect Ratio */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 4px',
                borderRadius: 8,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  fontFamily: 'Roboto, sans-serif',
                  lineHeight: '14px',
                  color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                  margin: 0,
                }}
              >
                Aspect Ratio
              </p>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  fontFamily: 'Roboto, sans-serif',
                  lineHeight: '16px',
                  color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                  margin: 0,
                  width: 120,
                  textAlign: 'right',
                }}
              >
                {layer.generationConfig?.aspectRatio || `${layer.width} : ${layer.height}`}
              </p>
            </div>
            {/* Resolution */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 4px',
                borderRadius: 8,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  fontFamily: 'Roboto, sans-serif',
                  lineHeight: '14px',
                  color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                  margin: 0,
                }}
              >
                Resolution
              </p>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  fontFamily: 'Roboto, sans-serif',
                  lineHeight: '16px',
                  color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                  margin: 0,
                  width: 120,
                  textAlign: 'right',
                }}
              >
                {layer.width} x {layer.height}
              </p>
            </div>
            {/* Date Added */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 4px',
                borderRadius: 8,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  fontFamily: 'Roboto, sans-serif',
                  lineHeight: '14px',
                  color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                  margin: 0,
                }}
              >
                Date Added
              </p>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  fontFamily: 'Roboto, sans-serif',
                  lineHeight: '16px',
                  color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                  margin: 0,
                  width: 120,
                  textAlign: 'right',
                }}
              >
                {dateAdded}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DetailPanel;
