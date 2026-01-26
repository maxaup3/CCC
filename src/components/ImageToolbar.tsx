import React, { useState, useRef, useEffect } from 'react';
import { ImageLayer } from '../types';
import { BorderRadius } from '../styles/constants';
import { useTheme, getThemeStyles, isLightTheme as checkLightTheme } from '../contexts/ThemeContext';

const isLightTheme = checkLightTheme;
import { getResolutionLevel } from '../utils/imageUtils';

// 图标路径
const iconRemix = '/assets/icons/remix.svg';
const iconEdit = '/assets/icons/edit.svg';
const iconDownload = '/assets/icons/download.svg';
const iconKeyframes = '/assets/icons/start_end_frames.svg';
const iconImage = '/assets/icons/image.svg';
const iconMerge = '/assets/icons/copy.svg';
const iconFillDialog = '/assets/icons/image.svg'; // 加入工作区
const iconCopy = '/assets/icons/copy.svg';
const iconCredits = '/assets/icons/credits.svg';

interface ImageToolbarProps {
  selectedLayers: ImageLayer[];
  layerPosition: { x: number; y: number; width: number; height: number } | null;
  stagePos: { x: number; y: number };
  zoom: number;
  onDownload: () => void;
  onBatchDownload?: () => void;
  onRemix?: () => void;
  onEdit?: (quickEditPrompt?: string) => void;
  onFillToDialog?: () => void;
  onFillToKeyframes?: () => void;
  onFillToImageGen?: () => void;
  onMergeLayers?: () => void;
  // 用于将编辑框定位到图片下方
  imageBottomY?: number;
}

