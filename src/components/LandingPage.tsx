import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme, getThemeStyles, isLightTheme as checkLightTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../styles/colors';
import BottomDialog from './BottomDialog';
import AllProjectsPage from './AllProjectsPage';
import DeleteConfirmModal from './DeleteConfirmModal';
import { GenerationConfig } from '../types';

interface LandingPageProps {
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onStartGeneration: (config: GenerationConfig) => void;
  onDeleteProject?: (projectId: string) => void;
  onShowDeleteSuccess?: () => void;
  transitionVariant?: 'morph' | 'curtain' | 'zoom' | 'ink' | 'fold';
  onTransitionVariantChange?: (variant: 'morph' | 'curtain' | 'zoom' | 'ink' | 'fold') => void;
  isTransitioning?: boolean;
  gridTransitionVersion?: 0 | 1 | 2 | 3; // 0=脉冲, 1=波纹, 2=折叠, 3=旋转
}

interface Project {
  id: string;
  name: string;
  thumbnailUrl: string;
  updatedAt: string;
}

interface InspirationItem {
  id: string;
  imageUrl: string;
  author: string;
  likes: number;
  views: number;
}

const LandingPage: React.FC<LandingPageProps> = ({
  onCreateProject,
  onOpenProject,
  onStartGeneration,
  onDeleteProject,
  onShowDeleteSuccess,
  transitionVariant = 'morph',
  onTransitionVariantChange,
  isTransitioning = false,
  gridTransitionVersion = 0,
}) => {
  const { themeStyle, setThemeStyle } = useTheme();
  const theme = getThemeStyles(themeStyle);
  const [showScrollContent, setShowScrollContent] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDialogExpanded, setIsDialogExpanded] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<0 | 1 | 2 | 3>(0);

  // 模式选择方案切换器
  type ModeSelectorVariant = 'original' | 'top-tabs' | 'below-title' | 'enhanced-button' | 'hybrid' | 'floating-cards' | 'integrated-input' | 'minimal-toggle' | 'visual-cards';
  const [modeSelectorVariant, setModeSelectorVariant] = useState<ModeSelectorVariant>('floating-cards');
  const [currentMode, setCurrentMode] = useState<'image' | 'video'>('image');

  // 模式选择器样式控制 - 用于演示两种样式
  type ModeSelectorStyle = 'enhanced-button' | 'colored-text';
  const [modeSelectorStyle, setModeSelectorStyle] = useState<ModeSelectorStyle>('colored-text');

  // 扫光效果切换器（已禁用）
  // type ShineEffect = 'none' | 'css-shimmer' | 'framer-shine' | 'react-spring' | 'gsap-sweep' | 'css-mask';
  // const [shineEffect, setShineEffect] = useState<ShineEffect>('none');

  // 背景效果切换器
  type BackgroundEffect = 'none' | 'pattern' | 'singularity' | 'warp';
  const [backgroundEffect, setBackgroundEffect] = useState<BackgroundEffect>('none');

  // 测试用：隐藏最近项目版块，模拟新用户
  const [showRecentProjects, setShowRecentProjects] = useState(true);

  // 项目删除相关状态
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  // 查看全部项目页面
  const [showAllProjects, setShowAllProjects] = useState(false);

  // 网格光束随机播放控制 (5组: 3/5/5/3/7)
  const [activeBeamGroup, setActiveBeamGroup] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [beamCycle, setBeamCycle] = useState(0); // 用于强制重新挂载
  const lastGroupRef = useRef<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    const getRandomGroup = (excludeGroup: 1 | 2 | 3 | 4 | 5): 1 | 2 | 3 | 4 | 5 => {
      const groups = ([1, 2, 3, 4, 5] as const).filter(g => g !== excludeGroup);
      return groups[Math.floor(Math.random() * groups.length)];
    };

    const interval = setInterval(() => {
      const nextGroup = getRandomGroup(lastGroupRef.current);
      lastGroupRef.current = nextGroup;
      setActiveBeamGroup(nextGroup);
      setBeamCycle(c => c + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // 模拟项目数据
  const recentProjects: Project[] = [
    {
      id: '1',
      name: '未命名',
      thumbnailUrl: 'https://picsum.photos/400/300?random=1',
      updatedAt: '2026-01-17',
    },
    {
      id: '2',
      name: '未命名',
      thumbnailUrl: 'https://picsum.photos/400/300?random=2',
      updatedAt: '2026-01-17',
    },
    {
      id: '3',
      name: 'Untitled',
      thumbnailUrl: 'https://picsum.photos/400/300?random=3',
      updatedAt: '2026-01-16',
    },
    {
      id: '4',
      name: '未命名',
      thumbnailUrl: 'https://picsum.photos/400/300?random=4',
      updatedAt: '2026-01-15',
    },
  ];

  // 模拟灵感数据（瀑布流）
  const inspirationItems: InspirationItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: `inspiration-${i}`,
    imageUrl: `https://picsum.photos/${300 + Math.floor(Math.random() * 200)}/${400 + Math.floor(Math.random() * 300)}?random=${i + 100}`,
    author: ['Danni', 'ludwig', 'Andy Chen', 'hume'][Math.floor(Math.random() * 4)],
    likes: Math.floor(Math.random() * 500),
    views: Math.floor(Math.random() * 1000),
  }));

  // 监听滚动 - 默认显示灵感发现
  useEffect(() => {
    // 默认显示灵感发现
    setShowScrollContent(true);

    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        // 始终显示
        setShowScrollContent(true);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // 处理生成
  const handleGenerate = (config: GenerationConfig) => {
    onStartGeneration(config);
  };

  // 对话框展开状态（移到顶层避免组件重新挂载）
  const [dialogExpanded, setDialogExpanded] = useState(true);

  // 判断是否为浅色主题
  const isLightTheme = themeStyle === 'anthropic' || themeStyle === 'neumorphism' || themeStyle === 'genz' || themeStyle === 'minimalism' || themeStyle === 'flat';

  // 获取当前主题颜色
  const colors = useMemo(() => getThemeColors(isLightTheme), [isLightTheme]);

  // 鼠标位置追踪 - 已禁用，改用静态背景
  // const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // useEffect(() => {
  //   const handleMouseMove = (e: MouseEvent) => {
  //     setMousePosition({
  //       x: (e.clientX / window.innerWidth) * 100,
  //       y: (e.clientY / window.innerHeight) * 100,
  //     });
  //   };

  //   window.addEventListener('mousemove', handleMouseMove);
  //   return () => window.removeEventListener('mousemove', handleMouseMove);
  // }, []);

  return (
    <>
      {/* Google Fonts - 独特字体组合 */}
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* 全局样式：调整对话框位置和显示 */}
      <style>{`
        /* CSS 变量定义 */
        :root {
          --vi-button-primary-bg-color: linear-gradient(106.49deg, #6F5DFF 0%, #27D4CD 59.7%, #74FF7E 100%);
        }


        /* 将 BottomDialog 改为静态定位，放在页面中间，并增大尺寸 */
        /* 排除 .bottom-dialog-container 以保持星云动画效果 */
        .landing-page-dialog > div[style*="position: absolute"]:not(.bottom-dialog-container) {
          position: static !important;
          transform: none !important;
          width: 1100px !important;
          max-width: 1100px !important;
          left: auto !important;
          bottom: auto !important;
          padding: 12px 12px !important;
          overflow: visible !important;
        }

        /* 为 bottom-dialog-container 设置特殊样式 */
        .landing-page-dialog .bottom-dialog-container {
          position: relative !important;
          bottom: auto !important;
          left: auto !important;
          transform: none !important;
          width: 1100px !important;
          max-width: 1100px !important;
          padding: 12px 12px !important;
          overflow: visible !important;
          isolation: isolate;
        }

        /* 星云容器 - 用于旋转 */
        .landing-page-dialog .bottom-dialog-container::before,
        .landing-page-dialog .bottom-dialog-container::after {
          content: '';
          position: absolute;
          bottom: -40px;
          left: 50%;
          pointer-events: none;
          z-index: -1;
        }

        /* 主光晕层 */
        .landing-page-dialog .bottom-dialog-container::before {
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
        .landing-page-dialog .bottom-dialog-container::after {
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

        /* 主内容区域 */
        .landing-page-dialog > div > div {
          overflow: visible !important;
        }

        /* 内容容器 - 排除 Tab */
        .landing-page-dialog > div > div > div:first-child:not([data-tab]) {
          gap: 12px !important;
          padding: 0 !important;
          overflow: visible !important;
        }

        /* 输入框容器 */
        .landing-page-dialog > div > div > div:first-child > div:first-child {
          width: 100% !important;
          overflow: visible !important;
        }

        /* 调整输入框高度 */
        .landing-page-dialog textarea {
          min-height: 120px !important;
          height: 120px !important;
          font-size: 18px !important;
          line-height: 1.7em !important;
          padding: 0 !important;
          resize: none !important;
          width: 100% !important;
          overflow-y: auto !important;
          word-wrap: break-word !important;
          white-space: pre-wrap !important;
        }

        /* 控制栏 */
        .landing-page-dialog > div > div > div:first-child > div:last-child {
          gap: 8px !important;
          padding: 0 !important;
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          flex-wrap: nowrap !important;
        }

        /* 控制栏按钮组 */
        .landing-page-dialog > div > div > div:first-child > div:last-child > div:first-child {
          gap: 0px !important;
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
        }

        /* 控制栏按钮 - 排除分割线 */
        .landing-page-dialog > div > div > div:first-child > div:last-child > div:first-child > div:not([data-divider]) {
          padding: 4px !important;
          font-size: 14px !important;
          min-height: auto !important;
        }

        /* 控制栏按钮图标 - 排除箭头 */
        .landing-page-dialog > div > div > div:first-child > div:last-child > div:first-child > div img:not([alt="Arrow Down"]) {
          width: 20px !important;
          height: 20px !important;
        }

        /* 下拉箭头 */
        .landing-page-dialog > div > div > div:first-child > div:last-child > div:first-child > div img[alt="Arrow Down"] {
          width: 16px !important;
          height: 16px !important;
        }

        /* 控制栏右侧按钮 - 放大 */
        .landing-page-dialog > div > div > div:first-child > div:last-child > button {
          padding: 12px 24px !important;
          font-size: 16px !important;
          min-height: 48px !important;
          font-weight: 600 !important;
        }

        /* 宽高比按钮 */
        .landing-page-dialog > div > div > div:first-child > div:last-child > div:last-child > div {
          padding: 4px !important;
          font-size: 14px !important;
          min-height: auto !important;
        }

        /* 增强视觉效果 - 根据主题添加阴影 + 底部发光效果 */
        .landing-page-dialog > div[style*="position: static"] {
          box-shadow:
            ${isLightTheme
              ? '0 30px 80px rgba(0, 0, 0, 0.2), 0 0 0 1.5px rgba(102, 126, 234, 0.25), 0 0 80px rgba(102, 126, 234, 0.18), 0 50px 120px -20px rgba(102, 126, 234, 0.5)'
              : '0 30px 80px rgba(0, 0, 0, 0.6), 0 0 0 1.5px rgba(102, 126, 234, 0.3), 0 0 80px rgba(102, 126, 234, 0.25), 0 50px 120px -20px rgba(102, 126, 234, 0.7)'
            } !important;
        }

        /* 底部发光效果 - 太阳光线 */
        .landing-page-dialog {
          position: relative;
        }

        /* 底部发光基础层 - 增强版 */
        .landing-page-dialog::after {
          content: '';
          position: absolute;
          bottom: -100px;
          left: 50%;
          transform: translateX(-50%);
          width: 1000px;
          height: 180px;
          background: radial-gradient(ellipse at center top,
            ${isLightTheme
              ? 'rgba(102, 126, 234, 0.4) 0%, rgba(102, 126, 234, 0.28) 25%, rgba(102, 126, 234, 0.15) 40%, transparent 70%'
              : 'rgba(102, 126, 234, 0.6) 0%, rgba(102, 126, 234, 0.45) 25%, rgba(102, 126, 234, 0.22) 40%, transparent 70%'
            });
          pointer-events: none;
          z-index: -1;
          filter: blur(30px);
        }

        /* 移除太阳光线效果 */

        /* 脉冲动画 - 更微妙的吸引注意 */
        @keyframes dialog-pulse {
          0%, 100% {
            box-shadow:
              ${isLightTheme
                ? '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(102, 126, 234, 0.2), 0 0 60px rgba(102, 126, 234, 0.12), 0 40px 80px -20px rgba(102, 126, 234, 0.4)'
                : '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(102, 126, 234, 0.25), 0 0 60px rgba(102, 126, 234, 0.15), 0 40px 100px -20px rgba(102, 126, 234, 0.6)'
              };
          }
          50% {
            box-shadow:
              ${isLightTheme
                ? '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(102, 126, 234, 0.3), 0 0 80px rgba(102, 126, 234, 0.2), 0 40px 80px -20px rgba(102, 126, 234, 0.6)'
                : '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(102, 126, 234, 0.35), 0 0 80px rgba(102, 126, 234, 0.25), 0 40px 100px -20px rgba(102, 126, 234, 0.8)'
              };
          }
        }

        .landing-page-dialog > div[style*="position: static"] {
          animation: dialog-pulse 3s ease-in-out infinite;
        }

        /* ========== 新增：量子画布设计系统 ========== */

        /* 自定义字体系统 */
        * {
          --font-display: 'Syne', system-ui, sans-serif;
          --font-body: 'Instrument Sans', system-ui, sans-serif;
        }

        /* 动态渐变背景 */
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        /* 网格动画 */
        @keyframes grid-pulse {
          0%, 100% {
            opacity: 0.03;
          }
          50% {
            opacity: 0.08;
          }
        }

        /* 浮动动画 - 对话框微微浮动 */
        @keyframes float-dialog {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        /* 增强对话框立体感 */
        .landing-page-dialog > div[style*="position: static"] {
          animation: dialog-pulse 3s ease-in-out infinite, float-dialog 6s ease-in-out infinite !important;
          transform-style: preserve-3d;
          perspective: 1000px;
        }

        /* 标题样式 */
        .hero-title {
          position: relative;
        }

        /* 缩放效果 - 项目卡片图片 */
        .project-card-image {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center center;
        }

        .project-card:hover .project-card-image {
          transform: scale(1.05);
        }

        .project-card:hover .project-overlay {
          opacity: 1 !important;
        }

        /* 粒子效果容器 */
        .particles-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        /* 网格线条 */
        .grid-line {
          position: absolute;
          background: ${isLightTheme
            ? 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.1), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.15), transparent)'
          };
          opacity: 0;
          animation: grid-fade-in 0.8s ease-out forwards;
        }

        /* 网格光束 */
        .grid-beam {
          position: absolute;
          pointer-events: none;
          opacity: 0;
        }

        /* 水平光束 */
        .grid-beam.horizontal {
          height: 1px;
          width: 100px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(118, 75, 162, 0.15) 10%,
            rgba(102, 126, 234, 0.4) 50%,
            rgba(118, 75, 162, 0.15) 90%,
            transparent 100%
          );
          box-shadow: 0 0 6px rgba(102, 126, 234, 0.3), 0 0 12px rgba(118, 75, 162, 0.2);
          border-radius: 1px;
        }

        /* 垂直光束 */
        .grid-beam.vertical {
          width: 1px;
          height: 100px;
          background: linear-gradient(180deg,
            transparent 0%,
            rgba(118, 75, 162, 0.15) 10%,
            rgba(102, 126, 234, 0.4) 50%,
            rgba(118, 75, 162, 0.15) 90%,
            transparent 100%
          );
          box-shadow: 0 0 6px rgba(102, 126, 234, 0.3), 0 0 12px rgba(118, 75, 162, 0.2);
          border-radius: 1px;
        }

        /* 光束动画 - 水平向右 */
        @keyframes beam-move-right {
          0% {
            left: -120px;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            left: 100%;
            opacity: 0;
          }
        }

        /* 光束动画 - 水平向左 */
        @keyframes beam-move-left {
          0% {
            left: 100%;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            left: -120px;
            opacity: 0;
          }
        }

        /* 光束动画 - 垂直向下 */
        @keyframes beam-move-down {
          0% {
            top: -120px;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }

        /* 光束动画 - 垂直向上 */
        @keyframes beam-move-up {
          0% {
            top: 100%;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            top: -120px;
            opacity: 0;
          }
        }

        /* 光束动画 */
        .grid-beam.active.h-right { animation: beam-move-right 3s linear forwards; }
        .grid-beam.active.h-left { animation: beam-move-left 3s linear forwards; }
        .grid-beam.active.v-down { animation: beam-move-down 3s linear forwards; }
        .grid-beam.active.v-up { animation: beam-move-up 3s linear forwards; }

        /* 过渡时的网格脉冲动画 - 版本0（当前版本） */
        .grid-line.transitioning-pulse {
          animation: grid-pulse-transition 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }

        /* 版本1：波纹扩散 - 需要通过 style 设置 animationDelay */
        .grid-line.transitioning-ripple {
          animation: grid-ripple-transition 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }

        /* 版本2：折叠收缩 */
        .grid-line.transitioning-collapse {
          animation: grid-collapse-transition 0.7s cubic-bezier(0.6, 0, 0.2, 1) forwards !important;
        }

        /* 版本3：旋转淡出 */
        .grid-line.transitioning-rotate {
          animation: grid-rotate-transition 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }

        @keyframes grid-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* 版本0：脉冲 - 优化版 */
        @keyframes grid-pulse-transition {
          0% {
            opacity: 1;
            filter: brightness(1) blur(0px);
            transform: scaleY(1);
          }
          25% {
            opacity: 1;
            filter: brightness(2.5) blur(0.5px);
            transform: scaleY(1.02);
          }
          50% {
            opacity: 1;
            filter: brightness(4) blur(2px);
            transform: scaleY(1.03);
          }
          70% {
            opacity: 0.8;
            filter: brightness(2) blur(1px);
            transform: scaleY(1.01);
          }
          100% {
            opacity: 0;
            filter: brightness(0.5) blur(0px);
            transform: scaleY(0.98);
          }
        }

        /* 版本1：波纹扩散 */
        @keyframes grid-ripple-transition {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1);
          }
          30% {
            opacity: 1;
            transform: scale(1.02);
            filter: brightness(4) blur(2px);
          }
          60% {
            opacity: 1;
            transform: scale(1.02);
            filter: brightness(4) blur(2px);
          }
          100% {
            opacity: 0;
            transform: scale(1);
            filter: brightness(1);
          }
        }

        /* 版本2：折叠收缩 */
        @keyframes grid-collapse-transition {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1);
          }
          40% {
            opacity: 1;
            transform: scale(0.95);
            filter: brightness(2);
          }
          100% {
            opacity: 0;
            transform: scale(0.5);
            filter: brightness(0.5);
          }
        }

        /* 版本3：旋转淡出 */
        @keyframes grid-rotate-transition {
          0% {
            opacity: 1;
            filter: brightness(1) hue-rotate(0deg);
          }
          50% {
            opacity: 1;
            filter: brightness(2.5) hue-rotate(15deg);
          }
          100% {
            opacity: 0;
            filter: brightness(1) hue-rotate(30deg);
          }
        }

        /* 页面内容淡出动画 - 优化版 */
        .page-content-fade-out {
          animation: content-fade-out 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes content-fade-out {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0px);
            filter: blur(0px);
          }
          30% {
            opacity: 0.9;
            transform: scale(1) translateY(0px);
            filter: blur(0px);
          }
          60% {
            opacity: 0.4;
            transform: scale(0.98) translateY(5px);
            filter: blur(2px);
          }
          100% {
            opacity: 0;
            transform: scale(0.96) translateY(10px);
            filter: blur(4px);
          }
        }

        /* 对话框特殊消失动画 */
        .landing-page-dialog.transitioning {
          animation: dialog-dissolve 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes dialog-dissolve {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0px);
            filter: blur(0px) brightness(1);
          }
          40% {
            opacity: 1;
            transform: scale(1.01) translateY(-2px);
            filter: blur(0px) brightness(1.1);
          }
          70% {
            opacity: 0.3;
            transform: scale(0.97) translateY(8px);
            filter: blur(3px) brightness(0.8);
          }
          100% {
            opacity: 0;
            transform: scale(0.94) translateY(15px);
            filter: blur(6px) brightness(0.6);
          }
        }

        /* 背景效果容器 */
        .background-effect-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          pointer-events: none;
          z-index: 0;
        }

        /* 方案1: 点阵背景 - Pattern Background */
        .pattern-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: radial-gradient(circle, ${isLightTheme ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.4)'} 1px, transparent 1px);
          background-size: 30px 30px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 80%);
          animation: pattern-fade 3s ease-in-out infinite;
        }

        @keyframes pattern-fade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }

        /* 方案2: 奇点背景 - Singularity Background */
        .singularity-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .singularity-orb {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle at center,
            ${isLightTheme ? 'rgba(102, 126, 234, 0.4)' : 'rgba(102, 126, 234, 0.6)'} 0%,
            ${isLightTheme ? 'rgba(118, 75, 162, 0.3)' : 'rgba(118, 75, 162, 0.4)'} 40%,
            transparent 70%);
          filter: blur(40px);
          animation: singularity-pulse 4s ease-in-out infinite;
        }

        @keyframes singularity-pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.8;
          }
        }

        /* 方案3: 曲速背景 - Warp Background */
        .warp-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          perspective: 400px;
          transform-style: preserve-3d;
          pointer-events: none;
        }

        .warp-grid {
          position: absolute;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
        }

        .warp-grid-top {
          top: 0;
          transform: rotateX(70deg) translateZ(-200px);
        }

        .warp-grid-bottom {
          bottom: 0;
          transform: rotateX(-70deg) translateZ(-200px);
        }

        .warp-grid-left {
          left: 0;
          transform: rotateY(70deg) translateZ(-200px);
        }

        .warp-grid-right {
          right: 0;
          transform: rotateY(-70deg) translateZ(-200px);
        }

        .warp-beam {
          position: absolute;
          left: var(--beam-x);
          bottom: -50%;
          width: 6%;
          height: 200%;
          background: linear-gradient(to top,
            transparent 0%,
            hsla(var(--beam-hue), 60%, 50%, 0.3) 20%,
            hsla(var(--beam-hue), 60%, 50%, 0) 100%
          );
          animation: warp-beam-rise 3s linear infinite;
          animation-delay: var(--beam-delay);
          filter: blur(4px);
          transform-origin: bottom;
        }

        @keyframes warp-beam-rise {
          0% {
            transform: translateY(0%) scaleY(0.5);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-150%) scaleY(1.5);
            opacity: 0;
          }
        }

        /* 主层动画 - 均匀呼吸 */
        @keyframes nebula-primary {
          0% {
            transform: scale(0.85);
            opacity: 0.15;
          }
          25% {
            transform: scale(1.0);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.75;
          }
          75% {
            transform: scale(1.0);
            opacity: 0.45;
          }
          100% {
            transform: scale(0.85);
            opacity: 0.15;
          }
        }

        /* 次层动画 - 错开节奏 */
        @keyframes nebula-secondary {
          0% {
            transform: scale(1.1);
            opacity: 0.6;
          }
          25% {
            transform: scale(0.95);
            opacity: 0.35;
          }
          50% {
            transform: scale(0.8);
            opacity: 0.1;
          }
          75% {
            transform: scale(0.95);
            opacity: 0.35;
          }
          100% {
            transform: scale(1.1);
            opacity: 0.6;
          }
        }
      `}</style>

      {/* 方案3: 增强按钮样式 */}
      {modeSelectorVariant === 'enhanced-button' && (
        <style>{`
          /* 增强对话框中第一个选择按钮（模式选择按钮） */
          /* 定位到包含 "图像生成" 或 "视频生成" 文本的按钮 */
          div[style*="position: absolute"] > div > div > div:first-child > div:first-child > div:first-child {
            position: relative;
            height: 40px !important;
            padding: 6px 14px !important;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%) !important;
            border: 1.5px solid rgba(102, 126, 234, 0.4) !important;
            box-shadow: 0 0 12px rgba(102, 126, 234, 0.2) !important;
            animation: modePulse 2s ease-in-out infinite !important;
            margin-right: 16px !important;
          }

          div[style*="position: absolute"] > div > div > div:first-child > div:first-child > div:first-child:hover {
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.4) !important;
          }

          div[style*="position: absolute"] > div > div > div:first-child > div:first-child > div:first-child span {
            font-size: 15px !important;
            font-weight: 700 !important;
          }

          @keyframes modePulse {
            0%, 100% {
              box-shadow: 0 0 12px rgba(102, 126, 234, 0.2);
            }
            50% {
              box-shadow: 0 0 20px rgba(102, 126, 234, 0.4);
            }
          }

          /* 在模式按钮右侧添加分隔线 */
          div[style*="position: absolute"] > div > div > div:first-child > div:first-child > div:first-child::after {
            content: '';
            position: absolute;
            right: -10px;
            top: 50%;
            transform: translateY(-50%);
            width: 1px;
            height: 24px;
            background: rgba(255, 255, 255, 0.2);
          }
        `}</style>
      )}

      <div
        className="landing-background"
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          perspective: transitionVariant === 'fold' ? '1200px' : 'none',
          transformStyle: transitionVariant === 'fold' ? 'preserve-3d' : 'flat',
        }}
      >
        {/* 背景效果层 */}
        {backgroundEffect !== 'none' && (
          <div className="background-effect-container">
            {/* 方案1: 点阵渐隐背景 */}
            {backgroundEffect === 'pattern' && (
              <div className="pattern-background"></div>
            )}

            {/* 方案2: 奇点光晕背景 */}
            {backgroundEffect === 'singularity' && (
              <div className="singularity-background">
                <div className="singularity-orb"></div>
              </div>
            )}

            {/* 方案3: 曲速光束背景 */}
            {backgroundEffect === 'warp' && (
              <div className="warp-background">
                {/* 顶部平面 */}
                <div className="warp-grid warp-grid-top">
                  {[...Array(3)].map((_, i) => (
                    <div key={`top-${i}`} className="warp-beam" style={{ '--beam-delay': `${i * 1}s`, '--beam-hue': Math.random() * 360, '--beam-x': `${20 + i * 30}%` } as any}></div>
                  ))}
                </div>
                {/* 底部平面 */}
                <div className="warp-grid warp-grid-bottom">
                  {[...Array(3)].map((_, i) => (
                    <div key={`bottom-${i}`} className="warp-beam" style={{ '--beam-delay': `${i * 1.2}s`, '--beam-hue': Math.random() * 360, '--beam-x': `${25 + i * 25}%` } as any}></div>
                  ))}
                </div>
                {/* 左侧平面 */}
                <div className="warp-grid warp-grid-left">
                  {[...Array(3)].map((_, i) => (
                    <div key={`left-${i}`} className="warp-beam" style={{ '--beam-delay': `${i * 0.8}s`, '--beam-hue': Math.random() * 360, '--beam-x': `${15 + i * 35}%` } as any}></div>
                  ))}
                </div>
                {/* 右侧平面 */}
                <div className="warp-grid warp-grid-right">
                  {[...Array(3)].map((_, i) => (
                    <div key={`right-${i}`} className="warp-beam" style={{ '--beam-delay': `${i * 1.5}s`, '--beam-hue': Math.random() * 360, '--beam-x': `${10 + i * 40}%` } as any}></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 动态网格背景 */}
        <div className="particles-container">
          {/* 垂直网格线 */}
          {[...Array(12)].map((_, i) => {
            const isTransitioningOrPreviewing = isTransitioning || isPreviewing;
            const currentVersion = isPreviewing ? previewVersion : gridTransitionVersion;

            // 计算波纹延迟（从中心向外）
            const distanceFromCenter = Math.abs(i - 5.5);
            const rippleDelay = currentVersion === 1 ? distanceFromCenter * 0.04 : 0;

            // 计算折叠延迟（从边缘向中心）
            const collapseDelay = currentVersion === 2 ? (5.5 - distanceFromCenter) * 0.05 : 0;

            const transitionClass = isTransitioningOrPreviewing
              ? currentVersion === 0 ? 'transitioning-pulse'
              : currentVersion === 1 ? 'transitioning-ripple'
              : currentVersion === 2 ? 'transitioning-collapse'
              : 'transitioning-rotate'
              : '';

            const transitionDelay = isTransitioningOrPreviewing
              ? currentVersion === 1 ? `${rippleDelay}s`
              : currentVersion === 2 ? `${collapseDelay}s`
              : '0s'
              : `${i * 0.2}s`;

            return (
              <div
                key={`v-${i}`}
                className={`grid-line ${transitionClass}`}
                style={{
                  left: `${(i + 1) * 8.33}%`,
                  top: 0,
                  width: '1px',
                  height: '100%',
                  animationDelay: transitionDelay,
                }}
              />
            );
          })}
          {/* 水平网格线 */}
          {[...Array(8)].map((_, i) => {
            const isTransitioningOrPreviewing = isTransitioning || isPreviewing;
            const currentVersion = isPreviewing ? previewVersion : gridTransitionVersion;

            // 计算波纹延迟（从中心向外）
            const distanceFromCenter = Math.abs(i - 3.5);
            const rippleDelay = currentVersion === 1 ? distanceFromCenter * 0.04 : 0;

            // 计算折叠延迟（从边缘向中心）
            const collapseDelay = currentVersion === 2 ? (3.5 - distanceFromCenter) * 0.05 : 0;

            const transitionClass = isTransitioningOrPreviewing
              ? currentVersion === 0 ? 'transitioning-pulse'
              : currentVersion === 1 ? 'transitioning-ripple'
              : currentVersion === 2 ? 'transitioning-collapse'
              : 'transitioning-rotate'
              : '';

            const transitionDelay = isTransitioningOrPreviewing
              ? currentVersion === 1 ? `${rippleDelay}s`
              : currentVersion === 2 ? `${collapseDelay}s`
              : '0s'
              : `${i * 0.15}s`;

            return (
              <div
                key={`h-${i}`}
                className={`grid-line ${transitionClass}`}
                style={{
                  left: 0,
                  top: `${(i + 1) * 12.5}%`,
                  width: '100%',
                  height: '1px',
                  animationDelay: transitionDelay,
                }}
              />
            );
          })}

          {/* 光束效果 - 沿网格线走，只渲染当前活跃组 */}
          {/* 垂直线位置: 8.33%, 16.66%, 25%, 33.33%, 41.66%, 50%, 58.33%, 66.66%, 75%, 83.33%, 91.66% */}
          {/* 水平线位置: 12.5%, 25%, 37.5%, 50%, 62.5%, 75%, 87.5% */}

          {activeBeamGroup === 1 && (
            <React.Fragment key={`group1-${beamCycle}`}>
              <div className="grid-beam horizontal active h-right" style={{ top: '25%' }} />
              <div className="grid-beam vertical active v-down" style={{ left: '75%' }} />
              <div className="grid-beam horizontal active h-left" style={{ top: '62.5%' }} />
            </React.Fragment>
          )}

          {activeBeamGroup === 2 && (
            <React.Fragment key={`group2-${beamCycle}`}>
              <div className="grid-beam vertical active v-up" style={{ left: '25%' }} />
              <div className="grid-beam horizontal active h-right" style={{ top: '37.5%' }} />
              <div className="grid-beam vertical active v-down" style={{ left: '91.66%' }} />
              <div className="grid-beam horizontal active h-left" style={{ top: '87.5%' }} />
              <div className="grid-beam vertical active v-up" style={{ left: '58.33%' }} />
            </React.Fragment>
          )}

          {activeBeamGroup === 3 && (
            <React.Fragment key={`group3-${beamCycle}`}>
              <div className="grid-beam horizontal active h-left" style={{ top: '12.5%' }} />
              <div className="grid-beam vertical active v-down" style={{ left: '8.33%' }} />
              <div className="grid-beam horizontal active h-right" style={{ top: '50%' }} />
              <div className="grid-beam vertical active v-up" style={{ left: '83.33%' }} />
              <div className="grid-beam horizontal active h-left" style={{ top: '75%' }} />
            </React.Fragment>
          )}

          {activeBeamGroup === 4 && (
            <React.Fragment key={`group4-${beamCycle}`}>
              <div className="grid-beam vertical active v-down" style={{ left: '41.66%' }} />
              <div className="grid-beam horizontal active h-right" style={{ top: '12.5%' }} />
              <div className="grid-beam vertical active v-up" style={{ left: '66.66%' }} />
            </React.Fragment>
          )}

          {activeBeamGroup === 5 && (
            <React.Fragment key={`group5-${beamCycle}`}>
              <div className="grid-beam horizontal active h-left" style={{ top: '37.5%' }} />
              <div className="grid-beam vertical active v-down" style={{ left: '16.66%' }} />
              <div className="grid-beam horizontal active h-right" style={{ top: '62.5%' }} />
              <div className="grid-beam vertical active v-up" style={{ left: '33.33%' }} />
              <div className="grid-beam horizontal active h-left" style={{ top: '75%' }} />
              <div className="grid-beam vertical active v-down" style={{ left: '50%' }} />
              <div className="grid-beam horizontal active h-right" style={{ top: '25%' }} />
            </React.Fragment>
          )}
        </div>

        {/* 主内容区域 */}
        <div
        ref={scrollContainerRef}
        className={isTransitioning ? 'page-content-fade-out' : ''}
        style={{
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* 顶部导航栏 - Tensor.Art 风格 */}
        <div
          className=""
          style={{
            width: '100%',
            padding: '12px 24px',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'flex-start',
            borderBottom: `1px solid ${colors.stroke.primary}`,
            background: colors.background.primary,
            backdropFilter: 'blur(20px)',
            position: 'sticky',
            top: 0,
            zIndex: 1100,
          }}
        >
          {/* 左侧：菜单按钮 + Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {/* 菜单按钮 */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.fill.default;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <img
                src="/assets/icons/fold-1.svg"
                alt="Menu"
                style={{
                  width: 24,
                  height: 24,
                  filter: isLightTheme ? 'brightness(0)' : 'brightness(0) invert(1)',
                }}
              />
            </div>

            {/* Logo */}
            <a href="/" style={{ height: 40, display: 'flex', alignItems: 'center' }}>
              <img
                src="/assets/icons/logo.svg"
                alt="Tensor.Art"
                style={{
                  height: 40,
                  width: 'auto',
                  filter: isLightTheme ? 'invert(1) brightness(0.2)' : 'none',
                }}
              />
            </a>
          </div>

          {/* 中间：搜索框 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            gap: 12,
          }}>

            <div style={{
              flex: '1 0 0',
              maxWidth: 600,
              background: colors.background.onPrimary,
              border: `1px solid ${colors.stroke.primary}`,
              borderRadius: 12,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 40,
            }}>
              {/* Input 区域 */}
              <div style={{
                flex: '1 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 12,
                height: '100%'
              }}>
                <input
                  type="search"
                  placeholder="Search"
                  style={{
                    flex: '1 0 0',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 14,
                    color: colors.text.primary,
                    outline: 'none',
                    fontFamily: 'Roboto, sans-serif',
                    fontWeight: 400,
                  }}
                />
              </div>

              {/* 分隔线 */}
              <div style={{
                width: 0,
                height: 20,
                borderLeft: `1px solid ${colors.stroke.primary}`,
              }}></div>

              {/* 相机按钮 */}
              <div style={{
                padding: 10,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <img
                  src="/assets/icons/camera.svg"
                  alt="Camera"
                  style={{
                    width: 20,
                    height: 20,
                    filter: isLightTheme ? 'none' : 'invert(1) brightness(1)',
                  }}
                />
              </div>

              {/* 搜索按钮 */}
              <div style={{
                padding: 10,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <img
                  src="/assets/icons/search.svg"
                  alt="Search"
                  style={{
                    width: 20,
                    height: 20,
                    filter: isLightTheme ? 'none' : 'invert(1) brightness(1)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* 左侧按钮组：在线生图 + 发布 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* 在线生图按钮（带下拉）- 完整渐变 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                borderRadius: 10,
                background: 'linear-gradient(95deg, #6F5DFF 0%, #27D4CD 59.7%, #74FF7E 100%)',
              }}>
                <button
                  style={{
                    height: 40,
                    padding: '8px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <img
                    src="/assets/icons/magic.svg"
                    alt="Magic"
                    style={{
                      width: 20,
                      height: 20,
                      filter: 'invert(1) brightness(1)',
                    }}
                  />
                  在线生图
                </button>

                {/* 分隔线 */}
                <div style={{
                  width: 0,
                  height: '100%',
                  borderLeft: '1px solid rgba(0, 0, 0, 1)',
                }}></div>

                <button
                  style={{
                    height: 40,
                    width: 40,
                    padding: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '0 10px 10px 0',
                  }}
                >
                  <img
                    src="/assets/icons/arrow_down.svg"
                    alt="Dropdown"
                    style={{
                      width: 20,
                      height: 20,
                      filter: 'invert(1) brightness(1)',
                    }}
                  />
                </button>
              </div>

              {/* 发布按钮 */}
              <button
                onClick={onCreateProject}
                style={{
                  height: 40,
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${colors.stroke.primary}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 16,
                  color: colors.text.primary,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-body)',
                }}
              >
                <img
                  src="/assets/icons/plus.svg"
                  alt="Plus"
                  style={{
                    width: 20,
                    height: 20,
                    filter: isLightTheme ? 'none' : 'invert(1) brightness(1)',
                  }}
                />
                发布
              </button>
            </div>

            {/* 右侧图标组：Pro + Discord + Calendar + 通知 + 用户 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {/* Pro 图标 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              width: 48,
              height: 40,
              cursor: 'pointer',
            }}>
              <img
                src="/assets/icons/pro.svg"
                alt="Pro"
                style={{
                  width: 36,
                  height: 36,
                }}
              />
            </div>

            {/* Discord */}
            <a href="https://discord.gg/qYjANGqBED" target="_blank" rel="noopener noreferrer" style={{
              width: 40,
              height: 40,
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                width: 28,
                height: 28,
                WebkitMaskImage: 'url(/assets/icons/discord.svg)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskImage: 'url(/assets/icons/discord.svg)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                backgroundColor: '#7078FF',
              }}></div>
            </a>

            {/* Calendar */}
            <div style={{ width: 40, height: 40, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <img
                src="/assets/icons/calendar.svg"
                alt="Calendar"
                style={{
                  width: 28,
                  height: 28,
                  filter: isLightTheme ? 'none' : 'invert(1) brightness(1)',
                }}
              />
            </div>

            {/* 通知图标（带数字） */}
            <div style={{ position: 'relative', cursor: 'pointer', width: 40, height: 40, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <img
                src="/assets/icons/notification.svg"
                alt="Notification"
                style={{
                  width: 28,
                  height: 28,
                  filter: isLightTheme ? 'none' : 'invert(1) brightness(1)',
                }}
              />
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: '#cc3b3b',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: 10,
                fontWeight: 600,
                padding: '0 4px',
                borderRadius: 10,
                lineHeight: '15px',
                height: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>2</span>
            </div>

            {/* 用户菜单区域 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* 用户头像 - 点击切换亮/暗色主题 */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${colors.stroke.secondary}`,
                  transition: 'transform 0.2s',
                  position: 'relative',
                }}
                onClick={() => {
                  // 切换亮/暗色主题：亮色用 flat，暗色用 original
                  setThemeStyle(isLightTheme ? 'original' : 'flat');
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                title={isLightTheme ? '切换到暗色模式' : '切换到亮色模式'}
              >
                M
                {/* Pro 标记 */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 20,
                  height: 20,
                }}>
                  <img
                    src="/assets/icons/pro_bottom.svg"
                    alt="Pro"
                    style={{
                      width: 20,
                      height: 20,
                    }}
                  />
                </div>
              </div>

              {/* 下拉箭头 */}
              <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <img
                  src="/assets/icons/arrow_down.svg"
                  alt="Dropdown"
                  style={{
                    width: 20,
                    height: 20,
                    filter: isLightTheme ? 'none' : 'invert(1) brightness(1)',
                  }}
                />
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* 查看全部项目页面 - 放在header下方 */}
        {showAllProjects ? (
          <AllProjectsPage
            projects={recentProjects}
            onClose={() => setShowAllProjects(false)}
            onOpenProject={onOpenProject}
            onCreateProject={onCreateProject}
          />
        ) : (
        <>
        {/* 首屏内容 */}
        <div
          className=""
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            padding: '80px 48px 60px',
          }}
        >
          {/* 主标题 */}
          <div style={{ textAlign: 'center', marginBottom: modeSelectorVariant === 'top-tabs' ? 32 : 64, position: 'relative', zIndex: 1 }}>
            <h1
              className="hero-title"
              style={{
                fontSize: 72,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: colors.text.primary,
                margin: 0,
                marginBottom: 20,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              创意无界 画布无限
            </h1>
            <p style={{
              fontSize: 20,
              fontFamily: 'var(--font-body)',
              color: colors.text.secondary,
              margin: 0,
              fontWeight: 500,
              letterSpacing: '0.01em'
            }}>
              AI 驱动的创作平台 · 图像与视频一键生成
            </p>
          </div>

          {/* 方案1: 上方Tab栏 */}
          {modeSelectorVariant === 'top-tabs' && (
            <div style={{ marginBottom: 48 }}>
              <div
                style={{
                  maxWidth: 600,
                  margin: '0 auto',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: 4,
                  display: 'flex',
                  gap: 4,
                }}
              >
                {/* 图像生成 Tab */}
                <button
                  onClick={() => setCurrentMode('image')}
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    background: currentMode === 'image' ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 32 }}>📷</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: currentMode === 'image' ? '#FFFFFF' : colors.text.secondary }}>
                    图像生成
                  </div>
                  <div style={{ fontSize: 12, color: currentMode === 'image' ? 'rgba(255, 255, 255, 0.8)' : colors.text.tertiary }}>
                    创建精美的静态图片
                  </div>
                </button>

                {/* 视频生成 Tab */}
                <button
                  onClick={() => setCurrentMode('video')}
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    background: currentMode === 'video' ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 32 }}>🎬</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: currentMode === 'video' ? '#FFFFFF' : colors.text.secondary }}>
                    视频生成
                  </div>
                  <div style={{ fontSize: 12, color: currentMode === 'video' ? 'rgba(255, 255, 255, 0.8)' : colors.text.tertiary }}>
                    生成动态视频内容
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 方案2: 标题下方大型切换器 */}
          {modeSelectorVariant === 'below-title' && (
            <div style={{ marginBottom: 48, display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 50,
                  padding: 6,
                  gap: 6,
                }}
              >
                <button
                  onClick={() => setCurrentMode('image')}
                  style={{
                    padding: '12px 32px',
                    background: currentMode === 'image' ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)' : 'transparent',
                    border: 'none',
                    borderRadius: 50,
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: 600,
                    color: currentMode === 'image' ? '#FFFFFF' : colors.text.secondary,
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: currentMode === 'image' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 20 }}>📷</span>
                  图像生成
                </button>
                <button
                  onClick={() => setCurrentMode('video')}
                  style={{
                    padding: '12px 32px',
                    background: currentMode === 'video' ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)' : 'transparent',
                    border: 'none',
                    borderRadius: 50,
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: 600,
                    color: currentMode === 'video' ? '#FFFFFF' : colors.text.secondary,
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: currentMode === 'video' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 20 }}>🎬</span>
                  视频生成
                </button>
              </div>
            </div>
          )}

          {/* 方案4: 混合方案 - 首次引导 */}
          {modeSelectorVariant === 'hybrid' && (
            <div style={{ marginBottom: 48 }}>
              <div
                style={{
                  maxWidth: 500,
                  margin: '0 auto',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  border: '1.5px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: 16,
                  padding: 24,
                  position: 'relative',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              >
                <style>{`
                  @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
                    50% { box-shadow: 0 0 0 8px rgba(102, 126, 234, 0); }
                  }
                `}</style>
                <div style={{ fontSize: 14, color: colors.text.secondary, marginBottom: 16, textAlign: 'center' }}>
                  👋 选择你想创建的内容类型
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setCurrentMode('image')}
                    style={{
                      flex: 1,
                      padding: '20px 16px',
                      background: currentMode === 'image' ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)' : 'rgba(255, 255, 255, 0.05)',
                      border: currentMode === 'image' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 36 }}>📷</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: currentMode === 'image' ? '#FFFFFF' : colors.text.primary }}>
                      图像生成
                    </div>
                  </button>
                  <button
                    onClick={() => setCurrentMode('video')}
                    style={{
                      flex: 1,
                      padding: '20px 16px',
                      background: currentMode === 'video' ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)' : 'rgba(255, 255, 255, 0.05)',
                      border: currentMode === 'video' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 36 }}>🎬</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: currentMode === 'video' ? '#FFFFFF' : colors.text.primary }}>
                      视频生成
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 新方案1: 浮动卡片 - 已移除，改用集成到对话框的 Tab */}
          {false && modeSelectorVariant === 'floating-cards' && (
            <div className={isTransitioning ? 'landing-content' : ''} style={{ marginBottom: 0, position: 'relative' }}>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
                {/* 图像生成卡片 */}
                <div
                  onClick={() => setCurrentMode('image')}
                  style={{
                    width: 240,
                    padding: '32px 28px',
                    background: currentMode === 'image'
                      ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)'
                      : colors.fill.light,
                    border: currentMode === 'image' ? 'none' : `1.5px solid ${colors.stroke.primary}`,
                    borderRadius: 20,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                    boxShadow: currentMode === 'image'
                      ? '0 12px 32px rgba(102, 126, 234, 0.4), 0 0 0 2px rgba(102, 126, 234, 0.25)'
                      : 'none',
                    transform: currentMode === 'image' ? 'translateY(-6px) scale(1.05)' : 'translateY(0) scale(1)',
                  }}
                  onMouseEnter={(e) => {
                    if (currentMode !== 'image') {
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                      e.currentTarget.style.background = colors.interactive.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentMode !== 'image') {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.background = colors.fill.light;
                    }
                  }}
                >
                  <div style={{ fontSize: 56, lineHeight: 1 }}>📷</div>
                  <div>
                    <div style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: currentMode === 'image' ? '#FFFFFF' : (colors.text.primary),
                      marginBottom: 6,
                      textAlign: 'center',
                      letterSpacing: '-0.01em'
                    }}>
                      图像生成
                    </div>
                    <div style={{
                      fontSize: 14,
                      fontFamily: 'var(--font-body)',
                      color: currentMode === 'image' ? 'rgba(255, 255, 255, 0.85)' : (colors.text.tertiary),
                      textAlign: 'center'
                    }}>
                      创建精美图片
                    </div>
                  </div>
                </div>

                {/* 中间分隔符 */}
                <div style={{
                  fontSize: 28,
                  fontFamily: 'var(--font-display)',
                  color: colors.stroke.primary,
                  fontWeight: 300
                }}>
                  或
                </div>

                {/* 视频生成卡片 */}
                <div
                  onClick={() => setCurrentMode('video')}
                  style={{
                    width: 240,
                    padding: '32px 28px',
                    background: currentMode === 'video'
                      ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)'
                      : colors.fill.light,
                    border: currentMode === 'video' ? 'none' : `1.5px solid ${colors.stroke.primary}`,
                    borderRadius: 20,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                    boxShadow: currentMode === 'video'
                      ? '0 12px 32px rgba(102, 126, 234, 0.4), 0 0 0 2px rgba(102, 126, 234, 0.25)'
                      : 'none',
                    transform: currentMode === 'video' ? 'translateY(-6px) scale(1.05)' : 'translateY(0) scale(1)',
                  }}
                  onMouseEnter={(e) => {
                    if (currentMode !== 'video') {
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                      e.currentTarget.style.background = colors.interactive.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentMode !== 'video') {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.background = colors.fill.light;
                    }
                  }}
                >
                  <div style={{ fontSize: 56, lineHeight: 1 }}>🎬</div>
                  <div>
                    <div style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: currentMode === 'video' ? '#FFFFFF' : (colors.text.primary),
                      marginBottom: 6,
                      textAlign: 'center',
                      letterSpacing: '-0.01em'
                    }}>
                      视频生成
                    </div>
                    <div style={{
                      fontSize: 14,
                      fontFamily: 'var(--font-body)',
                      color: currentMode === 'video' ? 'rgba(255, 255, 255, 0.85)' : (colors.text.tertiary),
                      textAlign: 'center'
                    }}>
                      生成动态视频
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 新方案2: 极简切换 - iOS风格 */}
          {modeSelectorVariant === 'minimal-toggle' && (
            <div style={{ marginBottom: 48, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: 8,
                background: colors.fill.default,
                borderRadius: 16,
              }}>
                <div
                  onClick={() => setCurrentMode('image')}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    background: currentMode === 'image' ? '#FFFFFF' : 'transparent',
                    color: currentMode === 'image' ? '#667EEA' : (colors.text.tertiary),
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: currentMode === 'image' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 20 }}>📷</span>
                  图像
                </div>
                <div
                  onClick={() => setCurrentMode('video')}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    background: currentMode === 'video' ? '#FFFFFF' : 'transparent',
                    color: currentMode === 'video' ? '#667EEA' : (colors.text.tertiary),
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: currentMode === 'video' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 20 }}>🎬</span>
                  视频
                </div>
              </div>
            </div>
          )}

          {/* 对话框区域 - 放在页面中间，Tab 已集成到对话框内 */}
          <div style={{ marginTop: 0, marginBottom: 80 }}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div
                className={`landing-page-dialog ${isTransitioning ? 'transitioning' : ''}`}
                style={{ width: '1100px' }}
              >
                <BottomDialog
                  isExpanded={dialogExpanded}
                  onToggle={() => setDialogExpanded(!dialogExpanded)}
                  selectedLayer={null}
                  selectedLayerIds={[]}
                  layers={[]}
                  editMode="normal"
                  onGenerate={handleGenerate}
                  isLandingPage={true}
                  modeSelectorStyle={modeSelectorStyle}
                />
              </div>
            </div>
          </div>

          {/* 最近项目 - 更轻量化的横向滚动 */}
          {/* 新用户（无项目）时也显示，但只有"新建项目"选项 */}
          <div style={{ marginBottom: 64 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: colors.text.primary,
                  margin: 0,
                  letterSpacing: '-0.01em'
                }}>最近项目</h2>
                {/* 测试用：隐藏按钮（仅在有项目时显示） */}
                {showRecentProjects && recentProjects.length > 0 && (
                <button
                  onClick={() => setShowRecentProjects(false)}
                  title="隐藏最近项目"
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: colors.fill.default,
                    color: colors.text.tertiary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 400,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.interactive.active;
                    e.currentTarget.style.color = colors.text.secondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.fill.default;
                    e.currentTarget.style.color = colors.text.tertiary;
                  }}
                >
                  新用户状态
                </button>
                )}
              </div>
              {showRecentProjects && recentProjects.length > 0 && (
              <button
                onClick={() => setShowAllProjects(true)}
                style={{
                  fontSize: 13,
                  color: colors.text.tertiary,
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = colors.text.secondary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = colors.text.tertiary)}
              >
                查看全部 →
              </button>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 8,
              }}
            >
              {/* 新建项目卡片 */}
              <div
                onClick={onCreateProject}
                style={{
                  width: 180,
                  height: 140,
                  flexShrink: 0,
                  background: colors.fill.default,
                  border: `1.5px dashed ${colors.stroke.primary}`,
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.stroke.primary;
                  e.currentTarget.style.background = colors.interactive.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.stroke.primary;
                  e.currentTarget.style.background = colors.fill.default;
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    color: colors.text.tertiary,
                    marginBottom: 4,
                  }}
                >
                  +
                </div>
                <span style={{ fontSize: 12, color: colors.text.tertiary }}>新建项目</span>
              </div>

              {/* 项目卡片 - 仅在有项目且显示时渲染 */}
              {showRecentProjects && recentProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="project-card"
                  style={{
                    width: 180,
                    flexShrink: 0,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onMouseEnter={() => setHoveredProjectId(project.id)}
                  onMouseLeave={() => setHoveredProjectId(null)}
                >
                  <div
                    className="project-card-image"
                    style={{
                      width: '100%',
                      height: 140,
                      background: isLightTheme
                        ? 'linear-gradient(135deg, #f0f2f5 0%, #e8ecf1 100%)'
                        : 'linear-gradient(135deg, #1a1c28 0%, #252837 100%)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      marginBottom: 12,
                      border: `1px solid ${colors.stroke.secondary}`,
                      boxShadow: isLightTheme
                        ? '0 4px 12px rgba(0, 0, 0, 0.08)'
                        : '0 4px 20px rgba(0, 0, 0, 0.3)',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={project.thumbnailUrl}
                      alt={project.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {/* 悬浮渐变遮罩 */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '50%',
                      background: 'linear-gradient(to top, rgba(0, 0, 0, 0.4), transparent)',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                      pointerEvents: 'none',
                    }} className="project-overlay" />

                    {/* 删除按钮 - hover时显示 */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[LandingPage] Delete clicked for project:', project);
                        setDeleteConfirmProject(project);
                      }}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'rgba(60, 60, 60, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        opacity: hoveredProjectId === project.id ? 1 : 0,
                        transform: hoveredProjectId === project.id ? 'scale(1)' : 'scale(0.8)',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(8px)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(80, 80, 80, 0.95)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(60, 60, 60, 0.9)';
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    color: colors.text.primary,
                    marginBottom: 4,
                    letterSpacing: '-0.01em'
                  }}>{project.name}</div>
                  <div style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    color: colors.text.tertiary
                  }}>更新於 {project.updatedAt}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 灵感发现 - 更现代的瀑布流设计 */}
          {showScrollContent && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: colors.text.primary,
                  marginBottom: 24,
                  letterSpacing: '-0.01em'
                }}>灵感发现</h2>

                {/* 分类标签 */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 32, overflowX: 'auto', paddingBottom: 8 }}>
                  {['全部', '品牌设计', '界面视觉', '插画', 'UI设计', '角色设计', '节庆设计', '建筑设计'].map((category, index) => (
                    <button
                      key={category}
                      style={{
                        padding: '8px 18px',
                        background: index === 0
                          ? (isLightTheme ? '#181818' : '#FFFFFF')
                          : colors.stroke.secondary,
                        border: 'none',
                        borderRadius: 20,
                        cursor: 'pointer',
                        fontSize: 14,
                        color: index === 0
                          ? (isLightTheme ? '#FFFFFF' : '#181818')
                          : colors.text.secondary,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (index !== 0) {
                          e.currentTarget.style.background = colors.stroke.primary;
                        } else {
                          e.currentTarget.style.opacity = '0.9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (index !== 0) {
                          e.currentTarget.style.background = colors.stroke.secondary;
                        } else {
                          e.currentTarget.style.opacity = '1';
                        }
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* 瀑布流布局 - 4列布局，更紧凑的间距 */}
              <div
                style={{
                  columnCount: 4,
                  columnGap: 16,
                  marginBottom: 60,
                }}
              >
                {inspirationItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      breakInside: 'avoid',
                      marginBottom: 16,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        background: colors.fill.light,
                        borderRadius: 10,
                        overflow: 'hidden',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                        const overlay = e.currentTarget.querySelector('.image-overlay') as HTMLElement;
                        if (overlay) overlay.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                        const overlay = e.currentTarget.querySelector('.image-overlay') as HTMLElement;
                        if (overlay) overlay.style.opacity = '0';
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt=""
                        style={{
                          width: '100%',
                          display: 'block',
                        }}
                      />
                      {/* 悬停覆盖层 */}
                      <div
                        className="image-overlay"
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '12px',
                          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 100%)',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#FFFFFF',
                            }}
                          >
                            {item.author.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#FFFFFF' }}>{item.author}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="rgba(255, 255, 255, 0.8)" />
                            </svg>
                            <span style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 500 }}>{item.likes}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="2" />
                              <circle cx="12" cy="12" r="3" fill="rgba(255, 255, 255, 0.8)" />
                            </svg>
                            <span style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 500 }}>{item.views}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
        )}
        </div>
      </div>

      <DeleteConfirmModal
        visible={!!deleteConfirmProject}
        title="删除项目"
        content={`确定要删除「${deleteConfirmProject?.name || ''}」吗？此操作无法撤销。`}
        onOk={() => {
          if (deleteConfirmProject) {
            onShowDeleteSuccess?.();
            onDeleteProject?.(deleteConfirmProject.id);
            setDeleteConfirmProject(null);
          }
        }}
        onCancel={() => setDeleteConfirmProject(null)}
      />

    </>
  );
};

export default LandingPage;
