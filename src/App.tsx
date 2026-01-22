import { useState, useCallback, useEffect, useRef } from 'react';
import Canvas from './components/Canvas';
import TopBar from './components/TopBar';
import BottomDialog, { BottomDialogRef } from './components/BottomDialog';
import LayerPanel from './components/LayerPanel';
import ImageDetails from './components/ImageDetails';
import ToastContainer, { ToastItem } from './components/ToastContainer';
import LandingPage from './components/LandingPage';
import AllProjectsPage from './components/AllProjectsPage';
import LoadingScreen from './components/LoadingScreen';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import { ImageLayer, Comment, EditMode, GenerationTask, GenerationConfig } from './types';
import { ThemeProvider, useTheme, getThemeStyles, isLightTheme } from './contexts/ThemeContext';
// 导入生成遮罩组件
import GeneratingOverlay from './components/GeneratingOverlay';

function AppContent() {
  const { themeStyle } = useTheme();
  const theme = getThemeStyles(themeStyle);
  const lightTheme = isLightTheme(themeStyle);

  const [showLandingPage, setShowLandingPage] = useState(true);
  const [showAllProjectsPage, setShowAllProjectsPage] = useState(false);
  const [transitionVariant, setTransitionVariant] = useState<'morph' | 'curtain' | 'zoom' | 'ink' | 'fold'>('morph');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [gridTransitionVersion, setGridTransitionVersion] = useState<0 | 1 | 2 | 3>(0);
  const [showLoading, setShowLoading] = useState(false);
  const [pendingGenerationConfig, setPendingGenerationConfig] = useState<GenerationConfig | null>(null);
  const [layers, setLayers] = useState<ImageLayer[]>([]);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [editMode, setEditMode] = useState<EditMode>('normal');
  const [zoom, setZoom] = useState(75);
  const [credits] = useState(200.20);
  const [projectName, setProjectName] = useState('Untitled');
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsManualClosed, setIsDetailsManualClosed] = useState(false); // 用户是否手动关闭了详情面板
  const [detailPanelAnchor, setDetailPanelAnchor] = useState<{ x: number; y: number } | null>(null); // 用于 popover 的锚点位置
  const [isBottomDialogExpanded, setIsBottomDialogExpanded] = useState(true); // 默认展开
  const [generationTasks, setGenerationTasks] = useState<GenerationTask[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const getCanvasCenterRef = useRef<(() => { x: number; y: number }) | null>(null);
  const getCanvasToScreenRef = useRef<((canvasPos: { x: number; y: number }) => { x: number; y: number }) | null>(null);
  const getScreenToCanvasRef = useRef<((screenPos: { x: number; y: number }) => { x: number; y: number }) | null>(null);
  const bottomDialogRef = useRef<BottomDialogRef>(null);
  const processedGenerationTasksRef = useRef<Set<string>>(new Set()); // 跟踪已处理的生成任务
  const lastGenerationTimeRef = useRef<number>(0); // 跟踪最后一次生成的时间

  const selectedLayer = selectedLayerIds.length === 1 ? layers.find(l => l.id === selectedLayerIds[0]) : null;
  const selectedLayerId = selectedLayerIds.length === 1 ? selectedLayerIds[0] : null; // 兼容 Canvas 组件

  // 监听网格过渡版本切换事件
  useEffect(() => {
    const handleVersionChange = (e: CustomEvent<0 | 1 | 2 | 3>) => {
      setGridTransitionVersion(e.detail);
    };
    window.addEventListener('gridTransitionVersionChange', handleVersionChange as EventListener);
    return () => window.removeEventListener('gridTransitionVersionChange', handleVersionChange as EventListener);
  }, []);

  // 剪贴板状态
  const [clipboardLayers, setClipboardLayers] = useState<ImageLayer[]>([]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + C：复制
      if (cmdOrCtrl && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault();
        if (selectedLayerIds.length > 0) {
          const layersToCopy = layers.filter(l => selectedLayerIds.includes(l.id));
          setClipboardLayers(layersToCopy);
          // addToast(`已复制 ${layersToCopy.length} 个图层`, 'success');
        }
        return;
      }

      // Cmd/Ctrl + V：粘贴
      if (cmdOrCtrl && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
        e.preventDefault();
        if (clipboardLayers.length > 0) {
          const offset = 30; // 粘贴偏移量
          const newLayers = clipboardLayers.map((layer, index) => ({
            ...layer,
            id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
            x: layer.x + offset,
            y: layer.y + offset,
            name: `${layer.name} (副本)`,
          }));
          setLayers(prev => [...prev, ...newLayers]);
          setSelectedLayerIds(newLayers.map(l => l.id));
          // addToast(`已粘贴 ${newLayers.length} 个图层`, 'success');
        }
        return;
      }

      // Cmd/Ctrl + D：复制并粘贴（快速复制）
      if (cmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (selectedLayerIds.length > 0) {
          const offset = 30;
          const layersToDuplicate = layers.filter(l => selectedLayerIds.includes(l.id));
          const newLayers = layersToDuplicate.map((layer, index) => ({
            ...layer,
            id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
            x: layer.x + offset,
            y: layer.y + offset,
            name: `${layer.name} (副本)`,
          }));
          setLayers(prev => [...prev, ...newLayers]);
          setSelectedLayerIds(newLayers.map(l => l.id));
        }
        return;
      }

      // Cmd/Ctrl + A：全选
      if (cmdOrCtrl && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const allLayerIds = layers.filter(l => l.visible && !l.locked).map(l => l.id);
        setSelectedLayerIds(allLayerIds);
        return;
      }

      // Escape：取消选择
      if (e.key === 'Escape') {
        setEditMode('normal');
        setSelectedLayerIds([]);
        setSelectedTaskIds([]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedLayerIds, layers, clipboardLayers]);

  // 选中图层时自动打开底部对话框
  useEffect(() => {
    if (selectedLayerIds.length > 0) {
      setIsBottomDialogExpanded(true);
    }
  }, [selectedLayerIds]);

  const handleLayerSelect = useCallback((layerId: string | null, isMultiSelect: boolean = false) => {
    if (layerId === null) {
      setSelectedLayerIds([]);
      setSelectedTaskIds([]); // 同时清除任务选中
      return;
    }
    
    // 选中图层时，清除任务选中
    setSelectedTaskIds([]);
    
    if (isMultiSelect) {
      // 多选模式：切换选中状态
      setSelectedLayerIds(prev => 
        prev.includes(layerId) 
          ? prev.filter(id => id !== layerId)
          : [...prev, layerId]
      );
    } else {
      // 单选模式：替换选中
      setSelectedLayerIds([layerId]);
    }
  }, []);

  const handleTaskSelect = useCallback((taskId: string | null, isMultiSelect: boolean = false) => {
    if (taskId === null) {
      setSelectedTaskIds([]);
      return;
    }
    
    // 选中任务时，清除图层选中
    setSelectedLayerIds([]);
    
    if (isMultiSelect) {
      // 多选模式：切换选中状态
      setSelectedTaskIds(prev => 
        prev.includes(taskId) 
          ? prev.filter(id => id !== taskId)
          : [...prev, taskId]
      );
    } else {
      // 单选模式：替换选中
      setSelectedTaskIds([taskId]);
    }
  }, []);

  const handleTaskUpdate = useCallback((taskId: string, position: { x: number; y: number }) => {
    setGenerationTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, position } : t
    ));
  }, []);

  const handleLayerUpdate = useCallback((layerId: string, updates: Partial<ImageLayer>) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, ...updates } : l));
  }, []);

  // 批量更新多个图层（用于多选拖动，避免逐个更新造成的延迟）
  const handleLayersBatchUpdate = useCallback((updates: Array<{ layerId: string; updates: Partial<ImageLayer> }>) => {
    setLayers(prev => prev.map(layer => {
      const update = updates.find(u => u.layerId === layer.id);
      return update ? { ...layer, ...update.updates } : layer;
    }));
  }, []);

  const handleLayerAdd = useCallback((layer: Omit<ImageLayer, 'id'>) => {
    const newLayer: ImageLayer = {
      ...layer,
      id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      visible: true,
      locked: false,
      selected: false,
    };
    setLayers(prev => [...prev, newLayer]);
    return newLayer.id;
  }, []);

  const handleLayerDelete = useCallback((layerId: string) => {
    setLayers(prev => prev.filter(l => l.id !== layerId));
    setSelectedLayerIds(prev => {
      const newIds = prev.filter(id => id !== layerId);
      if (newIds.length === 0) {
        setIsDetailsOpen(false);
      }
      return newIds;
    });
  }, []);

  // 处理图层重新排序（Z轴顺序）
  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    setLayers(prev => {
      const newLayers = [...prev];
      const [removed] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, removed);
      return newLayers;
    });
  }, []);

  const handleCommentAdd = useCallback((comment: Omit<Comment, 'id' | 'createdAt'>) => {
    const newComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isEditing: true,
    };
    setComments(prev => [...prev, newComment]);
  }, []);

  const handleCommentUpdate = useCallback((commentId: string, updates: Partial<Comment>) => {
    setComments(prev => {
      if (updates.text === '' && !updates.isEditing) {
        // 如果文本为空且不在编辑状态，删除这个comment
        return prev.filter(c => c.id !== commentId);
      }
      return prev.map(c => c.id === commentId ? { ...c, ...updates } : c);
    });
  }, []);

  // 添加通知
  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info', duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  // 移除通知
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // 监听任务完成，添加图层
  useEffect(() => {
    generationTasks.forEach(task => {
      if (task.status === 'completed' && !processedGenerationTasksRef.current.has(task.id)) {
        processedGenerationTasksRef.current.add(task.id);

        const taskConfig = task.config;
        const taskPosition = task.position;

        // task.position 已经是画布坐标，直接使用
        const canvasPos = taskPosition;

        // 根据比例计算图片尺寸（与任务创建时保持一致）
        const baseSize = 400;
        let imageWidth: number;
        let imageHeight: number;

        const [ratioWidth, ratioHeight] = taskConfig.aspectRatio.split(':').map(Number);
        if (ratioWidth && ratioHeight) {
          if (ratioWidth >= ratioHeight) {
            // 横版或正方形：宽度为基准
            imageWidth = baseSize;
            imageHeight = Math.round((baseSize / ratioWidth) * ratioHeight);
          } else {
            // 竖版：高度为基准
            imageHeight = baseSize;
            imageWidth = Math.round((baseSize / ratioHeight) * ratioWidth);
          }
        } else {
          imageWidth = baseSize;
          imageHeight = baseSize;
        }

        // 构建图层数据
        const newLayers: ImageLayer[] = [];

        for (let i = 0; i < taskConfig.count; i++) {
          // 根据模式生成不同的 URL
          let contentUrl: string;
          let layerType: 'image' | 'video';

          if (taskConfig.mode === 'video') {
            // 使用 Pixabay 的免费视频（支持 CORS）
            const sampleVideos = [
              'https://cdn.pixabay.com/video/2024/07/24/222837_large.mp4',
              'https://cdn.pixabay.com/video/2020/05/25/40130-424930446_large.mp4',
              'https://cdn.pixabay.com/video/2019/06/17/24634-343750378_large.mp4',
            ];
            contentUrl = sampleVideos[i % sampleVideos.length];
            layerType = 'video';
          } else {
            // 生成图片 URL
            contentUrl = `https://picsum.photos/${imageWidth}/${imageHeight}?random=${Date.now()}-${i}`;
            layerType = 'image';
          }

          const layerId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`;

          let x: number;
          let y: number;
          const gap = 20; // 图片之间的间距

          if (taskConfig.count === 1) {
            // 单张图：中心对齐
            x = canvasPos.x - imageWidth / 2;
            y = canvasPos.y - imageHeight / 2;
          } else if (taskConfig.count === 4) {
            // 4 张图：2x2 布局
            const col = i % 2; // 0 或 1
            const row = Math.floor(i / 2); // 0 或 1
            const totalWidth = 2 * imageWidth + gap;
            const totalHeight = 2 * imageHeight + gap;
            x = canvasPos.x - totalWidth / 2 + col * (imageWidth + gap);
            y = canvasPos.y - totalHeight / 2 + row * (imageHeight + gap);
          } else {
            // 其他数量：水平排列
            const totalWidth = taskConfig.count * imageWidth + (taskConfig.count - 1) * gap;
            x = canvasPos.x - totalWidth / 2 + i * (imageWidth + gap);
            y = canvasPos.y - imageHeight / 2;
          }

          newLayers.push({
            id: layerId,
            name: taskConfig.count > 1
              ? `Generated ${new Date().toLocaleTimeString()} (${i + 1}/${taskConfig.count})`
              : `Generated ${new Date().toLocaleTimeString()}`,
            url: contentUrl,
            type: layerType,
            x: x,
            y: y,
            width: imageWidth,
            height: imageHeight,
            visible: true,
            locked: false,
            selected: false,
            generationConfig: taskConfig, // 保存生成配置
          });

        }

        // 添加图层
        if (newLayers.length > 0) {
          setLayers(prev => [...prev, ...newLayers]);

          // 显示通知 - 已隐藏
          // const contentType = taskConfig.mode === 'video' ? '个视频' : '张图片';
          // addToast(`成功生成 ${taskConfig.count} ${contentType}`, 'success');

          // 选中第一张
          setSelectedLayerIds([newLayers[0].id]);
        }
      }
    });
  }, [generationTasks, addToast]);

  // 处理生成任务
  // 处理填入对话框（支持多张图片，最多10张）
  const handleFillToDialog = useCallback((imageUrls: string | string[]) => {
    const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    // 调用 BottomDialog 的方法添加参考图片（最多10张）
    bottomDialogRef.current?.addReferenceImages(urls);

    // 展开对话框
    setIsBottomDialogExpanded(true);

    // Focus 到 prompt 输入框
    setTimeout(() => {
      bottomDialogRef.current?.focusPrompt();
    }, 0);
  }, []);

  const handleGenerate = useCallback((config: GenerationConfig) => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 防止快速重复生成
    const now = Date.now();
    if (now - lastGenerationTimeRef.current < 500) {
      return;
    }
    lastGenerationTimeRef.current = now;

    // 计算生成位置（画布坐标系）
    let position: { x: number; y: number };

    // 优先使用选中的图层位置
    if (selectedLayer) {
      position = {
        x: selectedLayer.x + selectedLayer.width + 20,
        y: selectedLayer.y
      };
    }
    // 其次使用参考图片对应的图层位置
    else if (config.referenceImage) {
      const refLayer = layers.find(l => l.url === config.referenceImage);
      if (refLayer) {
        position = {
          x: refLayer.x + refLayer.width + 20,
          y: refLayer.y
        };
      } else {
        // 如果参考图片不在画布上，使用画布中心（需要转换为画布坐标）
        if (getCanvasCenterRef.current) {
          const canvasCenter = getCanvasCenterRef.current();
          position = { x: canvasCenter.x, y: canvasCenter.y };
        } else {
          position = { x: 0, y: 0 };
        }
      }
    }
    // 默认使用画布中心（需要转换为画布坐标）
    else {
      if (getCanvasCenterRef.current) {
        const canvasCenter = getCanvasCenterRef.current();
        position = { x: canvasCenter.x, y: canvasCenter.y };
      } else {
        position = { x: 0, y: 0 };
      }
    }

    // 根据比例计算图片尺寸
    // 基准尺寸：确保生成的内容在视觉上大小合适
    const baseSize = 400;
    let imageWidth: number;
    let imageHeight: number;

    const [ratioWidth, ratioHeight] = config.aspectRatio.split(':').map(Number);
    if (ratioWidth && ratioHeight) {
      if (ratioWidth >= ratioHeight) {
        // 横版或正方形：宽度为基准
        imageWidth = baseSize;
        imageHeight = Math.round((baseSize / ratioWidth) * ratioHeight);
      } else {
        // 竖版：高度为基准
        imageHeight = baseSize;
        imageWidth = Math.round((baseSize / ratioHeight) * ratioWidth);
      }
    } else {
      imageWidth = baseSize;
      imageHeight = baseSize;
    }

    // 遮罩尺寸只按单张图片计算，不管生成多少张
    const maskWidth = imageWidth;
    const maskHeight = imageHeight;

    // 预计生成时间：3-15秒随机，生成数量越多时间越长
    const baseTime = 3 + Math.random() * 7; // 3-10秒基础时间
    const countBonus = (config.count - 1) * (1 + Math.random() * 2); // 每多生成一张增加1-3秒
    const modeBonus = config.mode === 'video' ? 5 + Math.random() * 5 : 0; // 视频额外5-10秒
    const estimatedDuration = Math.min(60, Math.round(baseTime + countBonus + modeBonus)); // 最长60秒

    const newTask: GenerationTask = {
      id: taskId,
      config,
      progress: 0,
      status: 'generating',
      position,
      width: maskWidth,
      height: maskHeight,
      createdAt: new Date().toISOString(),
      startedAt: Date.now(),
      estimatedDuration,
    };

    setGenerationTasks(prev => [...prev, newTask]);

    // 模拟生成进度 - 约 10 秒完成（图片），45 秒（视频）
    // 使用更平滑的进度曲线，让用户感觉更自然
    let progress = 0;
    let isCompleted = false;
    const totalSteps = Math.floor(estimatedDuration * 1000 / 200); // 每 200ms 更新一次
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;

      // 使用 ease-out 曲线让进度更自然
      // 前期快，后期慢，给用户"快完成了"的感觉
      const linearProgress = currentStep / totalSteps;
      progress = Math.min(99, linearProgress * 100 * (2 - linearProgress)); // ease-out quadratic

      if (currentStep >= totalSteps) {
        progress = 100;
        clearInterval(interval);

        if (isCompleted) return;
        isCompleted = true;

        // 生成完成，更新任务状态为 completed
        setTimeout(() => {
          setGenerationTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: 'completed' as const, progress: 100 } : t
          ));
        }, 500);
      } else {
        setGenerationTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, progress } : t
        ));
      }
    }, 200);
  }, [selectedLayer, layers]);

  // 处理 Remix：将配置回填到对话框
  const handleRemix = useCallback((layer: ImageLayer) => {
    if (!layer.generationConfig) {
      addToast('该图层没有生成配置信息', 'error');
      return;
    }

    // 回填配置到对话框
    bottomDialogRef.current?.setConfig(layer.generationConfig);

    // 展开对话框
    setIsBottomDialogExpanded(true);

    // Focus 到 prompt 输入框
    setTimeout(() => {
      bottomDialogRef.current?.focusPrompt();
    }, 0);

  }, [addToast]);

  // 处理 Edit：快速编辑，基于原图 prompt 添加修改描述后生成
  const handleEdit = useCallback((layer: ImageLayer, quickEditPrompt?: string) => {
    if (!layer.generationConfig) {
      addToast('该图层没有生成配置信息', 'error');
      return;
    }

    if (!quickEditPrompt) {
      return;
    }

    // 基于原配置，添加用户的修改描述
    const newConfig = {
      ...layer.generationConfig,
      prompt: `${layer.generationConfig.prompt || ''}, ${quickEditPrompt}`.trim(),
    };

    handleGenerate(newConfig);
  }, [handleGenerate, addToast]);

  // 处理填入首尾帧（1张填首帧，2张以上取前2张）
  const handleFillToKeyframes = useCallback(() => {
    if (selectedLayerIds.length < 1) {
      addToast('请至少选择1张图片', 'error');
      return;
    }

    const firstLayer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!firstLayer) return;

    if (selectedLayerIds.length === 1) {
      // 只有1张：填入首帧，切换到图生视频模式
      bottomDialogRef.current?.setConfig({
        mode: 'video',
        videoCapability: 'image-to-video',
        videoStartFrame: firstLayer.url,
      });
    } else {
      // 2张以上：取前2张作为首尾帧
      const secondLayer = layers.find(l => l.id === selectedLayerIds[1]);
      if (!secondLayer) return;

      bottomDialogRef.current?.setConfig({
        mode: 'video',
        videoCapability: 'first-last-frame',
        videoStartFrame: firstLayer.url,
        videoEndFrame: secondLayer.url,
      });
    }

    // 展开对话框
    setIsBottomDialogExpanded(true);

    // Focus 到 prompt 输入框
    setTimeout(() => {
      bottomDialogRef.current?.focusPrompt();
    }, 0);
  }, [selectedLayerIds, layers, addToast]);

  // 处理填入图像生成（取所有选中图片作为参考，最多10张）
  const handleFillToImageGen = useCallback(() => {
    if (selectedLayerIds.length < 1) {
      addToast('请至少选择1张图片', 'error');
      return;
    }

    // 取所有选中的图片URL（最多10张）
    const selectedLayers = selectedLayerIds
      .map(id => layers.find(l => l.id === id))
      .filter((l): l is ImageLayer => l !== undefined)
      .slice(0, 10);

    if (selectedLayers.length === 0) return;

    // 填入到对话框作为参考图片
    bottomDialogRef.current?.setConfig({
      mode: 'image',
      referenceImages: selectedLayers.map(l => l.url),
    });

    // 展开对话框
    setIsBottomDialogExpanded(true);

    // Focus 到 prompt 输入框
    setTimeout(() => {
      bottomDialogRef.current?.focusPrompt();
    }, 0);

    const count = selectedLayers.length;
  }, [selectedLayerIds, layers, addToast]);

  // 处理合并图层
  const handleMergeLayers = useCallback(() => {
    if (selectedLayerIds.length < 2) {
      addToast('请至少选择2张图片进行合并', 'error');
      return;
    }

    const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id));

    // 找到最左边和最上边的位置
    const minX = Math.min(...selectedLayers.map(l => l.x));
    const minY = Math.min(...selectedLayers.map(l => l.y));
    const maxX = Math.max(...selectedLayers.map(l => l.x + l.width));
    const maxY = Math.max(...selectedLayers.map(l => l.y + l.height));

    const mergedWidth = maxX - minX;
    const mergedHeight = maxY - minY;

    // 创建 canvas 来合并图片
    const canvas = document.createElement('canvas');
    canvas.width = mergedWidth;
    canvas.height = mergedHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // 清空画布（透明背景）
    ctx.clearRect(0, 0, mergedWidth, mergedHeight);

    let loadedCount = 0;
    const images: { img: HTMLImageElement; layer: ImageLayer }[] = [];

    // 加载所有图片
    selectedLayers.forEach(layer => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        images.push({ img, layer });
        loadedCount++;

        // 所有图片加载完成后合并
        if (loadedCount === selectedLayers.length) {
          // 按照图层在数组中的顺序绘制（先添加的在下面）
          selectedLayers.forEach(layer => {
            const imgData = images.find(i => i.layer.id === layer.id);
            if (imgData) {
              const x = layer.x - minX;
              const y = layer.y - minY;
              ctx.drawImage(imgData.img, x, y, layer.width, layer.height);
            }
          });

          // 转换为 data URL
          const mergedUrl = canvas.toDataURL('image/png');

          // 获取第一个图层（保留这个图层，更新它的内容）
          const firstLayer = selectedLayers[0];

          // 更新第一个图层为合并后的图片
          handleLayerUpdate(firstLayer.id, {
            url: mergedUrl,
            x: minX,
            y: minY,
            width: mergedWidth,
            height: mergedHeight,
            name: 'Merged Image',
          });

          // 删除其他被合并的图层
          selectedLayers.slice(1).forEach(layer => {
            handleLayerDelete(layer.id);
          });

          // 保持选中第一个图层
          handleLayerSelect(firstLayer.id, false);
        }
      };

      img.onerror = () => {
        addToast('图片加载失败', 'error');
      };

      img.src = layer.url;
    });
  }, [selectedLayerIds, layers, handleLayerUpdate, handleLayerDelete, handleLayerSelect, addToast]);

  // 处理图层拆分（生成新图） - 使用与 handleGenerate 相同的防重复机制

  // 分层演示 - 生成演示图片并拆分成上下两半
  const handleLayeredDemo = useCallback(() => {
    // 获取选中的layer
    const selectedLayer = selectedLayerIds.length > 0
      ? layers.find(l => l.id === selectedLayerIds[0])
      : null;

    if (!selectedLayer) {
      addToast('Please select an image first', 'error');
      return;
    }

    // 创建生成任务，位置在选中图片的右侧
    const taskId = `layered-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 将选中图片的右侧位置转换为屏幕坐标
    let canvasToScreenPos = { x: 0, y: 0 };
    if (getCanvasToScreenRef.current) {
      const layerRightX = selectedLayer.x + selectedLayer.width + 20;
      const layerCenterY = selectedLayer.y + selectedLayer.height / 2;
      canvasToScreenPos = getCanvasToScreenRef.current({ x: layerRightX, y: layerCenterY });
    }

    const position = canvasToScreenPos.x > 0 && canvasToScreenPos.y > 0
      ? canvasToScreenPos
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 }; // 备用位置

    const newTask: GenerationTask = {
      id: taskId,
      config: { mode: 'image', aspectRatio: '1:1', count: 1, prompt: '', model: '', enhancePrompt: false, loraWeight: 0 },
      progress: 0,
      status: 'generating',
      position,
      width: 512,
      height: 512,
      createdAt: new Date().toISOString(),
    };

    setGenerationTasks(prev => [...prev, newTask]);

    // 模拟进度
    let progress = 0;
    let isCompleted = false;
    const interval = setInterval(() => {
      progress += Math.random() * 20 + 10; // 每次增加10-30%
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        if (isCompleted) return;
        isCompleted = true;

        // 完成后，删除生成任务并添加分割后的图片
        setTimeout(() => {
          try {

            // 加载选中的图片
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            let imageProcessed = false;

            img.onload = () => {
              try {
                if (imageProcessed) return;
                imageProcessed = true;

                // 创建 Canvas 并拆分
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  addToast('Failed to create canvas context', 'error');
                  return;
                }

                ctx.drawImage(img, 0, 0);

                // 计算新图位置 - 在原图右侧 20px
                const newX = selectedLayer.x + selectedLayer.width + 20;

                // 上半部分
                const topCanvas = document.createElement('canvas');
                topCanvas.width = img.width;
                topCanvas.height = img.height / 2;
                const topCtx = topCanvas.getContext('2d');
                if (topCtx) {
                  topCtx.drawImage(img, 0, 0, img.width, img.height / 2, 0, 0, img.width, img.height / 2);
                  const topImageUrl = topCanvas.toDataURL('image/png');
                  handleLayerAdd({
                    name: `${selectedLayer.name} (Top)`,
                    url: topImageUrl,
                    type: 'image',
                    x: newX,  // 使用右侧位置
                    y: selectedLayer.y,  // 和原图顶部对齐
                    width: selectedLayer.width,
                    height: selectedLayer.height / 2,
                    visible: true,
                    locked: false,
                    selected: false,
                  });
                }

                // 下半部分
                const bottomCanvas = document.createElement('canvas');
                bottomCanvas.width = img.width;
                bottomCanvas.height = img.height / 2;
                const bottomCtx = bottomCanvas.getContext('2d');
                if (bottomCtx) {
                  bottomCtx.drawImage(img, 0, img.height / 2, img.width, img.height / 2, 0, 0, img.width, img.height / 2);
                  const bottomImageUrl = bottomCanvas.toDataURL('image/png');
                  handleLayerAdd({
                    name: `${selectedLayer.name} (Bottom)`,
                    url: bottomImageUrl,
                    type: 'image',
                    x: newX,  // 使用右侧位置
                    y: selectedLayer.y + selectedLayer.height / 2,  // 在上半部分下方
                    width: selectedLayer.width,
                    height: selectedLayer.height / 2,
                    visible: true,
                    locked: false,
                    selected: false,
                  });
                }

                // 完成后立即删除任务
                setGenerationTasks(prev => prev.filter(t => t.id !== taskId));
              } catch (error) {
                console.error('Error processing image:', error);
                addToast('Error processing image', 'error');
                // 出错时也删除任务
                setGenerationTasks(prev => prev.filter(t => t.id !== taskId));
              }
            };

            img.onerror = () => {
              addToast('Failed to load image', 'error');
              // 出错时删除任务
              setGenerationTasks(prev => prev.filter(t => t.id !== taskId));
            };

            img.src = selectedLayer.url;
          } catch (error) {
            console.error('Error in layers demo:', error);
            addToast('Error splitting image', 'error');
            // 出错时删除任务
            setGenerationTasks(prev => prev.filter(t => t.id !== taskId));
          }
        }, 500);
      } else {
        // 更新进度
        setGenerationTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, progress } : t
        ));
      }
    }, 150);
  }, [selectedLayerIds, layers, handleLayerAdd, addToast]);

  // 处理删除键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        if (selectedLayerIds.length > 0) {
          selectedLayerIds.forEach(id => handleLayerDelete(id));
          // addToast(`已删除 ${selectedLayerIds.length} 张图片`, 'info'); // 已隐藏删除通知
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerIds, handleLayerDelete, addToast]);

  // 处理从首页创建新项目
  const handleCreateProject = useCallback(() => {
    // 清空画布，进入画布页面
    setLayers([]);
    setSelectedLayerIds([]);
    setSelectedTaskIds([]);
    setComments([]);
    setGenerationTasks([]);
    setProjectName('Untitled');
    setShowLandingPage(false);
  }, []);

  // 处理从首页打开项目
  const handleOpenProject = useCallback((_projectId: string) => {
    // TODO: 从本地存储或服务器加载项目数据
    // 这里先简单地进入画布
    setShowLandingPage(false);
  }, []);

  // 处理从首页开始生成
  const handleStartGeneration = useCallback((config: GenerationConfig) => {
    // 保存生成配置
    setPendingGenerationConfig(config);
    setIsTransitioning(true);

    // 网格脉冲过渡时长：700ms（优化后）
    const gridTransitionDuration = 700;

    setTimeout(() => {
      // 网格动画结束后，隐藏首页内容，显示 loading（网格继续显示）
      setShowLandingPage(false);
      setIsTransitioning(false);
      setShowLoading(true);
    }, gridTransitionDuration);
  }, []);

  // Loading 完成后的回调
  const handleLoadingComplete = useCallback(() => {
    setShowLoading(false);

    // 使用保存的配置开始生成
    if (pendingGenerationConfig) {
      setTimeout(() => {
        handleGenerate(pendingGenerationConfig);
        setIsBottomDialogExpanded(true);
        setPendingGenerationConfig(null);
      }, 100);
    }
  }, [handleGenerate, pendingGenerationConfig]);

  // 使用与首页相同的渐变背景
  const canvasBackground = lightTheme
    ? 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)'
    : 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)';

  // 如果显示 loading，渲染 loading 界面（背景 + 网格 + loading文字）
  if (showLoading) {
    return (
      <>
        {/* 全局背景层 */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: canvasBackground,
            backgroundSize: '200% 200%',
            animation: 'gradient-shift 15s ease infinite',
            zIndex: -10,
          }}
        />

        {/* 画布网格背景 - 继续显示 */}
        <div className="canvas-grid-container">
          {/* 垂直网格线 */}
          {[...Array(12)].map((_, i) => (
            <div
              key={`canvas-v-${i}`}
              className="canvas-grid-line"
              style={{
                left: `${(i + 1) * 8.33}%`,
                top: 0,
                width: '1px',
                height: '100%',
                opacity: 1,
              }}
            />
          ))}
          {/* 水平网格线 */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`canvas-h-${i}`}
              className="canvas-grid-line"
              style={{
                left: 0,
                top: `${(i + 1) * 12.5}%`,
                width: '100%',
                height: '1px',
                opacity: 1,
              }}
            />
          ))}
        </div>

        <style>{`
          @keyframes gradient-shift {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }

          /* 画布网格背景 */
          .canvas-grid-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
          }

          .canvas-grid-line {
            position: absolute;
            background: ${lightTheme
              ? 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.1), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.15), transparent)'
            };
          }
        `}</style>

        <LoadingScreen onComplete={handleLoadingComplete} duration={1500} />
      </>
    );
  }

  // 如果显示首页，渲染首页
  if (showLandingPage || isTransitioning) {
    return (
      <>
        {/* 全局背景层 - 始终可见 */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: canvasBackground,
            backgroundSize: '200% 200%',
            animation: 'gradient-shift 15s ease infinite',
            zIndex: -10,
          }}
        />
        <style>{`
          @keyframes gradient-shift {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
        `}</style>
        <LandingPage
          onCreateProject={handleCreateProject}
          onOpenProject={handleOpenProject}
          onStartGeneration={handleStartGeneration}
          transitionVariant={transitionVariant}
          onTransitionVariantChange={setTransitionVariant}
          isTransitioning={isTransitioning}
          gridTransitionVersion={gridTransitionVersion}
          onShowDeleteSuccess={() => addToast('项目删除成功', 'success')}
        />
        {/* 通知容器 - 全局可见 */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <>
      {/* 全局背景层 - 始终可见 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: canvasBackground,
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 15s ease infinite',
          zIndex: -10,
        }}
      />
      <div style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        animation: 'canvasFadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        zIndex: 0,
        background: 'transparent',
      }}>
      <style>{`
        @keyframes canvasFadeIn {
          from {
            opacity: 0;
            transform: scale(0.98) translateY(5px);
            filter: blur(3px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0px);
            filter: blur(0px);
          }
        }

        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
      <TopBar
        zoom={zoom}
        onZoomChange={setZoom}
        credits={credits}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onLogoClick={() => setShowLandingPage(true)}
        onGoHome={() => setShowLandingPage(true)}
        onGoToProjects={() => {
          setShowAllProjectsPage(true);
        }}
        onNewProject={() => {
          // 新建项目 - 清空画布
          setLayers([]);
          setSelectedLayerIds([]);
          setProjectName('Untitled');
        }}
        onDeleteProject={() => {
          setDeleteConfirmVisible(true);
        }}
        onImportImage={() => {
          // 导入图片
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.multiple = true;
          input.onchange = (e: any) => {
            const files = e.target.files;
            if (files) {
              Array.from(files).forEach((file: any, index: number) => {
                const reader = new FileReader();
                reader.onload = (event: any) => {
                  const img = new window.Image();
                  img.onload = () => {
                    const newLayer: Omit<ImageLayer, 'id'> = {
                      x: 100 + index * 50,
                      y: 100 + index * 50,
                      width: img.width,
                      height: img.height,
                      url: event.target.result,
                      name: file.name,
                      visible: true,
                      locked: false,
                      selected: false,
                    };
                    handleLayerAdd(newLayer);
                  };
                  img.src = event.target.result;
                };
                reader.readAsDataURL(file);
              });
            }
          };
          input.click();
        }}
        onShowAllImages={() => {
          // 显示画布所有图片 - 缩放到全部可见
          if (layers.length > 0) {
            setZoom(50);
          }
        }}
      />
      <Canvas
        layers={layers}
        selectedLayerId={selectedLayerId}
        selectedLayerIds={selectedLayerIds}
        selectedTaskIds={selectedTaskIds}
        onLayerSelect={handleLayerSelect}
        onTaskSelect={handleTaskSelect}
        onTaskUpdate={handleTaskUpdate}
        onLayerUpdate={handleLayerUpdate}
        onLayersBatchUpdate={handleLayersBatchUpdate}
        onLayerAdd={handleLayerAdd}
        onLayeredDemo={handleLayeredDemo}
        zoom={zoom}
        onZoomChange={setZoom}
        editMode={editMode}
        comments={comments}
        onCommentAdd={handleCommentAdd}
        onCommentUpdate={handleCommentUpdate}
        onLayerDelete={handleLayerDelete}
        onFillToDialog={handleFillToDialog}
        onRemix={handleRemix}
        onEdit={handleEdit}
        onFillToKeyframes={handleFillToKeyframes}
        onFillToImageGen={handleFillToImageGen}
        onMergeLayers={handleMergeLayers}
        generationTasks={generationTasks}
        onGetCanvasCenter={(callback) => {
          getCanvasCenterRef.current = callback;
        }}
        onGetCanvasToScreen={(callback) => {
          getCanvasToScreenRef.current = callback;
        }}
        onGetScreenToCanvas={(callback) => {
          getScreenToCanvasRef.current = callback;
        }}
        hasCompletedOnboarding={false}
      />
      <LayerPanel
        layers={layers}
        selectedLayerIds={selectedLayerIds}
        isOpen={isLayerPanelOpen}
        onClose={() => setIsLayerPanelOpen(false)}
        onOpen={() => setIsLayerPanelOpen(true)}
        onLayerSelect={handleLayerSelect}
        onLayerUpdate={handleLayerUpdate}
        onLayerDelete={handleLayerDelete}
        onLayerAdd={handleLayerAdd}
        onLayerReorder={handleLayerReorder}
      />
      {selectedLayer && isDetailsOpen && (
        <ImageDetails
          layer={selectedLayer}
          onClose={() => setIsDetailsOpen(false)}
          onLayerUpdate={handleLayerUpdate}
        />
      )}
      <BottomDialog
        ref={bottomDialogRef}
        isExpanded={isBottomDialogExpanded}
        onToggle={() => setIsBottomDialogExpanded(!isBottomDialogExpanded)}
        selectedLayer={selectedLayer || null}
        selectedLayerIds={selectedLayerIds}
        layers={layers}
        editMode={editMode}
        onGenerate={handleGenerate}
        onLayerSelect={handleLayerSelect}
      />
      {/* 通知容器 */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />



      </div>

      {/* 全部项目页面 */}
      {showAllProjectsPage && (
        <AllProjectsPage
          projects={[
            { id: '1', name: '未命名', thumbnailUrl: 'https://picsum.photos/400/300?random=1', updatedAt: '2026-01-17' },
            { id: '2', name: '未命名', thumbnailUrl: 'https://picsum.photos/400/300?random=2', updatedAt: '2026-01-17' },
            { id: '3', name: 'Untitled', thumbnailUrl: 'https://picsum.photos/400/300?random=3', updatedAt: '2026-01-16' },
            { id: '4', name: '未命名', thumbnailUrl: 'https://picsum.photos/400/300?random=4', updatedAt: '2026-01-15' },
          ]}
          onClose={() => setShowAllProjectsPage(false)}
          onOpenProject={(_projectId) => {
            // TODO: 实现项目加载逻辑
            setShowAllProjectsPage(false);
          }}
          onCreateProject={() => {
            setLayers([]);
            setSelectedLayerIds([]);
            setProjectName('Untitled');
            setShowAllProjectsPage(false);
          }}
          onShowDeleteSuccess={() => addToast('项目删除成功', 'success')}
        />
      )}

      <DeleteConfirmModal
        visible={deleteConfirmVisible}
        title="删除项目"
        content={`确定要删除「${projectName}」吗？此操作无法撤销。`}
        onOk={() => {
          setDeleteConfirmVisible(false);
          setLayers([]);
          setSelectedLayerIds([]);
          setProjectName('Untitled');
          setShowLandingPage(true);
          addToast('项目删除成功', 'success');
        }}
        onCancel={() => {
          setDeleteConfirmVisible(false);
        }}
      />

      </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