const ImageToolbar: React.FC<ImageToolbarProps> = ({
  selectedLayers,
  layerPosition,
  stagePos,
  zoom,
  onDownload,
  onBatchDownload,
  onRemix,
  onEdit,
  onFillToDialog,
  onFillToKeyframes,
  onFillToImageGen,
  onMergeLayers,
  imageBottomY,
}) => {
  const { themeMode } = useTheme();
  const theme = getThemeStyles(themeMode);
  const isLight = isLightTheme(themeMode);

  // 辅助函数：根据主题获取图标 filter
  const getIconFilter = () => {
    if (isLight) {
      // 浅色主题：保持深色图标(不反转)
      return 'brightness(0.3)';
    }
    // 深色主题：反转为白色
    return 'brightness(0) invert(1)';
  };

  const [showDetailsTooltip, setShowDetailsTooltip] = useState(false);
  const detailsTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hoveredButtonIndex, setHoveredButtonIndex] = useState<number | null>(null);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [quickEditPrompt, setQuickEditPrompt] = useState('');
  const quickEditInputRef = useRef<HTMLTextAreaElement>(null);
  const [editButtonSelected, setEditButtonSelected] = useState(false);

  // Tab 快捷键处理 - 只有单图选中时才能唤起/关闭编辑模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 仅当选中单张图片时触发
      if (e.key === 'Tab' && selectedLayers.length === 1) {
        e.preventDefault();
        if (showQuickEdit) {
          // 已经在编辑模式，关闭它
          setShowQuickEdit(false);
          setEditButtonSelected(false);
          setQuickEditPrompt('');
        } else {
          // 打开编辑模式
          handleEditClick();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayers.length, showQuickEdit]);

  if (selectedLayers.length === 0 || !layerPosition) return null;

  // Convert canvas coordinates to screen coordinates
  // Canvas 容器从 top: 0 开始，所以不需要偏移
  const canvasTopOffset = 0;
  const scale = zoom / 100;
  const screenX = layerPosition.x * scale + stagePos.x;
  const screenY = layerPosition.y * scale + stagePos.y + canvasTopOffset;
  const screenWidth = layerPosition.width * scale;
  const screenHeight = layerPosition.height * scale;

  // Position toolbar above the image
  // 功能条：与图片水平居中对齐，底部距离图片顶部 28px
  const toolbarX = screenX + screenWidth / 2;
  // 功能条底部距离图片顶部 28px
  const toolbarBottom = screenY - 28;
  // 图片底部位置（用于定位编辑框到图片下方）
  const imageBottom = imageBottomY !== undefined ? imageBottomY : (screenY + screenHeight);

  // 判断选中的媒介类型和数量
  const imageCount = selectedLayers.filter(l => l.type !== 'video').length;
  const videoCount = selectedLayers.filter(l => l.type === 'video').length;
  const totalCount = selectedLayers.length;

  // 定义按钮配置
  interface ButtonConfig {
    label: string;
    icon?: string;
    title: string;
    onClick?: () => void;
    iconOnly?: boolean;
    isDetails?: boolean; // 标记是否为 Details 按钮（使用 hover 而非 click）
    group?: number; // 按钮所属组（用于判断是否显示分隔线）
  }

  let buttons: ButtonConfig[] = [];

  // 根据选中情况决定显示哪些按钮
  // 处理 Edit 按钮点击
  const handleEditClick = () => {
    setShowQuickEdit(true);
    setEditButtonSelected(true);
    setQuickEditPrompt('');
    // 延迟聚焦，等待 DOM 渲染
    setTimeout(() => {
      quickEditInputRef.current?.focus();
      quickEditInputRef.current?.select();
    }, 50);
  };

  // 处理快速编辑提交
  const handleQuickEditSubmit = () => {
    if (quickEditPrompt.trim() && onEdit) {
      onEdit(quickEditPrompt.trim());
      setShowQuickEdit(false);
      setEditButtonSelected(false);
      setQuickEditPrompt('');
    }
  };

  if (totalCount === 1 && imageCount === 1) {
    // 图片*1
    buttons = [
      { label: '加入工作区', icon: iconFillDialog, title: '加入工作区 (Cmd+左键快速填入)', onClick: onFillToDialog, group: 1 },
      { label: 'Remix', icon: iconRemix, title: '回填参数到对话框', onClick: onRemix, group: 1 },
      { label: 'Edit', icon: iconEdit, title: '快速编辑', onClick: handleEditClick, group: 1 },
      { label: '', icon: iconDownload, title: '下载', onClick: onDownload, iconOnly: true, group: 2 },
    ];
  } else if (totalCount === 1 && videoCount === 1) {
    // 视频*1
    buttons = [
      { label: 'Remix', icon: iconRemix, title: '回填参数到对话框', onClick: onRemix, group: 1 },
      { label: '', icon: iconDownload, title: '下载', onClick: onDownload, iconOnly: true, group: 2 },
    ];
  } else if (imageCount >= 2 && videoCount === 0) {
    // 图片*2或更多
    buttons = [
      { label: '填入首尾帧', icon: iconKeyframes, title: '填入首尾帧', onClick: onFillToKeyframes, group: 1 },
      { label: '填入图像生成', icon: iconImage, title: '填入图像生成', onClick: onFillToImageGen, group: 1 },
      { label: '合并图层', icon: iconMerge, title: '合并图层', onClick: onMergeLayers, group: 1 },
      { label: '', icon: iconDownload, title: '下载', onClick: onBatchDownload, iconOnly: true, group: 2 },
    ];
  } else if (videoCount > 0 && imageCount > 0) {
    // 视频+图片混合
    buttons = [
      { label: '', icon: iconDownload, title: '下载', onClick: onBatchDownload, iconOnly: true, group: 1 },
    ];
  } else if (videoCount > 1) {
    // 视频*超过1
    buttons = [
      { label: '', icon: iconDownload, title: '下载', onClick: onBatchDownload, iconOnly: true, group: 1 },
    ];
  }

  return (
    <>
    <div
      style={{
        position: 'fixed',
        left: `${toolbarX}px`,
        top: `${toolbarBottom}px`,
        transform: 'translateX(-50%) translateY(-100%)',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: theme.panelBackground,
        backdropFilter: theme.panelBackdrop,
        border: theme.panelBorder,
        borderRadius: parseInt(theme.panelBorderRadius),
        padding: '4px',
        boxShadow: theme.panelShadow,
        zIndex: 2000,
        height: 44,
        transition: 'all 0.3s ease',
      }}
    >
      {buttons.map((button, index) => {
        const prevButton = index > 0 ? buttons[index - 1] : null;
        const isGroupBoundary = prevButton && prevButton.group !== button.group;

        return (
          <React.Fragment key={index}>
            {/* 组之间显示分隔线 */}
            {isGroupBoundary && (
              <div
                style={{
                  width: 1,
                  height: 20,
                  background: isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)',
                  margin: '0 4px',
                  flexShrink: 0,
                }}
              />
            )}
            <button
              onClick={button.isDetails ? undefined : button.onClick}
              style={{
                height: 36,
                width: button.iconOnly ? 36 : 'auto',
                background: button.label === 'Edit' && editButtonSelected
                  ? (isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)')
                  : 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: button.iconOnly ? 0 : 6,
                padding: button.iconOnly ? 0 : '0 10px',
                transition: 'all 0.15s ease',
                borderRadius: 6,
                position: 'relative',
              }}
            onMouseEnter={(e) => {
              if (!(button.label === 'Edit' && editButtonSelected)) {
                e.currentTarget.style.background = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)';
              }
              setHoveredButtonIndex(index);
              if (button.isDetails) {
                // 取消之前的关闭定时器
                if (detailsTooltipTimeoutRef.current) {
                  clearTimeout(detailsTooltipTimeoutRef.current);
                  detailsTooltipTimeoutRef.current = null;
                }
                setShowDetailsTooltip(true);
              }
            }}
            onMouseLeave={(e) => {
              if (!(button.label === 'Edit' && editButtonSelected)) {
                e.currentTarget.style.background = 'transparent';
              }
              setHoveredButtonIndex(null);
              if (button.isDetails) {
                // 延迟关闭，给用户时间移动到 tooltip 上
                detailsTooltipTimeoutRef.current = setTimeout(() => {
                  setShowDetailsTooltip(false);
                }, 150);
              }
            }}
          >
            {button.icon && (
              <img
                src={button.icon}
                alt={button.label}
                width={18}
                height={18}
                style={{
                  flexShrink: 0,
                  filter: getIconFilter(),
                  opacity: 0.9
                }}
              />
            )}
            {!button.iconOnly && button.label && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isLight ? theme.textPrimary : 'rgba(255, 255, 255, 0.9)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.01em',
                }}
              >
                {button.label}
              </span>
            )}
            {/* 自定义 Tooltip - 立即显示 */}
            {hoveredButtonIndex === index && button.title && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 8,
                  backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : '#181818',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  boxShadow: isLight ? '0 2px 8px rgba(0, 0, 0, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.4)',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'white',
                    fontFamily: '"PingFang SC", -apple-system, sans-serif',
                    lineHeight: '16px',
                  }}
                >
                  {button.title}
                </span>
                {/* 小箭头 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: isLight ? '6px solid rgba(255, 255, 255, 0.98)' : '6px solid #181818',
                  }}
                />
              </div>
            )}
          </button>
          </React.Fragment>
        );
      })}

      {/* Details Tooltip */}
      {showDetailsTooltip && selectedLayers[0] && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 8,
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(26, 26, 26, 0.95)',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
            borderRadius: BorderRadius.medium,
            padding: 20,
            minWidth: 400,
            maxWidth: 600,
            boxShadow: isLight ? '0 4px 24px rgba(0, 0, 0, 0.15)' : '0 4px 24px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)',
            zIndex: 501,
          }}
          onMouseEnter={() => {
            // 鼠标移入 tooltip，取消关闭定时器
            if (detailsTooltipTimeoutRef.current) {
              clearTimeout(detailsTooltipTimeoutRef.current);
              detailsTooltipTimeoutRef.current = null;
            }
            setShowDetailsTooltip(true);
          }}
          onMouseLeave={() => {
            // 鼠标离开 tooltip，立即关闭
            setShowDetailsTooltip(false);
          }}
        >
          {/* 提示词区域 */}
          {selectedLayers[0].generationConfig?.prompt && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div style={{ color: isLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.65)', fontSize: 13 }}>
                  提示词
                </div>
                <button
                  onClick={() => {
                    if (selectedLayers[0].generationConfig?.prompt) {
                      navigator.clipboard.writeText(selectedLayers[0].generationConfig.prompt);
                    }
                  }}
                  style={{
                    background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                    border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="复制提示词"
                >
                  <img
                    src={iconCopy}
                    alt="复制"
                    style={{
                      width: 14,
                      height: 14,
                      filter: isLight ? 'brightness(0.3)' : 'brightness(0) invert(1)',
                      opacity: 0.65,
                    }}
                  />
                </button>
              </div>
              <div
                style={{
                  color: isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                  fontSize: 15,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {selectedLayers[0].generationConfig.prompt}
              </div>
            </div>
          )}

          {/* 图片信息 */}
          <div
            style={{
              display: 'flex',
              gap: 32,
              paddingTop: selectedLayers[0].generationConfig?.prompt ? 12 : 0,
              borderTop: selectedLayers[0].generationConfig?.prompt ? `1px solid ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'}` : 'none',
            }}
          >
            <div style={{ color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)', fontSize: 13 }}>
              图片 {selectedLayers[0].name || selectedLayers[0].id.slice(0, 4)}
            </div>
            <div style={{ color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)', fontSize: 13 }}>
              {selectedLayers[0].generationConfig?.aspectRatio || `${selectedLayers[0].width}:${selectedLayers[0].height}`}
            </div>
            <div style={{ color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)', fontSize: 13 }}>
              {getResolutionLevel(selectedLayers[0].width, selectedLayers[0].height)}
            </div>
          </div>
        </div>
      )}


    </div>

    {/* 快速编辑对话框 - 设计稿复现 */}
    {showQuickEdit && (
      <>
        {/* 背景遮罩 - 点击关闭 */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99998,
          }}
          onClick={() => {
            setShowQuickEdit(false);
            setEditButtonSelected(false);
            setQuickEditPrompt('');
          }}
        />
        {/* 编辑框 */}
        <div
          style={{
            position: 'fixed',
            top: `${imageBottom + 16}px`,
            left: `${toolbarX}px`,
            transform: 'translateX(-50%)',
            backgroundColor: isLight ? 'rgba(245, 245, 245, 1)' : 'rgba(30, 30, 30, 0.95)',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            backdropFilter: 'blur(10px)',
            zIndex: 99999,
            width: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 文本区域 */}
          <textarea
            ref={quickEditInputRef}
            value={quickEditPrompt}
            onChange={(e) => setQuickEditPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && quickEditPrompt.trim()) {
                e.preventDefault();
                handleQuickEditSubmit();
              } else if (e.key === 'Escape') {
                setShowQuickEdit(false);
                setEditButtonSelected(false);
                setQuickEditPrompt('');
              }
            }}
            placeholder="What do  you want to create today?"
            style={{
              padding: 0,
              fontSize: 16,
              fontFamily: 'Roboto, sans-serif',
              fontWeight: 400,
              lineHeight: '24px',
              border: 'none',
              background: 'transparent',
              color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.85)',
              outline: 'none',
              resize: 'none',
              minHeight: 56,
              boxSizing: 'border-box',
              whiteSpace: 'pre-wrap',
            }}
          />
          {/* 操作栏 - 生成按钮，复用 BottomDialog 的设计 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={handleQuickEditSubmit}
              disabled={!quickEditPrompt.trim()}
              title={quickEditPrompt.trim() ? '生成' : '请输入提示词'}
              style={{
                position: 'relative',
                width: 85,
                height: 36,
                background: isLight
                  ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 100%)',
                border: 'none',
                borderRadius: 100,
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                cursor: quickEditPrompt.trim() ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.3s ease-in-out, transform 0.2s ease-in-out',
                fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                overflow: 'visible',
                opacity: quickEditPrompt.trim() ? 1 : 0.5,
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (quickEditPrompt.trim()) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* 边框渐变效果 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 100,
                  padding: '1px',
                  background: isLight
                    ? (quickEditPrompt.trim()
                        ? 'linear-gradient(180deg, rgba(0, 0, 0, 0) 31%, rgba(0, 0, 0, 0.15) 79%)'
                        : 'linear-gradient(180deg, rgba(0, 0, 0, 0) 31%, rgba(0, 0, 0, 0.08) 79%)')
                    : (quickEditPrompt.trim()
                        ? 'linear-gradient(180deg, rgba(255, 255, 255, 0) 31%, rgba(255, 255, 255, 0.3) 79%)'
                        : 'linear-gradient(180deg, rgba(255, 255, 255, 0) 31%, rgba(255, 255, 255, 0.1) 79%)'),
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  pointerEvents: 'none',
                  transition: 'background 0.3s ease-in-out',
                }}
              />
              {/* 左侧：椭圆容器 - credit 图标和数字 */}
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 8,
                  width: 29,
                  height: 20,
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 4px',
                }}
              >
                {/* credit 图标 */}
                <img
                  src={iconCredits}
                  alt="credits"
                  width={14}
                  height={14}
                  style={{
                    flexShrink: 0,
                    opacity: quickEditPrompt.trim() ? 1 : 0.5,
                    transition: 'opacity 0.3s ease-in-out',
                    filter: getIconFilter(),
                  }}
                />
                {/* 数字 */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isLight
                      ? (quickEditPrompt.trim() ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.3)')
                      : (quickEditPrompt.trim() ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.25)'),
                    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                    lineHeight: '1.4285714285714286em',
                    flexShrink: 0,
                    transition: 'color 0.3s ease-in-out, opacity 0.2s ease-in-out',
                    display: 'inline-block',
                  }}
                >
                  4
                </span>
              </div>
              {/* 右侧：圆形容器 - 向上箭头 */}
              <div
                style={{
                  position: 'absolute',
                  left: 53,
                  top: 4,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: isLight
                    ? (quickEditPrompt.trim() ? '#1A1A1A' : 'rgba(0, 0, 0, 0.4)')
                    : (quickEditPrompt.trim() ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: quickEditPrompt.trim()
                    ? (isLight
                        ? '0px 0px 8px 0px rgba(0, 0, 0, 0.3)'
                        : '0px 0px 8px 0px rgba(255, 255, 255, 0.8)')
                    : (isLight
                        ? '0px 0px 6px 0px rgba(0, 0, 0, 0.15)'
                        : '0px 0px 6.25px 0px rgba(255, 255, 255, 0.3)'),
                  transition: 'all 0.3s ease-in-out',
                }}
              >
                {/* 向上箭头 */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  style={{
                    opacity: quickEditPrompt.trim() ? 1 : 0.5,
                    transition: 'opacity 0.3s ease-in-out',
                  }}
                >
                  <path
                    d="M7 12V2M7 2L2 7M7 2L12 7"
                    stroke={isLight ? '#FFFFFF' : '#000000'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </>
    )}
    </>
  );
};

export default ImageToolbar;
