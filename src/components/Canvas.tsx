import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';
import { ImageLayer, Comment, EditMode, GenerationTask } from '../types';
import ImageToolbar from './ImageToolbar';
// 导入生成遮罩组件
import GeneratingOverlay from './GeneratingOverlay';
import DetailPanelSimple from './DetailPanelSimple';
import LibraryDialog from './LibraryDialog';
import ContextMenu, { ContextMenuEntry } from './ContextMenu';
import { useTheme, type ThemeStyle, getThemeStyles, isLightTheme } from '../contexts/ThemeContext';
import iconInfo from '../assets/icons/info_circle.svg?url';
import iconImage from '../assets/icons/image.svg?url';
import iconVideo from '../assets/icons/video.svg?url';
import libraryIcon from '../assets/icons/library-icon.svg?url';

// TODO: 视频控制组件 (VideoControls) - 等待视频功能完整实现后添加

interface CanvasProps {
  layers: ImageLayer[];
  selectedLayerId: string | null;
  selectedLayerIds?: string[];
  selectedTaskIds?: string[];
  onLayerSelect: (layerId: string | null, isMultiSelect?: boolean) => void;
  onTaskSelect?: (taskId: string | null, isMultiSelect?: boolean) => void;
  onTaskUpdate?: (taskId: string, position: { x: number; y: number }) => void;
  onLayerUpdate: (layerId: string, updates: Partial<ImageLayer>) => void;
  onLayersBatchUpdate?: (updates: Array<{ layerId: string; updates: Partial<ImageLayer> }>) => void;
  onLayerAdd: (layer: Omit<ImageLayer, 'id'>) => string;
  onLayerDelete: (layerId: string) => void;
  onLayeredDemo?: () => void;
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  editMode: EditMode;
  comments: Comment[];
  onCommentAdd: (comment: Omit<Comment, 'id' | 'createdAt'>) => void;
  onCommentUpdate: (commentId: string, updates: Partial<Comment>) => void;
  onFillToDialog?: (imageUrl: string | string[]) => void;
  onRemix?: (layer: ImageLayer) => void;
  onEdit?: (layer: ImageLayer, quickEditPrompt?: string) => void;
  onFillToKeyframes?: () => void;
  onFillToImageGen?: () => void;
  onMergeLayers?: () => void;
  generationTasks?: GenerationTask[];
  onGetCanvasCenter?: (callback: () => { x: number; y: number }) => void;
  onGetCanvasToScreen?: (callback: (canvasPos: { x: number; y: number }) => { x: number; y: number }) => void;
  onGetScreenToCanvas?: (callback: (screenPos: { x: number; y: number }) => { x: number; y: number }) => void;
  hasCompletedOnboarding?: boolean;
}

interface ImageNodeProps {
  layer: ImageLayer;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ImageLayer>) => void;
  editMode: EditMode;
  comments: Comment[];
  onCommentAdd: (comment: Omit<Comment, 'id' | 'createdAt'>) => void;
  onCommentUpdate: (commentId: string, updates: Partial<Comment>) => void;
  onFillToDialog?: (imageUrl: string | string[]) => void;
}

