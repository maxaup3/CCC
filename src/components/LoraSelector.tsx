import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Model } from '../types';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../styles/constants';
import iconModel from '../assets/icons/model.svg?url';

interface LoraSelectorProps {
  models: Model[];
  selectedLora?: string;
  onSelect: (loraId: string) => void;
  onClose: () => void;
}

// 标签列表 - 移到组件外避免每次渲染重新创建
const TAGS = ['Try Now', 'All', 'Anime', 'Portrait', 'Realistic', 'Illustration', 'Sci-Fi', 'Visual Design', 'Space Design', 'Game Design', '3D'] as const;

const LoraSelector: React.FC<LoraSelectorProps> = ({
  models,
  selectedLora,
  onSelect,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'lora' | 'starred' | 'my'>('lora');
  const [selectedTag, setSelectedTag] = useState<string>('Try Now');
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 过滤模型 - 使用 useMemo 避免每次渲染重新计算
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      // Tab过滤
      if (activeTab === 'my' && !model.isUser) return false;
      if (activeTab === 'starred' && !model.isFavorite) return false;

      // 标签过滤
      if (selectedTag !== 'All' && selectedTag !== 'Try Now') {
        if (!model.tags || !model.tags.includes(selectedTag)) return false;
      }

      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          model.name.toLowerCase().includes(query) ||
          model.description?.toLowerCase().includes(query) ||
          model.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [models, activeTab, selectedTag, searchQuery]);

  // 回调函数 memoization
  const handleSelectAndClose = useCallback((modelId: string) => {
    onSelect(modelId);
    onClose();
  }, [onSelect, onClose]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <>
      {/* 背景遮罩 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)', // 根据设计稿 fill_CM25E3
          zIndex: 10000,
        }}
        onClick={onClose}
      />
      {/* 对话框 */}
      <div
        ref={containerRef}
        data-lora-selector
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 1290,
          maxHeight: 736,
          background: Colors.background.secondary, // #2A2A2A
          border: `1px solid ${Colors.border.default}`,
          borderRadius: BorderRadius.xlarge, // 12px
          boxShadow: Shadows.large,
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: Spacing.md, // 12px
            padding: Spacing.md, // 12px
            borderBottom: `1px solid rgba(255, 255, 255, 0.2)`, // stroke_TB46GH
            background: Colors.background.secondary,
            position: 'relative',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24, // 精确匹配设计稿 layout_FHSLUO
              padding: `0 ${Spacing.sm}px 0 0`, // 0 8px 0 0
              flex: 1,
              height: 36,
            }}
          >
            {[
              { id: 'lora', label: 'LoRA', icon: iconModel },
              { id: 'starred', label: 'My Starred', icon: null },
              { id: 'my', label: '+ My Models', icon: null },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'lora' | 'starred' | 'my')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: `${Spacing.xs}px 0`, // 4px 0
                    cursor: 'pointer',
                    borderBottom: isActive ? `2px solid ${Colors.theme.primary}` : '2px solid transparent',
                    transition: 'border-color 0.2s',
                    height: 32,
                  }}
                >
                  {tab.icon && (
                    <img src={tab.icon} alt="" width={16} height={16} style={{ flexShrink: 0 }} />
                  )}
                  {tab.id === 'starred' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={isActive ? Colors.theme.primary : Colors.text.secondary} strokeWidth="1.5" fill="none" />
                    </svg>
                  )}
                  {tab.id === 'my' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5V19M5 12H19" stroke={isActive ? Colors.theme.primary : Colors.text.secondary} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                  <span
                    style={{
                      fontSize: Typography.englishHeading.fontSize.medium, // 16px
                      fontWeight: Typography.englishHeading.fontWeight, // 600
                      color: isActive ? Colors.theme.primary : Colors.text.secondary, // 选中时蓝色，未选中时次要文字
                      fontFamily: Typography.englishHeading.fontFamily,
                    }}
                  >
                    {tab.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: Spacing.xs, // 8px
              padding: '2px',
              background: Colors.background.secondary,
              border: `1px solid ${Colors.border.default}`,
              borderRadius: 9,
              height: 36,
              width: 345,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: `0 0 0 ${Spacing.xs}px`,
                flex: 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke={Colors.text.secondary} strokeWidth="1.5" />
                <path d="M11 11L14 14" stroke={Colors.text.secondary} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="搜索 LoRA..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: Colors.text.primary,
                  fontSize: Typography.englishBody.fontSize.small, // 12px
                  fontFamily: Typography.englishBody.fontFamily,
                  padding: 0,
                }}
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M4 4L10 10M10 4L4 10" stroke={Colors.text.secondary} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = Colors.background.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke={Colors.text.primary} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tags */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: Spacing.xs, // 4px - 减小间距
            padding: Spacing.md, // 12px
            borderBottom: `1px solid rgba(255, 255, 255, 0.2)`,
            overflowX: 'auto',
            position: 'relative',
          }}
        >
          {TAGS.map((tag) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `${Spacing.sm}px ${Spacing.md}px`, // 8px 12px
                  height: 36,
                  background: isSelected ? 'rgba(0, 0, 0, 0.85)' : Colors.background.tertiary, // 选中时深色背景
                  border: isSelected ? 'none' : `1px solid ${Colors.border.default}`,
                  borderRadius: 9,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? Shadows.small : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = Colors.background.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = Colors.background.tertiary;
                  }
                }}
              >
                <span
                  style={{
                    fontSize: Typography.englishBody.fontSize.medium, // 14px
                    fontWeight: Typography.englishHeading.fontWeight, // 600
                    color: isSelected ? '#FFFFFF' : Colors.text.secondary, // 选中时纯白色
                    fontFamily: Typography.englishHeading.fontFamily,
                  }}
                >
                  {tag}
                </span>
              </button>
            );
          })}
        </div>

        {/* Models Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${Spacing.md}px ${Spacing.md}px 240px`, // 12px 12px 240px
            display: 'flex',
            flexWrap: 'wrap',
            gap: Spacing.sm, // 8px
            alignContent: 'flex-start',
          }}
        >
          {filteredModels.length === 0 ? (
            <div
              style={{
                width: '100%',
                padding: '40px 20px',
                textAlign: 'center',
                color: Colors.text.secondary,
                fontSize: Typography.englishBody.fontSize.medium,
                fontFamily: Typography.englishBody.fontFamily,
              }}
            >
              No models found
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = model.id === selectedLora;
              return (
                <div
                  key={model.id}
                  onClick={() => handleSelectAndClose(model.id)}
                  style={{
                    width: 242,
                    height: 328,
                    background: isSelected ? Colors.theme.primaryDark : '#3B3B3B', // fill_5YBT06
                    border: `1px solid ${isSelected ? Colors.theme.primary : Colors.border.default}`,
                    borderRadius: BorderRadius.xlarge, // 12px
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = Colors.background.hover;
                      e.currentTarget.style.borderColor = Colors.border.hover;
                      e.currentTarget.style.boxShadow = Shadows.medium;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#3B3B3B';
                      e.currentTarget.style.borderColor = Colors.border.default;
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {/* Model Image */}
                  <div
                    style={{
                      width: '100%',
                      height: 248,
                      background: Colors.background.primary,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {model.imageUrl ? (
                      <img
                        src={model.imageUrl}
                        alt={model.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: Colors.background.primary,
                        }}
                      >
                        <img src={iconModel} alt="Model" width={32} height={32} />
                      </div>
                    )}
                    {/* Type and User badges */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        display: 'flex',
                        gap: Spacing.xs,
                      }}
                    >
                      {model.tags && model.tags.length > 0 && (
                        <div
                          style={{
                            padding: '0px 4px',
                            background: 'rgba(0, 0, 0, 0.65)', // Light/Secondary
                            borderRadius: BorderRadius.small,
                            fontSize: Typography.englishBody.fontSize.small, // 12px
                            color: Colors.text.primary,
                            fontFamily: Typography.englishBody.fontFamily,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {model.tags[0]}
                        </div>
                      )}
                    </div>
                    {/* Bottom badges */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        display: 'flex',
                        gap: Spacing.xs,
                      }}
                    >
                      {model.tags && model.tags.length > 1 && (
                        <div
                          style={{
                            padding: '3px 8px',
                            background: 'rgba(0, 0, 0, 0.65)',
                            borderRadius: BorderRadius.small,
                            fontSize: Typography.englishBody.fontSize.small,
                            color: Colors.text.primary,
                            fontFamily: Typography.englishBody.fontFamily,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                          </svg>
                          <span>12K</span>
                        </div>
                      )}
                      {model.isUser && (
                        <div
                          style={{
                            padding: '3px 8px',
                            background: 'rgba(0, 0, 0, 0.65)',
                            borderRadius: BorderRadius.small,
                            fontSize: Typography.englishBody.fontSize.small,
                            color: Colors.text.primary,
                            fontFamily: Typography.englishBody.fontFamily,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              background: '#D9D9D9',
                            }}
                          />
                          <span>Hello</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Model Info */}
                  <div
                    style={{
                      flex: 1,
                      padding: Spacing.sm, // 8px
                      display: 'flex',
                      flexDirection: 'column',
                      gap: Spacing.sm, // 8px
                    }}
                  >
                    <div
                      style={{
                        fontSize: Typography.englishHeading.fontSize.medium, // 16px
                        fontWeight: Typography.englishHeading.fontWeight, // 600
                        color: Colors.text.primary,
                        fontFamily: Typography.englishHeading.fontFamily,
                      }}
                    >
                      {model.name}
                    </div>
                    {/* Version and Select button */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'stretch',
                        gap: Spacing.sm,
                      }}
                    >
                      <button
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          background: Colors.background.tertiary,
                          border: 'none',
                          borderRadius: 7,
                          color: Colors.text.secondary,
                          fontSize: Typography.englishBody.fontSize.small, // 12px
                          fontFamily: Typography.englishBody.fontFamily,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        v3.2
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          background: 'transparent',
                          border: `1px solid ${Colors.theme.primary}`,
                          borderRadius: 8,
                          color: Colors.theme.primary,
                          fontSize: Typography.englishBody.fontSize.medium, // 14px
                          fontFamily: Typography.englishBody.fontFamily,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(model.id);
                          onClose();
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = Colors.theme.primaryDark;
                          e.currentTarget.style.color = Colors.text.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = Colors.theme.primary;
                        }}
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default React.memo(LoraSelector);

