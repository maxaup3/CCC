import React, { useState, Fragment, useCallback } from 'react';
import { ImageLayer } from '../types';
import { Colors, Typography, BorderRadius, Spacing } from '../styles/constants';
import layersIcon from '../assets/icons/layers.svg?url';
import layerIcon from '../assets/icons/layers-icon.svg?url';
import libraryIcon from '../assets/icons/library-icon.svg?url';
import lockIcon from '../assets/icons/lock.svg?url';
import unlockIcon from '../assets/icons/unlock.svg?url';
import hideIcon from '../assets/icons/hide.svg?url';
import eyesIcon from '../assets/icons/eyes.svg?url';
import LibraryDialog from './LibraryDialog';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface LayerPanelProps {
  layers: ImageLayer[];
  selectedLayerIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onLayerSelect: (layerId: string | null, isMultiSelect?: boolean) => void;
  onLayerUpdate: (layerId: string, updates: Partial<ImageLayer>) => void;
  onLayerDelete: (layerId: string) => void;
  onLayerAdd: (layer: Omit<ImageLayer, 'id'>) => string;
  onLayerReorder?: (fromIndex: number, toIndex: number) => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  selectedLayerIds,
  isOpen,
  onClose,
  onOpen,
  onLayerSelect,
  onLayerUpdate,
  onLayerDelete: _onLayerDelete,
  onLayerAdd,
  onLayerReorder,
}) => {
  const { isLight, theme, iconFilter } = useThemedStyles();

  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);

  const handleDoubleClick = useCallback((layer: ImageLayer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  }, []);

  const handleNameSubmit = useCallback((layerId: string) => {
    if (editingName.trim()) {
      onLayerUpdate(layerId, { name: editingName.trim() });
    }
    setEditingLayerId(null);
    setEditingName('');
  }, [editingName, onLayerUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, layerId: string) => {
    if (e.key === 'Enter') {
      handleNameSubmit(layerId);
    } else if (e.key === 'Escape') {
      setEditingLayerId(null);
      setEditingName('');
    }
  }, [handleNameSubmit]);

  // 按钮样式
  const buttonStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isLight ? '#F5F5F5' : '#2A2A2A',
    border: 'none',
    boxShadow: isLight ? '0 2px 8px rgba(0, 0, 0, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease',
  };

  const iconStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    filter: iconFilter,
    opacity: 0.85,
  };

  if (!isOpen) {
    return (
      <Fragment>
        {/* 资料库入口按钮 - 在图层图标上方 */}
        <div
          style={{
            position: 'absolute',
            bottom: 68,
            left: 20,
            zIndex: 1000,
            ...buttonStyle,
          }}
          onClick={() => setShowLibraryDialog(true)}
          title="从资料库导入图片"
        >
          <img src={libraryIcon} alt="Library" style={iconStyle} />
        </div>
        {/* 图层图标 */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            ...buttonStyle,
          }}
          onClick={onOpen}
        >
          <img src={layerIcon} alt="Layers" style={iconStyle} />
        </div>
        {/* 资料库对话框 */}
        {showLibraryDialog && (
          <LibraryDialog
            onSelect={(imageUrl) => {
              const img = new window.Image();
              img.onload = () => {
                const viewWidth = window.innerWidth;
                const viewHeight = window.innerHeight - 60;
                const centerX = viewWidth / 2;
                const centerY = viewHeight / 2;
                const imageWidth = img.width;
                const imageHeight = img.height;
                const layerId = onLayerAdd({
                  name: `Library Image ${new Date().toLocaleTimeString()}`,
                  url: imageUrl,
                  x: centerX - imageWidth / 2,
                  y: centerY - imageHeight / 2,
                  width: imageWidth,
                  height: imageHeight,
                  visible: true,
                  locked: false,
                  selected: false,
                });
                onLayerSelect(layerId);
                setShowLibraryDialog(false);
              };
              img.onerror = () => {
                const viewWidth = window.innerWidth;
                const viewHeight = window.innerHeight - 60;
                const centerX = viewWidth / 2;
                const centerY = viewHeight / 2;
                const defaultWidth = 400;
                const defaultHeight = 300;
                const layerId = onLayerAdd({
                  name: `Library Image ${new Date().toLocaleTimeString()}`,
                  url: imageUrl,
                  x: centerX - defaultWidth / 2,
                  y: centerY - defaultHeight / 2,
                  width: defaultWidth,
                  height: defaultHeight,
                  visible: true,
                  locked: false,
                  selected: false,
                });
                onLayerSelect(layerId);
                setShowLibraryDialog(false);
              };
              img.src = imageUrl;
            }}
            onClose={() => setShowLibraryDialog(false)}
          />
        )}
      </Fragment>
    );
  }

  return (
    <Fragment>
      {/* 资料库入口按钮 - 位置不动，置于后层 */}
      <div
        style={{
          position: 'absolute',
          bottom: 68,
          left: 20,
          zIndex: 999,
          ...buttonStyle,
        }}
        onClick={() => setShowLibraryDialog(true)}
        title="从资料库导入图片"
      >
        <img src={libraryIcon} alt="Library" style={iconStyle} />
      </div>
      
      <div
        style={{
          position: 'absolute',
          top: 60,
          bottom: 20,
          left: 20,
          width: 244,
          background: isLight ? '#F5F5F5' : '#2A2A2A',
          backdropFilter: theme.panelBackdrop,
          border: theme.panelBorder,
          borderRadius: 10,
          boxShadow: theme.panelShadow,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
      >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 8px',
          height: 44,
          flexShrink: 0,
          borderBottom: `1px solid ${Colors.border.default}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* 图层图标 */}
          <img
            src={layersIcon}
            alt="Layers"
            width={16}
            height={16}
            style={{ flexShrink: 0 }}
          />
          <span style={{
            fontSize: 14,
            fontWeight: Typography.englishHeading.fontWeight,
            color: Colors.text.primary,
            fontFamily: Typography.englishHeading.fontFamily
          }}>
            Layers
          </span>
        </div>
        {/* 折叠图标 - 在右侧 */}
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
          <path d="M4 4L12 12M12 4L4 12" stroke={Colors.text.primary} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* 图层列表 - 竖直滚动 */}
      <div
        style={{
          flex: 1,
          overflowX: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: Spacing.sm,
          padding: `${Spacing.sm}px ${Spacing.sm}px`,
        }}
      >
        {layers.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: Spacing.md,
            padding: Spacing.md,
            height: '100%',
            paddingTop: Spacing.lg,
          }}>
            <div style={{
              color: Colors.text.secondary,
              fontSize: Typography.englishBody.fontSize.small,
              whiteSpace: 'nowrap',
              fontFamily: Typography.englishBody.fontFamily,
            }}>
              No layers yet
            </div>
          </div>
        ) : (
          layers.map((layer, index) => {
            const isSelected = selectedLayerIds.includes(layer.id);
            const isDragging = draggedLayerId === layer.id;
            const isDragOver = dragOverLayerId === layer.id;

            return (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => {
                  setDraggedLayerId(layer.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggedLayerId(null);
                  setDragOverLayerId(null);
                  setDragOverPosition(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedLayerId && draggedLayerId !== layer.id) {
                    setDragOverLayerId(layer.id);
                    // 检测鼠标在目标元素的上半部分还是下半部分
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseY = e.clientY;
                    const elementMiddle = rect.top + rect.height / 2;
                    setDragOverPosition(mouseY < elementMiddle ? 'top' : 'bottom');
                  }
                }}
                onDragLeave={() => {
                  setDragOverLayerId(null);
                  setDragOverPosition(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedLayerId && draggedLayerId !== layer.id && onLayerReorder) {
                    const fromIndex = layers.findIndex(l => l.id === draggedLayerId);
                    let toIndex = index;
                    // 如果在下半部分，插入到下一个位置
                    if (dragOverPosition === 'bottom') {
                      toIndex = index + 1;
                    }
                    if (fromIndex !== -1 && fromIndex !== toIndex) {
                      onLayerReorder(fromIndex, toIndex);
                    }
                  }
                  setDraggedLayerId(null);
                  setDragOverLayerId(null);
                  setDragOverPosition(null);
                }}
                onClick={(e) => {
                  const isMultiSelect = e.ctrlKey || e.metaKey;
                  onLayerSelect(layer.id, isMultiSelect);
                }}
                onMouseEnter={(e) => {
                  setHoveredLayerId(layer.id);
                  if (!isSelected && !isDragging) {
                    e.currentTarget.style.background = Colors.background.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredLayerId(null);
                  if (!isSelected && !isDragging) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 48,
                  padding: Spacing.xs,
                  background: (isSelected || hoveredLayerId === layer.id) ? Colors.background.tertiary : 'transparent',
                  borderRadius: BorderRadius.small,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: Spacing.lg,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  opacity: isDragging ? 0.5 : 1,
                  borderTop: isDragOver && dragOverPosition === 'top' ? '2px solid #00D4FF' : 'none',
                  borderBottom: isDragOver && dragOverPosition === 'bottom' ? '2px solid #00D4FF' : 'none',
                }}
              >
                {/* 左侧：缩略图 + 名称 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: Spacing.xs,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {/* 图层缩略图 - 40x40px */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      background: Colors.background.primary,
                      borderRadius: BorderRadius.small,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {layer.url ? (
                      layer.type === 'video' ? (
                        // 视频图层：优先显示首帧图片，否则显示视频第一帧
                        layer.generationConfig?.videoStartFrame ? (
                          <img
                            src={layer.generationConfig.videoStartFrame}
                            alt={layer.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <video
                            src={layer.url}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            muted
                            playsInline
                          />
                        )
                      ) : (
                        // 图片图层
                        <img
                          src={layer.url}
                          alt={layer.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      )
                    ) : (
                      // 生成中的 loading 态
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)',
                          borderRadius: 4,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 3,
                          }}
                        >
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                background: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.5)',
                                animation: `layerLoadingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                              }}
                            />
                          ))}
                        </div>
                        <style>
                          {`
                            @keyframes layerLoadingDot {
                              0%, 80%, 100% {
                                opacity: 0.3;
                                transform: scale(0.8);
                              }
                              40% {
                                opacity: 1;
                                transform: scale(1);
                              }
                            }
                          `}
                        </style>
                      </div>
                    )}
                  </div>

                  {/* 图层名称 */}
                  {editingLayerId === layer.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleNameSubmit(layer.id)}
                      onKeyDown={(e) => handleKeyDown(e, layer.id)}
                      autoFocus
                      style={{
                        flex: 1,
                        background: Colors.background.primary,
                        border: `1px solid ${Colors.border.active}`,
                        borderRadius: BorderRadius.small,
                        padding: `${Spacing.xs}px ${Spacing.sm}px`,
                        fontSize: Typography.englishBody.fontSize.small, // 12px
                        fontWeight: Typography.englishHeading.fontWeight, // 600
                        color: Colors.text.primary,
                        outline: 'none',
                        fontFamily: Typography.englishHeading.fontFamily,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1,
                        fontSize: Typography.englishBody.fontSize.small, // 12px H(En)/12
                        fontWeight: Typography.englishHeading.fontWeight, // 600
                        color: !layer.visible ? Colors.text.secondary : Colors.text.primary, // 隐藏时使用次要颜色 rgba(255, 255, 255, 0.45)
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: Typography.englishHeading.fontFamily, // SF Pro Display
                        lineHeight: '1.3333333333333333em', // 精确匹配设计稿
                      }}
                      onDoubleClick={() => handleDoubleClick(layer)}
                    >
                      {layer.name}
                    </span>
                  )}
                </div>

                {/* 右侧：操作按钮 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6, // 根据设计稿，gap是6px
                    flexShrink: 0,
                  }}
                >
                    {/* 锁定/解锁按钮 - 始终保持位置 */}
                    {(layer.locked || hoveredLayerId === layer.id || isSelected) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLayerUpdate(layer.id, { locked: !layer.locked });
                        }}
                        style={{
                          width: 14,
                          height: 14,
                          background: 'transparent',
                          border: 'none',
                          borderRadius: BorderRadius.small,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s',
                          padding: 0,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = Colors.background.hover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        title={layer.locked ? 'Unlock' : 'Lock'}
                      >
                        <img
                          src={layer.locked ? lockIcon : unlockIcon}
                          alt={layer.locked ? 'Lock' : 'Unlock'}
                          width={14}
                          height={14}
                          style={{ width: '100%', height: '100%', filter: isLight ? 'brightness(0.3)' : 'brightness(0) invert(1)', opacity: 0.85 }}
                        />
                      </button>
                    )}

                    {/* 隐藏/显示按钮 - 始终保持位置 */}
                    {(!layer.visible || hoveredLayerId === layer.id || isSelected) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLayerUpdate(layer.id, { visible: !layer.visible });
                        }}
                        style={{
                          width: 14,
                          height: 14,
                          background: 'transparent',
                          border: 'none',
                          borderRadius: BorderRadius.small,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s',
                          padding: 0,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = Colors.background.hover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        title={layer.visible ? 'Hide' : 'Show'}
                      >
                        <img
                          src={!layer.visible ? hideIcon : eyesIcon}
                          alt={layer.visible ? 'Hide' : 'Show'}
                          width={14}
                          height={14}
                          style={{ width: '100%', height: '100%', filter: isLight ? 'brightness(0.3)' : 'brightness(0) invert(1)', opacity: 0.85 }}
                        />
                      </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
      {/* 资料库对话框 */}
      {showLibraryDialog && (
        <LibraryDialog
          onSelect={(imageUrl) => {
            const img = new window.Image();
            img.onload = () => {
              const viewWidth = window.innerWidth;
              const viewHeight = window.innerHeight - 60;
              const centerX = viewWidth / 2;
              const centerY = viewHeight / 2;
              const imageWidth = img.width;
              const imageHeight = img.height;
              const layerId = onLayerAdd({
                name: `Library Image ${new Date().toLocaleTimeString()}`,
                url: imageUrl,
                x: centerX - imageWidth / 2,
                y: centerY - imageHeight / 2,
                width: imageWidth,
                height: imageHeight,
                visible: true,
                locked: false,
                selected: false,
              });
              onLayerSelect(layerId);
              setShowLibraryDialog(false);
            };
            img.onerror = () => {
              const viewWidth = window.innerWidth;
              const viewHeight = window.innerHeight - 60;
              const centerX = viewWidth / 2;
              const centerY = viewHeight / 2;
              const defaultWidth = 400;
              const defaultHeight = 300;
              const layerId = onLayerAdd({
                name: `Library Image ${new Date().toLocaleTimeString()}`,
                url: imageUrl,
                x: centerX - defaultWidth / 2,
                y: centerY - defaultHeight / 2,
                width: defaultWidth,
                height: defaultHeight,
                visible: true,
                locked: false,
                selected: false,
              });
              onLayerSelect(layerId);
              setShowLibraryDialog(false);
            };
            img.src = imageUrl;
          }}
          onClose={() => setShowLibraryDialog(false)}
        />
      )}
    </Fragment>
  );
};

export default React.memo(LayerPanel);