const ImageNode: React.FC<ImageNodeProps> = ({
  layer,
  isSelected,
  onSelect,
  onUpdate,
  editMode,
  comments,
  onCommentAdd,
  onCommentUpdate,
  onFillToDialog,
}) => {
  const { themeStyle } = useTheme();
  const theme = getThemeStyles(themeStyle);

  const [image, setImage] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [, setIsVideoPlaying] = useState(false); // isVideoPlaying unused, kept for future use
  const groupRef = useRef<any>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragActivatedRef = useRef(false); // 标记拖动是否已激活（距离是否超过阈值）
  const lastPosPosRef = useRef<{ x: number; y: number } | null>(null); // 上一次的位置

  useEffect(() => {
    if (layer.type === 'video') {
      // 创建 video 元素
      const video = document.createElement('video');
      // 注意：不设置 crossOrigin 以避免某些视频源的 CORS 问题
      // 如果需要导出 canvas，则需要确保视频源支持 CORS
      video.loop = true;
      video.muted = true; // 默认静音以允许自动播放
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');

      video.onloadedmetadata = () => {
        console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
        // 元数据加载后就可以设置 image
        setImage(video);
      };

      video.onloadeddata = () => {
        console.log('Video data loaded');
        setIsVideoPlaying(false);
        // 跳转到第一帧以显示预览
        video.currentTime = 0.1;
      };

      video.onerror = (e) => {
        console.error('Video load error:', e, 'URL:', layer.url);
        setImage(null);
      };

      // 设置 src 并加载
      video.src = layer.url;
      video.load();

      return () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
        setIsVideoPlaying(false);
      };
    } else {
      // 创建图片元素
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setImage(img);
      img.onerror = () => setImage(null);
      img.src = layer.url;
    }
  }, [layer.url, layer.type]);

  // 如果是视频，需要持续更新帧（播放时）或初始渲染（暂停时）
  useEffect(() => {
    if (layer.type === 'video' && image && image instanceof HTMLVideoElement) {
      let anim: Konva.Animation | null = null;

      const handlePlay = () => {
        console.log('Video play event');
        // 播放时持续更新帧
        const layer = groupRef.current?.getLayer();
        if (layer) {
          anim = new Konva.Animation(() => {
            // 动画循环会自动触发重绘
          }, layer);
          anim.start();
        }
      };

      const handlePause = () => {
        console.log('Video pause event');
        // 暂停时停止动画并触发一次重绘
        if (anim) {
          anim.stop();
          anim = null;
        }
        groupRef.current?.getLayer()?.batchDraw();
      };

      // 视频准备好时触发一次重绘以显示第一帧
      const handleCanPlay = () => {
        console.log('Video can play, triggering redraw');
        groupRef.current?.getLayer()?.batchDraw();
      };

      // 视频 seek 完成后重绘（显示第一帧）
      const handleSeeked = () => {
        console.log('Video seeked, triggering redraw');
        groupRef.current?.getLayer()?.batchDraw();
      };

      // 视频时间更新时重绘（确保帧显示）
      const handleTimeUpdate = () => {
        if (image.paused) {
          groupRef.current?.getLayer()?.batchDraw();
        }
      };

      image.addEventListener('play', handlePlay);
      image.addEventListener('pause', handlePause);
      image.addEventListener('canplay', handleCanPlay);
      image.addEventListener('seeked', handleSeeked);
      image.addEventListener('timeupdate', handleTimeUpdate);

      // 如果视频正在播放，立即启动动画
      if (!image.paused) {
        handlePlay();
      } else {
        // 暂停状态也要触发一次重绘
        setTimeout(() => {
          groupRef.current?.getLayer()?.batchDraw();
        }, 200);
      }

      return () => {
        image.removeEventListener('play', handlePlay);
        image.removeEventListener('pause', handlePause);
        image.removeEventListener('canplay', handleCanPlay);
        image.removeEventListener('seeked', handleSeeked);
        image.removeEventListener('timeupdate', handleTimeUpdate);
        if (anim) {
          anim.stop();
        }
      };
    }
  }, [layer.type, image]);

  const layerComments = comments.filter(c => c.layerId === layer.id);

  // 计算显示尺寸（视频和图片的宽高获取方式不同）
  let displayWidth = layer.width;
  let displayHeight = layer.height;

  if (image) {
    let aspectRatio = 1;
    if (image instanceof HTMLVideoElement) {
      aspectRatio = image.videoWidth && image.videoHeight ? image.videoWidth / image.videoHeight : 1;
    } else {
      aspectRatio = image.width && image.height ? image.width / image.height : 1;
    }
    displayWidth = layer.height * aspectRatio;
    displayHeight = layer.height;
  }

  const handleDragStart = useCallback((_e: any) => {
    if (!layer.locked && isSelected) {
      setIsDragging(true);
      onSelect();
      // 记录拖动起始位置
      if (groupRef.current) {
        dragStartPosRef.current = { x: groupRef.current.x(), y: groupRef.current.y() };
        lastPosPosRef.current = { x: groupRef.current.x(), y: groupRef.current.y() };
      }
      dragActivatedRef.current = false; // 拖动开始时，还未激活
    }
  }, [layer.locked, isSelected, onSelect]);

  // 当编辑模式改变时，重置拖拽状态
  useEffect(() => {
    setIsDragging(false);
    dragStartPosRef.current = null;
    dragActivatedRef.current = false;
  }, [editMode]);

  // 监听拖动过程中的距离，只有超过阈值时才允许移动
  useEffect(() => {
    if (!isDragging || !dragStartPosRef.current || !groupRef.current) return;

    const DRAG_THRESHOLD = 5;
    let animationFrameId: number | null = null;

    const checkDragDistance = () => {
      const currentX = groupRef.current.x();
      const currentY = groupRef.current.y();
      const startPos = dragStartPosRef.current;

      if (!startPos) return;

      const dragDistance = Math.sqrt(
        Math.pow(currentX - startPos.x, 2) + Math.pow(currentY - startPos.y, 2)
      );

      // 如果还没激活拖动，且距离 < 阈值，恢复到起始位置
      if (!dragActivatedRef.current && dragDistance < DRAG_THRESHOLD) {
        groupRef.current.x(startPos.x);
        groupRef.current.y(startPos.y);
      } else if (dragDistance >= DRAG_THRESHOLD) {
        // 距离达到阈值，激活拖动
        dragActivatedRef.current = true;
      }

      if (isDragging) {
        animationFrameId = requestAnimationFrame(checkDragDistance);
      }
    };

    animationFrameId = requestAnimationFrame(checkDragDistance);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDragging]);

  const handleDragEnd = useCallback((e: any) => {
    setIsDragging(false);

    const endX = e.target.x();
    const endY = e.target.y();
    const startPos = dragStartPosRef.current;

    // 检查拖动距离是否达到阈值
    const dragDistance = startPos ? Math.sqrt(
      Math.pow(endX - startPos.x, 2) + Math.pow(endY - startPos.y, 2)
    ) : 0;

    const DRAG_THRESHOLD = 5;

    // 只有拖动距离足够时才更新位置
    if (dragDistance >= DRAG_THRESHOLD) {
      onUpdate({
        x: endX,
        y: endY,
      });
    } else {
      // 距离太小，恢复到原始位置
      if (startPos && groupRef.current) {
        groupRef.current.x(startPos.x);
        groupRef.current.y(startPos.y);
      }
    }

    dragStartPosRef.current = null;
    dragActivatedRef.current = false;
  }, [onUpdate]);

  const handleMouseDown = useCallback((e: any) => {
    if (editMode === 'edit' && isSelected) {
      const target = e.target;
      // 检查是否点击在图片上
      if (target && (target.getClassName() === 'Image' || target.getParent() === groupRef.current)) {
        const stage = target.getStage();
        if (!stage) return;
        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;
        const groupPos = groupRef.current.getAbsolutePosition();
        const scale = stage.scaleX();
        const relativePos = {
          x: Math.max(0, Math.min(displayWidth, (pointerPos.x - groupPos.x) / scale)),
          y: Math.max(0, Math.min(displayHeight, (pointerPos.y - groupPos.y) / scale)),
        };
        setSelectionStart(relativePos);
        setSelectionEnd(relativePos);
      }
    }
  }, [editMode, isSelected, displayWidth, displayHeight]);

  // 不再在图层上处理滚轮事件，让滚轮事件传递到画布进行缩放
  // 如果需要通过滚轮缩放单个图片，可以使用其他方式（如按住特定键+滚轮）

  useEffect(() => {
    if (editMode === 'edit' && isSelected && selectionStart) {
      const updateSelectionEnd = () => {
        const stage = groupRef.current?.getStage();
        if (!stage) return;
        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;
        const groupPos = groupRef.current.getAbsolutePosition();
        const scale = stage.scaleX();
        const relativePos = {
          x: Math.max(0, Math.min(displayWidth, (pointerPos.x - groupPos.x) / scale)),
          y: Math.max(0, Math.min(displayHeight, (pointerPos.y - groupPos.y) / scale)),
        };
        setSelectionEnd(relativePos);
      };

      const handleMouseMove = () => {
        updateSelectionEnd();
      };

      // 监听触控板平移事件，更新框选位置
      // 使用 requestAnimationFrame 确保在 stage 位置更新后再更新框选位置
      const handleCanvasPan = () => {
        requestAnimationFrame(() => {
          updateSelectionEnd();
        });
      };

      const handleMouseUp = () => {
        if (selectionStart && selectionEnd) {
          const x = Math.min(selectionStart.x, selectionEnd.x);
          const y = Math.min(selectionStart.y, selectionEnd.y);
          const width = Math.abs(selectionEnd.x - selectionStart.x);
          const height = Math.abs(selectionEnd.y - selectionStart.y);

          if (width > 10 && height > 10) {
            onCommentAdd({
              layerId: layer.id,
              x,
              y,
              width,
              height,
              text: '',
            });
          }

          setSelectionStart(null);
          setSelectionEnd(null);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('canvasPan', handleCanvasPan);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('canvasPan', handleCanvasPan);
      };
    }
  }, [editMode, isSelected, selectionStart, selectionEnd, layer.id, displayWidth, displayHeight, onCommentAdd]);

  useEffect(() => {
    if (isResizing && !layer.locked) {
      const handleMouseMove = (_e: MouseEvent) => {
        const stage = groupRef.current?.getStage();
        if (!stage) return;
        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;

        const groupPos = groupRef.current.getAbsolutePosition();
        const scale = stage.scaleX();
        const mouseX = (pointerPos.x - groupPos.x) / scale;
        const mouseY = (pointerPos.y - groupPos.y) / scale;

        let newHeight = layer.height;
        let newWidth = layer.width;
        let newX = layer.x;
        let newY = layer.y;

        // Maintain aspect ratio based on original image
        const aspectRatio = image ? image.width / image.height : 1;

        if (isResizing === 'br') {
          // 右下角：从右下角拉伸
          newHeight = Math.max(50, mouseY);
          newWidth = newHeight * aspectRatio;
        } else if (isResizing === 'bl') {
          // 左下角：从左下角拉伸，需要调整x位置
          newHeight = Math.max(50, mouseY);
          newWidth = newHeight * aspectRatio;
          newX = layer.x + layer.width - newWidth;
        } else if (isResizing === 'tr') {
          // 右上角：从右上角拉伸，需要调整y位置
          newHeight = Math.max(50, layer.height - mouseY);
          newWidth = newHeight * aspectRatio;
          newY = layer.y + layer.height - newHeight;
        } else if (isResizing === 'tl') {
          // 左上角：从左上角拉伸，需要调整x和y位置
          newHeight = Math.max(50, layer.height - mouseY);
          newWidth = newHeight * aspectRatio;
          newX = layer.x + layer.width - newWidth;
          newY = layer.y + layer.height - newHeight;
        }

        onUpdate({ width: newWidth, height: newHeight, x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsResizing(null);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, layer.locked, image, layer.height, layer.width, layer.x, layer.y, onUpdate]);

  if (!layer.visible) return null;

  return (
      <Group
        ref={groupRef}
        x={layer.x}
        y={layer.y}
        draggable={isSelected && !layer.locked && editMode === 'normal' && !isResizing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          // 停止事件冒泡，防止触发 Stage 的 mouseDown
          e.evt.stopPropagation();
          e.evt.preventDefault();

          // Cmd/Ctrl + 左键：快速填入对话框
          if ((e.evt.metaKey || e.evt.ctrlKey) && onFillToDialog) {
            onFillToDialog(layer.url);
            return;
          }

          // 延迟选中，避免立即触发拖拽
          setTimeout(() => {
            onSelect();
          }, 0);
        }}
        onDblClick={(e) => {
          e.evt.stopPropagation();
          e.evt.preventDefault();

          // 双击视频播放/暂停
          if (layer.type === 'video' && image && image instanceof HTMLVideoElement) {
            if (image.paused) {
              image.play().catch(err => console.error('Video play error:', err));
            } else {
              image.pause();
            }
          }
        }}
        onTap={(e) => {
          // 停止事件冒泡，防止触发 Stage 的 mouseDown
          e.evt?.stopPropagation();
          e.evt?.preventDefault();
          onSelect();
        }}
        onMouseDown={handleMouseDown}
      >
      {image && (
        <>
          <KonvaImage
            image={image}
            width={displayWidth}
            height={displayHeight}
            opacity={isDragging ? 0.8 : 1}
          />
        </>
      )}
      {isSelected && (
        <Rect
          x={-2}
          y={-2}
          width={displayWidth + 4}
          height={displayHeight + 4}
          stroke={(theme as any).selectionStroke}
          strokeWidth={4}
          fill="transparent"
          listening={false}
        />
      )}
      {editMode === 'edit' && isSelected && selectionStart && selectionEnd && (
        <Rect
          x={Math.min(selectionStart.x, selectionEnd.x)}
          y={Math.min(selectionStart.y, selectionEnd.y)}
          width={Math.abs(selectionEnd.x - selectionStart.x)}
          height={Math.abs(selectionEnd.y - selectionStart.y)}
          stroke={(theme as any).selectionStroke}
          strokeWidth={2}
          fill={(theme as any).selectionFill}
          dash={[5, 5]}
          listening={false}
        />
      )}
      {isSelected && !layer.locked && (
        <>
          {/* Bottom-right resize handle */}
          <Rect
            x={displayWidth - 8}
            y={displayHeight - 8}
            width={16}
            height={16}
            fill={(theme as any).handleFill}
            stroke={(theme as any).handleStroke}
            strokeWidth={1}
            cornerRadius={2}
            listening={true}
            cursor="nwse-resize"
            onMouseDown={(e) => {
              e.cancelBubble = true;
              setIsResizing('br');
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              setIsResizing('br');
            }}
            opacity={isResizing === 'br' ? 1 : 0.8}
          />
          {/* Bottom-left resize handle */}
          <Rect
            x={-8}
            y={displayHeight - 8}
            width={16}
            height={16}
            fill={(theme as any).handleFill}
            stroke={(theme as any).handleStroke}
            strokeWidth={1}
            cornerRadius={2}
            listening={true}
            cursor="nesw-resize"
            onMouseDown={(e) => {
              e.cancelBubble = true;
              setIsResizing('bl');
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              setIsResizing('bl');
            }}
            opacity={isResizing === 'bl' ? 1 : 0.8}
          />
          {/* Top-right resize handle */}
          <Rect
            x={displayWidth - 8}
            y={-8}
            width={16}
            height={16}
            fill={(theme as any).handleFill}
            stroke={(theme as any).handleStroke}
            strokeWidth={1}
            cornerRadius={2}
            listening={true}
            cursor="nesw-resize"
            onMouseDown={(e) => {
              e.cancelBubble = true;
              setIsResizing('tr');
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              setIsResizing('tr');
            }}
            opacity={isResizing === 'tr' ? 1 : 0.8}
          />
          {/* Top-left resize handle */}
          <Rect
            x={-8}
            y={-8}
            width={16}
            height={16}
            fill={(theme as any).handleFill}
            stroke={(theme as any).handleStroke}
            strokeWidth={1}
            cornerRadius={2}
            listening={true}
            cursor="nwse-resize"
            onMouseDown={(e) => {
              e.cancelBubble = true;
              setIsResizing('tl');
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              setIsResizing('tl');
            }}
            opacity={isResizing === 'tl' ? 1 : 0.8}
          />
        </>
      )}
      {layerComments.map(comment => (
        <Group key={comment.id}>
          <Rect
            x={comment.x}
            y={comment.y}
            width={comment.width}
            height={comment.height}
            stroke="#1677FF"
            strokeWidth={2}
            fill="rgba(22, 119, 255, 0.1)"
            dash={[5, 5]}
            listening={false}
          />
          <Line
            points={[comment.x + comment.width / 2, comment.y + comment.height, comment.x + comment.width / 2, comment.y + comment.height + 20]}
            stroke="#1677FF"
            strokeWidth={2}
            listening={false}
          />
          {!comment.isEditing && (
            <>
              <Rect
                x={comment.x + comment.width / 2 - 60}
                y={comment.y + comment.height + 20}
                width={120}
                height={comment.text ? Math.max(40, comment.text.split('\n').length * 16 + 16) : 40}
                fill="#2A2A2A"
                cornerRadius={8}
                listening={true}
                onClick={() => onCommentUpdate(comment.id, { isEditing: true })}
                onTap={() => onCommentUpdate(comment.id, { isEditing: true })}
                shadowBlur={10}
                shadowColor="rgba(0, 0, 0, 0.5)"
              />
              <Text
                x={comment.x + comment.width / 2 - 55}
                y={comment.y + comment.height + 28}
                text={comment.text || '点击编辑'}
                fontSize={12}
                fill="rgba(255, 255, 255, 0.85)"
                listening={false}
                width={110}
                wrap="word"
              />
            </>
          )}
        </Group>
      ))}
    </Group>
  );
};

const Canvas: React.FC<CanvasProps> = ({
  layers,
  selectedLayerId,
  selectedLayerIds: _selectedLayerIds = [],
  selectedTaskIds = [],
  onLayerSelect,
  onTaskSelect,
  onTaskUpdate,
  onLayerUpdate,
  onLayersBatchUpdate,
  onLayerAdd,
  onLayerDelete: _onLayerDelete,
  onLayeredDemo,
  zoom,
  onZoomChange,
  editMode,
  comments,
  onCommentAdd,
  onCommentUpdate,
  onFillToDialog,
  onRemix,
  onEdit,
  onFillToKeyframes,
  onFillToImageGen,
  onMergeLayers,
  generationTasks = [],
  onGetCanvasCenter,
  onGetCanvasToScreen,
  onGetScreenToCanvas,
  hasCompletedOnboarding = false,
}) => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 使用全局主题
  const { themeStyle, setThemeStyle } = useTheme();
  const theme = getThemeStyles(themeStyle);
  const [showStyleSwitcher, setShowStyleSwitcher] = useState(true);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [detailPanelLayer, setDetailPanelLayer] = useState<ImageLayer | null>(null);
  const [detailPanelAnchor, setDetailPanelAnchor] = useState<{ x: number; y: number } | null>(null); // 用于 popover/tooltip 的锚点位置
  const [detailPanelLayerPosition, setDetailPanelLayerPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // 用于 tooltip 的图层位置
  const [detailPanelManualClosed, setDetailPanelManualClosed] = useState(false); // 用户是否手动关闭了详情面板

  // 当选中图片变化时，自动显示/隐藏详情面板
  useEffect(() => {
    if (selectedLayerId) {
      // 选中单个图片时，如果没有手动关闭，则显示详情面板
      const layer = layers.find(l => l.id === selectedLayerId);
      if (layer && !detailPanelManualClosed) {
        setDetailPanelLayer(layer);
        setShowDetailPanel(true);
      } else if (layer && showDetailPanel) {
        // 即使手动关闭了，也更新当前显示的图层信息
        setDetailPanelLayer(layer);
      }
    } else {
      // 取消选中时，隐藏详情面板
      setShowDetailPanel(false);
      setDetailPanelLayer(null);
    }
  }, [selectedLayerId, layers, detailPanelManualClosed]);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 资料库弹窗状态
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [libraryInsertPosition, setLibraryInsertPosition] = useState<{ x: number; y: number } | null>(null);


  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // 上传本地档案
  const handleUploadLocal = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = e.target.files;
      if (files && contextMenu) {
        const scale = zoom / 100;
        const canvasX = (contextMenu.x - stagePos.x) / scale;
        const canvasY = (contextMenu.y - stagePos.y) / scale;

        Array.from(files).forEach((file: any, index: number) => {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            const img = new window.Image();
            img.onload = () => {
              onLayerAdd({
                x: canvasX + index * 30,
                y: canvasY + index * 30,
                width: img.width,
                height: img.height,
                url: event.target.result,
                name: file.name,
                visible: true,
                locked: false,
                selected: false,
              });
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
    setContextMenu(null);
  }, [contextMenu, zoom, stagePos, onLayerAdd]);

  // 从资料库导入
  const handleImportFromLibrary = useCallback(() => {
    if (contextMenu) {
      const scale = zoom / 100;
      const canvasX = (contextMenu.x - stagePos.x) / scale;
      const canvasY = (contextMenu.y - stagePos.y) / scale;
      setLibraryInsertPosition({ x: canvasX, y: canvasY });
    }
    setShowLibraryDialog(true);
    setContextMenu(null);
  }, [contextMenu, zoom, stagePos]);

  // 提供坐标转换函数给父组件
  useEffect(() => {
    if (onGetCanvasCenter) {
      onGetCanvasCenter(() => {
        // 返回画布中心坐标（画布坐标系）
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;
        const scale = zoom / 100;
        return {
          x: (viewWidth / 2 - stagePos.x) / scale,
          y: (viewHeight / 2 - stagePos.y) / scale,
        };
      });
    }

    if (onGetCanvasToScreen) {
      onGetCanvasToScreen((canvasPos: { x: number; y: number }) => {
        // 将画布坐标转换为屏幕坐标
        const scale = zoom / 100;
        return {
          x: canvasPos.x * scale + stagePos.x,
          y: canvasPos.y * scale + stagePos.y,
        };
      });
    }

    if (onGetScreenToCanvas) {
      onGetScreenToCanvas((screenPos: { x: number; y: number }) => {
        // 将屏幕坐标转换为画布坐标
        const scale = zoom / 100;
        return {
          x: (screenPos.x - stagePos.x) / scale,
          y: (screenPos.y - stagePos.y) / scale,
        };
      });
    }
  }, [onGetCanvasCenter, onGetCanvasToScreen, onGetScreenToCanvas, zoom, stagePos]);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldZoom = zoom;
    const wheelEvent = e.evt;
    
    // 检测触控板平移：deltaX 或 deltaY 不为 0，且不是按住 Ctrl/Cmd 的缩放操作
    const isPanning = (wheelEvent.deltaX !== 0 || wheelEvent.deltaY !== 0) && 
                      !wheelEvent.ctrlKey && 
                      !wheelEvent.metaKey;
    
    // 检测缩放：按住 Ctrl/Cmd 或者 deltaY 的绝对值远大于 deltaX（触控板双指缩放）
    const isZooming = wheelEvent.ctrlKey ||
                      wheelEvent.metaKey ||
                      (Math.abs(wheelEvent.deltaY) > Math.abs(wheelEvent.deltaX) * 5 && Math.abs(wheelEvent.deltaY) > 5);
    
    if (isPanning && !isZooming) {
      // 触控板平移：直接更新画板位置
      const newPos = {
        x: stagePos.x - wheelEvent.deltaX,
        y: stagePos.y - wheelEvent.deltaY,
      };
      setStagePos(newPos);
      
      // 触发自定义事件，通知框选功能更新位置
      // 传递鼠标位置信息，确保框选位置与鼠标位置保持一致
      const pointer = stage.getPointerPosition();
      const customEvent = new CustomEvent('canvasPan', {
        detail: { 
          deltaX: wheelEvent.deltaX, 
          deltaY: wheelEvent.deltaY,
          clientX: wheelEvent.clientX,
          clientY: wheelEvent.clientY,
          pointerX: pointer?.x,
          pointerY: pointer?.y
        }
      });
      window.dispatchEvent(customEvent);
    } else if (isZooming) {
      // 缩放操作
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stagePos.x) / (oldZoom / 100),
        y: (pointer.y - stagePos.y) / (oldZoom / 100),
      };

      const newZoom = wheelEvent.deltaY > 0 ? oldZoom * 0.95 : oldZoom * 1.05;
      const clampedZoom = Math.max(10, Math.min(200, newZoom));

      if (onZoomChange) {
        onZoomChange(clampedZoom);
      }

      const newPos = {
        x: pointer.x - mousePointTo.x * (clampedZoom / 100),
        y: pointer.y - mousePointTo.y * (clampedZoom / 100),
      };
      setStagePos(newPos);
    }
  }, [zoom, stagePos, onZoomChange]);

  const handleStageMouseDown = useCallback((e: any) => {
    // 关闭右键菜单
    setContextMenu(null);

    if (e.target === e.target.getStage()) {
      // 檢查是否按住 Ctrl/Cmd 鍵
      const isMultiSelect = e.evt.ctrlKey || e.evt.metaKey;

      // 如果不是多選模式，清除現有選中
      if (!isMultiSelect) {
        onLayerSelect(null);
      }

      // 啟動框選
      setIsSelecting(true);
      setDragStart({
        x: e.evt.clientX,
        y: e.evt.clientY,
      });
    }
  }, [onLayerSelect]);

  const handleStageMouseMove = useCallback((e: any) => {
    if (isSelecting) {
      // 更新選擇框
      const currentX = e.evt.clientX;
      const currentY = e.evt.clientY;

      const minX = Math.min(dragStart.x, currentX);
      const minY = Math.min(dragStart.y, currentY);
      const maxX = Math.max(dragStart.x, currentX);
      const maxY = Math.max(dragStart.y, currentY);

      setSelectionBox({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    } else if (isDragging) {
      const newPos = {
        x: e.evt.clientX - dragStart.x,
        y: e.evt.clientY - dragStart.y,
      };
      setStagePos(newPos);
    }
  }, [isSelecting, isDragging, dragStart]);

  const handleStageMouseUp = useCallback(() => {
    if (isSelecting && selectionBox) {
      // 找出在選擇框內的所有圖片
      const selectedIds: string[] = [];

      layers.forEach(layer => {
        // 隐藏的图层不能被选中
        if (!layer.visible) {
          return;
        }

        const layerScreenX = layer.x * (zoom / 100) + stagePos.x;
        const layerScreenY = layer.y * (zoom / 100) + stagePos.y;
        const layerScreenWidth = layer.width * (zoom / 100);
        const layerScreenHeight = layer.height * (zoom / 100);

        // 檢查圖片是否與選擇框相交
        if (
          layerScreenX < selectionBox.x + selectionBox.width &&
          layerScreenX + layerScreenWidth > selectionBox.x &&
          layerScreenY < selectionBox.y + selectionBox.height &&
          layerScreenY + layerScreenHeight > selectionBox.y
        ) {
          selectedIds.push(layer.id);
        }
      });

      // 更新選中的圖層（多選模式下合併選擇）
      if (selectedIds.length > 0) {
        selectedIds.forEach((id, index) => {
          onLayerSelect(id, index > 0 || _selectedLayerIds.length > 0);
        });
      }

      setSelectionBox(null);
    }

    setIsSelecting(false);
    setIsDragging(false);
  }, [isSelecting, selectionBox, layers, zoom, stagePos, onLayerSelect, _selectedLayerIds]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const pointerPos = stage.getPointerPosition();
          const stagePos = stage.position();
          const scale = stage.scaleX();

          const x = (pointerPos.x - stagePos.x) / scale;
          const y = (pointerPos.y - stagePos.y) / scale;

          const layerId = onLayerAdd({
            name: file.name,
            url: event.target?.result as string,
            x,
            y,
            width: img.width,
            height: img.height,
            visible: true,
            locked: false,
            selected: false,
          });

          onLayerSelect(layerId);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, [onLayerAdd, onLayerSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'transparent',
        overflow: 'hidden',
        zIndex: 1,
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onContextMenu={handleContextMenu}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = new window.Image();
              img.onload = () => {
                const stage = stageRef.current;
                if (!stage) return;

                const pointerPos = stage.getPointerPosition() || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                const stagePos = stage.position();
                const scale = stage.scaleX();

                const x = (pointerPos.x - stagePos.x) / scale;
                const y = (pointerPos.y - stagePos.y) / scale;

                const layerId = onLayerAdd({
                  name: file.name,
                  url: event.target?.result as string,
                  x,
                  y,
                  width: img.width,
                  height: img.height,
                  visible: true,
                  locked: false,
                  selected: false,
                });

                onLayerSelect(layerId);
              };
              img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
          });
        }}
      />
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={zoom / 100}
        scaleY={zoom / 100}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : editMode === 'edit' ? 'crosshair' : 'default', backgroundColor: 'transparent' }}
      >
        <Layer>
          {/* 网格背景 - 小网格 + 大网格 */}
          {(() => {
            const smallGridSize = 20; // 小网格大小（画布坐标系）
            const largeGridSize = 100; // 大网格大小（画布坐标系）
            const viewWidth = window.innerWidth;
            const viewHeight = window.innerHeight;
            const scale = zoom / 100;

            // 将屏幕坐标转换为画布坐标
            const canvasStartX = -stagePos.x / scale;
            const canvasStartY = -stagePos.y / scale;
            const canvasEndX = (viewWidth - stagePos.x) / scale;
            const canvasEndY = (viewHeight - stagePos.y) / scale;

            const lines: React.ReactElement[] = [];
            const theme = getThemeStyles(themeStyle);
            const lightTheme = isLightTheme(themeStyle);

            // 小网格颜色（更淡）
            const smallGridColor = lightTheme ? 'rgba(102, 126, 234, 0.08)' : 'rgba(102, 126, 234, 0.12)';
            // 大网格颜色（只比小网格亮一点点）
            const largeGridColor = lightTheme ? 'rgba(102, 126, 234, 0.12)' : 'rgba(102, 126, 234, 0.15)';

            // 计算小网格的范围
            const smallStartX = Math.floor(canvasStartX / smallGridSize) * smallGridSize;
            const smallStartY = Math.floor(canvasStartY / smallGridSize) * smallGridSize;
            const smallEndX = Math.ceil(canvasEndX / smallGridSize) * smallGridSize;
            const smallEndY = Math.ceil(canvasEndY / smallGridSize) * smallGridSize;

            // 计算大网格的范围
            const largeStartX = Math.floor(canvasStartX / largeGridSize) * largeGridSize;
            const largeStartY = Math.floor(canvasStartY / largeGridSize) * largeGridSize;
            const largeEndX = Math.ceil(canvasEndX / largeGridSize) * largeGridSize;
            const largeEndY = Math.ceil(canvasEndY / largeGridSize) * largeGridSize;

            // 绘制小网格 - 水平线
            for (let y = smallStartY; y <= smallEndY; y += smallGridSize) {
              // 如果是大网格的位置，跳过（大网格会单独绘制）
              if (y % largeGridSize === 0) continue;

              lines.push(
                <Line
                  key={`grid-small-h-${y}`}
                  points={[smallStartX, y, smallEndX, y]}
                  stroke={smallGridColor}
                  strokeWidth={0.5 / scale}
                  listening={false}
                />
              );
            }

            // 绘制小网格 - 垂直线
            for (let x = smallStartX; x <= smallEndX; x += smallGridSize) {
              // 如果是大网格的位置，跳过
              if (x % largeGridSize === 0) continue;

              lines.push(
                <Line
                  key={`grid-small-v-${x}`}
                  points={[x, smallStartY, x, smallEndY]}
                  stroke={smallGridColor}
                  strokeWidth={0.5 / scale}
                  listening={false}
                />
              );
            }

            // 绘制大网格 - 水平线
            for (let y = largeStartY; y <= largeEndY; y += largeGridSize) {
              lines.push(
                <Line
                  key={`grid-large-h-${y}`}
                  points={[smallStartX, y, smallEndX, y]}
                  stroke={largeGridColor}
                  strokeWidth={1 / scale}
                  listening={false}
                />
              );
            }

            // 绘制大网格 - 垂直线
            for (let x = largeStartX; x <= largeEndX; x += largeGridSize) {
              lines.push(
                <Line
                  key={`grid-large-v-${x}`}
                  points={[x, smallStartY, x, smallEndY]}
                  stroke={largeGridColor}
                  strokeWidth={1 / scale}
                  listening={false}
                />
              );
            }

            return lines;
          })()}
        </Layer>
        <Layer>
          {layers.map(layer => {
            const isSelected = layer.id === selectedLayerId || _selectedLayerIds.includes(layer.id);
            return (
              <ImageNode
                key={layer.id}
                layer={layer}
                isSelected={isSelected}
                onSelect={() => {
                  // 隐藏的图层不能被选中
                  if (!layer.visible) {
                    return;
                  }
                  // 如果这个图片已经是多选的一部分，则保留多选
                  if (_selectedLayerIds.length > 1 && _selectedLayerIds.includes(layer.id)) {
                    return;
                  }
                  onLayerSelect(layer.id);
                }}
                onUpdate={(updates) => {
                  // 如果有多个选中的图片，则同时更新其他的
                  if (_selectedLayerIds.length > 1 && isSelected && (updates.x !== undefined || updates.y !== undefined)) {
                    // 计算这个图片的偏移量
                    const deltaX = (updates.x ?? layer.x) - layer.x;
                    const deltaY = (updates.y ?? layer.y) - layer.y;

                    // 批量更新所有选中的图片（一次性更新，避免延迟）
                    if (onLayersBatchUpdate) {
                      const batchUpdates = _selectedLayerIds.map(id => {
                        const targetLayer = layers.find(l => l.id === id);
                        if (targetLayer) {
                          return {
                            layerId: id,
                            updates: {
                              x: targetLayer.x + deltaX,
                              y: targetLayer.y + deltaY,
                            }
                          };
                        }
                        return null;
                      }).filter(u => u !== null) as Array<{ layerId: string; updates: Partial<ImageLayer> }>;

                      onLayersBatchUpdate(batchUpdates);
                    } else {
                      // 降级方案：逐个更新
                      _selectedLayerIds.forEach(id => {
                        const targetLayer = layers.find(l => l.id === id);
                        if (targetLayer) {
                          onLayerUpdate(id, {
                            x: targetLayer.x + deltaX,
                            y: targetLayer.y + deltaY,
                          });
                        }
                      });
                    }
                  } else {
                    // 单个图片，直接更新
                    onLayerUpdate(layer.id, updates);
                  }
                }}
                editMode={editMode}
                comments={comments}
                onCommentAdd={onCommentAdd}
                onCommentUpdate={onCommentUpdate}
                onFillToDialog={onFillToDialog}
              />
            );
          })}
        </Layer>
      </Stage>
      {/* 欢迎页面 - 仅新用户展示 */}
      {!hasCompletedOnboarding && layers.length === 0 && generationTasks.filter(task => task.status === 'generating').length === 0 && (() => {
        const isLight = isLightTheme(themeStyle);

        // Original 风格 - 简洁现代设计，带指向引导
        const renderOriginalStyle = () => (
          <>
            <style>
              {`
                @keyframes onboarding-float {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-8px); }
                }
                @keyframes onboarding-arrow-bounce {
                  0%, 100% { transform: translateY(0); opacity: 0.6; }
                  50% { transform: translateY(8px); opacity: 1; }
                }
                @keyframes onboarding-pulse {
                  0%, 100% { opacity: 0.4; }
                  50% { opacity: 0.8; }
                }
              `}
            </style>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                pointerEvents: 'none',
                paddingBottom: 200, // 为底部对话框留空间
              }}
            >
              {/* 主内容区 */}
              <div
                style={{
                  textAlign: 'center',
                  animation: 'onboarding-float 4s ease-in-out infinite',
                }}
              >
                {/* 图标 */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    margin: '0 auto 24px',
                    borderRadius: 16,
                    background: isLight
                      ? 'linear-gradient(135deg, rgba(56, 189, 255, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(56, 189, 255, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                      stroke={isLight ? '#38BDFF' : '#38BDFF'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>

                {/* 标题 */}
                <h1
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                    marginBottom: 12,
                    background: 'linear-gradient(135deg, #38BDFF 0%, #7C3AED 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '-0.02em',
                  }}
                >
                  开始创作
                </h1>

                {/* 副标题 */}
                <p
                  style={{
                    fontSize: 16,
                    color: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                    fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                    marginBottom: 40,
                    maxWidth: 360,
                    lineHeight: 1.6,
                  }}
                >
                  在下方输入你的创意想法，AI 将帮你生成精美的图片或视频
                </p>

                {/* 向下箭头指引 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)',
                      fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                      animation: 'onboarding-pulse 2s ease-in-out infinite',
                    }}
                  >
                    在下方输入提示词
                  </span>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      animation: 'onboarding-arrow-bounce 1.5s ease-in-out infinite',
                    }}
                  >
                    <path
                      d="M12 5V19M12 19L5 12M12 19L19 12"
                      stroke={isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </>
        );

        // Professional/Glassmorphism 风格 - 专业毛玻璃设计
        const renderProfessionalStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                padding: '64px 80px',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
            >
              <h1
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.95)',
                  fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                  marginBottom: 20,
                  letterSpacing: '-0.02em',
                }}
              >
                从想法到作品
              </h1>
              <p
                style={{
                  fontSize: 18,
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                  marginBottom: 48,
                  margin: '0 auto 48px',
                  maxWidth: 520,
                  lineHeight: 1.6,
                }}
              >
                用 AI 将你的创意想法变成视觉作品，无需任何设计经验
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
              >
                {[
                  { step: '第1步', text: '输入提示词', icon: '✨' },
                  { step: '第2步', text: '调整参数和风格', icon: '⚙️' },
                  { step: '第3步', text: '生成你的作品', icon: '🎨' },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 20,
                      padding: '16px 24px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 12,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, rgba(56, 189, 255, 0.2), rgba(124, 58, 237, 0.2))',
                        border: '1px solid rgba(56, 189, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'rgba(56, 189, 255, 0.8)',
                          fontWeight: 600,
                          marginBottom: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {item.step}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          color: 'rgba(255, 255, 255, 0.85)',
                          fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                        }}
                      >
                        {item.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // Cyberpunk 风格 - 赛博朋克霓虹设计
        const renderCyberpunkStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(139, 0, 255, 0.05), rgba(255, 0, 170, 0.05))',
                backdropFilter: 'blur(20px)',
                border: '2px solid transparent',
                borderImage: 'linear-gradient(135deg, #8B00FF, #FF00AA, #00D9FF) 1',
                borderRadius: 16,
                padding: '56px 72px',
                boxShadow: '0 0 60px rgba(139, 0, 255, 0.4), 0 0 100px rgba(255, 0, 170, 0.2), inset 0 0 40px rgba(139, 0, 255, 0.1)',
                position: 'relative',
              }}
            >
              {/* Glow effect */}
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  right: -2,
                  bottom: -2,
                  background: 'linear-gradient(135deg, #8B00FF, #FF00AA, #00D9FF)',
                  borderRadius: 16,
                  filter: 'blur(20px)',
                  opacity: 0.3,
                  zIndex: -1,
                }}
              />
              <h1
                style={{
                  fontSize: 52,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  fontFamily: '"Courier New", monospace',
                  marginBottom: 16,
                  textShadow: '0 0 20px rgba(139, 0, 255, 0.8), 0 0 40px rgba(255, 0, 170, 0.6)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                从想法到作品
              </h1>
              <p
                style={{
                  fontSize: 16,
                  color: '#00D9FF',
                  fontFamily: '"Courier New", monospace',
                  marginBottom: 40,
                  margin: '0 auto 40px',
                  maxWidth: 500,
                  textShadow: '0 0 10px rgba(0, 217, 255, 0.6)',
                  letterSpacing: '0.02em',
                }}
              >
                &gt; 用 AI 将你的创意想法变成视觉作品_
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {[
                  { step: 'STEP_01', text: '输入提示词', color: '#8B00FF' },
                  { step: 'STEP_02', text: '调整参数和风格', color: '#FF00AA' },
                  { step: 'STEP_03', text: '生成你的作品', color: '#00D9FF' },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '12px 20px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: `1px solid ${item.color}`,
                      borderRadius: 4,
                      boxShadow: `0 0 20px ${item.color}40, inset 0 0 20px ${item.color}10`,
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 12px',
                        background: item.color,
                        borderRadius: 2,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#000000',
                        fontFamily: '"Courier New", monospace',
                        letterSpacing: '0.1em',
                        boxShadow: `0 0 15px ${item.color}`,
                      }}
                    >
                      {item.step}
                    </div>
                    <span
                      style={{
                        fontSize: 15,
                        color: '#FFFFFF',
                        fontFamily: '"Courier New", monospace',
                        textShadow: `0 0 10px ${item.color}80`,
                      }}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // Minimal Futuristic 风格 - 极简未来主义设计
        const renderMinimalStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <h1
              style={{
                fontSize: 64,
                fontWeight: 300,
                color: 'rgba(255, 255, 255, 0.95)',
                fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                marginBottom: 16,
                letterSpacing: '-0.03em',
              }}
            >
              从想法到作品
            </h1>
            <div
              style={{
                width: 120,
                height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
                margin: '0 auto 32px',
              }}
            />
            <p
              style={{
                fontSize: 17,
                color: 'rgba(255, 255, 255, 0.45)',
                fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                marginBottom: 64,
                margin: '0 auto 64px',
                maxWidth: 480,
                lineHeight: 1.8,
                fontWeight: 300,
              }}
            >
              用 AI 将你的创意想法变成视觉作品
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 48,
              }}
            >
              {[
                { num: '01', text: '输入提示词' },
                { num: '02', text: '调整参数' },
                { num: '03', text: '生成作品' },
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 200,
                      color: 'rgba(255, 255, 255, 0.3)',
                      fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {item.num}
                  </div>
                  <div
                    style={{
                      width: 1,
                      height: 24,
                      background: 'linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                      fontWeight: 400,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

        // Runway 风格 - 电影级视频优先美学
        const renderRunwayStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(80px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 24,
                padding: '88px 104px',
                boxShadow: '0 40px 80px rgba(0, 0, 0, 0.8), 0 0 1px rgba(14, 165, 233, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                maxWidth: 720,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'rgba(14, 165, 233, 0.85)',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  letterSpacing: '0.1em',
                  marginBottom: 24,
                  textTransform: 'uppercase',
                }}
              >
                AI Video Generation
              </div>
              <h1
                style={{
                  fontSize: 68,
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.98)',
                  fontFamily: 'Inter Display, -apple-system, sans-serif',
                  marginBottom: 20,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(14, 165, 233, 0.85))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Create Cinematic
                <br />
                Experiences
              </h1>
              <p
                style={{
                  fontSize: 20,
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  marginBottom: 64,
                  margin: '0 auto 64px',
                  maxWidth: 560,
                  lineHeight: 1.6,
                  fontWeight: 400,
                }}
              >
                Transform ideas into stunning visual content with AI-powered video and image generation
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 40,
                }}
              >
                {[
                  { label: 'Prompt', desc: 'Describe your vision' },
                  { label: 'Generate', desc: 'AI creates frames' },
                  { label: 'Refine', desc: 'Polish & export' },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      padding: '24px 20px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: 14,
                      transition: 'all 200ms',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.98)',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: 'rgba(14, 165, 233, 0.75)',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        fontWeight: 400,
                      }}
                    >
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // Anthropic 风格 - 温暖精致极简主义
        const renderAnthropicStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(40px) saturate(105%)',
                border: '1px solid rgba(19, 19, 20, 0.08)',
                borderRadius: 16,
                padding: '72px 96px',
                boxShadow: '0 24px 48px rgba(19, 19, 20, 0.08), 0 1px 2px rgba(19, 19, 20, 0.04)',
                maxWidth: 640,
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '6px 16px',
                  background: 'rgba(217, 119, 87, 0.12)',
                  border: '1px solid rgba(217, 119, 87, 0.2)',
                  borderRadius: 24,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#D97757',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  letterSpacing: '0.02em',
                  marginBottom: 28,
                }}
              >
                AI-Powered Creation
              </div>
              <h1
                style={{
                  fontSize: 56,
                  fontWeight: 600,
                  color: '#131314',
                  fontFamily: 'Inter Display, -apple-system, sans-serif',
                  marginBottom: 18,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}
              >
                从想法到
                <br />
                <span style={{ color: '#D97757' }}>视觉作品</span>
              </h1>
              <p
                style={{
                  fontSize: 18,
                  color: 'rgba(19, 19, 20, 0.65)',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  marginBottom: 56,
                  margin: '0 auto 56px',
                  maxWidth: 480,
                  lineHeight: 1.65,
                  fontWeight: 400,
                }}
              >
                用 AI 将你的创意想法变成令人惊叹的视觉内容，享受流畅的创作体验
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 20,
                }}
              >
                {[
                  { num: '01', label: '输入', desc: '描述你的想法' },
                  { num: '02', label: '生成', desc: 'AI 创作内容' },
                  { num: '03', label: '完善', desc: '调整与导出' },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      padding: '20px 18px',
                      background: 'rgba(19, 19, 20, 0.04)',
                      border: '1px solid rgba(19, 19, 20, 0.08)',
                      borderRadius: 12,
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#D97757',
                        fontFamily: 'Inter, -apple-system, monospace',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {item.num}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#131314',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        marginBottom: 2,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'rgba(19, 19, 20, 0.55)',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        lineHeight: 1.5,
                      }}
                    >
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // Terminal 风格 - 代码极简主义
        const renderTerminalStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'left',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: '#0D0D0D',
                border: '1px solid #00FF41',
                borderRadius: 0,
                padding: '48px 56px',
                boxShadow: '0 0 20px rgba(0, 255, 65, 0.2), inset 0 0 1px #00FF41',
                maxWidth: 720,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 32,
                  paddingBottom: 16,
                  borderBottom: '1px solid #00FF41',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: '#00FF41',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  $
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(0, 255, 65, 0.7)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  infinite-canvas --version 2.0.0
                </div>
              </div>

              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: '#00FF41',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 16,
                  letterSpacing: '-0.02em',
                  textShadow: '0 0 10px rgba(0, 255, 65, 0.3)',
                }}
              >
                {'> AI_GENERATION_SYSTEM'}
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: 'rgba(0, 255, 65, 0.7)',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 40,
                  lineHeight: 1.8,
                }}
              >
                [INFO] Initialize creative process<br />
                [INFO] Transform ideas into visual content
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {[
                  { cmd: 'input', desc: 'Enter your prompt' },
                  { cmd: 'generate', desc: 'Execute AI creation' },
                  { cmd: 'export', desc: 'Save and refine output' },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 20,
                      padding: '16px 20px',
                      background: '#000000',
                      border: '1px solid #00FF41',
                      borderRadius: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        color: '#00FF41',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        minWidth: 24,
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          color: '#FFFFFF',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 600,
                        }}
                      >
                        {item.cmd}()
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'rgba(0, 255, 65, 0.6)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        // {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // Neumorphism 风格 - 「光影诗人」新拟态主义
        const renderNeumorphismStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                background: '#E8EAF0',
                border: 'none',
                borderRadius: 32,
                padding: '80px 96px',
                boxShadow: '16px 16px 32px rgba(174, 179, 200, 0.5), -16px -16px 32px rgba(255, 255, 255, 0.9), inset 2px 2px 4px rgba(255, 255, 255, 0.4)',
                maxWidth: 680,
              }}
            >
              {/* 顶部装饰 - 凹陷圆点 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 12,
                  marginBottom: 40,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#E8EAF0',
                      boxShadow: 'inset 2px 2px 4px rgba(174, 179, 200, 0.4), inset -2px -2px 4px rgba(255, 255, 255, 0.8)',
                    }}
                  />
                ))}
              </div>

              <h1
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  color: '#4A4F6A',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  marginBottom: 16,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8), -1px -1px 2px rgba(174, 179, 200, 0.3)',
                }}
              >
                触摸光影
                <br />
                <span style={{ color: '#D4A574' }}>感知深度</span>
              </h1>

              <p
                style={{
                  fontSize: 17,
                  color: '#7B80A0',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  marginBottom: 56,
                  margin: '0 auto 56px',
                  maxWidth: 480,
                  lineHeight: 1.7,
                  fontWeight: 400,
                }}
              >
                在光影交织的空间中,每一次触碰都能感受到真实的质感
              </p>

              {/* 三个凸起按钮 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 24,
                }}
              >
                {[
                  { icon: '✏️', label: '构思' },
                  { icon: '🎨', label: '创作' },
                  { icon: '✨', label: '完成' },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 16,
                      padding: '28px 20px',
                      background: '#E8EAF0',
                      border: 'none',
                      borderRadius: 20,
                      boxShadow: '8px 8px 16px rgba(174, 179, 200, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: '#E8EAF0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                        boxShadow: 'inset 4px 4px 8px rgba(174, 179, 200, 0.35), inset -4px -4px 8px rgba(255, 255, 255, 0.7)',
                      }}
                    >
                      {item.icon}
                    </div>
                    <span
                      style={{
                        fontSize: 15,
                        color: '#4A4F6A',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        fontWeight: 600,
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // Garden 风格 - 「数字花园」生机勃勃的自然美学
        const renderGardenStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <style>
              {`
                @keyframes gardenGrow {
                  0%, 100% {
                    border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
                    transform: rotate(0deg) scale(1);
                  }
                  33% {
                    border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
                    transform: rotate(120deg) scale(1.05);
                  }
                  66% {
                    border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%;
                    transform: rotate(240deg) scale(0.98);
                  }
                }
                @keyframes petalFloat {
                  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.8; }
                  50% { transform: translateY(-15px) rotate(180deg); opacity: 1; }
                }
                @keyframes leafSway {
                  0%, 100% { transform: translateX(0) rotate(-5deg); }
                  50% { transform: translateX(8px) rotate(5deg); }
                }
              `}
            </style>
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(250, 255, 245, 0.95) 100%)',
                backdropFilter: 'blur(24px) saturate(160%)',
                border: '1px solid rgba(129, 199, 132, 0.3)',
                borderRadius: 32,
                padding: '70px 90px',
                boxShadow: '0 20px 60px rgba(76, 175, 80, 0.08), 0 8px 24px rgba(129, 199, 132, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                maxWidth: 750,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* 装饰性花朵和叶子 */}
              <div
                style={{
                  position: 'absolute',
                  top: '-10%',
                  right: '5%',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(255, 111, 97, 0.25) 0%, rgba(255, 171, 145, 0.15) 50%, transparent 70%)',
                  animation: 'gardenGrow 18s ease-in-out infinite',
                  filter: 'blur(30px)',
                  zIndex: 0,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '10%',
                  right: '-5%',
                  width: '120px',
                  height: '120px',
                  background: 'radial-gradient(circle, rgba(255, 224, 130, 0.3) 0%, transparent 70%)',
                  animation: 'petalFloat 6s ease-in-out infinite',
                  filter: 'blur(20px)',
                  zIndex: 0,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '15%',
                  left: '8%',
                  width: '250px',
                  height: '250px',
                  background: 'radial-gradient(circle, rgba(102, 187, 106, 0.22) 0%, rgba(129, 199, 132, 0.12) 50%, transparent 70%)',
                  animation: 'gardenGrow 22s ease-in-out infinite reverse',
                  filter: 'blur(35px)',
                  zIndex: 0,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '-5%',
                  left: '-3%',
                  width: '150px',
                  height: '150px',
                  background: 'radial-gradient(circle, rgba(129, 199, 132, 0.25) 0%, transparent 70%)',
                  animation: 'leafSway 8s ease-in-out infinite',
                  filter: 'blur(25px)',
                  zIndex: 0,
                }}
              />

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* 标签 */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, rgba(102, 187, 106, 0.15) 0%, rgba(129, 199, 132, 0.12) 100%)',
                    border: '1px solid rgba(102, 187, 106, 0.25)',
                    borderRadius: 24,
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#1B5E20',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 32,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span style={{ fontSize: 16 }}>🌿</span>
                  Digital Garden
                </div>

                {/* 主标题 */}
                <h1
                  style={{
                    fontSize: 64,
                    fontWeight: 800,
                    color: '#1B5E20',
                    fontFamily: 'Inter Display, -apple-system, sans-serif',
                    marginBottom: 20,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                  }}
                >
                  在创意中
                  <br />
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #66BB6A 0%, #FFD54F 50%, #FF8A65 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    自然生长
                  </span>
                </h1>

                {/* 副标题 */}
                <p
                  style={{
                    fontSize: 19,
                    color: '#388E3C',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 48,
                    margin: '0 auto 48px',
                    maxWidth: 550,
                    lineHeight: 1.65,
                    fontWeight: 500,
                  }}
                >
                  像园丁培育植物一样，让每个创意在数字土壤中萌芽、成长、绽放
                </p>

                {/* 特色卡片 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 8,
                  }}
                >
                  {[
                    { emoji: '🌱', text: '播种', desc: '创意萌芽', bg: 'linear-gradient(135deg, rgba(129, 199, 132, 0.18), rgba(165, 214, 167, 0.12))', border: 'rgba(129, 199, 132, 0.35)' },
                    { emoji: '🌻', text: '生长', desc: '持续迭代', bg: 'linear-gradient(135deg, rgba(255, 213, 79, 0.18), rgba(255, 224, 130, 0.15))', border: 'rgba(255, 213, 79, 0.4)' },
                    { emoji: '🌸', text: '绽放', desc: '精彩呈现', bg: 'linear-gradient(135deg, rgba(255, 138, 101, 0.18), rgba(255, 171, 145, 0.15))', border: 'rgba(255, 138, 101, 0.4)' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '24px 18px',
                        background: item.bg,
                        backdropFilter: 'blur(10px)',
                        border: `1.5px solid ${item.border}`,
                        borderRadius: 20,
                        minWidth: 150,
                        animation: 'petalFloat 4s ease-in-out infinite',
                        animationDelay: `${index * 0.4}s`,
                        transition: 'transform 0.3s ease',
                      }}
                    >
                      <div style={{ fontSize: 42, marginBottom: 12, lineHeight: 1 }}>{item.emoji}</div>
                      <div
                        style={{
                          fontSize: 16,
                          color: '#1B5E20',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontWeight: 700,
                          marginBottom: 6,
                        }}
                      >
                        {item.text}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#388E3C',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontWeight: 500,
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

        // Spectrum 风格 - 「光谱实验室」科学艺术融合
        const renderSpectrumStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <style>
              {`
                @keyframes spectrumScan {
                  0% { left: -100%; }
                  100% { left: 200%; }
                }
                @keyframes prismRotate {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
            <div
              style={{
                background: 'rgba(20, 25, 35, 0.85)',
                backdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid transparent',
                borderImage: 'linear-gradient(135deg, rgba(138, 43, 226, 0.3), rgba(75, 0, 130, 0.2), rgba(0, 191, 255, 0.3)) 1',
                borderRadius: 8,
                padding: '72px 88px',
                boxShadow: '0 8px 32px rgba(138, 43, 226, 0.15), 0 0 80px rgba(75, 0, 130, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                maxWidth: 720,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* 光谱扫描线 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100px',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(138, 43, 226, 0.3), rgba(0, 191, 255, 0.3), transparent)',
                  animation: 'spectrumScan 8s linear infinite',
                  zIndex: 0,
                }}
              />

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* 顶部光谱条 */}
                <div
                  style={{
                    height: 3,
                    background: 'linear-gradient(90deg, #8B00FF 0%, #4B0082 14%, #0000FF 28%, #00FF00 42%, #FFFF00 57%, #FF7F00 71%, #FF0000 85%, #8B00FF 100%)',
                    marginBottom: 40,
                    borderRadius: 2,
                    boxShadow: '0 0 20px rgba(138, 43, 226, 0.6)',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    marginBottom: 28,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      background: 'linear-gradient(135deg, #8B00FF, #00BFFF)',
                      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                      animation: 'prismRotate 10s linear infinite',
                      filter: 'drop-shadow(0 0 10px rgba(138, 43, 226, 0.6))',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'rgba(138, 180, 255, 0.85)',
                      fontFamily: 'JetBrains Mono, monospace',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Spectrum Lab
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: 64,
                    fontWeight: 700,
                    color: 'rgba(255, 255, 255, 0.95)',
                    fontFamily: 'Inter Display, -apple-system, sans-serif',
                    marginBottom: 16,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                    textShadow: '0 0 30px rgba(0, 191, 255, 0.4)',
                  }}
                >
                  光谱创造
                </h1>

                <p
                  style={{
                    fontSize: 18,
                    color: 'rgba(138, 180, 255, 0.85)',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 64,
                    margin: '0 auto 64px',
                    maxWidth: 560,
                    lineHeight: 1.6,
                    fontWeight: 400,
                  }}
                >
                  以科学的精密,捕捉艺术的无限可能性
                </p>

                {/* 精密网格步骤 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 16,
                  }}
                >
                  {[
                    { wavelength: '380nm', label: 'Input', color: '#8B00FF' },
                    { wavelength: '550nm', label: 'Process', color: '#00FF00' },
                    { wavelength: '700nm', label: 'Output', color: '#FF0000' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '20px 16px',
                        background: 'rgba(30, 35, 50, 0.6)',
                        border: `1px solid ${item.color}40`,
                        borderRadius: 6,
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '2px',
                          background: item.color,
                          boxShadow: `0 0 10px ${item.color}`,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 11,
                          color: item.color,
                          fontFamily: 'JetBrains Mono, monospace',
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        λ {item.wavelength}
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          color: 'rgba(255, 255, 255, 0.95)',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontWeight: 600,
                        }}
                      >
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

        // Gen-Z 风格 - Claymorphism (3D 玩具美学)
        const renderGenZStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <style>
              {`
                @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Comic+Neue:wght@300;400;700&display=swap');
                @keyframes softBounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-8px); }
                }
                @keyframes gentlePress {
                  0% { transform: translate(0, 0); box-shadow: 8px 8px 0px #60A5FA, 12px 12px 0px rgba(37, 99, 235, 0.2); }
                  100% { transform: translate(4px, 4px); box-shadow: 4px 4px 0px #60A5FA, 6px 6px 0px rgba(37, 99, 235, 0.2); }
                }
              `}
            </style>
            <div
              style={{
                background: '#FFFFFF',
                border: '4px solid #2563EB',
                borderRadius: 24,
                padding: '60px 80px',
                boxShadow: '8px 8px 0px #60A5FA, 12px 12px 0px rgba(37, 99, 235, 0.2)',
                maxWidth: 700,
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* 玩具标签 */}
                <div
                  style={{
                    display: 'inline-block',
                    padding: '12px 32px',
                    background: '#F43F5E',
                    border: '3px solid #BE123C',
                    borderRadius: 16,
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    fontFamily: '"Baloo 2", "Comic Neue", sans-serif',
                    marginBottom: 32,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    boxShadow: '4px 4px 0px #BE123C',
                  }}
                >
                  FUN MODE
                </div>

                {/* 主标题 - 粘土质感 */}
                <h1
                  style={{
                    fontSize: 72,
                    fontWeight: 800,
                    color: '#1E293B',
                    fontFamily: '"Baloo 2", sans-serif',
                    marginBottom: 20,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  无限创意
                  <br />
                  <span
                    style={{
                      color: '#2563EB',
                    }}
                  >
                    无限可能
                  </span>
                </h1>

                {/* 副标题 */}
                <p
                  style={{
                    fontSize: 20,
                    color: '#475569',
                    fontFamily: '"Comic Neue", sans-serif',
                    marginBottom: 48,
                    margin: '0 auto 48px',
                    maxWidth: 500,
                    lineHeight: 1.6,
                    fontWeight: 400,
                  }}
                >
                  像玩玩具一样创作，轻松又有趣
                </p>

                {/* 3D 粘土卡片 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 20,
                  }}
                >
                  {[
                    { icon: '🎨', text: 'Create', bg: '#2563EB', border: '#1E40AF' },
                    { icon: '✨', text: 'Play', bg: '#60A5FA', border: '#2563EB' },
                    { icon: '🚀', text: 'Share', bg: '#F43F5E', border: '#BE123C' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '24px 20px',
                        background: item.bg,
                        border: `3px solid ${item.border}`,
                        borderRadius: 16,
                        minWidth: 120,
                        animation: 'softBounce 2s ease-in-out infinite',
                        animationDelay: `${index * 0.2}s`,
                        boxShadow: `6px 6px 0px ${item.border}`,
                        transition: 'all 200ms ease-out',
                      }}
                    >
                      <div style={{ fontSize: 44, marginBottom: 8, lineHeight: 1 }}>{item.icon}</div>
                      <div
                        style={{
                          fontSize: 18,
                          color: '#FFFFFF',
                          fontFamily: '"Baloo 2", sans-serif',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

        // Minimalism 风格 - Exaggerated Minimalism (夸张极简主义)
        const renderMinimalismStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <style>
              {`
                @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
              `}
            </style>
            <div
              style={{
                background: '#FFFFFF',
                border: '2px solid #1C1917',
                borderRadius: 0,
                padding: '80px 100px',
                boxShadow: 'none',
                maxWidth: 800,
              }}
            >
              {/* Brutalist 标记 */}
              <div
                style={{
                  display: 'inline-block',
                  padding: '16px 48px',
                  background: '#1C1917',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: '"Space Mono", monospace',
                  marginBottom: 80,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  border: '2px solid #1C1917',
                }}
              >
                INFINITE CANVAS
              </div>

              {/* 主标题 - 巨大夸张字体 */}
              <h1
                style={{
                  fontSize: 'clamp(3rem, 10vw, 7rem)',
                  fontWeight: 900,
                  color: '#0C0A09',
                  fontFamily: '"Space Mono", monospace',
                  marginBottom: 40,
                  letterSpacing: '-0.05em',
                  lineHeight: 0.9,
                  textTransform: 'uppercase',
                }}
              >
                无限
                <br />
                创意
              </h1>

              {/* Brutalist 分割线 */}
              <div
                style={{
                  width: '100%',
                  height: 2,
                  background: '#1C1917',
                  margin: '60px 0',
                }}
              />

              {/* 副标题 - 等宽字体 */}
              <p
                style={{
                  fontSize: 14,
                  color: '#44403C',
                  fontFamily: '"Space Mono", monospace',
                  marginBottom: 80,
                  lineHeight: 1.8,
                  fontWeight: 400,
                  maxWidth: 600,
                  margin: '0 auto 80px',
                  letterSpacing: '0.05em',
                }}
              >
                BOLD MINIMALISM / HIGH CONTRAST / NEGATIVE SPACE
              </p>

              {/* Brutalist 方块组 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 24,
                }}
              >
                {[
                  { num: '01', label: 'STARK' },
                  { num: '02', label: 'BOLD' },
                  { num: '03', label: 'RAW' },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 100,
                        height: 100,
                        border: '2px solid #1C1917',
                        borderRadius: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                        fontWeight: 700,
                        fontFamily: '"Space Mono", monospace',
                        background: index === 1 ? '#1C1917' : '#FFFFFF',
                        color: index === 1 ? '#FFFFFF' : '#0C0A09',
                      }}
                    >
                      {item.num}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        padding: '12px 0',
                        background: index === 1 ? '#CA8A04' : 'transparent',
                        border: '2px solid #1C1917',
                        borderTop: 'none',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: index === 1 ? '#FFFFFF' : '#44403C',
                          fontFamily: '"Space Mono", monospace',
                          fontWeight: 700,
                          letterSpacing: '0.2em',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // Flat Design 风格 - Glassmorphism (现代玻璃态)
        const renderFlatStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <style>
              {`
                @keyframes glassFloat {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-10px); }
                }
              `}
            </style>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 16,
                padding: '70px 90px',
                maxWidth: 750,
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* 光线反射效果 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, transparent 50%)',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* 玻璃标签 */}
                <div
                  style={{
                    display: 'inline-block',
                    padding: '12px 28px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#3B82F6',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 32,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  GLASSMORPHISM
                </div>

                {/* 主标题 - 清晰对比 */}
                <h1
                  style={{
                    fontSize: 60,
                    fontWeight: 800,
                    color: '#1E293B',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 18,
                    letterSpacing: '-0.025em',
                    lineHeight: 1.15,
                  }}
                >
                  透明质感
                  <br />
                  <span style={{ color: '#F97316' }}>
                    现代设计
                  </span>
                </h1>

                {/* 副标题 */}
                <p
                  style={{
                    fontSize: 18,
                    color: '#475569',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 56,
                    lineHeight: 1.65,
                    fontWeight: 500,
                    maxWidth: 540,
                    margin: '0 auto 56px',
                  }}
                >
                  毛玻璃质感，层次分明的现代界面
                </p>

                {/* 玻璃卡片 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                  }}
                >
                  {[
                    { text: 'Design', desc: '设计' },
                    { text: 'Create', desc: '创作' },
                    { text: 'Share', desc: '分享' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '32px 24px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 12,
                        minWidth: 160,
                        animation: 'glassFloat 3s ease-in-out infinite',
                        animationDelay: `${index * 0.2}s`,
                        boxShadow: '0 4px 16px rgba(59, 130, 246, 0.1)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          color: '#3B82F6',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontWeight: 700,
                          marginBottom: 8,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {item.text}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: '#475569',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontWeight: 500,
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

        // Glassmorphism 风格 - Liquid Glass (流动玻璃)
        const renderGlassmorphismStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <style>
              {`
                @keyframes liquidMorph {
                  0%, 100% {
                    border-radius: 28% 72% 43% 57% / 64% 35% 65% 36%;
                    transform: rotate(0deg) scale(1);
                  }
                  33% {
                    border-radius: 73% 27% 56% 44% / 42% 68% 32% 58%;
                    transform: rotate(120deg) scale(1.05);
                  }
                  66% {
                    border-radius: 41% 59% 38% 62% / 71% 29% 71% 29%;
                    transform: rotate(240deg) scale(0.95);
                  }
                }
                @keyframes iridescentShift {
                  0% { background-position: 0% 50%; }
                  50% { background-position: 100% 50%; }
                  100% { background-position: 0% 50%; }
                }
                @keyframes liquidFloat {
                  0%, 100% { transform: translateY(0) translateX(0); }
                  50% { transform: translateY(-12px) translateX(8px); }
                }
              `}
            </style>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(60px) saturate(220%) brightness(110%)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 28,
                padding: '70px 90px',
                boxShadow: '0 16px 64px rgba(102, 126, 234, 0.25), 0 0 100px rgba(118, 75, 162, 0.15), inset 0 2px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 0 rgba(255, 255, 255, 0.2)',
                maxWidth: 750,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* 彩虹色散光效果 */}
              <div
                style={{
                  position: 'absolute',
                  top: -100,
                  left: -100,
                  width: 300,
                  height: 300,
                  background: 'linear-gradient(45deg, rgba(102, 126, 234, 0.4), rgba(240, 147, 251, 0.4), rgba(79, 172, 254, 0.4))',
                  backgroundSize: '200% 200%',
                  animation: 'iridescentShift 10s ease infinite, liquidMorph 15s ease-in-out infinite',
                  pointerEvents: 'none',
                  filter: 'blur(80px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -100,
                  right: -100,
                  width: 300,
                  height: 300,
                  background: 'linear-gradient(45deg, rgba(79, 172, 254, 0.4), rgba(0, 242, 254, 0.4), rgba(118, 75, 162, 0.4))',
                  backgroundSize: '200% 200%',
                  animation: 'iridescentShift 12s ease infinite, liquidMorph 18s ease-in-out infinite',
                  pointerEvents: 'none',
                  filter: 'blur(80px)',
                }}
              />

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* 液态玻璃标签 */}
                <div
                  style={{
                    display: 'inline-block',
                    padding: '12px 28px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(40px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.4)',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'rgba(255, 255, 255, 0.99)',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 32,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                  }}
                >
                  LIQUID GLASS
                </div>

                {/* 主标题 - 流动效果 */}
                <h1
                  style={{
                    fontSize: 64,
                    fontWeight: 800,
                    color: 'rgba(255, 255, 255, 0.99)',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 18,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                    textShadow: '0 4px 30px rgba(240, 147, 251, 0.5)',
                  }}
                >
                  流动玻璃
                  <br />
                  <span
                    style={{
                      color: '#FFFFFF',
                      textShadow: '0 0 50px rgba(102, 126, 234, 0.8)',
                    }}
                  >
                    如梦似幻
                  </span>
                </h1>

                {/* 副标题 */}
                <p
                  style={{
                    fontSize: 18,
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    marginBottom: 52,
                    lineHeight: 1.65,
                    fontWeight: 500,
                    maxWidth: 540,
                    margin: '0 auto 52px',
                  }}
                >
                  液态质感，流动变形，彩虹色散的视觉体验
                </p>

                {/* 流动玻璃卡片 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                  }}
                >
                  {[
                    { text: 'Morph', desc: '变形' },
                    { text: 'Flow', desc: '流动' },
                    { text: 'Shine', desc: '光泽' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '30px 22px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(40px)',
                        border: '1.5px solid rgba(255, 255, 255, 0.4)',
                        borderRadius: 20,
                        minWidth: 150,
                        animation: 'liquidFloat 5s ease-in-out infinite',
                        animationDelay: `${index * 0.5}s`,
                        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.5)',
                        transition: 'all 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 17,
                          color: '#FFFFFF',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontWeight: 700,
                          marginBottom: 8,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {item.text}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: 'rgba(255, 255, 255, 0.85)',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontWeight: 500,
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

        // Aurora 风格 - Vibrant & Block-based (活力方块)
        const renderAuroraStyle = () => (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <style>
              {`
                @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
                @keyframes colorShift {
                  0% { border-color: #39FF14; }
                  25% { border-color: #BF00FF; }
                  50% { border-color: #FF1493; }
                  75% { border-color: #00FFFF; }
                  100% { border-color: #39FF14; }
                }
                @keyframes energeticPulse {
                  0%, 100% { box-shadow: 0 0 40px rgba(57, 255, 20, 0.5); }
                  50% { box-shadow: 0 0 80px rgba(191, 0, 255, 0.8); }
                }
              `}
            </style>
            <div
              style={{
                background: '#1A1A1A',
                border: '3px solid #39FF14',
                borderRadius: 8,
                padding: '70px 90px',
                boxShadow: '0 16px 48px rgba(57, 255, 20, 0.3), 0 0 80px rgba(191, 0, 255, 0.2)',
                maxWidth: 800,
                position: 'relative',
                animation: 'colorShift 8s linear infinite',
              }}
            >
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Vibrant 标签 */}
                <div
                  style={{
                    display: 'inline-block',
                    padding: '16px 40px',
                    background: '#BF00FF',
                    border: '3px solid #FFFFFF',
                    borderRadius: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    fontFamily: '"Space Mono", monospace',
                    marginBottom: 48,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    boxShadow: '0 8px 32px rgba(191, 0, 255, 0.5)',
                  }}
                >
                  VIBRANT BLOCKS
                </div>

                {/* 主标题 - 巨大粗体 */}
                <h1
                  style={{
                    fontSize: 72,
                    fontWeight: 900,
                    color: '#FFFFFF',
                    fontFamily: '"Space Mono", monospace',
                    marginBottom: 24,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                    textTransform: 'uppercase',
                    textShadow: '0 0 40px rgba(57, 255, 20, 0.8)',
                  }}
                >
                  INFINITE
                  <br />
                  <span
                    style={{
                      color: '#39FF14',
                      textShadow: '0 0 60px rgba(191, 0, 255, 1)',
                    }}
                  >
                    ENERGY
                  </span>
                </h1>

                {/* 副标题 - 霓虹色 */}
                <p
                  style={{
                    fontSize: 16,
                    color: '#00FFFF',
                    fontFamily: '"Space Mono", monospace',
                    marginBottom: 60,
                    lineHeight: 1.8,
                    fontWeight: 400,
                    maxWidth: 600,
                    margin: '0 auto 60px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  BOLD / ENERGETIC / PLAYFUL / GEOMETRIC
                </p>

                {/* 几何方块卡片 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 24,
                  }}
                >
                  {[
                    { num: 'A', text: 'BOLD', bg: '#FF1493', border: '#FFFFFF' },
                    { num: 'B', text: 'VIVID', bg: '#39FF14', border: '#000000' },
                    { num: 'C', text: 'LOUD', bg: '#00FFFF', border: '#BF00FF' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 120,
                          height: 120,
                          border: `3px solid ${item.border}`,
                          borderRadius: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 48,
                          color: '#FFFFFF',
                          fontWeight: 900,
                          fontFamily: '"Space Mono", monospace',
                          background: item.bg,
                          boxShadow: `0 0 40px ${item.bg}`,
                          transition: 'all 200ms ease-out',
                        }}
                      >
                        {item.num}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          padding: '12px 0',
                          background: '#1A1A1A',
                          border: '3px solid #FFFFFF',
                          borderTop: 'none',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: '#FFAA00',
                            fontFamily: '"Space Mono", monospace',
                            fontWeight: 700,
                            letterSpacing: '0.2em',
                          }}
                        >
                          {item.text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

        // 根据当前选择的风格渲染对应的界面
        const renderWelcome = () => {
          // 基于 themeStyle 的新手引导
          switch (themeStyle) {
            case 'professional':
              return renderProfessionalStyle();
            case 'cyberpunk':
              return renderCyberpunkStyle();
            case 'minimal':
              return renderMinimalStyle();
            case 'runway':
              return renderRunwayStyle();
            case 'anthropic':
              return renderAnthropicStyle();
            case 'terminal':
              return renderTerminalStyle();
            case 'neumorphism':
              return renderNeumorphismStyle();
            case 'garden':
              return renderGardenStyle();
            case 'spectrum':
              return renderSpectrumStyle();
            case 'genz':
              return renderGenZStyle();
            case 'minimalism':
              return renderMinimalismStyle();
            case 'flat':
              return renderFlatStyle();
            case 'glassmorphism':
              return renderGlassmorphismStyle();
            case 'aurora':
              return renderAuroraStyle();
            case 'original':
            default:
              return renderOriginalStyle();
          }
        };

        // Render theme-specific background effects
        const renderBackgroundEffects = () => {
          if (themeStyle === 'runway') {
            return (
              <>
                <style>
                  {`
                    @keyframes floatGradient {
                      0%, 100% { transform: translate(0%, 0%) scale(1); }
                      33% { transform: translate(5%, -5%) scale(1.1); }
                      66% { transform: translate(-3%, 5%) scale(0.95); }
                    }
                  `}
                </style>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '-20%',
                      right: '-10%',
                      width: '60%',
                      height: '60%',
                      background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)',
                      animation: 'floatGradient 20s ease-in-out infinite',
                      filter: 'blur(60px)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-20%',
                      left: '-10%',
                      width: '50%',
                      height: '50%',
                      background: 'radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 70%)',
                      animation: 'floatGradient 25s ease-in-out infinite reverse',
                      filter: 'blur(80px)',
                    }}
                  />
                </div>
              </>
            );
          }

          if (themeStyle === 'terminal') {
            return (
              <>
                <style>
                  {`
                    @keyframes scanline {
                      0% { transform: translateY(-100%); }
                      100% { transform: translateY(100vh); }
                    }
                    @keyframes crtFlicker {
                      0%, 100% { opacity: 0.02; }
                      50% { opacity: 0.04; }
                    }
                  `}
                </style>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* CRT Scanline effect */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '2px',
                      background: 'linear-gradient(to bottom, transparent, rgba(0, 255, 65, 0.3), transparent)',
                      animation: 'scanline 8s linear infinite',
                      boxShadow: '0 0 10px rgba(0, 255, 65, 0.5)',
                    }}
                  />
                  {/* CRT grain */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      background: 'repeating-linear-gradient(0deg, rgba(0, 255, 65, 0.02) 0px, transparent 1px, transparent 2px, rgba(0, 255, 65, 0.02) 3px)',
                      animation: 'crtFlicker 0.1s infinite',
                    }}
                  />
                  {/* Corner glow */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '300px',
                      height: '300px',
                      background: 'radial-gradient(circle at top left, rgba(0, 255, 65, 0.1) 0%, transparent 50%)',
                      filter: 'blur(40px)',
                    }}
                  />
                </div>
              </>
            );
          }

          if (themeStyle === 'neumorphism') {
            return (
              <>
                <style>
                  {`
                    @keyframes softPulse {
                      0%, 100% { opacity: 0.3; }
                      50% { opacity: 0.5; }
                    }
                  `}
                </style>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* 柔和光源 - 右上 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10%',
                      right: '-5%',
                      width: '40%',
                      height: '40%',
                      background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
                      filter: 'blur(80px)',
                      animation: 'softPulse 8s ease-in-out infinite',
                    }}
                  />
                  {/* 柔和阴影 - 左下 */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-10%',
                      left: '-5%',
                      width: '35%',
                      height: '35%',
                      background: 'radial-gradient(circle, rgba(174, 179, 200, 0.3) 0%, transparent 70%)',
                      filter: 'blur(100px)',
                      animation: 'softPulse 10s ease-in-out infinite reverse',
                    }}
                  />
                </div>
              </>
            );
          }

          if (themeStyle === 'garden') {
            return (
              <>
                <style>
                  {`
                    @keyframes gardenBreeze {
                      0%, 100% {
                        transform: translate(0%, 0%) rotate(0deg);
                        border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
                      }
                      33% {
                        transform: translate(4%, -3%) rotate(5deg);
                        border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
                      }
                      66% {
                        transform: translate(-3%, 4%) rotate(-5deg);
                        border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%;
                      }
                    }
                    @keyframes petalDrift {
                      0% { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 0; }
                      5% { opacity: 0.7; }
                      95% { opacity: 0.6; }
                      100% { transform: translateY(100vh) translateX(30px) rotate(540deg); opacity: 0; }
                    }
                    @keyframes leafDance {
                      0%, 100% { transform: translateX(0) rotate(-8deg) scale(1); }
                      50% { transform: translateX(12px) rotate(8deg) scale(1.05); }
                    }
                    @keyframes flowerBloom {
                      0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.15; }
                      50% { transform: scale(1.1) rotate(5deg); opacity: 0.25; }
                    }
                  `}
                </style>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* 主背景渐变光晕 - 绿色生机 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-20%',
                      right: '10%',
                      width: '55%',
                      height: '55%',
                      background: 'radial-gradient(circle, rgba(102, 187, 106, 0.18) 0%, rgba(129, 199, 132, 0.1) 40%, transparent 70%)',
                      animation: 'gardenBreeze 24s ease-in-out infinite',
                      filter: 'blur(70px)',
                    }}
                  />
                  {/* 黄色花朵光晕 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '15%',
                      right: '-5%',
                      width: '35%',
                      height: '35%',
                      background: 'radial-gradient(circle, rgba(255, 213, 79, 0.22) 0%, rgba(255, 224, 130, 0.12) 50%, transparent 70%)',
                      animation: 'flowerBloom 12s ease-in-out infinite',
                      filter: 'blur(50px)',
                    }}
                  />
                  {/* 珊瑚色花朵光晕 */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '20%',
                      left: '15%',
                      width: '40%',
                      height: '40%',
                      background: 'radial-gradient(circle, rgba(255, 138, 101, 0.18) 0%, rgba(255, 171, 145, 0.1) 50%, transparent 70%)',
                      animation: 'gardenBreeze 28s ease-in-out infinite reverse',
                      filter: 'blur(65px)',
                    }}
                  />
                  {/* 底部叶子光晕 */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-10%',
                      left: '-5%',
                      width: '45%',
                      height: '45%',
                      background: 'radial-gradient(circle, rgba(129, 199, 132, 0.2) 0%, rgba(165, 214, 167, 0.12) 45%, transparent 70%)',
                      animation: 'leafDance 16s ease-in-out infinite',
                      filter: 'blur(60px)',
                    }}
                  />
                  {/* 飘落的花瓣 - 不同颜色 */}
                  {[
                    { color: 'rgba(255, 138, 101, 0.4)', delay: 0, duration: 18 },
                    { color: 'rgba(244, 143, 177, 0.35)', delay: 3, duration: 22 },
                    { color: 'rgba(255, 224, 130, 0.4)', delay: 6, duration: 20 },
                    { color: 'rgba(255, 171, 145, 0.38)', delay: 9, duration: 19 },
                    { color: 'rgba(129, 199, 132, 0.35)', delay: 12, duration: 21 },
                    { color: 'rgba(255, 138, 101, 0.42)', delay: 15, duration: 23 },
                  ].map((petal, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: '-30px',
                        left: `${15 + i * 14}%`,
                        width: 10,
                        height: 10,
                        background: petal.color,
                        borderRadius: '50% 0% 50% 0%',
                        animation: `petalDrift ${petal.duration}s linear infinite`,
                        animationDelay: `${petal.delay}s`,
                        boxShadow: `0 2px 8px ${petal.color}`,
                      }}
                    />
                  ))}
                  {/* 小叶子装饰 */}
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={`leaf-${i}`}
                      style={{
                        position: 'absolute',
                        top: `${25 + i * 20}%`,
                        left: `${5 + i * 25}%`,
                        width: 6,
                        height: 12,
                        background: 'rgba(129, 199, 132, 0.3)',
                        borderRadius: '0% 100% 0% 100%',
                        animation: `petalDrift ${24 + i * 2}s linear infinite`,
                        animationDelay: `${i * 4}s`,
                        transform: 'rotate(45deg)',
                      }}
                    />
                  ))}
                </div>
              </>
            );
          }

          if (themeStyle === 'spectrum') {
            return (
              <>
                <style>
                  {`
                    @keyframes spectrumPulse {
                      0%, 100% { opacity: 0.08; }
                      50% { opacity: 0.15; }
                    }
                    @keyframes prismLight {
                      0% { transform: translateX(-100%) rotate(0deg); }
                      100% { transform: translateX(200%) rotate(360deg); }
                    }
                  `}
                </style>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* 光谱渐变背景 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'radial-gradient(circle at 30% 30%, rgba(138, 43, 226, 0.08) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(0, 191, 255, 0.06) 0%, transparent 50%)',
                      animation: 'spectrumPulse 6s ease-in-out infinite',
                    }}
                  />
                  {/* 棱镜光线扫描 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '-100%',
                      width: '200px',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #8B00FF, #00BFFF, transparent)',
                      boxShadow: '0 0 20px rgba(138, 43, 226, 0.6), 0 0 40px rgba(0, 191, 255, 0.4)',
                      animation: 'prismLight 12s linear infinite',
                    }}
                  />
                  {/* 光谱粒子 */}
                  {['#8B00FF', '#4B0082', '#0000FF', '#00FF00', '#FFFF00', '#FF7F00', '#FF0000'].map((color, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: `${10 + i * 12}%`,
                        right: `${5 + i * 8}%`,
                        width: 4,
                        height: 4,
                        background: color,
                        borderRadius: '50%',
                        boxShadow: `0 0 10px ${color}`,
                        animation: 'spectrumPulse 3s ease-in-out infinite',
                        animationDelay: `${i * 0.3}s`,
                      }}
                    />
                  ))}
                </div>
              </>
            );
          }

          return null;
        };

        return (
          <>
            {renderBackgroundEffects()}
            {renderWelcome()}
            {/* 风格切换器 */}
            {showStyleSwitcher && (
              <div
                style={{
                  position: 'fixed',
                  bottom: 32,
                  right: 32,
                  zIndex: 200,
                  pointerEvents: 'auto',
                }}
              >
                <div
                  style={{
                    background: 'rgba(30, 30, 30, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: 12,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                        flex: 1,
                      }}
                    >
                      设计风格
                    </span>
                    <button
                      onClick={() => setShowStyleSwitcher(false)}
                      style={{
                        width: 20,
                        height: 20,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {[
                      { value: 'original' as ThemeStyle, label: 'Original' },
                      { value: 'professional' as ThemeStyle, label: 'Professional' },
                      { value: 'cyberpunk' as ThemeStyle, label: 'Cyberpunk' },
                      { value: 'minimal' as ThemeStyle, label: 'Minimal' },
                      { value: 'runway' as ThemeStyle, label: 'Runway' },
                      { value: 'anthropic' as ThemeStyle, label: 'Anthropic' },
                      { value: 'terminal' as ThemeStyle, label: 'Terminal' },
                      { value: 'neumorphism' as ThemeStyle, label: '🌗 光影诗人' },
                      { value: 'garden' as ThemeStyle, label: '🌱 数字花园' },
                      { value: 'spectrum' as ThemeStyle, label: '🔬 光谱实验室' },
                      { value: 'genz' as ThemeStyle, label: '🌈 Gen-Z' },
                      { value: 'minimalism' as ThemeStyle, label: '一 极简主义' },
                      { value: 'flat' as ThemeStyle, label: '⚡ 扁平设计' },
                      { value: 'glassmorphism' as ThemeStyle, label: '✨ 玻璃态' },
                      { value: 'aurora' as ThemeStyle, label: '🌌 极光梦' },
                    ].map((style) => (
                      <button
                        key={style.value}
                        onClick={() => setThemeStyle(style.value)}
                        style={{
                          padding: '8px 16px',
                          background: themeStyle === style.value ? 'rgba(56, 189, 255, 0.2)' : 'transparent',
                          border: `1px solid ${themeStyle === style.value ? 'rgba(56, 189, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: themeStyle === style.value ? '#38BDFF' : 'rgba(255, 255, 255, 0.7)',
                          fontSize: 13,
                          fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          if (themeStyle !== style.value) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (themeStyle !== style.value) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          }
                        }}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* 显示隐藏的切换器按钮 */}
            {!showStyleSwitcher && (
              <button
                onClick={() => setShowStyleSwitcher(true)}
                style={{
                  position: 'fixed',
                  bottom: 32,
                  right: 32,
                  zIndex: 200,
                  pointerEvents: 'auto',
                  width: 48,
                  height: 48,
                  background: 'rgba(30, 30, 30, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: 20,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(40, 40, 40, 0.95)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 30, 30, 0.95)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                🎨
              </button>
            )}
          </>
        );
      })()}
      {(selectedLayerId || _selectedLayerIds.length > 0) && (() => {
        const selectedLayers = _selectedLayerIds.length > 0
          ? layers.filter(l => _selectedLayerIds.includes(l.id) && l.visible)
          : selectedLayerId
          ? layers.filter(l => l.id === selectedLayerId && l.visible)
          : [];

        if (selectedLayers.length === 0) return null;

        // 计算所有选中图层的边界框
        const bounds = selectedLayers.reduce((acc, layer) => {
          return {
            minX: Math.min(acc.minX, layer.x),
            minY: Math.min(acc.minY, layer.y),
            maxX: Math.max(acc.maxX, layer.x + layer.width),
            maxY: Math.max(acc.maxY, layer.y + layer.height),
          };
        }, {
          minX: selectedLayers[0].x,
          minY: selectedLayers[0].y,
          maxX: selectedLayers[0].x + selectedLayers[0].width,
          maxY: selectedLayers[0].y + selectedLayers[0].height,
        });

        return (
          <ImageToolbar
            selectedLayers={selectedLayers}
            layerPosition={{
              x: bounds.minX,
              y: bounds.minY,
              width: bounds.maxX - bounds.minX,
              height: bounds.maxY - bounds.minY,
            }}
            stagePos={stagePos}
            zoom={zoom}
            onDownload={() => {
              if (selectedLayers[0]?.url) {
                const link = document.createElement('a');
                link.href = selectedLayers[0].url;
                link.download = selectedLayers[0].name || 'download';
                link.click();
              }
            }}
            onBatchDownload={() => {
              selectedLayers.forEach((layer, index) => {
                setTimeout(() => {
                  const link = document.createElement('a');
                  link.href = layer.url;
                  link.download = layer.name || `download-${index + 1}`;
                  link.click();
                }, index * 100);
              });
            }}
            onRemix={() => {
              if (selectedLayers.length > 0 && onRemix) {
                onRemix(selectedLayers[0]);
              }
            }}
            onEdit={(quickEditPrompt?: string) => {
              if (selectedLayers.length > 0 && onEdit) {
                onEdit(selectedLayers[0], quickEditPrompt);
              }
            }}
            onFillToDialog={() => {
              if (selectedLayers.length > 0 && onFillToDialog) {
                // 传递所有选中的图片URL（最多10张）
                const imageUrls = selectedLayers
                  .filter(layer => layer.type === 'image')
                  .slice(0, 10)
                  .map(layer => layer.url);
                onFillToDialog(imageUrls.length === 1 ? imageUrls[0] : imageUrls);
              }
            }}
            onFillToKeyframes={onFillToKeyframes}
            onFillToImageGen={onFillToImageGen}
            onMergeLayers={onMergeLayers}
            imageBottomY={(() => {
              // 计算图片底部屏幕坐标
              const scale = zoom / 100;
              const canvasTopOffset = 60;
              return bounds.maxY * scale + stagePos.y + canvasTopOffset;
            })()}
          />
        );
      })()}
      {/* 图片标签和Info按钮 - 仅显示单张选中的图片 */}
      {(() => {
        if (_selectedLayerIds.length !== 1) return null;

        const selectedLayer = layers.find(l => l.id === _selectedLayerIds[0]);
        if (!selectedLayer || !selectedLayer.visible) return null;

        const scale = zoom / 100;
        // 图片位置（左上角）
        const screenX = selectedLayer.x * scale + stagePos.x;
        const screenY = selectedLayer.y * scale + stagePos.y;
        const screenWidth = selectedLayer.width * scale;

        const lightTheme = isLightTheme(themeStyle);

        // 判断是图片还是视频
        const mediaName = selectedLayer.name || '未命名';
        // 名字条：底部距离图片上方 8px，高度 16px
        const labelHeight = 16;
        const labelGap = 8;
        const labelTop = screenY - labelGap - labelHeight;

        // 计算可用空间：图片宽度 - info按钮宽度(16) - 间距(8)
        const availableWidth = screenWidth - 16 - 8;
        // 名称区域最小宽度：图标(16) + gap(2) + 一些文字空间(40)
        const minNameWidth = 16 + 2 + 40;
        // 只显示图标的最小宽度
        const iconOnlyWidth = 16 + 8;

        // 决定显示模式：full(完整), icon(只有图标), none(隐藏)
        const nameDisplayMode = availableWidth >= minNameWidth ? 'full' :
                                availableWidth >= iconOnlyWidth ? 'icon' : 'none';

        return (
          <>
            {/* 左上角：媒体icon + 名称 - 与图片左边对齐 */}
            {nameDisplayMode !== 'none' && (
              <div
                style={{
                  position: 'fixed',
                  left: screenX,
                  top: labelTop,
                  height: labelHeight,
                  maxWidth: availableWidth,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  zIndex: 500,
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={selectedLayer.type === 'video' ? iconVideo : iconImage}
                  alt=""
                  width={16}
                  height={16}
                  style={{
                    flexShrink: 0,
                    filter: lightTheme ? 'brightness(0.3)' : 'brightness(0) invert(1)',
                    opacity: 0.45,
                  }}
                />
                {nameDisplayMode === 'full' && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: lightTheme ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '16px',
                    }}
                  >
                    {mediaName}
                  </span>
                )}
              </div>
            )}

            {/* 右上角：Info按钮 - 与图片右边对齐 */}
            <button
              style={{
                position: 'fixed',
                left: screenX + screenWidth - 16,
                top: labelTop,
                width: labelHeight,
                height: labelHeight,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                zIndex: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.15s ease',
              }}
              onClick={(e) => {
                setDetailPanelLayer(selectedLayer);
                // 保存锚点位置（info按钮中心）
                const buttonRect = e.currentTarget.getBoundingClientRect();
                setDetailPanelAnchor({
                  x: buttonRect.left + buttonRect.width / 2,
                  y: buttonRect.bottom,
                });
                // 保存图层位置（用于 tooltip 样式）
                setDetailPanelLayerPosition({
                  x: selectedLayer.x,
                  y: selectedLayer.y,
                  width: selectedLayer.width,
                  height: selectedLayer.height,
                });
                setShowDetailPanel(true);
                setDetailPanelManualClosed(false); // 重置手动关闭状态
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
                // hover 时立即显示详情面板
                setDetailPanelLayer(selectedLayer);
                const buttonRect = e.currentTarget.getBoundingClientRect();
                setDetailPanelAnchor({
                  x: buttonRect.left + buttonRect.width / 2,
                  y: buttonRect.bottom,
                });
                setDetailPanelLayerPosition({
                  x: selectedLayer.x,
                  y: selectedLayer.y,
                  width: selectedLayer.width,
                  height: selectedLayer.height,
                });
                setShowDetailPanel(true);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              title="查看详情"
            >
              <img
                src={iconInfo}
                alt="详情"
                width={16}
                height={16}
                style={{
                  filter: lightTheme ? 'brightness(0.3)' : 'brightness(0) invert(1)',
                  opacity: 0.45,
                }}
              />
            </button>
          </>
        );
      })()}
      {/* 生成中遮罩 - 作为可交互的画板元素 */}
      {generationTasks
        .filter(task => task.status === 'generating')
        .map(task => {
          const scale = zoom / 100;

          // task.position 已经是画布坐标（图片中心点），需要转换为左上角坐标
          const canvasX = task.position.x - task.width / 2;
          const canvasY = task.position.y - task.height / 2;

          // 将画布坐标转换为屏幕坐标（用于定位）
          const screenX = canvasX * scale + stagePos.x;
          const screenY = canvasY * scale + stagePos.y;
          const screenWidth = task.width * scale;
          const screenHeight = task.height * scale;

          const isSelected = selectedTaskIds?.includes(task.id);
          const isDraggingState = draggingTaskId === task.id;

          const handleMouseDown = (e: React.MouseEvent) => {
            e.stopPropagation();

            // 先选中任务
            if (!isSelected) {
              onTaskSelect?.(task.id, e.ctrlKey || e.metaKey);
            }

            // 允许拖拽（无论是否已选中）
            const startX = e.clientX;
            const startY = e.clientY;
            const startCenterX = task.position.x;
            const startCenterY = task.position.y;
            let isDragging = false;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = moveEvent.clientX - startX;
              const deltaY = moveEvent.clientY - startY;

              // 阈值设为 5px，更灵敏的拖拽响应
              if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
                isDragging = true;
                setDraggingTaskId(task.id);
              }

              if (isDragging) {
                // 直接計算新的畫布座標（中心点坐标）
                const deltaCanvasX = deltaX / scale;
                const deltaCanvasY = deltaY / scale;

                onTaskUpdate?.(task.id, {
                  x: startCenterX + deltaCanvasX,
                  y: startCenterY + deltaCanvasY,
                });
              }
            };

            const handleMouseUp = () => {
              setDraggingTaskId(null);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          };

          // 计算已用时间
          const elapsedTime = task.startedAt ? (Date.now() - task.startedAt) / 1000 : 0;
          const estimatedTime = task.estimatedDuration || 60;

          // 渲染生成遮罩组件
          const renderOverlay = () => {
            const overlayProps = {
              position: { x: screenWidth / 2, y: screenHeight / 2 },
              width: screenWidth,
              height: screenHeight,
              progress: task.progress,
              taskId: task.id,
              elapsedTime,
              estimatedTime,
            };

            return <GeneratingOverlay {...overlayProps} />;
          };

          return (
            <div
              key={task.id}
              style={{
                position: 'absolute',
                left: screenX,
                top: screenY,
                width: screenWidth,
                height: screenHeight,
                cursor: isDraggingState ? 'grabbing' : isSelected ? 'grab' : 'pointer',
                userSelect: 'none',
                zIndex: 2000,
                borderRadius: '12px',
                boxSizing: 'border-box',
                outline: isSelected ? '2px solid rgba(59, 130, 246, 0.8)' : 'none',
                outlineOffset: 2,
                transition: isDraggingState ? 'none' : 'all 0.15s ease-out',
              }}
              onMouseDown={handleMouseDown}
            >
              {renderOverlay()}
            </div>
          );
        })}
      {/* 選擇框視覺反饋 */}
      {isSelecting && selectionBox && (() => {
        const theme = getThemeStyles(themeStyle);
        return (
          <div
            style={{
              position: 'absolute',
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
              border: `2px solid ${(theme as any).selectionStroke}`,
              background: (theme as any).selectionFill,
              pointerEvents: 'none',
              zIndex: 1999,
              transition: 'all 0.2s ease',
            }}
          />
        );
      })()}
      {/* 视频控制面板 */}
      {(() => {
        const selectedVideoLayers = layers.filter(l =>
          _selectedLayerIds.includes(l.id) && l.type === 'video' && l.visible
        );

        if (selectedVideoLayers.length !== 1) return null;

        // TODO: 获取 video 元素和实现视频控制面板 - imageCache 尚未实现
        // 暂时返回 null，等待视频缓存系统实现
        return null;
        // const videoElement = imageCache.current.get(videoLayer.id);
        // if (!videoElement || !(videoElement instanceof HTMLVideoElement)) return null;

        // TODO: 实现视频控制面板
        // return (
        //   <div
        //     style={{
        //       position: 'absolute',
        //       left: screenX,
        //       top: screenY + screenHeight + 8,
        //       width: screenWidth,
        //       zIndex: 2001,
        //       pointerEvents: 'auto',
        //     }}
        //     onMouseDown={(e) => e.stopPropagation()}
        //     onClick={(e) => e.stopPropagation()}
        //   >
        //     <VideoControls video={videoElement} />
        //   </div>
        // );
      })()}

      {/* Detail Panel - 根据样式显示不同组件 */}
      {showDetailPanel && detailPanelLayer && (() => {
        const handleClose = () => {
          setShowDetailPanel(false);
          setDetailPanelLayer(null);
          setDetailPanelAnchor(null);
          setDetailPanelLayerPosition(null);
          setDetailPanelManualClosed(true); // 用户手动关闭
        };

        return (
          <DetailPanelSimple
            layer={detailPanelLayer}
            onClose={handleClose}
          />
        );
      })()}

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              id: 'upload',
              label: '上传本地档案',
              icon: (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M15.75 11.25V14.25C15.75 14.6478 15.592 15.0294 15.3107 15.3107C15.0294 15.592 14.6478 15.75 14.25 15.75H3.75C3.35218 15.75 2.97064 15.592 2.68934 15.3107C2.40804 15.0294 2.25 14.6478 2.25 14.25V11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12.75 6L9 2.25L5.25 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 2.25V11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              onClick: handleUploadLocal,
            },
            {
              id: 'library',
              label: '从资料库导入',
              icon: <img src={libraryIcon} alt="" style={{ width: 18, height: 18 }} />,
              onClick: handleImportFromLibrary,
            },
          ] as ContextMenuEntry[]}
        />
      )}

      {/* 资料库弹窗 */}
      {showLibraryDialog && (
        <LibraryDialog
          onSelect={(url: string) => {
            if (libraryInsertPosition) {
              const img = new window.Image();
              img.onload = () => {
                onLayerAdd({
                  x: libraryInsertPosition.x,
                  y: libraryInsertPosition.y,
                  width: img.width,
                  height: img.height,
                  url: url,
                  name: `Library Image ${new Date().toLocaleTimeString()}`,
                  visible: true,
                  locked: false,
                  selected: false,
                });
              };
              img.src = url;
            }
            setShowLibraryDialog(false);
            setLibraryInsertPosition(null);
          }}
          onClose={() => {
            setShowLibraryDialog(false);
            setLibraryInsertPosition(null);
          }}
        />
      )}
    </div>
  );
};

// Canvas component

export default Canvas;

