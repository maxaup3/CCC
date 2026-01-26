import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Colors, Typography, BorderRadius, Shadows } from '../styles/constants';
import iconArrowDown from '../assets/icons/arrow_down.svg?url';
import iconEnhanceClose from '../assets/icons/enhance_close.svg?url';

interface LibraryImage {
  id: string;
  url: string;
  thumbnail?: string;
}

interface LibraryDialogProps {
  images?: LibraryImage[];
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

const LibraryDialog: React.FC<LibraryDialogProps> = ({
  images = [],
  onSelect,
  onClose,
}) => {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'Image' | 'Video' | 'All'>('Image');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLDivElement>(null);

  // 模拟图片数据（如果没有传入）- 使用 useMemo 避免每次渲染重新创建
  const mockImages = useMemo<LibraryImage[]>(() => {
    return images.length > 0 ? images : Array.from({ length: 12 }, (_, i) => ({
      id: `img-${i + 1}`,
      url: `https://picsum.photos/seed/${i + 1}/200/200`,
    }));
  }, [images]);

  // 过滤图片 - 使用 useMemo 避免每次渲染重新计算
  const filteredImages = useMemo(() => {
    return mockImages.filter((img) => {
      if (searchQuery) {
        return img.id.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [mockImages, searchQuery]);

  // 回调函数 memoization
  const handleImageClick = useCallback((imageId: string) => {
    setSelectedImageId(imageId);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const toggleFilterDropdown = useCallback(() => {
    setShowFilterDropdown(prev => !prev);
  }, []);

  const handleFilterSelect = useCallback((type: 'Image' | 'Video' | 'All') => {
    setFilterType(type);
    setShowFilterDropdown(false);
  }, []);

  // 点击外部关闭筛选下拉框
  useEffect(() => {
    if (!showFilterDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(target)
      ) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (selectedImageId) {
      const selectedImage = filteredImages.find(img => img.id === selectedImageId);
      if (selectedImage) {
        onSelect(selectedImage.url);
        onClose();
      }
    }
  }, [selectedImageId, filteredImages, onSelect, onClose]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: 1152,
          height: 640,
          background: Colors.background.secondary,
          border: `1px solid ${Colors.border.default}`,
          borderRadius: BorderRadius.xlarge,
          boxShadow: Shadows.large,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24,
          padding: '16px 24px 24px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            alignSelf: 'stretch',
            gap: 189,
            padding: '4px 0px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: Typography.englishHeading.fontSize.large + 4, // 24px
                fontWeight: Typography.englishHeading.fontWeight,
                color: Colors.text.primary,
                fontFamily: Typography.englishHeading.fontFamily,
                lineHeight: '1.3333333333333333em',
              }}
            >
              Select from library
            </span>
            {/* 关闭 X 图标 */}
            <button
              onClick={onClose}
              style={{
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                borderRadius: BorderRadius.small,
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = Colors.background.tertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <img src={iconEnhanceClose} alt="Close" width={16} height={16} />
            </button>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: BorderRadius.medium,
              cursor: 'pointer',
              padding: 8,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = Colors.background.tertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <img src={iconEnhanceClose} alt="Close" width={16} height={16} />
          </button>
        </div>

        {/* 搜索和筛选栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            alignSelf: 'stretch',
            gap: 236,
          }}
        >
          {/* 筛选下拉框 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 32,
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                ref={filterButtonRef}
                onClick={toggleFilterDropdown}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 6px 8px 8px',
                  background: '#3B3B3B',
                  borderRadius: BorderRadius.medium,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = Colors.background.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#3B3B3B';
                }}
              >
                <span
                  style={{
                    fontSize: Typography.englishHeading.fontSize.small,
                    fontWeight: Typography.englishHeading.fontWeight,
                    color: Colors.text.secondary,
                    fontFamily: Typography.englishHeading.fontFamily,
                  }}
                >
                  {filterType}
                </span>
                <img src={iconArrowDown} alt="Arrow Down" width={12} height={12} />
              </div>
              {showFilterDropdown && (
                <div
                  ref={filterDropdownRef}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: Colors.background.secondary,
                    border: `1px solid ${Colors.border.default}`,
                    borderRadius: BorderRadius.medium,
                    boxShadow: Shadows.medium,
                    zIndex: 10001,
                    minWidth: 120,
                    overflow: 'hidden',
                  }}
                >
                  {(['Image', 'Video', 'All'] as const).map((type) => (
                    <div
                      key={type}
                      onClick={() => handleFilterSelect(type)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: filterType === type ? Colors.background.tertiary : 'transparent',
                        color: Colors.text.primary,
                        fontSize: Typography.englishBody.fontSize.medium,
                        fontFamily: Typography.englishBody.fontFamily,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (filterType !== type) {
                          e.currentTarget.style.background = Colors.background.hover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (filterType !== type) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {type}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 搜索框 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: 240,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'stretch',
                  alignItems: 'stretch',
                  gap: 6,
                  padding: 8,
                  background: '#3B3B3B',
                  borderRadius: BorderRadius.medium,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 6,
                    flex: 1,
                  }}
                >
                  <input
                    type="text"
                    placeholder="搜索库文件..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: Colors.text.primary,
                      fontSize: Typography.englishBody.fontSize.medium,
                      fontFamily: Typography.englishBody.fontFamily,
                      lineHeight: '1.4285714285714286em',
                    }}
                  />
                  {/* 搜索图标 */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path
                      d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
                      stroke={Colors.text.secondary}
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 14L11.1 11.1"
                      stroke={Colors.text.secondary}
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 图片网格 - 瀑布流布局 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* 第一行 - 不同大小的图片 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              alignSelf: 'stretch',
              gap: 12,
            }}
          >
            {filteredImages.slice(0, 6).map((image, index) => {
              const isSelected = selectedImageId === image.id;
              // 根据索引设置不同的宽度和高度，模拟瀑布流
              const widths = [211, 140, 212, 142, 176, 176];
              const heights = [191, 191, 193, 193, 191, 191];
              const width = widths[index] || 176;
              const height = heights[index] || 191;
              
              return (
                <div
                  key={image.id}
                  onClick={() => handleImageClick(image.id)}
                  style={{
                    position: 'relative',
                    width: width,
                    height: height,
                    borderRadius: BorderRadius.medium,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: isSelected
                      ? `2px solid ${Colors.theme.primary}`
                      : `1px solid ${Colors.border.default}`,
                    background: Colors.background.tertiary,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = Colors.border.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = Colors.border.default;
                    }
                  }}
                >
                  <img
                    src={image.thumbnail || image.url}
                    alt={`Library image ${image.id}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  {/* 选中标记 */}
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 24,
                        height: 24,
                        background: Colors.theme.primary,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: Shadows.small,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="#181818"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 第二行 - 不同大小的图片 */}
          {filteredImages.length > 6 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                alignSelf: 'stretch',
                gap: 12,
              }}
            >
              {filteredImages.slice(6, 12).map((image, index) => {
                const isSelected = selectedImageId === image.id;
                // 根据索引设置不同的宽度和高度
                const widths = [123, 252, 130, 149, 227, 177];
                const heights = [222, 222, 222, 222, 222, 222];
                const width = widths[index] || 177;
                const height = heights[index] || 222;
                
                return (
                  <div
                    key={image.id}
                    onClick={() => handleImageClick(image.id)}
                    style={{
                      position: 'relative',
                      width: width,
                      height: height,
                      borderRadius: BorderRadius.medium,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: isSelected
                        ? `2px solid ${Colors.theme.primary}`
                        : `1px solid ${Colors.border.default}`,
                      background: Colors.background.tertiary,
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = Colors.border.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = Colors.border.default;
                      }
                    }}
                  >
                    <img
                      src={image.thumbnail || image.url}
                      alt={`Library image ${image.id}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {/* 选中标记 */}
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 24,
                          height: 24,
                          background: Colors.theme.primary,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: Shadows.small,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="#181818"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            alignSelf: 'stretch',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: 120,
              height: 40,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'transparent',
              border: `1px solid ${Colors.border.default}`,
              borderRadius: BorderRadius.large,
              cursor: 'pointer',
              color: Colors.text.primary,
              fontSize: Typography.englishHeading.fontSize.medium,
              fontWeight: Typography.englishHeading.fontWeight,
              fontFamily: Typography.englishHeading.fontFamily,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = Colors.background.hover;
              e.currentTarget.style.borderColor = Colors.border.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = Colors.border.default;
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedImageId}
            style={{
              width: 120,
              height: 40,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: selectedImageId ? Colors.theme.primary : Colors.background.tertiary,
              border: 'none',
              borderRadius: BorderRadius.large,
              cursor: selectedImageId ? 'pointer' : 'not-allowed',
              color: selectedImageId ? '#181818' : Colors.text.primary,
              fontSize: Typography.englishHeading.fontSize.medium,
              fontWeight: Typography.englishHeading.fontWeight,
              fontFamily: Typography.englishHeading.fontFamily,
              transition: 'all 0.2s',
              opacity: selectedImageId ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (selectedImageId) {
                e.currentTarget.style.background = 'rgba(56, 189, 255, 0.9)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedImageId) {
                e.currentTarget.style.background = Colors.theme.primary;
              }
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default React.memo(LibraryDialog);