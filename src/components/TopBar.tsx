import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Colors, Typography, BorderRadius, Spacing } from '../styles/constants';
import { useTheme, getThemeStyles } from '../contexts/ThemeContext';
import sLogo from '../assets/icons/s_logo.svg?url';

interface TopBarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  credits: number;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onLogoClick?: () => void;
  onGoHome?: () => void;
  onGoToProjects?: () => void;
  onNewProject?: () => void;
  onDeleteProject?: () => void;
  onImportImage?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicate?: () => void;
  onShowAllImages?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  zoom,
  onZoomChange,
  credits,
  projectName,
  onProjectNameChange,
  onLogoClick,
  onGoHome,
  onGoToProjects,
  onNewProject,
  onDeleteProject,
  onImportImage,
  onUndo,
  onRedo,
  onDuplicate,
  onShowAllImages,
}) => {
  const { themeStyle } = useTheme();
  const theme = getThemeStyles(themeStyle);

  // 判断是否为浅色主题
  const isLightTheme = themeStyle === 'anthropic' || themeStyle === 'neumorphism' || themeStyle === 'genz' || themeStyle === 'minimalism' || themeStyle === 'flat';

  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [showMenu, setShowMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // 菜单项配置
  const menuItems = [
    { label: '主页', shortcut: '', action: onGoHome, dividerAfter: false },
    { label: '新建项目', shortcut: '', action: onNewProject, dividerAfter: false },
    { label: '删除当前项目', shortcut: '', action: onDeleteProject, dividerAfter: true },
    { label: '导入图片', shortcut: '', action: onImportImage, dividerAfter: true },
    { label: '撤销', shortcut: '⌘ Z', action: onUndo, dividerAfter: false },
    { label: 'Redo', shortcut: '⌘ ⇧ Z', action: onRedo, dividerAfter: false },
    { label: '复制画布', shortcut: '⌘ D', action: onDuplicate, dividerAfter: true },
    { label: '放大', shortcut: '⌘ +', action: () => onZoomChange(Math.min(200, zoom + 10)), dividerAfter: false },
    { label: '缩小', shortcut: '⌘ -', action: () => onZoomChange(Math.max(10, zoom - 10)), dividerAfter: false },
  ];

  useEffect(() => {
    setTempName(projectName);
  }, [projectName]);

  const handleNameClick = () => {
    setIsEditing(true);
  };

  const handleNameBlur = () => {
    setIsEditing(false);
    if (tempName.trim()) {
      onProjectNameChange(tempName.trim());
    } else {
      setTempName(projectName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setTempName(projectName);
      setIsEditing(false);
    }
  };
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'transparent',
        background: 'transparent',
        backgroundImage: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px', // 精确匹配设计稿 (layout_39HGKV: x:20)
        zIndex: 1000,
        borderBottom: 'none',
        borderImage: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Logo / Menu Button - 点击切换 */}
        <button
          ref={menuButtonRef}
          onClick={() => setShowMenu(!showMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            background: showMenu ? (isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)') : 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!showMenu) {
              e.currentTarget.style.background = isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!showMenu) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          {showMenu ? (
            // Menu icon (hamburger) when open
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5H17" stroke={isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF'} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 10H17" stroke={isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF'} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 15H17" stroke={isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            // Logo when closed
            <img
              src={sLogo}
              alt="Logo"
              style={{
                width: 28,
                height: 28,
              }}
            />
          )}
        </button>

        {/* Dropdown Menu */}
        {showMenu && createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: 56,
              left: 20,
              background: isLightTheme ? '#FFFFFF' : '#2A2A2A',
              borderRadius: 12,
              boxShadow: isLightTheme
                ? '0 4px 24px rgba(0, 0, 0, 0.12)'
                : '0 4px 24px rgba(0, 0, 0, 0.4)',
              border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
              padding: '8px 0',
              minWidth: 220,
              zIndex: 10000,
            }}
          >
            {menuItems.map((item, index) => (
              <React.Fragment key={index}>
                <button
                  onClick={() => {
                    item.action?.();
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isLightTheme ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      color: isLightTheme ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
                      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                    }}
                  >
                    {item.label}
                  </span>
                  {item.shortcut && (
                    <span
                      style={{
                        fontSize: 12,
                        color: isLightTheme ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)',
                        fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                      }}
                    >
                      {item.shortcut}
                    </span>
                  )}
                </button>
                {item.dividerAfter && (
                  <div
                    style={{
                      height: 1,
                      background: isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)',
                      margin: '8px 0',
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}

        {/* Chevron - 向下/向上切换 */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            marginLeft: -2,
            transition: 'transform 0.2s',
            transform: showMenu ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M4 6L8 10L12 6" stroke={isLightTheme ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {isEditing ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
            style={{
              fontSize: Typography.chinese.fontSize.large,
              fontWeight: Typography.chinese.fontWeight,
              color: isLightTheme ? theme.textPrimary : Colors.text.primary,
              fontFamily: Typography.chinese.fontFamily,
              background: isLightTheme ? theme.inputBackground : Colors.background.hover,
              border: isLightTheme ? theme.inputBorder : `1px solid ${Colors.border.active}`,
              borderRadius: BorderRadius.small,
              padding: '4px 8px',
              outline: 'none',
              minWidth: 100,
            }}
          />
        ) : (
          <span
            onClick={handleNameClick}
            style={{
              fontSize: Typography.chinese.fontSize.large,
              fontWeight: Typography.chinese.fontWeight,
              color: isLightTheme ? theme.textPrimary : 'rgba(255, 255, 255, 0.85)',
              fontFamily: Typography.chinese.fontFamily,
              cursor: 'pointer',
              padding: `${Spacing.xs}px ${Spacing.sm}px`,
              borderRadius: BorderRadius.small,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isLightTheme ? 'rgba(0, 0, 0, 0.05)' : Colors.background.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {projectName}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 缩放控制 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: themeStyle === 'original' ? `1px solid rgba(255, 255, 255, 0.2)` : theme.buttonBorder,
            borderRadius: themeStyle === 'original' ? BorderRadius.large : parseInt(theme.buttonBorderRadius),
            padding: `${Spacing.xs}px ${Spacing.sm}px`,
            background: themeStyle === 'original' ? Colors.background.primary : theme.buttonBackground,
            backdropFilter: themeStyle === 'original' ? undefined : theme.panelBackdrop,
            height: 36,
            transition: 'all 0.3s ease',
            boxShadow: themeStyle === 'cyberpunk' ? `0 0 15px ${(theme as any).glowColor}40` : undefined,
          }}
        >
          <button
            onClick={() => onZoomChange(Math.max(10, zoom - 10))}
            style={{
              background: 'transparent',
              border: 'none',
              color: isLightTheme ? theme.textPrimary : '#FFFFFF',
              cursor: 'pointer',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.2s ease-in-out',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span
            style={{
              fontSize: Typography.englishHeading.fontSize.small,
              fontWeight: Typography.englishHeading.fontWeight,
              color: isLightTheme ? theme.textPrimary : Colors.text.primary,
              minWidth: 29,
              textAlign: 'center',
              fontFamily: Typography.englishHeading.fontFamily,
            }}
          >
            {Math.round(zoom)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
            style={{
              background: 'transparent',
              border: 'none',
              color: isLightTheme ? theme.textPrimary : '#FFFFFF',
              cursor: 'pointer',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.2s ease-in-out',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 积分显示 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: `${Spacing.xs}px 9px`,
            background: themeStyle === 'original' ? Colors.theme.primaryLight : theme.buttonBackground,
            backdropFilter: themeStyle === 'original' ? undefined : theme.panelBackdrop,
            border: themeStyle === 'original' ? 'none' : theme.buttonBorder,
            borderRadius: themeStyle === 'original' ? BorderRadius.large : parseInt(theme.buttonBorderRadius),
            height: 36,
            transition: 'all 0.3s ease',
            boxShadow: themeStyle === 'cyberpunk' ? `0 0 15px ${(theme as any).glowColor}40` : undefined,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10.876 2.8451C10.994 2.4203 10.6746 2 10.2337 2H6.04304C5.75256 2 5.49552 2.18808 5.40763 2.46495L3.55288 8.30739C3.43463 8.67988 3.66068 9.07373 4.04196 9.15951L5.6228 9.5152C5.99078 9.598 6.21685 9.96932 6.12144 10.3342L5.11873 14.1696C5.03323 14.4966 5.43269 14.7286 5.67433 14.4922L12.5251 7.79035C12.888 7.43533 12.7367 6.82112 12.2505 6.67524L10.6253 6.18768C10.2777 6.08341 10.0774 5.72032 10.1745 5.3707L10.876 2.8451Z"
              fill={isLightTheme ? theme.textAccent : "#38BDFF"}
              fillOpacity="1"
            />
          </svg>
          <span style={{
            fontSize: Typography.englishHeading.fontSize.medium,
            fontWeight: Typography.englishHeading.fontWeight,
            color: isLightTheme ? theme.textPrimary : Colors.text.primary,
            fontFamily: Typography.englishHeading.fontFamily
          }}>
            {Math.floor(credits)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;

