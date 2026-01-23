import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { ImageLayer, GenerationConfig, EditMode, Model } from '../types';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../styles/constants';
import ModeSelector from './ModeSelector';
import ModelDropdown from './ModelDropdown';
import CapabilitySelector from './CapabilitySelector';
import LoraSelector from './LoraSelector';
import LibraryDialog from './LibraryDialog';
import { useTheme, getThemeStyles } from '../contexts/ThemeContext';
// 导入图标
const iconModel = '/assets/icons/model.svg';
const iconMagic = '/assets/icons/magic.svg';
const iconInitialImg = '/assets/icons/initial_img.svg';
const iconEnhancePrompts = '/assets/icons/enhance_prompts.svg';
const iconNotify = '/assets/icons/notify.svg';
const iconCredits = '/assets/icons/credits.svg';
const iconArrowDown = '/assets/icons/arrow_down.svg';
const iconSwitch = '/assets/icons/switch.svg';
const iconPro = '/assets/icons/pro.svg';

// Tooltip 组件 - 基于 Figma 设计
interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  isLight?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children, position = 'top', isLight = false }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;

      if (position === 'bottom') {
        y = rect.bottom;
      } else if (position === 'left') {
        x = rect.left;
        y = rect.top + rect.height / 2;
      } else if (position === 'right') {
        x = rect.right;
        y = rect.top + rect.height / 2;
      }

      setCoords({ x, y });
    }
    setShow(true);
  };

  const bgColor = isLight ? '#FFFFFF' : '#181818';
  const textColor = isLight ? 'rgba(0, 0, 0, 0.85)' : '#FFFFFF';
  const shadowColor = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.4)';

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {show && createPortal(
        <div
          style={{
            position: 'fixed',
            left: position === 'left' ? coords.x - 8 : position === 'right' ? coords.x + 8 : coords.x,
            top: position === 'top' ? coords.y - 8 : position === 'bottom' ? coords.y + 8 : coords.y,
            transform: position === 'top'
              ? 'translate(-50%, -100%)'
              : position === 'bottom'
              ? 'translate(-50%, 0)'
              : position === 'left'
              ? 'translate(-100%, -50%)'
              : 'translate(0, -50%)',
            background: bgColor,
            color: textColor,
            padding: '4px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 400,
            fontFamily: '"PingFang SC", -apple-system, sans-serif',
            lineHeight: '16px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            boxShadow: `0 2px 8px ${shadowColor}`,
            pointerEvents: 'none',
            animation: 'tooltipFadeIn 0.15s ease',
          }}
        >
          {text}
          {/* 箭头 */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              ...(position === 'top' ? {
                bottom: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `6px solid ${bgColor}`,
              } : position === 'bottom' ? {
                top: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: `6px solid ${bgColor}`,
              } : position === 'left' ? {
                right: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderLeft: `6px solid ${bgColor}`,
              } : {
                left: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderRight: `6px solid ${bgColor}`,
              }),
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

// 轮播占位符 - 放在组件外部避免每次渲染重新创建
const PLACEHOLDER_EXAMPLES = [
  '一只可爱的猫咪在阳光下打盹，温暖的色调，超写实风格',
  '赛博朋克风格的未来城市夜景，霓虹灯光，雨后湿润的街道',
  '宁静的湖边小屋，日落时分，水面倒影，油画风格',
  '宇航员在太空中漫步，地球背景，4K高清，电影级画质',
  '魔法森林中的精灵，梦幻光效，蝴蝶飞舞，童话风格',
  '现代简约风格的室内设计，北欧风，阳光透过落地窗',
];

interface BottomDialogProps {
  isExpanded: boolean;
  onToggle: () => void;
  selectedLayer: ImageLayer | null;
  selectedLayerIds: string[]; // 所有选中的图层ID
  layers: ImageLayer[];
  editMode: EditMode;
  onGenerate: (config: GenerationConfig) => void;
  onLayerSelect?: (layerId: string | null, isMultiSelect?: boolean) => void;
  isLandingPage?: boolean; // 是否在首页，用于显示顶部tab
  modeSelectorStyle?: 'enhanced-button' | 'colored-text'; // 模式选择器样式
}

export interface BottomDialogRef {
  setReferenceImage: (imageUrl: string) => void;
  addReferenceImages: (imageUrls: string[]) => void;
  setConfig: (config: Partial<GenerationConfig>) => void;
  focusPrompt: () => void;
}

const BottomDialog = forwardRef<BottomDialogRef, BottomDialogProps>(({
  isExpanded,
  onToggle,
  selectedLayer,
  layers,
  editMode: _editMode,
  onGenerate,
  isLandingPage = false,
  modeSelectorStyle = 'colored-text',
}, ref) => {
  const { themeStyle } = useTheme();
  const theme = getThemeStyles(themeStyle);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 判断是否为浅色主题
  const isLightTheme = themeStyle === 'anthropic' || themeStyle === 'neumorphism' || themeStyle === 'genz' || themeStyle === 'minimalism' || themeStyle === 'flat';

  // 辅助函数：根据主题获取文字颜色
  const getTextColor = (opacity: number) => {
    if (isLightTheme) {
      // 浅色主题使用深色文字
      if (opacity >= 0.85) return theme.textPrimary;
      if (opacity >= 0.65) return theme.textSecondary;
      return theme.textTertiary;
    }
    // 深色主题使用白色文字
    return `rgba(255, 255, 255, ${opacity})`;
  };

  // 辅助函数：根据主题获取图标 filter (用于反转白色图标为深色)
  const getIconFilter = () => {
    if (isLightTheme) {
      // 浅色主题：反转颜色并降低亮度,使白色图标变为深色
      return 'invert(1) brightness(0.3)';
    }
    // 深色主题：反转为白色，85% 透明度
    return 'invert(1) brightness(1) opacity(0.85)';
  };

  // 辅助函数：获取当前模式的 Lora
  const getCurrentLora = () => {
    return config.mode === 'image' ? config.imageLora : config.videoLora;
  };

  // 辅助函数：获取当前模式的 Lora 权重
  const getCurrentLoraWeight = () => {
    return config.mode === 'image' ? config.imageLoraWeight : config.videoLoraWeight;
  };

  const [config, setConfig] = useState<GenerationConfig>({
    mode: 'image', // 默认图片模式
    model: 'qwen-image-edit', // 默认图像模型
    aspectRatio: '16:9',
    count: 1,
    prompt: '',
    enhancePrompt: true, // 默认开启提示词增强
    audioVideoSync: false, // 默认关闭音画同步
    loraWeight: 0.8,
    // 视频专属默认值
    videoCapability: 'image-to-video',
    videoDuration: 5,
    videoQuality: 'fast',
    videoSound: true,
    videoResolution: '720p',
  });
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showCapabilityDropdown, setShowCapabilityDropdown] = useState(false);
  const [showRatioDropdown, setShowRatioDropdown] = useState(false);
  const [showLoraDialog, setShowLoraDialog] = useState(false);
  const [hoveredLoraId, setHoveredLoraId] = useState<string | null>(null);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(null);
  const [hoveredVideoStartFrame, setHoveredVideoStartFrame] = useState(false);
  const [hoveredVideoEndFrame, setHoveredVideoEndFrame] = useState(false);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // 画布固定提示文案
  const CANVAS_PLACEHOLDER = '描述你想生成的内容...';

  // 打字机效果 + 轮播（仅首页启用）
  // 聚焦时：继续打完当前提示语，然后停止
  // 失焦时：恢复正常循环
  useEffect(() => {
    // 画布中不需要打字机效果
    if (!isLandingPage) {
      return;
    }

    const currentText = PLACEHOLDER_EXAMPLES[currentPlaceholder];
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      if (displayedPlaceholder.length < currentText.length) {
        // 继续打字（无论是否聚焦都继续打完）
        timeout = setTimeout(() => {
          setDisplayedPlaceholder(currentText.slice(0, displayedPlaceholder.length + 1));
        }, 150);
      } else {
        // 打完了
        if (isInputFocused) {
          // 聚焦状态：打完就停止，不进入删除阶段
          return;
        }
        // 非聚焦：等3秒后开始删除
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    } else {
      // 删除阶段
      if (isInputFocused) {
        // 聚焦状态：不删除
        return;
      }
      if (displayedPlaceholder.length > 0) {
        // 删除中
        timeout = setTimeout(() => {
          setDisplayedPlaceholder(displayedPlaceholder.slice(0, -1));
        }, 50);
      } else {
        // 删完了，切换下一个
        setCurrentPlaceholder((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedPlaceholder, currentPlaceholder, isTyping, isInputFocused, isLandingPage]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    setReferenceImage: (imageUrl: string) => {
      setConfig(prev => ({
        ...prev,
        referenceImage: imageUrl,
      }));
    },
    addReferenceImages: (imageUrls: string[]) => {
      setConfig(prev => {
        // 视频模式处理
        if (prev.mode === 'video') {
          // 文生视频模式：填入图片时自动切换到图生视频
          if (prev.videoCapability === 'text-to-video') {
            return {
              ...prev,
              videoCapability: 'image-to-video',
              videoStartFrame: imageUrls[0],
            };
          }
          // 首尾帧模式：需要填入两张图片
          if (prev.videoCapability === 'first-last-frame') {
            // 检查是否两张图片都已填入
            if (prev.videoStartFrame && prev.videoEndFrame) {
              setErrorMessage('首尾帧已填满，无法继续添加');
              setTimeout(() => setErrorMessage(null), 3000);
              return prev;
            }
            // 如果第一张有，第二张没有，填入第二张
            if (prev.videoStartFrame && !prev.videoEndFrame) {
              return {
                ...prev,
                videoEndFrame: imageUrls[0],
              };
            }
            // 如果第一张没有，填入第一张
            if (!prev.videoStartFrame) {
              return {
                ...prev,
                videoStartFrame: imageUrls[0],
              };
            }
          }
          // 图生视频模式：只需要填入一张首帧
          else if (prev.videoCapability === 'image-to-video') {
            // 如果已经有首帧，自动切换到首尾帧模式
            if (prev.videoStartFrame) {
              return {
                ...prev,
                videoCapability: 'first-last-frame',
                videoEndFrame: imageUrls[0],
              };
            }
            // 填入首帧
            return {
              ...prev,
              videoStartFrame: imageUrls[0],
            };
          }
        }

        // 图像模式：添加到 referenceImages 数组（最多10张）
        const existingImages = prev.referenceImages || [];

        // 检查是否已达到最大数量（10张）
        if (existingImages.length >= 10) {
          setErrorMessage('最多只能添加10张参考图片');
          setTimeout(() => setErrorMessage(null), 3000);
          return prev;
        }

        // 合并现有图片和新图片，限制最多10张
        const newImages = [...existingImages, ...imageUrls].slice(0, 10);
        return {
          ...prev,
          referenceImages: newImages,
        };
      });
    },
    setConfig: (newConfig: Partial<GenerationConfig>) => {
      setConfig(prev => ({
        ...prev,
        ...newConfig,
      }));
      if (newConfig.referenceImage !== undefined || newConfig.referenceImages !== undefined) {
        }
    },
    focusPrompt: () => {
      textareaRef.current?.focus();
    },
  }));

  // 不再自动设置参考图片，用户需要手动添加

  // Refs for dropdowns
  const ratioDropdownRef = useRef<HTMLDivElement>(null);
  const modeButtonRef = useRef<HTMLDivElement>(null); // 模式选择器
  const modelButtonRef = useRef<HTMLDivElement>(null);
  const capabilityButtonRef = useRef<HTMLDivElement>(null); // 视频能力选择器
  const loraButtonRef = useRef<HTMLDivElement>(null);
  const ratioButtonRef = useRef<HTMLDivElement>(null);
  const loraHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ratios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
  
  // 模型数据
  const modelData: Model[] = [
    // 图像模型
    {
      id: 'qwen-image-edit',
      name: 'Qwen-Image-Edit',
      mode: 'image',
      description: '精准指令编辑、文字渲染',
      tags: ['Image', 'Edit'],
      isUser: false,
      isFavorite: false,
    },
    {
      id: 'z-image',
      name: 'Z-image',
      mode: 'image',
      description: '写实摄影、人像',
      tags: ['Image'],
      isUser: false,
      isFavorite: false,
    },
    {
      id: 'illustrious',
      name: 'Illustrious',
      mode: 'image',
      description: '二次元/动漫插画',
      tags: ['Image', 'Anime'],
      isUser: false,
      isFavorite: false,
    },
    // 视频模型
    {
      id: 'wan2.2',
      name: 'Wan2.2',
      mode: 'video',
      description: '电影级质感、动作自然',
      tags: ['Video'],
      isUser: false,
      isFavorite: false,
    },
    {
      id: 'wan2.6',
      name: 'Wan2.6',
      mode: 'video',
      description: '音画同步',
      tags: ['Video'],
      isUser: false,
      isFavorite: false,
    },
    {
      id: 'ltx-2',
      name: 'LTX 2',
      mode: 'video',
      description: '音画同步、原生 4K',
      tags: ['Video', '4K'],
      isUser: false,
      isFavorite: false,
    },
  ];
  
  // 计算各个dropdown位置
  const [modeDropdownPosition, setModeDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [modelSelectorPosition, setModelSelectorPosition] = useState<{ top: number; left: number } | null>(null);
  const [capabilityDropdownPosition, setCapabilityDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  // 计算RatioDropdown位置
  const [ratioDropdownPosition, setRatioDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  
  const updateModelDropdownPosition = useCallback(() => {
    if (modelButtonRef.current) {
      const rect = modelButtonRef.current.getBoundingClientRect();
      setModelSelectorPosition({
        top: rect.top, // 使用按钮的 top 位置
        left: rect.left, // 与按钮左对齐
      });
    }
  }, []);
  
  useEffect(() => {
    if (showModelDropdown) {
      updateModelDropdownPosition();
      // 监听滚动和窗口大小变化，更新位置
      window.addEventListener('scroll', updateModelDropdownPosition, true);
      window.addEventListener('resize', updateModelDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateModelDropdownPosition, true);
        window.removeEventListener('resize', updateModelDropdownPosition);
      };
    }
    // 注意：不在这里设置 modelSelectorPosition 为 null，让它在点击外部关闭时处理
  }, [showModelDropdown, updateModelDropdownPosition]);

  // 更新RatioDropdown位置
  const updateRatioDropdownPosition = useCallback(() => {
    if (ratioButtonRef.current) {
      const rect = ratioButtonRef.current.getBoundingClientRect();
      setRatioDropdownPosition({
        top: rect.top, // 按钮的 top 位置
        left: rect.left, // 与按钮左对齐
      });
    }
  }, []);

  useEffect(() => {
    if (showRatioDropdown) {
      updateRatioDropdownPosition();
      // 监听滚动和窗口大小变化，更新位置
      window.addEventListener('scroll', updateRatioDropdownPosition, true);
      window.addEventListener('resize', updateRatioDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateRatioDropdownPosition, true);
        window.removeEventListener('resize', updateRatioDropdownPosition);
      };
    }
    // 注意：不在这里设置 ratioDropdownPosition 为 null，让它在点击外部关闭时处理
  }, [showRatioDropdown, updateRatioDropdownPosition]);

  // 点击外部关闭dropdown
  useEffect(() => {
    if (!showModeDropdown && !showModelDropdown && !showCapabilityDropdown && !showLoraDialog && !showRatioDropdown) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 关闭ModeSelector
      if (showModeDropdown) {
        const modeDropdown = document.querySelector('[data-mode-dropdown]');
        const clickedInButton = modeButtonRef.current?.contains(target);
        const clickedInDropdown = modeDropdown?.contains(target);

        if (!clickedInButton && !clickedInDropdown) {
          setShowModeDropdown(false);
          setModeDropdownPosition(null);
        }
      }

      // 关闭ModelDropdown - 检查是否点击在按钮或dropdown外部
      if (showModelDropdown) {
        const modelDropdown = document.querySelector('[data-model-dropdown]');
        const clickedInButton = modelButtonRef.current?.contains(target);
        const clickedInDropdown = modelDropdown?.contains(target);

        if (!clickedInButton && !clickedInDropdown) {
          setShowModelDropdown(false);
          setModelSelectorPosition(null);
        }
      }

      // 关闭CapabilitySelector
      if (showCapabilityDropdown) {
        const capabilityDropdown = document.querySelector('[data-capability-dropdown]');
        const clickedInButton = capabilityButtonRef.current?.contains(target);
        const clickedInDropdown = capabilityDropdown?.contains(target);

        if (!clickedInButton && !clickedInDropdown) {
          setShowCapabilityDropdown(false);
          setCapabilityDropdownPosition(null);
        }
      }

      // 关闭Lora对话框
      if (showLoraDialog && 
          loraButtonRef.current &&
          !loraButtonRef.current.contains(target) &&
          !(target as Element).closest('[data-lora-selector]')) {
        setShowLoraDialog(false);
      }

      // 关闭比例选择dropdown
      if (showRatioDropdown &&
          ratioDropdownRef.current &&
          ratioButtonRef.current &&
          !ratioDropdownRef.current.contains(target) &&
          !ratioButtonRef.current.contains(target)) {
        setShowRatioDropdown(false);
        setRatioDropdownPosition(null);
      }

    };

    // 延迟添加监听器，确保按钮点击事件先完成
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModeDropdown, showModelDropdown, showCapabilityDropdown, showLoraDialog, showRatioDropdown]);

  const handleGenerate = () => {
    if (!config.prompt.trim()) {
      return;
    }

    // 保存当前配置用于生成
    const currentConfig = { ...config };

    // 立即清空输入框、参考图片、Lora和视频帧
    setConfig(prev => ({
      ...prev,
      prompt: '',
      referenceImage: undefined,
      referenceImages: undefined,
      imageLora: undefined,
      imageLoraWeight: 0.8, // 重置为默认值
      videoLora: undefined,
      videoLoraWeight: 0.8,
      videoStartFrame: undefined,
      videoEndFrame: undefined,
    }));

    // 重置手动设置标志，允许下次选中图片时自动设置参考图片

    // 调用生成函数
    onGenerate(currentConfig);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    // Tab 键：把当前 placeholder 提示语填入输入框
    if (e.key === 'Tab' && !config.prompt && displayedPlaceholder) {
      e.preventDefault();
      const currentText = PLACEHOLDER_EXAMPLES[currentPlaceholder];
      setConfig(prev => ({ ...prev, prompt: currentText }));
    }
  };

  if (!isExpanded) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'auto',
          minWidth: 400,
          height: 48,
          background: Colors.background.secondary,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `1px solid ${Colors.border.default}`,
          borderRadius: BorderRadius.xlarge,
          boxShadow: Shadows.large,
          padding: '10px 15px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000,
          transition: 'all 0.3s ease-in-out',
        }}
        onClick={onToggle}
          onMouseEnter={(e) => {
          e.currentTarget.style.background = Colors.background.secondary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = Colors.background.secondary;
        }}
      >
        <span style={{ 
          fontSize: Typography.englishHeading.fontSize.large, 
          fontWeight: Typography.englishHeading.fontWeight, 
          color: Colors.text.secondary, 
          fontFamily: Typography.englishHeading.fontFamily, 
          whiteSpace: 'nowrap' 
        }}>
          {layers.length > 0 ? 'What do  you want to create?' : '今天想创作什么呢？'}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* 错误提示 - 顶部显示 */}
      {errorMessage && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24, 24, 28, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(209, 74, 74, 0.3)',
            borderRadius: 6,
            padding: '12px 16px',
            color: 'rgb(248, 113, 113)',
            fontSize: 14,
            fontWeight: 500,
            zIndex: 10000,
            boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
            animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="rgb(248, 113, 113)" strokeWidth="1.5" fill="none"/>
            <path d="M8 4v5M8 11v1" stroke="rgb(248, 113, 113)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {errorMessage}
        </div>
      )}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) scale(1);
          }
        }
      `}</style>
      <style>{`
        .bottom-dialog-textarea::placeholder {
          color: ${theme.textTertiary};
          transition: opacity 0.5s ease-in-out;
        }

        @keyframes placeholder-fade {
          0%, 100% { opacity: 1; }
          45%, 55% { opacity: 0.3; }
        }
        .lora-weight-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .lora-weight-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #38BDFF;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0px 0px 8px -2px rgba(0, 0, 0, 0.2), 0px 2px 4px 0px rgba(0, 0, 0, 0.2);
          margin-top: -6px; /* 垂直居中：thumb高度16px - track高度4px = 12px，向上偏移6px */
        }
        .lora-weight-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #38BDFF;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0px 0px 8px -2px rgba(0, 0, 0, 0.2), 0px 2px 4px 0px rgba(0, 0, 0, 0.2);
        }
        .lora-weight-slider::-webkit-slider-runnable-track {
          height: 4px;
          background: linear-gradient(to right, #38BDFF 0%, #38BDFF var(--slider-progress, 80%), rgba(255, 255, 255, 0.2) var(--slider-progress, 80%), rgba(255, 255, 255, 0.2) 100%);
          border-radius: 2px;
        }
        .lora-weight-slider::-moz-range-track {
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        /* 底部对话框光晕效果 - 星云流动 */
        .bottom-dialog-container {
          position: relative;
          isolation: isolate;
        }

        /* 星云容器 - 用于旋转 */
        .bottom-dialog-container::before,
        .bottom-dialog-container::after {
          content: '';
          position: absolute;
          bottom: -40px;
          left: 50%;
          pointer-events: none;
          z-index: -1;
        }

        /* 主光晕层 */
        .bottom-dialog-container::before {
          width: 900px;
          height: 120px;
          margin-left: -450px;
          background:
            radial-gradient(ellipse 400px 40px at 45% 50%, rgba(140, 160, 255, 0.8) 0%, transparent 60%),
            radial-gradient(ellipse 350px 35px at 55% 50%, rgba(120, 140, 245, 0.7) 0%, transparent 55%),
            radial-gradient(ellipse 500px 50px at 50% 50%, rgba(102, 126, 234, 0.5) 0%, transparent 70%);
          filter: blur(45px);
          animation: nebula-primary 6s linear infinite;
          transform-origin: center center;
          will-change: transform, opacity;
        }

        /* 流动的星云层 */
        .bottom-dialog-container::after {
          width: 1100px;
          height: 140px;
          margin-left: -550px;
          background:
            radial-gradient(ellipse 300px 30px at 35% 45%, rgba(118, 75, 162, 0.6) 0%, transparent 55%),
            radial-gradient(ellipse 280px 28px at 65% 55%, rgba(102, 126, 234, 0.5) 0%, transparent 50%),
            radial-gradient(ellipse 320px 32px at 50% 50%, rgba(130, 100, 200, 0.45) 0%, transparent 55%),
            radial-gradient(ellipse 250px 25px at 25% 50%, rgba(150, 120, 220, 0.4) 0%, transparent 50%),
            radial-gradient(ellipse 270px 27px at 75% 50%, rgba(100, 140, 255, 0.4) 0%, transparent 50%);
          filter: blur(40px);
          animation: nebula-secondary 8s linear infinite;
          transform-origin: center center;
          will-change: transform, opacity;
        }

        /* 主层动画 - 仅亮度变化 */
        @keyframes nebula-primary {
          0% {
            opacity: 0.2;
          }
          25% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.9;
          }
          75% {
            opacity: 0.5;
          }
          100% {
            opacity: 0.2;
          }
        }

        /* 次层动画 - 仅亮度变化，错开节奏 */
        @keyframes nebula-secondary {
          0% {
            opacity: 0.7;
          }
          25% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.15;
          }
          75% {
            opacity: 0.4;
          }
          100% {
            opacity: 0.7;
          }
        }
      `}</style>

      {/* Tab栏容器 - 在对话框外部顶部 */}
      <div
        className="bottom-dialog-container"
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 760,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
        }}
      >
        {/* 顶部独立 Tab - 仅首页显示 */}
        {isLandingPage && (
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexDirection: 'row',
              alignItems: 'center',
              background: isLightTheme ? '#F5F5F5' : '#3B3B3B',
              borderRadius: '12px 12px 0 0',
              alignSelf: 'flex-start',
            }}
          >
            {/* 滑动背景指示器 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: config.mode === 'image' ? 0 : '50%',
                width: '50%',
                height: '100%',
                background: isLightTheme ? '#FFFFFF' : '#181818',
                borderRadius: '12px 12px 0 0',
                transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 0,
              }}
            />

            {/* 图像生成 Tab */}
            <div
              data-tab="image"
              onClick={() => {
                setConfig(prev => ({ ...prev, mode: 'image', model: 'qwen-image-edit' }));
              }}
              style={{
                position: 'relative',
                zIndex: 1,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 24px',
                borderRadius: '12px 12px 0 0',
                cursor: 'pointer',
                gap: 6,
              }}
            >
              {/* 图像图标 - 与底部一致 */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M9 6C7.34316 6 6 7.34316 6 9C6 10.6568 7.34316 12 9 12C10.6568 12 12 10.6568 12 9C12 7.34316 10.6568 6 9 6ZM8 9C8 8.44772 8.44772 8 9 8C9.55228 8 10 8.44772 10 9C10 9.55228 9.55228 10 9 10C8.44772 10 8 9.55228 8 9Z" fill={config.mode === 'image' ? (isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF') : (isLightTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)')}/>
                <path d="M10.9268 2H13.0732C14.8966 1.99997 16.3664 1.99995 17.5223 2.15537C18.7225 2.31672 19.733 2.66191 20.5355 3.46447C21.3381 4.26702 21.6833 5.27752 21.8446 6.47767C22.0001 7.63363 22 9.1034 22 10.9269V13.0731C22 14.8966 22.0001 16.3664 21.8446 17.5223C21.6833 18.7225 21.3381 19.733 20.5355 20.5355C19.733 21.3381 18.7225 21.6833 17.5223 21.8446C16.3664 22.0001 14.8966 22 13.0731 22H10.9269C9.1034 22 7.63363 22.0001 6.47767 21.8446C5.27752 21.6833 4.26702 21.3381 3.46447 20.5355C2.66191 19.733 2.31672 18.7225 2.15537 17.5223C1.99995 16.3664 1.99997 14.8966 2 13.0732V10.9268C1.99997 9.10339 1.99995 7.63362 2.15537 6.47767C2.31672 5.27752 2.66191 4.26702 3.46447 3.46447C4.26702 2.66191 5.27752 2.31672 6.47767 2.15537C7.63362 1.99995 9.10339 1.99997 10.9268 2ZM6.74416 4.13753C5.7658 4.26907 5.2477 4.50966 4.87868 4.87868C4.50966 5.2477 4.26907 5.76579 4.13753 6.74416C4.00213 7.7513 4 9.08611 4 11V13C4 14.9139 4.00213 16.2487 4.13753 17.2558C4.26907 18.2342 4.50966 18.7523 4.87868 19.1213C5.16894 19.4116 5.55142 19.6224 6.17757 19.7632L6.52231 19.3035C8.29731 16.9362 9.35419 15.5266 10.7441 14.644C11.9921 13.8514 13.4162 13.3785 14.8905 13.2671C16.3164 13.1593 17.7788 13.5202 19.9984 14.1643C19.9999 13.8016 20 13.4144 20 13V11C20 9.08611 19.9979 7.7513 19.8625 6.74416C19.7309 5.7658 19.4903 5.2477 19.1213 4.87868C18.7523 4.50966 18.2342 4.26907 17.2558 4.13753C16.2487 4.00213 14.9139 4 13 4H11C9.08611 4 7.7513 4.00213 6.74416 4.13753ZM11 20H13C14.9139 20 16.2487 19.9979 17.2558 19.8625C18.2342 19.7309 18.7523 19.4903 19.1213 19.1213C19.4903 18.7523 19.7309 18.2342 19.8625 17.2558C19.9038 16.9485 19.9327 16.6106 19.9529 16.235C17.3641 15.479 16.1674 15.1762 15.0412 15.2614C13.8946 15.348 12.787 15.7159 11.8162 16.3323C10.8731 16.9312 10.1017 17.8757 8.51473 19.9816C9.21745 19.9995 10.0351 20 11 20Z" fill={config.mode === 'image' ? (isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF') : (isLightTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)')}/>
              </svg>
              <span
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                  fontSize: 16,
                  fontWeight: 600,
                  lineHeight: '24px',
                  color: config.mode === 'image' ? (isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF') : (isLightTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)'),
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease',
                }}
              >
                图像生成
              </span>
            </div>

            {/* 视频生成 Tab */}
            <div
              data-tab="video"
              onClick={() => {
                setConfig(prev => ({ ...prev, mode: 'video', model: 'wan2.2' }));
              }}
              style={{
                position: 'relative',
                zIndex: 1,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 24px',
                borderRadius: '12px 12px 0 0',
                cursor: 'pointer',
                gap: 6,
              }}
            >
              {/* 视频图标 */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M6.66667 5.83333C5.28595 5.83333 4.16667 6.95262 4.16667 8.33333C4.16667 9.71405 5.28595 10.8333 6.66667 10.8333C8.04738 10.8333 9.16667 9.71405 9.16667 8.33333C9.16667 6.95262 8.04738 5.83333 6.66667 5.83333ZM5.83333 8.33333C5.83333 7.8731 6.20643 7.5 6.66667 7.5C7.1269 7.5 7.5 7.8731 7.5 8.33333C7.5 8.79357 7.1269 9.16667 6.66667 9.16667C6.20643 9.16667 5.83333 8.79357 5.83333 8.33333Z" fill={config.mode === 'video' ? (isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF') : (isLightTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)')}/>
                <path d="M13.3769 2.61740C12.9438 2.49929 12.4433 2.49957 11.7693 2.49994L8.27237 2.49998C6.75282 2.49996 5.52802 2.49994 4.47306 2.62945C3.39793 2.76392 2.55585 3.05158 1.88706 3.72037C1.21826 4.38916 0.930598 5.23125 0.796141 6.30637C0.666627 7.36133 0.666645 8.58608 0.666672 10.1057V10.0609C0.666645 11.5805 0.666627 12.8053 0.796141 13.8603C0.930598 14.9354 1.21826 15.7775 1.88706 16.4463C2.55585 17.1151 3.39793 17.4027 4.47306 17.5372C5.52803 17.6667 6.75283 17.6667 8.27238 17.6667L11.8025 17.6667C12.4457 17.667 12.9234 17.6672 13.3379 17.5596C14.5083 17.2557 15.4223 16.3417 15.7263 15.1713C15.7629 15.0303 15.787 14.8822 15.8029 14.726C16.1070 14.9433 16.3855 15.1327 16.6353 15.2685C17.0451 15.4911 17.6339 15.7131 18.2453 15.4073C18.8568 15.1016 19.0326 14.4975 19.1002 14.0360C19.1668 13.5826 19.1667 12.9861 19.1667 12.3129V7.94590C19.1668 7.33380 19.1669 6.78314 19.1040 6.35933C19.0385 5.91729 18.8699 5.35728 18.3079 5.04578C17.7459 4.73429 17.1818 4.88819 16.7722 5.06691C16.4888 5.19058 16.1668 5.37703 15.8143 5.59319C15.7983 5.36073 15.7692 5.15171 15.7159 4.95640C15.4054 3.81758 14.5158 2.92793 13.3769 2.61740ZM11.6527 4.16665C12.4953 4.16665 12.7503 4.17405 12.9385 4.22536C13.5078 4.38063 13.9527 4.82545 14.108 5.39486C14.1592 5.58302 14.1667 5.83802 14.1667 6.68068L14.1667 6.68934C14.1667 6.72480 14.1666 6.77865 14.1692 6.82709C14.1717 6.87443 14.1789 7.00588 14.2311 7.13570C14.4039 7.59376 14.8831 7.85930 15.3631 7.76313C15.5079 7.73412 15.6162 7.67506 15.6577 7.65207C15.7001 7.62855 15.7457 7.60000 15.7757 7.58119L16.225 7.30039C16.8127 6.93308 17.1734 6.71028 17.4387 6.59447L17.453 6.58833L17.4553 6.60365C17.4977 6.89007 17.5 7.31400 17.5 8.00706V12.0833C17.5 12.8389 17.4978 13.3101 17.4512 13.6274L17.4483 13.6467L17.4312 13.6374C17.1494 13.4843 16.771 13.2033 16.1667 12.75L15.8458 12.5093C15.8161 12.487 15.7728 12.4545 15.7328 12.4275C15.6963 12.4029 15.5918 12.3326 15.4481 12.2904C14.9453 12.1429 14.4138 12.4087 14.2302 12.8994C14.1777 13.0397 14.1712 13.1655 14.169 13.2093C14.1666 13.2575 14.1667 13.3116 14.1667 13.3489L14.1667 13.3578C14.1667 14.162 14.1599 14.4055 14.1132 14.5856C13.9612 15.1708 13.5042 15.6278 12.919 15.7798C12.7388 15.8266 12.4953 15.8333 11.6912 15.8333H8.33333C6.73843 15.8333 5.62609 15.8316 4.7868 15.7187C3.98817 15.6091 3.53975 15.4086 3.23223 15.1011C2.92472 14.7936 2.72422 14.3452 2.61461 13.5465C2.50177 12.7072 2.5 11.5949 2.5 10C2.5 8.40509 2.50177 7.29273 2.61461 6.45345C2.72422 5.65481 2.92472 5.20639 3.23223 4.89888C3.53975 4.59137 3.98817 4.39087 4.7868 4.28126C5.62609 4.16842 6.73843 4.16665 8.33333 4.16665H11.6527Z" fill={config.mode === 'video' ? (isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF') : (isLightTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)')}/>
              </svg>
              <span
                style={{
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                  fontSize: 16,
                  fontWeight: 600,
                  lineHeight: '24px',
                  color: config.mode === 'video' ? (isLightTheme ? 'rgba(0,0,0,0.85)' : '#FFFFFF') : (isLightTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)'),
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease',
                }}
              >
                视频生成
              </span>
            </div>
          </div>
        )}

        {/* 对话框主体 */}
        <div
          data-dialog-main="true"
          onClick={() => textareaRef.current?.focus()}
          style={{
            background: isLightTheme ? '#FFFFFF' : '#181818',
            backdropFilter: 'none',
            border: 'none',
            borderRadius: isLandingPage ? '0 12px 12px 12px' : parseInt(theme.panelBorderRadius),
            boxShadow: theme.panelShadow,
            padding: 12,
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflow: 'visible',
            cursor: 'text',
          }}
        >
          {/* 内层容器 - gap: 8px */}
          <div
            data-inner-container="true"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignSelf: 'stretch',
              position: 'relative',
            }}
          >
            {/* 内容区域 */}
        <div
          data-content-area="true"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 0,
            alignSelf: 'stretch',
          }}
        >
          {/* 视频模式上传框 */}
          {config.mode === 'video' && config.videoCapability !== 'text-to-video' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {/* 首帧上传框 */}
                  <div
                    style={{
                      position: 'relative',
                      width: 56,
                      height: 84,
                      flexShrink: 0,
                    }}
                    onMouseEnter={() => setHoveredVideoStartFrame(true)}
                    onMouseLeave={() => setHoveredVideoStartFrame(false)}
                  >
                        {config.videoStartFrame ? (
                          <>
                            {/* 内容容器 */}
                            <div
                              style={{
                                position: 'relative',
                                width: 56,
                                height: 84,
                                borderRadius: BorderRadius.small,
                                overflow: 'hidden',
                                background: Colors.background.primary,
                              }}
                            >
                              <img
                                src={config.videoStartFrame}
                                alt="Start Frame"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </div>

                            {/* 删除按钮 - 只在hover时显示 */}
                            {hoveredVideoStartFrame && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfig(prev => ({ ...prev, videoStartFrame: undefined }));
                                }}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  right: 0,
                                  width: 12,
                                  height: 12,
                                  background: Colors.text.primary,
                                  border: 'none',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  zIndex: 1001,
                                  transform: 'translate(25%, -25%)',
                                  pointerEvents: 'auto',
                                }}
                              >
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                  <path d="M2 2L6 6M6 2L2 6" stroke={Colors.background.primary} strokeWidth="1" strokeLinecap="round" />
                                </svg>
                              </button>
                            )}
                          </>
                        ) : (
                      // 上传按钮
                      <label
                        style={{
                          width: 56,
                          height: 84,
                          borderRadius: BorderRadius.small,
                          border: `1px dashed ${isLightTheme ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = isLightTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = isLightTheme ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)';
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const url = event.target?.result as string;
                                setConfig(prev => ({ ...prev, videoStartFrame: url }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5V19M5 12H19" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </label>
                        )}
                  </div>

                  {/* 首尾帧模式下的切换图标 */}
                  {config.videoCapability === 'first-last-frame' && (
                    <>
                      {/* 切换图标 */}
                      <img
                        src={iconSwitch}
                        alt="Switch"
                        width={12}
                        height={12}
                        style={{
                          flexShrink: 0,
                          cursor: 'pointer',
                          filter: isLightTheme ? 'brightness(0.3)' : 'brightness(0) invert(1)',
                          opacity: 0.85,
                        }}
                        onClick={() => {
                          // 交换首尾帧
                          setConfig(prev => ({
                            ...prev,
                            videoStartFrame: prev.videoEndFrame,
                            videoEndFrame: prev.videoStartFrame,
                          }));
                        }}
                      />

                      {/* 尾帧上传框 */}
                      <div
                        style={{
                          position: 'relative',
                          width: 56,
                          height: 84,
                          flexShrink: 0,
                        }}
                        onMouseEnter={() => setHoveredVideoEndFrame(true)}
                        onMouseLeave={() => setHoveredVideoEndFrame(false)}
                      >
                            {config.videoEndFrame ? (
                              <>
                                {/* 内容容器 */}
                                <div
                                  style={{
                                    position: 'relative',
                                    width: 56,
                                    height: 84,
                                    borderRadius: BorderRadius.small,
                                    overflow: 'hidden',
                                    background: Colors.background.primary,
                                  }}
                                >
                                  <img
                                    src={config.videoEndFrame}
                                    alt="End Frame"
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                  />
                                </div>

                                {/* 删除按钮 - 只在hover时显示 */}
                                {hoveredVideoEndFrame && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfig(prev => ({ ...prev, videoEndFrame: undefined }));
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      width: 12,
                                      height: 12,
                                      background: Colors.text.primary,
                                      border: 'none',
                                      borderRadius: '50%',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 0,
                                      zIndex: 1001,
                                      transform: 'translate(25%, -25%)',
                                      pointerEvents: 'auto',
                                    }}
                                  >
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                      <path d="M2 2L6 6M6 2L2 6" stroke={Colors.background.primary} strokeWidth="1" strokeLinecap="round" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            ) : (
                          // 上传按钮
                          <label
                            style={{
                              width: 56,
                              height: 84,
                              borderRadius: BorderRadius.small,
                              border: `1px dashed ${isLightTheme ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = isLightTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = isLightTheme ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)';
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const url = event.target?.result as string;
                                    setConfig(prev => ({ ...prev, videoEndFrame: url }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                              <path d="M12 5V19M5 12H19" stroke={isLightTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </label>
                            )}
                      </div>
                    </>
                  )}

              {/* 分割线 - 在上传框和Lora之间 */}
              {config.videoLora && (
                <div
                  style={{
                    width: 1,
                    height: 16,
                    background: isLightTheme ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.2)',
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Video Lora权重显示 */}
              {config.videoLora && (() => {
                const selectedLoraModel = modelData.find(m => m.id === config.videoLora);
                const isHovered = hoveredLoraId === config.videoLora;

                return (
                  <div
                    style={{
                      position: 'relative',
                      width: 56,
                      height: 84,
                      flexShrink: 0,
                    }}
                    onMouseEnter={() => {
                      if (loraHoverTimeoutRef.current) {
                        clearTimeout(loraHoverTimeoutRef.current);
                        loraHoverTimeoutRef.current = null;
                      }
                      setHoveredLoraId(config.videoLora!);
                    }}
                    onMouseLeave={(e) => {
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (!relatedTarget || !relatedTarget.closest('[data-lora-tooltip]')) {
                        if (loraHoverTimeoutRef.current) {
                          clearTimeout(loraHoverTimeoutRef.current);
                        }
                        loraHoverTimeoutRef.current = setTimeout(() => {
                          setHoveredLoraId(null);
                        }, 100);
                      }
                    }}
                  >
                    {/* 内容容器 */}
                    <div
                      style={{
                        position: 'relative',
                        width: 56,
                        height: 84,
                        borderRadius: BorderRadius.small,
                        overflow: 'hidden',
                        border: `1px solid ${Colors.border.default}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                    {/* Lora 图片或背景 */}
                    {selectedLoraModel?.imageUrl ? (
                      <img
                        src={selectedLoraModel.imageUrl}
                        alt={selectedLoraModel.name}
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
                          background: Colors.background.tertiary,
                        }}
                      />
                    )}

                    {/* 半透明遮罩 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                      }}
                    />

                    {/* 权重值 - 居中显示 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: Typography.englishBody.fontSize.small,
                          fontWeight: Typography.englishHeading.fontWeight,
                          color: Colors.text.primary,
                          fontFamily: Typography.englishHeading.fontFamily,
                          lineHeight: '1.27em',
                        }}
                      >
                        {config.videoLoraWeight?.toFixed(1) || '0.8'}
                      </span>
                    </div>
                    </div>

                    {/* 关闭按钮 - hover 时显示 */}
                    {isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfig({ ...config, videoLora: undefined, videoLoraWeight: undefined });
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          background: Colors.text.primary,
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          zIndex: 10002,
                          transform: 'translate(25%, -25%)',
                          pointerEvents: 'auto',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2 2L6 6M6 2L2 6" stroke={Colors.background.primary} strokeWidth="1" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}

                    {/* Tooltip - hover 时显示，用于调整lora权重 */}
                    {isHovered && selectedLoraModel && (
                      <div
                        data-lora-tooltip
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: Colors.background.secondary,
                          border: `1px solid ${Colors.border.default}`,
                          borderRadius: 12,
                          padding: 12,
                          boxShadow: Shadows.medium,
                          zIndex: 10001,
                          minWidth: 200,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          pointerEvents: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => {
                          if (loraHoverTimeoutRef.current) {
                            clearTimeout(loraHoverTimeoutRef.current);
                            loraHoverTimeoutRef.current = null;
                          }
                          setHoveredLoraId(config.videoLora!);
                        }}
                        onMouseLeave={() => {
                          if (loraHoverTimeoutRef.current) {
                            clearTimeout(loraHoverTimeoutRef.current);
                          }
                          loraHoverTimeoutRef.current = setTimeout(() => {
                            setHoveredLoraId(null);
                          }, 200);
                        }}
                      >
                        {/* 模型名称 */}
                        <div
                          style={{
                            fontSize: Typography.englishBody.fontSize.medium,
                            fontWeight: Typography.englishBody.fontWeight,
                            color: Colors.text.primary,
                            fontFamily: Typography.englishBody.fontFamily,
                          }}
                        >
                          {selectedLoraModel.name}
                        </div>

                        {/* 滑块和数值输入 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                          }}
                        >
                          {/* 滑块 */}
                          <div
                            style={{
                              flex: 1,
                              height: 16,
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={config.videoLoraWeight || 0.8}
                              onChange={(e) => {
                                setConfig({ ...config, videoLoraWeight: parseFloat(e.target.value) });
                              }}
                              className="lora-weight-slider"
                              style={{
                                '--slider-progress': `${(config.videoLoraWeight || 0.8) * 100}%`,
                              } as React.CSSProperties}
                            />
                          </div>

                          {/* 数值输入 */}
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.videoLoraWeight || 0.8}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value <= 1) {
                                setConfig({ ...config, videoLoraWeight: value });
                              }
                            }}
                            style={{
                              width: 72,
                              height: 28,
                              background: Colors.background.secondary,
                              border: `1px solid ${Colors.border.default}`,
                              borderRadius: 7,
                              padding: '8px 12px',
                              color: Colors.text.primary,
                              fontSize: Typography.englishBody.fontSize.medium,
                              fontFamily: Typography.englishBody.fontFamily,
                              textAlign: 'center',
                              outline: 'none',
                            }}
                          />
                        </div>

                        {/* 箭头 - 指向下方 */}
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
                            borderTop: `6px solid ${Colors.background.secondary}`,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: -7,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: `6px solid ${Colors.border.default}`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          )}

          {/* 视频模式 text-to-video - 仅Lora显示 */}
          {config.mode === 'video' && config.videoCapability === 'text-to-video' && config.videoLora && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {(() => {
                const selectedLoraModel = modelData.find(m => m.id === config.videoLora);
                const isHovered = hoveredLoraId === config.videoLora;

                return (
                  <div
                    style={{
                      position: 'relative',
                      width: 56,
                      height: 84,
                      flexShrink: 0,
                    }}
                    onMouseEnter={() => {
                      if (loraHoverTimeoutRef.current) {
                        clearTimeout(loraHoverTimeoutRef.current);
                        loraHoverTimeoutRef.current = null;
                      }
                      setHoveredLoraId(config.videoLora!);
                    }}
                    onMouseLeave={(e) => {
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (!relatedTarget || !relatedTarget.closest('[data-lora-tooltip]')) {
                        if (loraHoverTimeoutRef.current) {
                          clearTimeout(loraHoverTimeoutRef.current);
                        }
                        loraHoverTimeoutRef.current = setTimeout(() => {
                          setHoveredLoraId(null);
                        }, 100);
                      }
                    }}
                  >
                    {/* 内容容器 */}
                    <div
                      style={{
                        position: 'relative',
                        width: 56,
                        height: 84,
                        borderRadius: BorderRadius.small,
                        overflow: 'hidden',
                        border: `1px solid ${Colors.border.default}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                    {/* Lora 图片或背景 */}
                    {selectedLoraModel?.imageUrl ? (
                      <img
                        src={selectedLoraModel.imageUrl}
                        alt={selectedLoraModel.name}
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
                          background: Colors.background.tertiary,
                        }}
                      />
                    )}

                    {/* 半透明遮罩 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                      }}
                    />

                    {/* 权重值 - 居中显示 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: Typography.englishBody.fontSize.small,
                          fontWeight: Typography.englishHeading.fontWeight,
                          color: Colors.text.primary,
                          fontFamily: Typography.englishHeading.fontFamily,
                          lineHeight: '1.27em',
                        }}
                      >
                        {config.videoLoraWeight?.toFixed(1) || '0.8'}
                      </span>
                    </div>
                    </div>

                    {/* 关闭按钮 - hover 时显示 */}
                    {isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfig({ ...config, videoLora: undefined, videoLoraWeight: undefined });
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          background: Colors.text.primary,
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          zIndex: 10002,
                          transform: 'translate(25%, -25%)',
                          pointerEvents: 'auto',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2 2L6 6M6 2L2 6" stroke={Colors.background.primary} strokeWidth="1" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}

                    {/* Tooltip - hover 时显示，用于调整lora权重 */}
                    {isHovered && selectedLoraModel && (
                      <div
                        data-lora-tooltip
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: Colors.background.secondary,
                          border: `1px solid ${Colors.border.default}`,
                          borderRadius: 12,
                          padding: 12,
                          boxShadow: Shadows.medium,
                          zIndex: 10001,
                          minWidth: 200,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          pointerEvents: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => {
                          if (loraHoverTimeoutRef.current) {
                            clearTimeout(loraHoverTimeoutRef.current);
                            loraHoverTimeoutRef.current = null;
                          }
                          setHoveredLoraId(config.videoLora!);
                        }}
                        onMouseLeave={() => {
                          if (loraHoverTimeoutRef.current) {
                            clearTimeout(loraHoverTimeoutRef.current);
                          }
                          loraHoverTimeoutRef.current = setTimeout(() => {
                            setHoveredLoraId(null);
                          }, 200);
                        }}
                      >
                        {/* 模型名称 */}
                        <div
                          style={{
                            fontSize: Typography.englishBody.fontSize.medium,
                            fontWeight: Typography.englishBody.fontWeight,
                            color: Colors.text.primary,
                            fontFamily: Typography.englishBody.fontFamily,
                          }}
                        >
                          {selectedLoraModel.name}
                        </div>

                        {/* 滑块和数值输入 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                          }}
                        >
                          {/* 滑块 */}
                          <div
                            style={{
                              flex: 1,
                              height: 16,
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={config.videoLoraWeight || 0.8}
                              onChange={(e) => {
                                setConfig({ ...config, videoLoraWeight: parseFloat(e.target.value) });
                              }}
                              className="lora-weight-slider"
                              style={{
                                '--slider-progress': `${(config.videoLoraWeight || 0.8) * 100}%`,
                              } as React.CSSProperties}
                            />
                          </div>

                          {/* 数值输入 */}
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.videoLoraWeight || 0.8}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value <= 1) {
                                setConfig({ ...config, videoLoraWeight: value });
                              }
                            }}
                            style={{
                              width: 72,
                              height: 28,
                              background: Colors.background.secondary,
                              border: `1px solid ${Colors.border.default}`,
                              borderRadius: 7,
                              padding: '8px 12px',
                              color: Colors.text.primary,
                              fontSize: Typography.englishBody.fontSize.medium,
                              fontFamily: Typography.englishBody.fontFamily,
                              textAlign: 'center',
                              outline: 'none',
                            }}
                          />
                        </div>

                        {/* 箭头 - 指向下方 */}
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
                            borderTop: `6px solid ${Colors.background.secondary}`,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: -7,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: `6px solid ${Colors.border.default}`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 图像模式 - 参考图片和Lora */}
          {config.mode === 'image' && ((config.referenceImages && config.referenceImages.length > 0) || config.imageLora) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {/* 多参考图片预览 - 图像模式下显示 */}
              {config.referenceImages && config.referenceImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    style={{
                      position: 'relative',
                      width: 56,
                      height: 84,
                      flexShrink: 0,
                    }}
                    onMouseEnter={() => setHoveredImageIndex(index)}
                    onMouseLeave={() => setHoveredImageIndex(null)}
                  >
                    {/* 内容容器 */}
                    <div
                      style={{
                        position: 'relative',
                        width: 56,
                        height: 84,
                        borderRadius: BorderRadius.small,
                        overflow: 'hidden',
                        background: Colors.background.primary,
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={`Reference ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>

                    {/* 删除按钮 - 只在hover时显示 */}
                    {hoveredImageIndex === index && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfig(prev => ({
                            ...prev,
                            referenceImages: prev.referenceImages?.filter((_, i) => i !== index),
                          }));
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          background: Colors.text.primary,
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          zIndex: 1001,
                          transform: 'translate(25%, -25%)',
                          pointerEvents: 'auto',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2 2L6 6M6 2L2 6" stroke={Colors.background.primary} strokeWidth="1" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
              ))}


              {/* 分割线 - 在参考图片和Lora之间 */}
              {((config.referenceImages && config.referenceImages.length > 0) && (config.imageLora || config.videoLora)) && (
                <div
                  style={{
                    width: 1,
                    height: 16,
                    background: isLightTheme ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.2)',
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Lora权重显示 - 可点击调整 */}
              {config.imageLora && (() => {
                const selectedLoraModel = modelData.find(m => m.id === config.imageLora);
                const isHovered = hoveredLoraId === config.imageLora;

                return (
                  <div
                    style={{
                      position: 'relative',
                      width: 56,
                      height: 84,
                      flexShrink: 0,
                    }}
                    onMouseEnter={() => {
                      // 鼠标进入时，清除任何待处理的超时
                      if (loraHoverTimeoutRef.current) {
                        clearTimeout(loraHoverTimeoutRef.current);
                        loraHoverTimeoutRef.current = null;
                      }
                      setHoveredLoraId(config.imageLora!);
                    }}
                    onMouseLeave={(e) => {
                      // 检查鼠标是否移到了tooltip上
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (!relatedTarget || !relatedTarget.closest('[data-lora-tooltip]')) {
                        // 延迟隐藏，给用户更多时间移动到tooltip
                        if (loraHoverTimeoutRef.current) {
                          clearTimeout(loraHoverTimeoutRef.current);
                        }
                        loraHoverTimeoutRef.current = setTimeout(() => {
                          setHoveredLoraId(null);
                        }, 100);
                      }
                    }}
                  >
                    {/* 内容容器 - 用于遮住关闭按钮 */}
                    <div
                      style={{
                        position: 'relative',
                        width: 56,
                        height: 84,
                        borderRadius: BorderRadius.small,
                        overflow: 'hidden', // 遮住关闭按钮
                        border: `1px solid ${Colors.border.default}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                    {/* Lora 图片或背景 */}
                    {selectedLoraModel?.imageUrl ? (
                      <img
                        src={selectedLoraModel.imageUrl}
                        alt={selectedLoraModel.name}
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
                          background: Colors.background.tertiary,
                        }}
                      />
                    )}
                    
                    {/* 半透明遮罩 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                      }}
                    />
                    
                    {/* 权重值 - 居中显示 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: Typography.englishBody.fontSize.small, // 11px
                          fontWeight: Typography.englishHeading.fontWeight, // 600
                          color: Colors.text.primary,
                          fontFamily: Typography.englishHeading.fontFamily,
                          lineHeight: '1.27em',
                        }}
                      >
                        {config.imageLoraWeight?.toFixed(1) || '0.8'}
                      </span>
                    </div>
                    </div>
                    
                    {/* 关闭按钮 - hover 时显示，被圆角遮住一部分，放在外层避免被overflow遮挡 */}
                    {isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfig({ ...config, imageLora: undefined, imageLoraWeight: undefined });
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          background: Colors.text.primary,
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          zIndex: 10002, // 确保在tooltip之上
                          transform: 'translate(25%, -25%)', // 部分超出，被圆角遮住
                          pointerEvents: 'auto',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2 2L6 6M6 2L2 6" stroke={Colors.background.primary} strokeWidth="1" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                    
                    {/* Tooltip - hover 时显示，用于调整lora权重 */}
                    {isHovered && selectedLoraModel && (
                      <div
                        data-lora-tooltip
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: Colors.background.secondary,
                          border: `1px solid ${Colors.border.default}`,
                          borderRadius: 12,
                          padding: 12,
                          boxShadow: Shadows.medium,
                          zIndex: 10001,
                          minWidth: 200,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          pointerEvents: 'auto', // 确保可以交互
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => {
                          // 鼠标移到tooltip上时保持显示，清除任何待处理的超时
                          if (loraHoverTimeoutRef.current) {
                            clearTimeout(loraHoverTimeoutRef.current);
                            loraHoverTimeoutRef.current = null;
                          }
                          setHoveredLoraId(config.imageLora!);
                        }}
                        onMouseLeave={() => {
                          // 鼠标离开tooltip时延迟隐藏（200ms）
                          if (loraHoverTimeoutRef.current) {
                            clearTimeout(loraHoverTimeoutRef.current);
                          }
                          loraHoverTimeoutRef.current = setTimeout(() => {
                            setHoveredLoraId(null);
                          }, 200);
                        }}
                      >
                        {/* 模型名称 */}
                        <div
                          style={{
                            fontSize: Typography.englishBody.fontSize.medium, // 14px
                            fontWeight: Typography.englishBody.fontWeight, // 400
                            color: Colors.text.primary,
                            fontFamily: Typography.englishBody.fontFamily,
                          }}
                        >
                          {selectedLoraModel.name}
                        </div>
                        
                        {/* 滑块和数值输入 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                          }}
                        >
                          {/* 滑块 */}
                          <div
                            style={{
                              flex: 1,
                              height: 16,
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={config.imageLoraWeight || 0.8}
                              onChange={(e) => {
                                setConfig({ ...config, imageLoraWeight: parseFloat(e.target.value) });
                              }}
                              className="lora-weight-slider"
                              style={{
                                '--slider-progress': `${(config.imageLoraWeight || 0.8) * 100}%`,
                              } as React.CSSProperties}
                            />
                          </div>
                          
                          {/* 数值输入 */}
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.imageLoraWeight || 0.8}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value <= 1) {
                                setConfig({ ...config, imageLoraWeight: value });
                              }
                            }}
                            style={{
                              width: 72,
                              height: 28,
                              background: Colors.background.secondary,
                              border: `1px solid ${Colors.border.default}`,
                              borderRadius: 7,
                              padding: '8px 12px',
                              color: Colors.text.primary,
                              fontSize: Typography.englishBody.fontSize.medium, // 14px
                              fontFamily: Typography.englishBody.fontFamily,
                              textAlign: 'center',
                              outline: 'none',
                            }}
                          />
                        </div>
                        
                        {/* 箭头 - 指向下方 */}
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
                            borderTop: `6px solid ${Colors.background.secondary}`,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: -7,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: `6px solid ${Colors.border.default}`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          )}

          {/* 对话输入框 */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: Spacing.md,
              padding: 0, // 移除padding
              minHeight: 80,
            }}
          >
            <textarea
              ref={textareaRef}
              className="bottom-dialog-textarea"
              value={config.prompt}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, prompt: e.target.value }));
                // 自动调整高度：首页5行(120px)，画布3行(72px)
                const maxH = isLandingPage ? 120 : 72;
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, maxH) + 'px';
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder={selectedLayer ? '基于此图片进行AI生图...' : (isLandingPage ? displayedPlaceholder : CANVAS_PLACEHOLDER)}
              style={{
                flex: 1,
                minHeight: 24,
                maxHeight: isLandingPage ? 120 : 72,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: config.prompt ? theme.textPrimary : theme.textTertiary,
                caretColor: '#38BDFF',
                fontSize: 16,
                fontFamily: 'Roboto, -apple-system, sans-serif',
                fontWeight: 400,
                lineHeight: '1.5em',
                resize: 'none',
                padding: 0,
                margin: 0,
                transition: 'color 0.3s ease',
                overflowY: 'auto',
                overflowX: 'hidden',
                wordWrap: 'break-word',
              }}
              rows={1}
            />
          </div>
        </div>

        {/* 控制条区域 */}
        <div
          data-control-bar="true"
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            alignSelf: 'stretch',
            gap: 8,
            padding: 0,
          }}
        >
            {/* 左侧：模型选择按钮组 */}
            <div
              data-left-buttons="true"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                flexShrink: 0,
              }}
            >
              {/* 模式选择 (图像生成/视频生成) */}
              <div style={{ position: 'relative', flexShrink: 0 }} title="选择生成模式：图像或视频">
                <div
                  ref={modeButtonRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    background: modeSelectorStyle === 'enhanced-button'
                      ? 'linear-gradient(135deg, rgba(56, 189, 255, 0.15) 0%, rgba(56, 189, 255, 0.05) 100%)'
                      : 'transparent',
                    border: modeSelectorStyle === 'enhanced-button'
                      ? '1px solid rgba(56, 189, 255, 0.3)'
                      : `1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.12)'}`,
                    borderRadius: '100px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: modeSelectorStyle === 'enhanced-button'
                      ? '0 0 12px rgba(56, 189, 255, 0.2)'
                      : 'none',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newState = !showModeDropdown;
                    if (newState && modeButtonRef.current) {
                      const rect = modeButtonRef.current.getBoundingClientRect();
                      const position = {
                        top: rect.top,
                        left: rect.left,
                      };
                      setModeDropdownPosition(position);
                      setShowModeDropdown(true);
                    } else {
                      setShowModeDropdown(false);
                      setModeDropdownPosition(null);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    {/* 模式图标 */}
                    <div style={{ width: 20, height: 20, flexShrink: 0 }}>
                      {config.mode === 'image' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 6C7.34316 6 6 7.34316 6 9C6 10.6568 7.34316 12 9 12C10.6568 12 12 10.6568 12 9C12 7.34316 10.6568 6 9 6ZM8 9C8 8.44772 8.44772 8 9 8C9.55228 8 10 8.44772 10 9C10 9.55228 9.55228 10 9 10C8.44772 10 8 9.55228 8 9Z" fill="#38BDFF"/>
                          <path d="M10.9268 2H13.0732C14.8966 1.99997 16.3664 1.99995 17.5223 2.15537C18.7225 2.31672 19.733 2.66191 20.5355 3.46447C21.3381 4.26702 21.6833 5.27752 21.8446 6.47767C22.0001 7.63363 22 9.1034 22 10.9269V13.0731C22 14.8966 22.0001 16.3664 21.8446 17.5223C21.6833 18.7225 21.3381 19.733 20.5355 20.5355C19.733 21.3381 18.7225 21.6833 17.5223 21.8446C16.3664 22.0001 14.8966 22 13.0731 22H10.9269C9.1034 22 7.63363 22.0001 6.47767 21.8446C5.27752 21.6833 4.26702 21.3381 3.46447 20.5355C2.66191 19.733 2.31672 18.7225 2.15537 17.5223C1.99995 16.3664 1.99997 14.8966 2 13.0732V10.9268C1.99997 9.10339 1.99995 7.63362 2.15537 6.47767C2.31672 5.27752 2.66191 4.26702 3.46447 3.46447C4.26702 2.66191 5.27752 2.31672 6.47767 2.15537C7.63362 1.99995 9.10339 1.99997 10.9268 2ZM6.74416 4.13753C5.7658 4.26907 5.2477 4.50966 4.87868 4.87868C4.50966 5.2477 4.26907 5.76579 4.13753 6.74416C4.00213 7.7513 4 9.08611 4 11V13C4 14.9139 4.00213 16.2487 4.13753 17.2558C4.26907 18.2342 4.50966 18.7523 4.87868 19.1213C5.16894 19.4116 5.55142 19.6224 6.17757 19.7632L6.52231 19.3035C8.29731 16.9362 9.35419 15.5266 10.7441 14.644C11.9921 13.8514 13.4162 13.3785 14.8905 13.2671C16.3164 13.1593 17.7788 13.5202 19.9984 14.1643C19.9999 13.8016 20 13.4144 20 13V11C20 9.08611 19.9979 7.7513 19.8625 6.74416C19.7309 5.7658 19.4903 5.2477 19.1213 4.87868C18.7523 4.50966 18.2342 4.26907 17.2558 4.13753C16.2487 4.00213 14.9139 4 13 4H11C9.08611 4 7.7513 4.00213 6.74416 4.13753ZM11 20H13C14.9139 20 16.2487 19.9979 17.2558 19.8625C18.2342 19.7309 18.7523 19.4903 19.1213 19.1213C19.4903 18.7523 19.7309 18.2342 19.8625 17.2558C19.9038 16.9485 19.9327 16.6106 19.9529 16.235C17.3641 15.479 16.1674 15.1762 15.0412 15.2614C13.8946 15.348 12.787 15.7159 11.8162 16.3323C10.8731 16.9312 10.1017 17.8757 8.51473 19.9816C9.21745 19.9995 10.0351 20 11 20Z" fill="#38BDFF"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6.66667 5.83333C5.28595 5.83333 4.16667 6.95262 4.16667 8.33333C4.16667 9.71405 5.28595 10.8333 6.66667 10.8333C8.04738 10.8333 9.16667 9.71405 9.16667 8.33333C9.16667 6.95262 8.04738 5.83333 6.66667 5.83333ZM5.83333 8.33333C5.83333 7.8731 6.20643 7.5 6.66667 7.5C7.1269 7.5 7.5 7.8731 7.5 8.33333C7.5 8.79357 7.1269 9.16667 6.66667 9.16667C6.20643 9.16667 5.83333 8.79357 5.83333 8.33333Z" fill="#38BDFF"/>
                          <path d="M13.3769 2.61740C12.9438 2.49929 12.4433 2.49957 11.7693 2.49994L8.27237 2.49998C6.75282 2.49996 5.52802 2.49994 4.47306 2.62945C3.39793 2.76392 2.55585 3.05158 1.88706 3.72037C1.21826 4.38916 0.930598 5.23125 0.796141 6.30637C0.666627 7.36133 0.666645 8.58608 0.666672 10.1057V10.0609C0.666645 11.5805 0.666627 12.8053 0.796141 13.8603C0.930598 14.9354 1.21826 15.7775 1.88706 16.4463C2.55585 17.1151 3.39793 17.4027 4.47306 17.5372C5.52803 17.6667 6.75283 17.6667 8.27238 17.6667L11.8025 17.6667C12.4457 17.667 12.9234 17.6672 13.3379 17.5596C14.5083 17.2557 15.4223 16.3417 15.7263 15.1713C15.7629 15.0303 15.787 14.8822 15.8029 14.726C16.1070 14.9433 16.3855 15.1327 16.6353 15.2685C17.0451 15.4911 17.6339 15.7131 18.2453 15.4073C18.8568 15.1016 19.0326 14.4975 19.1002 14.0360C19.1668 13.5826 19.1667 12.9861 19.1667 12.3129V7.94590C19.1668 7.33380 19.1669 6.78314 19.1040 6.35933C19.0385 5.91729 18.8699 5.35728 18.3079 5.04578C17.7459 4.73429 17.1818 4.88819 16.7722 5.06691C16.4888 5.19058 16.1668 5.37703 15.8143 5.59319C15.7983 5.36073 15.7692 5.15171 15.7159 4.95640C15.4054 3.81758 14.5158 2.92793 13.3769 2.61740ZM11.6527 4.16665C12.4953 4.16665 12.7503 4.17405 12.9385 4.22536C13.5078 4.38063 13.9527 4.82545 14.108 5.39486C14.1592 5.58302 14.1667 5.83802 14.1667 6.68068L14.1667 6.68934C14.1667 6.72480 14.1666 6.77865 14.1692 6.82709C14.1717 6.87443 14.1789 7.00588 14.2311 7.13570C14.4039 7.59376 14.8831 7.85930 15.3631 7.76313C15.5079 7.73412 15.6162 7.67506 15.6577 7.65207C15.7001 7.62855 15.7457 7.60000 15.7757 7.58119L16.225 7.30039C16.8127 6.93308 17.1734 6.71028 17.4387 6.59447L17.453 6.58833L17.4553 6.60365C17.4977 6.89007 17.5 7.31400 17.5 8.00706V12.0833C17.5 12.8389 17.4978 13.3101 17.4512 13.6274L17.4483 13.6467L17.4312 13.6374C17.1494 13.4843 16.771 13.2033 16.1667 12.75L15.8458 12.5093C15.8161 12.487 15.7728 12.4545 15.7328 12.4275C15.6963 12.4029 15.5918 12.3326 15.4481 12.2904C14.9453 12.1429 14.4138 12.4087 14.2302 12.8994C14.1777 13.0397 14.1712 13.1655 14.169 13.2093C14.1666 13.2575 14.1667 13.3116 14.1667 13.3489L14.1667 13.3578C14.1667 14.162 14.1599 14.4055 14.1132 14.5856C13.9612 15.1708 13.5042 15.6278 12.919 15.7798C12.7388 15.8266 12.4953 15.8333 11.6912 15.8333H8.33333C6.73843 15.8333 5.62609 15.8316 4.7868 15.7187C3.98817 15.6091 3.53975 15.4086 3.23223 15.1011C2.92472 14.7936 2.72422 14.3452 2.61461 13.5465C2.50177 12.7072 2.5 11.5949 2.5 10C2.5 8.40509 2.50177 7.29273 2.61461 6.45345C2.72422 5.65481 2.92472 5.20639 3.23223 4.89888C3.53975 4.59137 3.98817 4.39087 4.7868 4.28126C5.62609 4.16842 6.73843 4.16665 8.33333 4.16665H11.6527Z" fill="#38BDFF"/>
                        </svg>
                      )}
                    </div>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: modeSelectorStyle === 'colored-text'
                        ? '#38BDFF'
                        : modeSelectorStyle === 'enhanced-button'
                        ? 'rgba(255, 255, 255, 0.85)'
                        : getTextColor(0.85),
                      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                      lineHeight: '20px',
                    }}>
                      {config.mode === 'image' ? '图像生成' : '视频生成'}
                    </span>
                    <img
                      src={iconArrowDown}
                      alt="Arrow Down"
                      width={16}
                      height={16}
                      style={{
                        flexShrink: 0,
                        transform: showModeDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        filter: getIconFilter(),
                      }}
                    />
                </div>
                {showModeDropdown && modeDropdownPosition && (
                  <ModeSelector
                    selectedMode={config.mode}
                    onSelect={(mode) => {
                      // 切换模式时更新配置
                      setConfig(prev => {
                        const newConfig = { ...prev, mode };
                        // 根据模式切换到对应的默认模型
                        if (mode === 'video') {
                          newConfig.model = 'ltx-2'; // 默认视频模型 LTX 2
                          newConfig.videoCapability = newConfig.videoCapability || 'image-to-video';
                        } else {
                          newConfig.model = 'z-image'; // 默认图片模型 Z-image
                        }
                        return newConfig;
                      });
                      setShowModeDropdown(false);
                      setModeDropdownPosition(null);
                    }}
                    onClose={() => {
                      setShowModeDropdown(false);
                      setModeDropdownPosition(null);
                    }}
                    position={modeDropdownPosition}
                  />
                )}
              </div>

              {/* 分割线 */}
              <div
                data-divider="true"
                style={{
                  width: 1,
                  height: 12,
                  background: isLightTheme ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.65)',
                  flexShrink: 0,
                  marginLeft: 8,
                  marginRight: 4,
                }}
              />

              {/* 模型选择 */}
              <Tooltip text="选择AI模型" position="top" isLight={isLightTheme}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  ref={modelButtonRef}
                  data-model-selector="true"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 4,
                    background: 'transparent',
                    borderRadius: '100px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newState = !showModelDropdown;
                    if (newState && modelButtonRef.current) {
                      const rect = modelButtonRef.current.getBoundingClientRect();
                      const position = {
                        top: rect.top,
                        left: rect.left,
                      };
                      setModelSelectorPosition(position);
                      setShowModelDropdown(true);
                    } else {
                      setShowModelDropdown(false);
                      setModelSelectorPosition(null);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <img src={iconModel} alt="Model" width={20} height={20} style={{ flexShrink: 0, filter: getIconFilter() }} />
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: getTextColor(0.85),
                      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                      lineHeight: '20px',
                    }}>
                      {modelData.find(m => m.id === config.model)?.name || (config.mode === 'video' ? 'Wan2.2' : 'Qwen-Image-Edit')}
                    </span>
                    <img
                      src={iconArrowDown}
                      alt="Arrow Down"
                      width={16}
                      height={16}
                      style={{
                        flexShrink: 0,
                        transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        filter: getIconFilter(),
                      }}
                    />
                </div>
                {showModelDropdown && modelSelectorPosition && (
                  <ModelDropdown
                    models={modelData.filter(m => m.mode === config.mode)}
                    selectedModel={config.model}
                    onSelect={(modelId) => {
                      setConfig({ ...config, model: modelId });
                      setShowModelDropdown(false);
                      setModelSelectorPosition(null);
                    }}
                    onClose={() => {
                      setShowModelDropdown(false);
                      setModelSelectorPosition(null);
                    }}
                    position={modelSelectorPosition}
                  />
                )}
              </div>
              </Tooltip>

              {/* 视频能力选择 (仅视频模式显示) */}
              {config.mode === 'video' && (
                <div style={{ position: 'relative', flexShrink: 0 }} title="选择视频生成能力：文生视频、图生视频或首尾帧">
                  <div
                    ref={capabilityButtonRef}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px',
                      background: 'transparent',
                      borderRadius: '100px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newState = !showCapabilityDropdown;
                      if (newState && capabilityButtonRef.current) {
                        const rect = capabilityButtonRef.current.getBoundingClientRect();
                        const position = {
                          top: rect.top,
                          left: rect.left,
                        };
                        setCapabilityDropdownPosition(position);
                        setShowCapabilityDropdown(true);
                      } else {
                        setShowCapabilityDropdown(false);
                        setCapabilityDropdownPosition(null);
                      }
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: getTextColor(0.85),
                        fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                        lineHeight: '20px',
                      }}>
                        {config.videoCapability === 'text-to-video' ? '文生视频' :
                         config.videoCapability === 'image-to-video' ? '图生视频' :
                         '首尾帧'}
                      </span>
                      <img
                        src={iconArrowDown}
                        alt="Arrow Down"
                        width={16}
                        height={16}
                        style={{
                          flexShrink: 0,
                          transform: showCapabilityDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                          filter: getIconFilter(),
                        }}
                      />
                  </div>
                  {showCapabilityDropdown && capabilityDropdownPosition && (
                    <CapabilitySelector
                      selectedCapability={config.videoCapability || 'image-to-video'}
                      onSelect={(capability) => {
                        setConfig(prev => ({ ...prev, videoCapability: capability }));
                        setShowCapabilityDropdown(false);
                        setCapabilityDropdownPosition(null);
                      }}
                      onClose={() => {
                        setShowCapabilityDropdown(false);
                        setCapabilityDropdownPosition(null);
                      }}
                      position={capabilityDropdownPosition}
                    />
                  )}
                </div>
              )}

              {/* Add Lora */}
              <Tooltip text="添加LoRA模型增强效果" position="top" isLight={isLightTheme}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  ref={loraButtonRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px',
                    background: 'transparent',
                    borderRadius: '100px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => setShowLoraDialog(!showLoraDialog)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <img src={iconMagic} alt="Magic" width={20} height={20} style={{ flexShrink: 0, filter: getIconFilter() }} />
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: getTextColor(0.85),
                      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                      lineHeight: '20px',
                    }}>Add Lora</span>
                </div>
                {showLoraDialog && (
                  <LoraSelector
                    models={modelData}
                    selectedLora={config.mode === 'image' ? config.imageLora : config.videoLora}
                    onSelect={(loraId) => {
                      if (config.mode === 'image') {
                        setConfig({ ...config, imageLora: loraId, imageLoraWeight: config.imageLoraWeight || 0.8 });
                      } else {
                        setConfig({ ...config, videoLora: loraId, videoLoraWeight: config.videoLoraWeight || 0.8 });
                      }
                      setShowLoraDialog(false);
                    }}
                    onClose={() => setShowLoraDialog(false)}
                  />
                )}
              </div>
              </Tooltip>

              {/* 参考图片上传 - 仅图像模式显示 */}
              {config.mode === 'image' && (
                <Tooltip text="上传参考图片（最多10张）" position="top" isLight={isLightTheme}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    background: 'transparent',
                    borderRadius: '100px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (event: any) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (fileEvent: any) => {
                          const imageUrl = fileEvent.target.result;
                          const existingImages = config.referenceImages || [];
                          if (existingImages.length >= 10) {
                            setErrorMessage('最多只能添加10张参考图片');
                            setTimeout(() => setErrorMessage(null), 3000);
                            return;
                          }
                          setConfig({
                            ...config,
                            referenceImages: [...existingImages, imageUrl],
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <img src={iconInitialImg} alt="Reference Image" width={20} height={20} style={{ flexShrink: 0, filter: getIconFilter() }} />
                </div>
                </Tooltip>
              )}

              {/* 提示词增强 */}
              <Tooltip text="AI提示词增强：自动优化您的提示词以获得更好的生成效果" position="top" isLight={isLightTheme}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  background: 'transparent',
                  borderRadius: '100px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  flexShrink: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig(prev => ({ ...prev, enhancePrompt: !prev.enhancePrompt }));
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <img
                  src={iconEnhancePrompts}
                  alt="Enhance Prompts"
                  width={20}
                  height={20}
                  style={{
                    flexShrink: 0,
                    filter: config.enhancePrompt
                      ? 'invert(58%) sepia(95%) saturate(2453%) hue-rotate(169deg) brightness(102%) contrast(101%)' // #38BDFF
                      : isLightTheme
                        ? 'invert(1) brightness(0.3) opacity(0.65)'
                        : 'invert(1) brightness(1) opacity(0.65)',
                    transition: 'filter 0.2s',
                  }}
                />
              </div>
              </Tooltip>

              {/* 音画同步 - 仅视频模式显示 */}
              {config.mode === 'video' && (
              <Tooltip text="音画同步：为生成的视频添加匹配的背景音乐" position="top" isLight={isLightTheme}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  background: 'transparent',
                  borderRadius: '100px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  flexShrink: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig(prev => ({ ...prev, audioVideoSync: !prev.audioVideoSync }));
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <img
                  src={iconNotify}
                  alt="Audio Video Sync"
                  width={20}
                  height={20}
                  style={{
                    flexShrink: 0,
                    filter: config.audioVideoSync
                      ? 'invert(58%) sepia(95%) saturate(2453%) hue-rotate(169deg) brightness(102%) contrast(101%)' // #38BDFF
                      : isLightTheme
                        ? 'invert(1) brightness(0.3) opacity(0.65)'
                        : 'invert(1) brightness(1) opacity(0.65)',
                    transition: 'filter 0.2s',
                  }}
                />
              </div>
              </Tooltip>
              )}
            </div>

          {/* 右侧：比例/数量选择 + 生成按钮 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            {/* 比例和数量选择 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
              }}
            >
            <Tooltip text={config.mode === 'video' ? '选择视频宽高比和分辨率' : '选择图片宽高比'} position="top" isLight={isLightTheme}>
            <div
              ref={ratioButtonRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0',
                background: 'transparent',
                borderRadius: '100px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onClick={(e) => {
                e.stopPropagation();
                const newState = !showRatioDropdown;
                if (newState && ratioButtonRef.current) {
                  const rect = ratioButtonRef.current.getBoundingClientRect();
                  const position = {
                    top: rect.top,
                    left: rect.left,
                  };
                  setRatioDropdownPosition(position);
                  setShowRatioDropdown(true);
                } else {
                  setShowRatioDropdown(false);
                  setRatioDropdownPosition(null);
                }
              }}
            >
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: getTextColor(0.85),
                fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                lineHeight: '20px',
              }}>
                {config.mode === 'video'
                  ? `${config.aspectRatio}/1440P`
                  : config.aspectRatio}
              </span>
              {/* 圆点分隔符 */}
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: getTextColor(0.85),
                }}
              />
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: getTextColor(0.85),
                fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                lineHeight: '20px',
              }}>
                {config.mode === 'video'
                  ? `${config.videoDuration || 5}s`
                  : `${config.count}张`}
              </span>
              <img
                src={iconArrowDown}
                alt="Arrow Down"
                width={16}
                height={16}
                style={{
                  flexShrink: 0,
                  transform: showRatioDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  filter: getIconFilter(),
                }}
              />
            </div>
            </Tooltip>
            {showRatioDropdown && ratioDropdownPosition && createPortal(
              <div
                ref={ratioDropdownRef}
                style={{
                  position: 'fixed',
                  top: ratioDropdownPosition.top,
                  left: ratioDropdownPosition.left,
                  transform: 'translateY(calc(-100% - 8px))',
                  background: isLightTheme ? '#F5F5F5' : '#2A2A2A',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                  border: themeStyle === 'cyberpunk' ? 'none' : theme.panelBorder,
                  borderRadius: parseInt(theme.panelBorderRadius),
                  overflow: 'hidden',
                  minWidth: config.mode === 'video' ? 320 : 240,
                  maxWidth: config.mode === 'video' ? 400 : 320,
                  zIndex: 10001,
                  boxShadow: theme.panelShadow,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 视频模式 */}
                {config.mode === 'video' ? (
                  <div style={{ padding: Spacing.sm }}>
                    {/* 视频比例选择 */}
                    <div style={{ marginBottom: Spacing.sm }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: isLightTheme ? theme.textTertiary : 'rgba(255,255,255,0.45)',
                        marginBottom: 6,
                        letterSpacing: '0.02em',
                      }}>Aspect Ratio</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {['16:9', '9:16', '1:1', '4:3', '3:4'].map((ratio) => {
                          const isSelected = ratio === config.aspectRatio;
                          const getRatioIcon = (r: string) => {
                            const color = isSelected
                              ? (isLightTheme ? theme.textPrimary : '#fff')
                              : (isLightTheme ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)');
                            if (r === '16:9') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="5" width="14" height="8" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '9:16') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="5" y="2" width="8" height="14" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '1:1') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="4" y="4" width="10" height="10" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '4:3') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '3:4') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="4" y="2" width="10" height="14" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            return null;
                          };
                          return (
                            <button
                              key={ratio}
                              onClick={() => setConfig({ ...config, aspectRatio: ratio })}
                              style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                                padding: '8px 4px',
                                cursor: 'pointer',
                                background: isSelected
                                  ? (isLightTheme ? 'rgba(56, 189, 255, 0.15)' : 'rgba(56, 189, 255, 0.12)')
                                  : 'transparent',
                                border: isSelected
                                  ? (isLightTheme ? '1px solid rgba(56, 189, 255, 0.4)' : '1px solid rgba(56, 189, 255, 0.3)')
                                  : (isLightTheme ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent'),
                                borderRadius: BorderRadius.small,
                                color: isSelected
                                  ? (isLightTheme ? theme.textPrimary : '#fff')
                                  : (isLightTheme ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'),
                                fontSize: 11,
                                fontWeight: 500,
                                fontFamily: Typography.englishBody.fontFamily,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = theme.buttonBackgroundHover;
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {getRatioIcon(ratio)}
                              <span>{ratio}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 视频分辨率选择 */}
                    <div style={{ marginBottom: Spacing.sm }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: isLightTheme ? theme.textTertiary : 'rgba(255,255,255,0.45)',
                        marginBottom: 6,
                        letterSpacing: '0.02em',
                      }}>Resolution</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { value: '720p', label: '720P' },
                          { value: '1080p', label: '1080P', pro: true },
                        ].map((item) => {
                          const isSelected = item.value === config.videoResolution;
                          return (
                            <button
                              key={item.value}
                              onClick={() => setConfig({ ...config, videoResolution: item.value })}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                background: isSelected
                                  ? (isLightTheme ? 'rgba(56, 189, 255, 0.15)' : 'rgba(56, 189, 255, 0.12)')
                                  : 'transparent',
                                border: isSelected
                                  ? (isLightTheme ? '1px solid rgba(56, 189, 255, 0.4)' : '1px solid rgba(56, 189, 255, 0.3)')
                                  : (isLightTheme ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent'),
                                borderRadius: BorderRadius.small,
                                color: isSelected
                                  ? (isLightTheme ? theme.textPrimary : '#fff')
                                  : (isLightTheme ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'),
                                fontSize: 12,
                                fontWeight: 500,
                                fontFamily: Typography.englishBody.fontFamily,
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = theme.buttonBackgroundHover;
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span>{item.label}</span>
                              {item.pro && <img src={iconPro} alt="PRO" width={24} height={12} style={{ flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 视频时长选择 */}
                    <div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: isLightTheme ? theme.textTertiary : 'rgba(255,255,255,0.45)',
                        marginBottom: 6,
                        letterSpacing: '0.02em',
                      }}>Duration</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { value: 3, label: '3s' },
                          { value: 5, label: '5s' },
                          { value: 10, label: '10s', pro: true },
                        ].map((item) => {
                          const isSelected = item.value === config.videoDuration;
                          return (
                            <button
                              key={item.value}
                              onClick={() => setConfig({ ...config, videoDuration: item.value })}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                background: isSelected
                                  ? (isLightTheme ? 'rgba(56, 189, 255, 0.15)' : 'rgba(56, 189, 255, 0.12)')
                                  : 'transparent',
                                border: isSelected
                                  ? (isLightTheme ? '1px solid rgba(56, 189, 255, 0.4)' : '1px solid rgba(56, 189, 255, 0.3)')
                                  : (isLightTheme ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent'),
                                borderRadius: BorderRadius.small,
                                color: isSelected
                                  ? (isLightTheme ? theme.textPrimary : '#fff')
                                  : (isLightTheme ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'),
                                fontSize: 12,
                                fontWeight: 500,
                                fontFamily: Typography.englishBody.fontFamily,
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = theme.buttonBackgroundHover;
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span>{item.label}</span>
                              {item.pro && <img src={iconPro} alt="PRO" width={24} height={12} style={{ flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 图片模式 */
                  <div style={{ padding: Spacing.sm }}>
                    {/* 图片比例选择 */}
                    <div style={{ marginBottom: Spacing.sm }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: isLightTheme ? theme.textTertiary : 'rgba(255,255,255,0.45)',
                        marginBottom: 6,
                        letterSpacing: '0.02em',
                      }}>Aspect Ratio</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {['16:9', '9:16', '1:1', '4:3', '3:4'].map((ratio) => {
                          const isSelected = ratio === config.aspectRatio;
                          const getRatioIcon = (r: string) => {
                            const color = isSelected
                              ? (isLightTheme ? theme.textPrimary : '#fff')
                              : (isLightTheme ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)');
                            if (r === '16:9') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="5" width="14" height="8" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '9:16') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="5" y="2" width="8" height="14" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '1:1') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="4" y="4" width="10" height="10" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '4:3') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            if (r === '3:4') return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="4" y="2" width="10" height="14" rx="1.5" stroke={color} strokeWidth="1.2"/></svg>;
                            return null;
                          };
                          return (
                            <button
                              key={ratio}
                              onClick={() => setConfig({ ...config, aspectRatio: ratio })}
                              style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                                padding: '8px 4px',
                                cursor: 'pointer',
                                background: isSelected
                                  ? (isLightTheme ? 'rgba(56, 189, 255, 0.15)' : 'rgba(56, 189, 255, 0.12)')
                                  : 'transparent',
                                border: isSelected
                                  ? (isLightTheme ? '1px solid rgba(56, 189, 255, 0.4)' : '1px solid rgba(56, 189, 255, 0.3)')
                                  : (isLightTheme ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent'),
                                borderRadius: BorderRadius.small,
                                color: isSelected
                                  ? (isLightTheme ? theme.textPrimary : '#fff')
                                  : (isLightTheme ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'),
                                fontSize: 11,
                                fontWeight: 500,
                                fontFamily: Typography.englishBody.fontFamily,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = theme.buttonBackgroundHover;
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {getRatioIcon(ratio)}
                              <span>{ratio}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 图片数量选择 */}
                    <div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: isLightTheme ? theme.textTertiary : 'rgba(255,255,255,0.45)',
                        marginBottom: 6,
                        letterSpacing: '0.02em',
                      }}>Batch Quantity</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { value: 1, label: '1张' },
                          { value: 2, label: '2张' },
                          { value: 4, label: '4张', pro: true },
                        ].map((item) => {
                          const isSelected = item.value === config.count;
                          return (
                            <button
                              key={item.value}
                              onClick={() => setConfig({ ...config, count: item.value })}
                              style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                background: isSelected
                                  ? (isLightTheme ? 'rgba(56, 189, 255, 0.15)' : 'rgba(56, 189, 255, 0.12)')
                                  : 'transparent',
                                border: isSelected
                                  ? (isLightTheme ? '1px solid rgba(56, 189, 255, 0.4)' : '1px solid rgba(56, 189, 255, 0.3)')
                                  : (isLightTheme ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent'),
                                borderRadius: BorderRadius.small,
                                color: isSelected
                                  ? (isLightTheme ? theme.textPrimary : '#fff')
                                  : (isLightTheme ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'),
                                fontSize: 12,
                                fontWeight: 500,
                                fontFamily: Typography.englishBody.fontFamily,
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = theme.buttonBackgroundHover;
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                              {item.pro && <img src={iconPro} alt="PRO" width={24} height={12} style={{ flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>

          {/* 生成按钮 */}
          {(() => {
            const hasInput = config.prompt.trim().length > 0;
            const isEnabled = hasInput;

            return (
              <button
                title={isEnabled ? (config.mode === 'video' ? '开始生成视频' : '开始生成图片') : '请输入提示词'}
                onClick={isEnabled ? handleGenerate : undefined}
                disabled={!isEnabled}
                style={{
                  position: 'relative',
                  width: 85,
                  height: 36,
                  background: isLightTheme
                    ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 100%)',
                  border: 'none',
                  borderRadius: 100,
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  cursor: isEnabled ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.3s ease-in-out, transform 0.2s ease-in-out',
                  fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                  overflow: 'visible',
                  opacity: isEnabled ? 1 : 0.5,
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  if (isEnabled) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isEnabled) {
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                {/* 边框渐变效果 - 带过渡 */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 100,
                    padding: '1px',
                    background: isLightTheme
                      ? (isEnabled
                          ? 'linear-gradient(180deg, rgba(0, 0, 0, 0) 31%, rgba(0, 0, 0, 0.15) 79%)'
                          : 'linear-gradient(180deg, rgba(0, 0, 0, 0) 31%, rgba(0, 0, 0, 0.08) 79%)')
                      : (isEnabled
                          ? 'linear-gradient(180deg, rgba(255, 255, 255, 0) 31%, rgba(255, 255, 255, 0.3) 79%)'
                          : 'linear-gradient(180deg, rgba(255, 255, 255, 0) 31%, rgba(255, 255, 255, 0.1) 79%)'),
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    pointerEvents: 'none',
                    transition: 'background 0.3s ease-in-out',
                  }}
                />
                {/* 左侧：椭圆容器 - 闪电图标和数字，位置x:12, y:8 */}
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
                  {/* icon / credits - 位置x:0, y:2，带过渡 */}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      marginTop: 2,
                      backgroundColor: isLightTheme ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.85)',
                      WebkitMaskImage: `url(${iconCredits})`,
                      WebkitMaskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskImage: `url(${iconCredits})`,
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      transition: 'opacity 0.3s ease-in-out',
                    }}
                  />
                  {/* Text 数字 - 位置x:20, y:0，带过渡和数字变化动画 */}
                  <span
                    key={`count-${config.count}`}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isLightTheme
                        ? (isEnabled ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.3)')
                        : (isEnabled ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.25)'),
                      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                      lineHeight: '1.4285714285714286em',
                      flexShrink: 0,
                      transition: 'color 0.3s ease-in-out, opacity 0.2s ease-in-out',
                      display: 'inline-block',
                    }}
                  >
                    {config.count}
                  </span>
                </div>
                {/* 右侧：圆形Frame - 向上箭头，位置x:53, y:4，带过渡 */}
                <div
                  style={{
                    position: 'absolute',
                    left: 53,
                    top: 4,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isLightTheme
                      ? (isEnabled ? '#1A1A1A' : 'rgba(0, 0, 0, 0.4)')
                      : (isEnabled ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isEnabled
                      ? (isLightTheme
                          ? '0px 0px 8px 0px rgba(0, 0, 0, 0.3)'
                          : '0px 0px 8px 0px rgba(255, 255, 255, 0.8)')
                      : (isLightTheme
                          ? '0px 0px 6px 0px rgba(0, 0, 0, 0.15)'
                          : '0px 0px 6.25px 0px rgba(255, 255, 255, 0.3)'),
                    transition: 'all 0.3s ease-in-out',
                  }}
                >
                  {/* 向上箭头 - 代码实现 */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{
                      opacity: isEnabled ? 1 : 0.5,
                      transition: 'opacity 0.3s ease-in-out',
                    }}
                  >
                    <path
                      d="M7 12V2M7 2L2 7M7 2L12 7"
                      stroke={isLightTheme ? '#FFFFFF' : '#000000'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>
            );
          })()}
            </div>
          </div>
        </div>
      </div>

      </div>

      {showLibraryDialog && (
        <LibraryDialog
          onSelect={(imageUrl: string) => {
            setConfig({ ...config, referenceImage: imageUrl });
                  setShowLibraryDialog(false);
          }}
          onClose={() => {
            setShowLibraryDialog(false);
          }}
        />
      )}
    </>
  );
});

BottomDialog.displayName = 'BottomDialog';

export default BottomDialog;
