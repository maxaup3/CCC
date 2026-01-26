/**
 * tldraw 整合版本 - 完整功能
 * 使用 tldraw 无限画布 + 所有原有 UI 组件和功能
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Tldraw,
  Editor,
  createShapeId,
  TLComponents,
  useEditor,
  track,
  TLShapeId,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { AIImageShapeUtil, videoElementsMap } from './components/tldraw-poc/AIImageShape'
import VideoControls from './components/tldraw-poc/VideoControls'
import TopBar from './components/TopBar'
import BottomDialog, { BottomDialogRef } from './components/BottomDialog'
import LayerPanel from './components/LayerPanel'
import ToastContainer, { ToastItem } from './components/ToastContainer'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import GeneratingOverlay from './components/GeneratingOverlay'
import ImageToolbar from './components/ImageToolbar'
import DetailPanelSimple from './components/DetailPanelSimple'
import ContextMenu, { ContextMenuEntry } from './components/ContextMenu'
import LibraryDialog from './components/LibraryDialog'
import LandingPage from './components/LandingPage'
import AllProjectsPage from './components/AllProjectsPage'
import LoadingScreen from './components/LoadingScreen'
import { ImageLayer, GenerationTask, GenerationConfig, EditMode } from './types'
import { ThemeProvider, useTheme, getThemeStyles, isLightTheme } from './contexts/ThemeContext'
import {
  getViewportCenter,
  getImageSizeFromAspectRatio,
  calculateGridLayout,
  getGridPosition,
} from './utils/canvasUtils'

// 自定义形状
const customShapeUtils = [AIImageShapeUtil]

// 自定义网格组件 - 使用主题配色
function CustomGrid({ x, y, z }: { x: number; y: number; z: number; size: number }) {
  const { themeStyle } = useTheme()
  const theme = getThemeStyles(themeStyle)

  const smallGridSize = 20
  const largeGridSize = 100

  // 从主题获取网格颜色，默认使用蓝紫色调
  const baseGridColor = theme.gridColor || 'rgba(102, 126, 234, 0.06)'
  // 大网格颜色稍微亮一些
  const smallGridColor = baseGridColor
  const largeGridColor = baseGridColor.replace(/[\d.]+\)$/, (match) => {
    const opacity = parseFloat(match)
    return `${Math.min(opacity * 1.5, 0.2)})`
  })

  const viewWidth = window.innerWidth
  const viewHeight = window.innerHeight

  // 将屏幕原点转换为画布坐标
  const canvasStartX = -x
  const canvasStartY = -y
  const canvasEndX = (viewWidth / z) - x
  const canvasEndY = (viewHeight / z) - y

  // 计算小网格线的范围
  const smallStartX = Math.floor(canvasStartX / smallGridSize) * smallGridSize
  const smallStartY = Math.floor(canvasStartY / smallGridSize) * smallGridSize
  const smallEndX = Math.ceil(canvasEndX / smallGridSize) * smallGridSize
  const smallEndY = Math.ceil(canvasEndY / smallGridSize) * smallGridSize

  // 计算大网格线的范围
  const largeStartX = Math.floor(canvasStartX / largeGridSize) * largeGridSize
  const largeStartY = Math.floor(canvasStartY / largeGridSize) * largeGridSize
  const largeEndX = Math.ceil(canvasEndX / largeGridSize) * largeGridSize
  const largeEndY = Math.ceil(canvasEndY / largeGridSize) * largeGridSize

  // 生成路径
  let smallPath = ''
  let largePath = ''

  // 小网格竖线
  for (let gx = smallStartX; gx <= smallEndX; gx += smallGridSize) {
    const screenX = (gx + x) * z
    smallPath += `M ${screenX} 0 L ${screenX} ${viewHeight} `
  }
  // 小网格横线
  for (let gy = smallStartY; gy <= smallEndY; gy += smallGridSize) {
    const screenY = (gy + y) * z
    smallPath += `M 0 ${screenY} L ${viewWidth} ${screenY} `
  }

  // 大网格竖线
  for (let gx = largeStartX; gx <= largeEndX; gx += largeGridSize) {
    const screenX = (gx + x) * z
    largePath += `M ${screenX} 0 L ${screenX} ${viewHeight} `
  }
  // 大网格横线
  for (let gy = largeStartY; gy <= largeEndY; gy += largeGridSize) {
    const screenY = (gy + y) * z
    largePath += `M 0 ${screenY} L ${viewWidth} ${screenY} `
  }

  return (
    <svg
      className="tl-grid"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {/* 小网格 */}
      <path d={smallPath} stroke={smallGridColor} strokeWidth={1} fill="none" />
      {/* 大网格 */}
      <path d={largePath} stroke={largeGridColor} strokeWidth={1} fill="none" />
    </svg>
  )
}

// 隐藏 tldraw 默认 UI，使用自定义网格
const components: TLComponents = {
  Toolbar: null,
  PageMenu: null,
  MainMenu: null,
  ActionsMenu: null,
  HelpMenu: null,
  NavigationPanel: null,
  StylePanel: null,
  KeyboardShortcutsDialog: null,
  QuickActions: null,
  DebugPanel: null,
  DebugMenu: null,
  ZoomMenu: null,
  Minimap: null,
  Grid: CustomGrid,
}

// tldraw shape 转换为 ImageLayer（兼容现有组件）
function shapeToLayer(shape: any): ImageLayer {
  // 反序列化 generationConfig
  let generationConfig
  try {
    generationConfig = shape.props.generationConfig
      ? JSON.parse(shape.props.generationConfig)
      : undefined
  } catch {
    generationConfig = undefined
  }

  // 构建名称：prompt + 批次信息 (1/4)
  let name = shape.props.prompt || 'AI Image'
  if (generationConfig?.batchTotal && generationConfig.batchTotal > 1) {
    const batchIndex = (generationConfig.batchIndex || 0) + 1
    name = `${name} (${batchIndex}/${generationConfig.batchTotal})`
  }

  return {
    id: shape.id,
    name,
    url: shape.props.url,
    x: shape.x + shape.props.w / 2,
    y: shape.y + shape.props.h / 2,
    width: shape.props.w,
    height: shape.props.h,
    visible: shape.opacity !== 0, // 只有 opacity 为 0 才表示隐藏
    locked: shape.isLocked || false,
    selected: false,
    type: shape.props.isVideo ? 'video' : 'image',
    generationConfig,
  }
}

// 画布内容组件（需要访问 editor）
const CanvasContent = track(function CanvasContent({
  onLayersChange,
  onSelectionChange,
  onZoomChange,
  onCameraChange,
}: {
  onLayersChange: (layers: ImageLayer[]) => void
  onSelectionChange: (ids: string[]) => void
  onZoomChange: (zoom: number) => void
  onCameraChange: (camera: { x: number; y: number; z: number }) => void
}) {
  const editor = useEditor()

  // 监听形状变化
  useEffect(() => {
    const unsubscribe = editor.store.listen(() => {
      // 使用 getSortedChildIdsForParent 获取按 Z 轴排序的 shape IDs
      const currentPageId = editor.getCurrentPageId()
      const sortedIds = editor.getSortedChildIdsForParent(currentPageId)

      // 根据排序后的 ID 获取 ai-image shapes
      const aiShapes = sortedIds
        .map(id => editor.getShape(id))
        .filter((s): s is NonNullable<typeof s> => s !== undefined && (s as any).type === 'ai-image')

      // 倒序排列（最上层的在数组前面，用于图层面板显示）
      const reversedAiShapes = [...aiShapes].reverse()
      const layers = reversedAiShapes.map(shapeToLayer)
      onLayersChange(layers)
    }, { source: 'all', scope: 'document' })

    return unsubscribe
  }, [editor, onLayersChange])

  // 监听选择变化
  useEffect(() => {
    const unsubscribe = editor.store.listen(() => {
      const selectedIds = editor.getSelectedShapeIds()

      // 过滤掉隐藏的图层（opacity === 0）
      const visibleSelectedIds = selectedIds.filter(id => {
        const shape = editor.getShape(id)
        return shape && shape.opacity !== 0
      })

      // 如果有隐藏的图层被选中，自动取消它们的选中状态
      if (visibleSelectedIds.length !== selectedIds.length) {
        if (visibleSelectedIds.length > 0) {
          editor.select(...visibleSelectedIds)
        } else {
          editor.selectNone()
        }
        return // 选择变化会再次触发这个监听器
      }

      onSelectionChange(selectedIds as string[])
    }, { source: 'all', scope: 'session' })

    return unsubscribe
  }, [editor, onSelectionChange])

  // 监听缩放和相机变化
  useEffect(() => {
    const handleChange = () => {
      const zoom = editor.getZoomLevel() * 100
      onZoomChange(Math.round(zoom))
      const camera = editor.getCamera()
      onCameraChange(camera)
    }
    handleChange()
    const unsubscribe = editor.store.listen(handleChange, { source: 'all', scope: 'session' })
    return unsubscribe
  }, [editor, onZoomChange, onCameraChange])

  return null
})

// 主应用组件
function TldrawAppContent() {
  const { themeStyle } = useTheme()
  const theme = getThemeStyles(themeStyle)
  const lightTheme = isLightTheme(themeStyle)

  const [showLandingPage, setShowLandingPage] = useState(true)
  const [showAllProjectsPage, setShowAllProjectsPage] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [isLoadingFadingOut, setIsLoadingFadingOut] = useState(false) // loading 渐出状态
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [pendingGenerationConfig, setPendingGenerationConfig] = useState<GenerationConfig | null>(null)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [layers, setLayers] = useState<ImageLayer[]>([])
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])
  const [zoom, setZoom] = useState(100)
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 })
  const [projectName, setProjectName] = useState('Untitled')
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false)
  const [isBottomDialogExpanded, setIsBottomDialogExpanded] = useState(true)
  const [editMode, setEditMode] = useState<EditMode>('normal')
  const [generationTasks, setGenerationTasks] = useState<GenerationTask[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showLibraryDialog, setShowLibraryDialog] = useState(false)
  const [libraryInsertPosition, setLibraryInsertPosition] = useState<{ x: number; y: number } | null>(null)
  const [clipboardLayers, setClipboardLayers] = useState<ImageLayer[]>([])
  const [isLayerTransforming, setIsLayerTransforming] = useState(false)
  const bottomDialogRef = useRef<BottomDialogRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transformTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingGenerationConfigRef = useRef<GenerationConfig | null>(null)

  const selectedLayer = selectedLayerIds.length === 1
    ? layers.find(l => l.id === selectedLayerIds[0]) || null
    : null

  // 选中图层的屏幕坐标
  const [selectedLayerScreenPos, setSelectedLayerScreenPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const lastBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  // 计算选中图层的屏幕位置并检测变换状态
  const updateSelectedLayerScreenPos = useCallback((detectTransform: boolean = false) => {
    if (!editor || selectedLayerIds.length === 0) {
      setSelectedLayerScreenPos(null)
      return
    }

    // 计算所有选中图层的边界框
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let hasValidBounds = false

    for (const layerId of selectedLayerIds) {
      const shape = editor.getShape(layerId as TLShapeId)
      if (!shape) continue

      const bounds = editor.getShapePageBounds(shape)
      if (!bounds) continue

      hasValidBounds = true
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }

    if (!hasValidBounds) {
      setSelectedLayerScreenPos(null)
      return
    }

    // 转换为屏幕坐标
    const screenBounds = editor.pageToScreen({ x: minX, y: minY })
    const screenBoundsEnd = editor.pageToScreen({ x: maxX, y: maxY })

    const newBounds = {
      x: screenBounds.x,
      y: screenBounds.y,
      width: screenBoundsEnd.x - screenBounds.x,
      height: screenBoundsEnd.y - screenBounds.y,
    }

    setSelectedLayerScreenPos(newBounds)

    // 检测变换状态（仅在 store 变化时检测）
    if (detectTransform) {
      const lastBounds = lastBoundsRef.current
      if (lastBounds) {
        const isMoving = Math.abs(newBounds.x - lastBounds.x) > 1 || Math.abs(newBounds.y - lastBounds.y) > 1
        const isResizing = Math.abs(newBounds.width - lastBounds.width) > 1 || Math.abs(newBounds.height - lastBounds.height) > 1

        if (isMoving || isResizing) {
          // 图层正在变换，隐藏工具栏
          setIsLayerTransforming(true)

          // 清除之前的定时器
          if (transformTimeoutRef.current) {
            clearTimeout(transformTimeoutRef.current)
          }

          // 300ms 后如果没有新的变化，则认为变换结束
          transformTimeoutRef.current = setTimeout(() => {
            setIsLayerTransforming(false)
          }, 300)
        }
      }
      lastBoundsRef.current = newBounds
    }
  }, [editor, selectedLayerIds])

  // 监听 store 变化，实时更新 toolbar 位置
  useEffect(() => {
    if (!editor || selectedLayerIds.length === 0) {
      setSelectedLayerScreenPos(null)
      lastBoundsRef.current = null
      setIsLayerTransforming(false)
      if (transformTimeoutRef.current) {
        clearTimeout(transformTimeoutRef.current)
        transformTimeoutRef.current = null
      }
      return
    }

    // 初始计算位置（首次选中，立即显示工具栏）
    updateSelectedLayerScreenPos(false)
    setIsLayerTransforming(false)

    // 监听 store 变化（包括拖动、缩放等）
    const unsubscribe = editor.store.listen(() => {
      updateSelectedLayerScreenPos(true) // 检测变换状态
    }, { source: 'all', scope: 'document' })

    return () => {
      unsubscribe()
      if (transformTimeoutRef.current) {
        clearTimeout(transformTimeoutRef.current)
        transformTimeoutRef.current = null
      }
    }
  }, [editor, selectedLayerIds, updateSelectedLayerScreenPos])

  // 相机变化时也需要更新位置
  useEffect(() => {
    updateSelectedLayerScreenPos()
  }, [camera, zoom, updateSelectedLayerScreenPos])

  // Toast 管理
  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast-${Date.now()}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // 视频播放控制：选中时播放，取消选中时暂停
  useEffect(() => {
    // 暂停所有未选中的视频
    videoElementsMap.forEach((video, shapeId) => {
      if (!selectedLayerIds.includes(shapeId)) {
        video.pause()
        video.currentTime = 0
      }
    })

    // 播放选中的视频
    if (selectedLayerIds.length === 1 && selectedLayer?.type === 'video') {
      const video = videoElementsMap.get(selectedLayer.id)
      if (video && video.paused) {
        video.play().catch(err => console.error('Video play error:', err))
      }
    }
  }, [selectedLayerIds, selectedLayer])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Cmd/Ctrl + C：复制
      if (cmdOrCtrl && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault()
        if (selectedLayerIds.length > 0) {
          const layersToCopy = layers.filter(l => selectedLayerIds.includes(l.id))
          setClipboardLayers(layersToCopy)
        }
        return
      }

      // Cmd/Ctrl + V：粘贴
      if (cmdOrCtrl && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
        e.preventDefault()
        if (clipboardLayers.length > 0 && editor) {
          const offset = 30
          clipboardLayers.forEach((layer, index) => {
            const newId = createShapeId();
            (editor as any).createShape({
              id: newId,
              type: 'ai-image',
              x: layer.x - layer.width / 2 + offset,
              y: layer.y - layer.height / 2 + offset,
              props: {
                w: layer.width,
                h: layer.height,
                url: layer.url,
                prompt: `${layer.name} (副本)`,
                isVideo: layer.type === 'video',
                generationConfig: layer.generationConfig ? JSON.stringify(layer.generationConfig) : '',
              },
            })
          })
          addToast(`已粘贴 ${clipboardLayers.length} 个图层`, 'success')
        }
        return
      }

      // Delete/Backspace：直接删除（不需要确认）
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerIds.length > 0 && editor) {
          editor.deleteShapes(selectedLayerIds as TLShapeId[])
          addToast(`已删除 ${selectedLayerIds.length} 个图层`, 'success')
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedLayerIds, layers, clipboardLayers, editor, addToast])

  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // 上传本地文件
  const handleUploadLocal = useCallback(() => {
    setContextMenu(null)
    fileInputRef.current?.click()
  }, [])

  // 从资料库导入
  const handleImportFromLibrary = useCallback(() => {
    if (!editor) return
    setLibraryInsertPosition(getViewportCenter(editor))
    setShowLibraryDialog(true)
    setContextMenu(null)
  }, [editor])

  // 文件上传处理
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor || !e.target.files) return

    const files = Array.from(e.target.files)
    const position = getViewportCenter(editor)

    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })

      const isVideo = file.type.startsWith('video/')

      if (isVideo) {
        // 视频处理
        const video = document.createElement('video')
        video.src = dataUrl
        video.onloadedmetadata = () => {
          const shapeId = createShapeId();
          (editor as any).createShape({
            id: shapeId,
            type: 'ai-image',
            x: position.x - video.videoWidth / 2,
            y: position.y - video.videoHeight / 2,
            props: {
              w: video.videoWidth,
              h: video.videoHeight,
              url: dataUrl,
              prompt: file.name,
              model: 'local-upload',
              generatedAt: Date.now(),
              isVideo: true,
            },
          })
          editor.select(shapeId)
        }
      } else {
        // 图片处理
        const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ width: img.width, height: img.height })
          img.src = dataUrl
        })

        const shapeId = createShapeId();
        (editor as any).createShape({
          id: shapeId,
          type: 'ai-image',
          x: position.x - width / 2,
          y: position.y - height / 2,
          props: {
            w: width,
            h: height,
            url: dataUrl,
            prompt: file.name,
            model: 'local-upload',
            generatedAt: Date.now(),
            isVideo: false,
          },
        })
        editor.select(shapeId)
      }
    }

    // 重置文件输入
    e.target.value = ''
  }, [editor])

  // 从资料库选择图片
  const handleLibrarySelect = useCallback((imageUrl: string) => {
    if (!editor || !libraryInsertPosition) return

    const img = new Image()
    img.onload = () => {
      const shapeId = createShapeId();
      (editor as any).createShape({
        id: shapeId,
        type: 'ai-image',
        x: libraryInsertPosition.x - img.width / 2,
        y: libraryInsertPosition.y - img.height / 2,
        props: {
          w: img.width,
          h: img.height,
          url: imageUrl,
          prompt: 'Library Image',
          model: 'library',
          generatedAt: Date.now(),
          isVideo: false,
        },
      })
      editor.select(shapeId)
    }
    img.src = imageUrl
    setShowLibraryDialog(false)
  }, [editor, libraryInsertPosition])

  // 编辑器加载
  const handleMount = useCallback((ed: Editor) => {
    console.log('tldraw editor mounted')
    ed.setCurrentTool('select')
    setEditor(ed)

    // 启用网格背景
    ed.updateInstanceState({ isGridMode: true })

    // 检查是否有从首页带来的待处理生成任务
    if (pendingGenerationConfigRef.current) {
      console.log('🎯 Found pending generation config, executing now...')
      const config = pendingGenerationConfigRef.current
      pendingGenerationConfigRef.current = null
      setPendingGenerationConfig(null)

      // 延迟执行，确保 editor 完全准备好
      setTimeout(() => {
        // 直接在这里执行生成逻辑（因为此时 handleGenerate 可能还引用旧的 editor）
        const centerPage = getViewportCenter(ed)
        const imageSize = getImageSizeFromAspectRatio(config.aspectRatio || '1:1')
        const count = config.count || 1
        const gap = 20

        // 计算网格布局
        const { startX, startY, is2x2 } = calculateGridLayout(centerPage, imageSize, count, gap)

        const newTasks: GenerationTask[] = []
        const batchId = `batch-${Date.now()}`  // 批次ID，用于标识同一批生成的图片
        const taskId = `task-${Date.now()}`

        // 只创建第一张图的占位符 shape
        const firstShapeId = createShapeId()
        const firstShapeX = startX
        const firstShapeY = startY

        const firstConfigWithBatch = {
          ...config,
          batchId,
          batchIndex: 0,
          batchTotal: count,
        }

        ed.createShape({
          id: firstShapeId,
          type: 'ai-image' as any,
          x: firstShapeX,
          y: firstShapeY,
          props: {
            w: imageSize.width,
            h: imageSize.height,
            url: '',
            prompt: config.prompt,
            isVideo: config.mode === 'video',
            generationConfig: JSON.stringify(firstConfigWithBatch),
          },
        })

        ed.select(firstShapeId)

        const newTask: GenerationTask = {
          id: taskId,
          shapeId: firstShapeId as string,
          status: 'generating',
          progress: 0,
          config,
          position: { x: firstShapeX + imageSize.width / 2, y: firstShapeY + imageSize.height / 2 },
          width: imageSize.width,
          height: imageSize.height,
          createdAt: new Date().toISOString(),
          startedAt: Date.now(),
          estimatedDuration: 30,
        }
        newTasks.push(newTask)

        let progress = 0
        const interval = setInterval(() => {
          progress += 5
          setGenerationTasks(prev =>
            prev.map(t => t.id === taskId ? { ...t, progress } : t)
          )

          if (progress >= 100) {
            clearInterval(interval)

            const isVideoMode = config.mode === 'video'
            const allShapeIds: string[] = [firstShapeId as string]

            // 更新第一张图的 URL
            const firstMediaUrl = isVideoMode
              ? 'https://www.w3schools.com/html/mov_bbb.mp4'
              : `https://picsum.photos/seed/${Date.now()}/${imageSize.width * 2}/${imageSize.height * 2}`

            ed.updateShape({
              id: firstShapeId as any,
              type: 'ai-image' as any,
              props: {
                url: firstMediaUrl,
                model: config.model,
                generatedAt: Date.now(),
              },
            })

            // 生成完成后创建其他图片
            for (let i = 1; i < count; i++) {
              const newShapeId = createShapeId()
              const { x: shapeX, y: shapeY } = getGridPosition(startX, startY, i, imageSize, is2x2, gap)

              const configWithBatch = {
                ...config,
                batchId,
                batchIndex: i,
                batchTotal: count,
              }

              const mediaUrl = isVideoMode
                ? 'https://www.w3schools.com/html/mov_bbb.mp4'
                : `https://picsum.photos/seed/${Date.now() + i}/${imageSize.width * 2}/${imageSize.height * 2}`

              ed.createShape({
                id: newShapeId,
                type: 'ai-image' as any,
                x: shapeX,
                y: shapeY,
                props: {
                  w: imageSize.width,
                  h: imageSize.height,
                  url: mediaUrl,
                  prompt: config.prompt,
                  model: config.model,
                  generatedAt: Date.now(),
                  isVideo: isVideoMode,
                  generationConfig: JSON.stringify(configWithBatch),
                },
              })

              allShapeIds.push(newShapeId as string)
            }

            setGenerationTasks(prev => prev.filter(t => t.id !== taskId))
            ed.select(...allShapeIds as TLShapeId[])
          }
        }, 150)

        setGenerationTasks(prev => [...prev, ...newTasks])
        setIsBottomDialogExpanded(true)
        console.log(`📦 Created generation task for ${count} images from pending config`)
      }, 200)
    }

    // 覆盖文件拖放处理器
    ed.registerExternalContentHandler('files', async ({ point, files }) => {
      const position = point ?? ed.getViewportPageBounds().center

      for (const file of files) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })

        const isVideo = file.type.startsWith('video/')

        if (isVideo) {
          const video = document.createElement('video')
          video.src = dataUrl
          video.onloadedmetadata = () => {
            const shapeId = createShapeId();
            (ed as any).createShape({
              id: shapeId,
              type: 'ai-image',
              x: position.x - video.videoWidth / 2,
              y: position.y - video.videoHeight / 2,
              props: {
                w: video.videoWidth,
                h: video.videoHeight,
                url: dataUrl,
                prompt: file.name,
                model: 'local-upload',
                generatedAt: Date.now(),
                isVideo: true,
              },
            })
            ed.select(shapeId)
          }
        } else {
          const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
            const img = new Image()
            img.onload = () => resolve({ width: img.width, height: img.height })
            img.src = dataUrl
          })

          const shapeId = createShapeId();
          (ed as any).createShape({
            id: shapeId,
            type: 'ai-image',
            x: position.x - width / 2,
            y: position.y - height / 2,
            props: {
              w: width,
              h: height,
              url: dataUrl,
              prompt: file.name,
              model: 'local-upload',
              generatedAt: Date.now(),
              isVideo: false,
            },
          })
          ed.select(shapeId)
        }
      }
    })

    // 不添加预设图片，保持画布为空
  }, [])

  // 缩放控制
  const handleZoomChange = useCallback((newZoom: number) => {
    if (editor) {
      const cam = editor.getCamera()
      editor.setCamera({ x: cam.x, y: cam.y, z: newZoom / 100 })
    }
  }, [editor])

  // 图层选择
  const handleLayerSelect = useCallback((layerId: string | null, isMultiSelect?: boolean) => {
    if (!editor) return
    if (layerId) {
      // 检查图层是否隐藏，隐藏的图层不允许选中
      const shape = editor.getShape(layerId as TLShapeId)
      if (shape && shape.opacity === 0) {
        // 隐藏的图层不能被选中
        return
      }
      if (isMultiSelect) {
        const currentIds = editor.getSelectedShapeIds()
        if (currentIds.includes(layerId as TLShapeId)) {
          editor.deselect(layerId as TLShapeId)
        } else {
          editor.select(...currentIds, layerId as TLShapeId)
        }
      } else {
        editor.select(layerId as TLShapeId)
      }
    } else {
      editor.selectNone()
    }
  }, [editor])

  // 图层更新
  const handleLayerUpdate = useCallback((layerId: string, updates: Partial<ImageLayer>) => {
    if (!editor) return
    const shape = editor.getShape(layerId as TLShapeId)
    if (shape) {
      const updateObj: any = { id: layerId as TLShapeId, type: 'ai-image' }
      if (updates.visible !== undefined) {
        // 完全隐藏：opacity 设为 0
        updateObj.opacity = updates.visible ? 1 : 0
        // 如果隐藏图层且当前被选中，则取消选中
        if (!updates.visible) {
          const selectedIds = editor.getSelectedShapeIds()
          if (selectedIds.includes(layerId as TLShapeId)) {
            const newSelectedIds = selectedIds.filter(id => id !== layerId)
            if (newSelectedIds.length > 0) {
              editor.select(...newSelectedIds)
            } else {
              editor.selectNone()
            }
          }
        }
      }
      if (updates.locked !== undefined) {
        updateObj.isLocked = updates.locked
      }
      if (updates.name !== undefined) {
        updateObj.props = { ...shape.props, prompt: updates.name }
      }
      editor.updateShape(updateObj)
    }
  }, [editor])

  // 图层删除
  const handleLayerDelete = useCallback((layerId: string) => {
    if (!editor) return
    editor.deleteShape(layerId as TLShapeId)
  }, [editor])

  // 添加图层
  const handleLayerAdd = useCallback((layer: Omit<ImageLayer, 'id'>): string => {
    if (!editor) return ''
    const id = createShapeId();
    (editor as any).createShape({
      id,
      type: 'ai-image',
      x: layer.x - layer.width / 2,
      y: layer.y - layer.height / 2,
      props: {
        w: layer.width,
        h: layer.height,
        url: layer.url,
        prompt: layer.name,
        isVideo: layer.type === 'video',
        generationConfig: layer.generationConfig ? JSON.stringify(layer.generationConfig) : '',
      },
    })
    return id as string
  }, [editor])

  // 图层重排序（改变 Z 轴顺序）
  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (!editor) return
    if (fromIndex === toIndex) return

    console.log('🔄 handleLayerReorder called:', { fromIndex, toIndex, layersCount: layers.length })

    // layers 数组是从上到下排列的（index 0 是最上层，Z轴最高）
    // 使用 getSortedChildIdsForParent 获取真正按 Z 轴排序的 shapes
    const currentPageId = editor.getCurrentPageId()
    const sortedIds = editor.getSortedChildIdsForParent(currentPageId)

    // 只获取 ai-image shapes
    const aiShapeIds = sortedIds.filter(id => {
      const shape = editor.getShape(id)
      return shape && (shape as any).type === 'ai-image'
    })

    // aiShapeIds 是 tldraw 的原始顺序（index 越大，z-index 越高）
    // layers 是 reversed 的（index 越小，z-index 越高）
    // 所以 layers[i] 对应 aiShapeIds[aiShapeIds.length - 1 - i]

    const fromTldrawIndex = aiShapeIds.length - 1 - fromIndex
    const toTldrawIndex = aiShapeIds.length - 1 - toIndex

    console.log('🔄 Tldraw indices:', { fromTldrawIndex, toTldrawIndex, totalShapes: aiShapeIds.length })

    const shapeIdToMove = aiShapeIds[fromTldrawIndex]
    if (!shapeIdToMove) {
      console.log('❌ Shape to move not found')
      return
    }

    // 在面板中向上拖动 (fromIndex > toIndex) = Z轴变高 = 在 tldraw 中往后移
    // 在面板中向下拖动 (fromIndex < toIndex) = Z轴变低 = 在 tldraw 中往前移

    if (fromIndex > toIndex) {
      // 向上移动（Z轴变高）
      // 使用 bringForward 逐步向上移动
      const steps = fromIndex - toIndex
      console.log('⬆️ Moving up', steps, 'steps')
      for (let i = 0; i < steps; i++) {
        editor.bringForward([shapeIdToMove as TLShapeId])
      }
    } else {
      // 向下移动（Z轴变低）
      // 使用 sendBackward 逐步向下移动
      const steps = toIndex - fromIndex
      console.log('⬇️ Moving down', steps, 'steps')
      for (let i = 0; i < steps; i++) {
        editor.sendBackward([shapeIdToMove as TLShapeId])
      }
    }

    console.log('✅ Reorder complete')
  }, [editor, layers])

  // 生成图片
  const handleGenerate = useCallback((config: GenerationConfig) => {
    console.log('🎬 handleGenerate called, editor exists:', !!editor)
    if (!editor) {
      console.log('❌ Editor not ready, cannot generate!')
      return
    }

    // 首次生成时完成新手引导
    if (!hasCompletedOnboarding) {
      setHasCompletedOnboarding(true)
    }

    const centerPage = getViewportCenter(editor)
    const imageSize = getImageSizeFromAspectRatio(config.aspectRatio || '1:1', 320)
    const count = config.count || 1
    const gap = 20

    // 计算网格布局
    const { startX, startY, is2x2 } = calculateGridLayout(centerPage, imageSize, count, gap)

    const newTasks: GenerationTask[] = []
    const batchId = `batch-${Date.now()}`  // 批次ID，用于标识同一批生成的图片
    const taskId = `task-${Date.now()}`

    // 只创建第一张图的占位符 shape（其他图在生成完成后创建）
    const firstShapeId = createShapeId()
    const firstShapeX = startX
    const firstShapeY = startY

    // 第一张图的配置
    const firstConfigWithBatch = {
      ...config,
      batchId,
      batchIndex: 0,
      batchTotal: count,
    }

    // 创建第一张图的占位符 shape（遮罩会跟随这个 shape 移动）
    ;(editor as any).createShape({
      id: firstShapeId,
      type: 'ai-image' as any,
      x: firstShapeX,
      y: firstShapeY,
      props: {
        w: imageSize.width,
        h: imageSize.height,
        url: '',  // 空 url 表示正在生成
        prompt: config.prompt,
        isVideo: config.mode === 'video',
        generationConfig: JSON.stringify(firstConfigWithBatch),
      },
    })

    // 选中第一张图
    editor.select(firstShapeId)

    // 创建遮罩任务
    const newTask: GenerationTask = {
      id: taskId,
      shapeId: firstShapeId as string,
      status: 'generating',
      progress: 0,
      config,
      position: { x: firstShapeX + imageSize.width / 2, y: firstShapeY + imageSize.height / 2 },
      width: imageSize.width,
      height: imageSize.height,
      createdAt: new Date().toISOString(),
      startedAt: Date.now(),
      estimatedDuration: 30,
    }
    newTasks.push(newTask)

    // 进度更新
    let progress = 0
    const interval = setInterval(() => {
      progress += 5
      setGenerationTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, progress } : t)
      )

      if (progress >= 100) {
        clearInterval(interval)

        const isVideoMode = config.mode === 'video'
        const allShapeIds: string[] = [firstShapeId as string]

        // 更新第一张图的 URL
        const firstMediaUrl = isVideoMode
          ? 'https://www.w3schools.com/html/mov_bbb.mp4'
          : `https://picsum.photos/seed/${Date.now()}/${imageSize.width * 2}/${imageSize.height * 2}`

        editor.updateShape({
          id: firstShapeId as any,
          type: 'ai-image' as any,
          props: {
            url: firstMediaUrl,
            model: config.model,
            generatedAt: Date.now(),
          },
        })

        // 生成完成后创建其他图片（从第2张开始）
        for (let i = 1; i < count; i++) {
          const newShapeId = createShapeId()
          const { x: shapeX, y: shapeY } = getGridPosition(startX, startY, i, imageSize, is2x2, gap)

          const configWithBatch = {
            ...config,
            batchId,
            batchIndex: i,
            batchTotal: count,
          }

          const mediaUrl = isVideoMode
            ? 'https://www.w3schools.com/html/mov_bbb.mp4'
            : `https://picsum.photos/seed/${Date.now() + i}/${imageSize.width * 2}/${imageSize.height * 2}`

          ;(editor as any).createShape({
            id: newShapeId,
            type: 'ai-image' as any,
            x: shapeX,
            y: shapeY,
            props: {
              w: imageSize.width,
              h: imageSize.height,
              url: mediaUrl,
              prompt: config.prompt,
              model: config.model,
              generatedAt: Date.now(),
              isVideo: isVideoMode,
              generationConfig: JSON.stringify(configWithBatch),
            },
          })

          allShapeIds.push(newShapeId as string)
        }

        // 移除遮罩任务
        setGenerationTasks(prev => prev.filter(t => t.id !== taskId))

        // 显示完成提示并选中所有生成的图片
        addToast(`${count}张${isVideoMode ? '视频' : '图片'}生成完成`, 'success')
        editor.select(...allShapeIds as TLShapeId[])
      }
    }, 150)

    setGenerationTasks(prev => [...prev, ...newTasks])
    console.log(`📦 Created generation task for ${count} images`)
  }, [editor, addToast, hasCompletedOnboarding, setHasCompletedOnboarding])

  // 删除确认
  const confirmDelete = useCallback(() => {
    if (!editor) return
    editor.deleteShapes(selectedLayerIds as TLShapeId[])
    setDeleteConfirmVisible(false)
    addToast(`已删除 ${selectedLayerIds.length} 个图层`, 'success')
  }, [editor, selectedLayerIds, addToast])

  // 转换画布坐标到屏幕坐标
  const canvasToScreen = useCallback((canvasPos: { x: number; y: number }) => {
    if (!editor) return canvasPos
    return editor.pageToScreen(canvasPos)
  }, [editor])

  // 下载操作
  const handleDownload = useCallback(() => {
    const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id))
    if (selectedLayers.length === 0) return

    selectedLayers.forEach(layer => {
      if (layer.url) {
        const link = document.createElement('a')
        link.href = layer.url
        link.download = `${layer.name || 'image'}.png`
        link.click()
      }
    })
    addToast(`已下载 ${selectedLayers.length} 个图层`, 'success')
  }, [layers, selectedLayerIds, addToast])

  // Remix 操作 - 回填完整生成参数
  const handleRemix = useCallback(() => {
    if (!selectedLayer) return
    if (!bottomDialogRef.current) return

    // 获取图层的生成配置
    const genConfig = selectedLayer.generationConfig
    if (genConfig) {
      // 使用 setFullConfig 回填完整配置
      bottomDialogRef.current.setFullConfig({
        ...genConfig,
        // 将当前图层的 URL 作为参考图
        referenceImages: selectedLayer.url ? [selectedLayer.url] : genConfig.referenceImages,
      })
      addToast('已回填生成参数', 'success')
    } else {
      // 如果没有生成配置，只添加为参考图
      bottomDialogRef.current.setReferenceImage(selectedLayer.url)
      addToast('已添加为参考图', 'success')
    }
  }, [selectedLayer, addToast])

  // 编辑操作
  const handleEdit = useCallback((quickEditPrompt?: string) => {
    if (!selectedLayer || !editor) return
    const config: GenerationConfig = {
      mode: 'image',
      model: 'qwen-image',
      prompt: quickEditPrompt || selectedLayer.name || '',
      aspectRatio: '1:1',
      count: 1,
      referenceImage: selectedLayer.url,
    }
    handleGenerate(config)
  }, [selectedLayer, editor, handleGenerate])

  // 填充到对话框
  const handleFillToDialog = useCallback(() => {
    if (!bottomDialogRef.current) return
    // 支持单选和多选
    const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id))
    const imageUrls = selectedLayers.filter(l => l.url).map(l => l.url)
    if (imageUrls.length === 0) return

    // 使用 addReferenceImages 方法，它会根据当前模式自动处理
    bottomDialogRef.current.addReferenceImages(imageUrls)
    addToast(`已添加 ${imageUrls.length} 张图片到工作区`, 'success')
  }, [layers, selectedLayerIds, addToast])

  // 填充到关键帧 - 将前两张图片填入视频模式的首尾帧
  const handleFillToKeyframes = useCallback(() => {
    if (!bottomDialogRef.current) return
    const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id) && l.type !== 'video')
    const imageUrls = selectedLayers.filter(l => l.url).map(l => l.url)

    if (imageUrls.length === 0) {
      addToast('请选择至少一张图片', 'info')
      return
    }

    // 取前两张作为首尾帧
    const startFrame = imageUrls[0]
    const endFrame = imageUrls.length >= 2 ? imageUrls[1] : undefined

    bottomDialogRef.current.setKeyframes(startFrame, endFrame)

    if (endFrame) {
      addToast('已填入首尾帧，切换到视频生成模式', 'success')
    } else {
      addToast('已填入首帧，切换到视频生成模式', 'success')
    }
  }, [layers, selectedLayerIds, addToast])

  // 填充到图片生成 - 根据模型可填入的图片数量填入
  const handleFillToImageGen = useCallback(() => {
    if (!bottomDialogRef.current) return
    const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id) && l.type !== 'video')
    const imageUrls = selectedLayers.filter(l => l.url).map(l => l.url)

    if (imageUrls.length === 0) {
      addToast('请选择至少一张图片', 'info')
      return
    }

    // 获取当前图像模型支持的最大参考图数量
    const maxImages = bottomDialogRef.current.getMaxImagesForModel()
    const filledCount = Math.min(imageUrls.length, maxImages)

    bottomDialogRef.current.setImageGenReferenceImages(imageUrls)
    addToast(`已填入 ${filledCount} 张参考图到图像生成模式`, 'success')
  }, [layers, selectedLayerIds, addToast])

  // 合并图层 - 将选中图片合并为一张
  const handleMergeLayers = useCallback(async () => {
    if (!editor) return
    if (selectedLayerIds.length < 2) {
      addToast('请选择至少 2 个图层', 'info')
      return
    }

    const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id) && l.type !== 'video')
    if (selectedLayers.length < 2) {
      addToast('请选择至少 2 张图片进行合并', 'info')
      return
    }

    try {
      // 计算所有选中图层的边界框
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const layer of selectedLayers) {
        minX = Math.min(minX, layer.x)
        minY = Math.min(minY, layer.y)
        maxX = Math.max(maxX, layer.x + layer.width)
        maxY = Math.max(maxY, layer.y + layer.height)
      }

      const mergedWidth = maxX - minX
      const mergedHeight = maxY - minY

      // 创建离屏 canvas 进行合并
      const canvas = document.createElement('canvas')
      canvas.width = mergedWidth
      canvas.height = mergedHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        addToast('合并失败：无法创建画布', 'error')
        return
      }

      // 按 Z 轴顺序（从底到顶）绘制图片
      const currentPageId = editor.getCurrentPageId()
      const sortedIds = editor.getSortedChildIdsForParent(currentPageId)

      // 过滤出选中的图层并按 Z 轴顺序排列（从底到顶）
      const sortedSelectedLayers = sortedIds
        .map(id => selectedLayers.find(l => l.id === id))
        .filter((l): l is ImageLayer => l !== undefined)

      // 加载并绘制所有图片
      for (const layer of sortedSelectedLayers) {
        await new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            // 计算相对位置
            const relX = layer.x - minX
            const relY = layer.y - minY
            ctx.drawImage(img, relX, relY, layer.width, layer.height)
            resolve()
          }
          img.onerror = () => {
            console.error('Failed to load image:', layer.url)
            resolve() // 继续处理其他图片
          }
          img.src = layer.url
        })
      }

      // 生成合并后的图片 URL
      const mergedUrl = canvas.toDataURL('image/png')

      // 删除原有图层
      editor.deleteShapes(selectedLayerIds as TLShapeId[])

      // 创建新的合并图层
      const newShapeId = createShapeId()
      editor.createShape({
        id: newShapeId,
        type: 'ai-image' as const,
        x: minX,
        y: minY,
        props: {
          w: mergedWidth,
          h: mergedHeight,
          url: mergedUrl,
          prompt: '合并图层',
          model: '',
          generatedAt: Date.now(),
          isVideo: false,
        },
      } as any)

      // 选中新创建的图层
      editor.select(newShapeId)

      addToast(`已合并 ${sortedSelectedLayers.length} 个图层`, 'success')
    } catch (error) {
      console.error('Merge layers error:', error)
      addToast('合并图层失败', 'error')
    }
  }, [editor, layers, selectedLayerIds, addToast])

  // 处理创建新项目
  const handleCreateProject = useCallback(() => {
    setLayers([])
    setSelectedLayerIds([])
    setGenerationTasks([])
    setProjectName('Untitled')
    setShowLandingPage(false)
    setShowLoading(true)

    // 1.5秒后隐藏 loading
    setTimeout(() => {
      setShowLoading(false)
    }, 1500)
  }, [])

  // 处理打开项目
  const handleOpenProject = useCallback((_projectId: string) => {
    // TODO: 加载项目数据
    setShowLandingPage(false)
  }, [])

  // Loading 完成回调 - 开始渐出
  const handleLoadingFadeStart = useCallback(() => {
    console.log('🌅 Loading fade out starting...')
    setIsLoadingFadingOut(true)
  }, [])

  // Loading 完全消失后的回调
  const handleLoadingComplete = useCallback(() => {
    console.log('✅ Loading complete, pendingConfig:', pendingGenerationConfigRef.current)
    setShowLoading(false)
    setIsLoadingFadingOut(false)
    // 生成任务会在 handleMount 中处理（当 editor 准备好时）
    // pendingGenerationConfigRef.current 保持不变，等待 handleMount 使用
  }, [])

  // 处理从首页开始生成
  const handleStartGeneration = useCallback((config: GenerationConfig) => {
    console.log('🎯 handleStartGeneration called with config:', config)
    setPendingGenerationConfig(config)
    pendingGenerationConfigRef.current = config  // 同时保存到ref
    setIsTransitioning(true)

    // 网格脉冲过渡时长：700ms
    const gridTransitionDuration = 700

    setTimeout(() => {
      console.log('🔄 Transitioning to loading screen')
      // 网格动画结束后，隐藏首页内容，显示 loading
      setShowLandingPage(false)
      setIsTransitioning(false)
      setShowLoading(true)
    }, gridTransitionDuration)
  }, [])

  // 右键菜单项
  const contextMenuEntries: ContextMenuEntry[] = [
    {
      id: 'upload-local',
      icon: '/assets/icons/image.svg',
      label: '上传本地档案',
      onClick: handleUploadLocal,
    },
    {
      id: 'import-library',
      icon: '/assets/icons/library-icon.svg',
      label: '从资料库导入',
      onClick: handleImportFromLibrary,
    },
  ]

  // 获取主题画布背景（loading 和 landing 也使用）
  const getThemedCanvasBackground = () => {
    if (theme.canvasBackground && theme.canvasBackground !== 'transparent') {
      return theme.canvasBackground
    }
    return lightTheme
      ? 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)'
      : 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)'
  }

  // Loading 屏幕渐出动画时长
  const loadingFadeOutDuration = 500

  // 渲染 Loading 覆盖层（当 showLoading 为 true 时，浮在画布上方）
  const renderLoadingOverlay = () => {
    if (!showLoading) return null

    const loadingBackground = getThemedCanvasBackground()
    const needsLoadingAnimation = loadingBackground.includes('gradient')
    const gridLineColor = theme.gridColor || (lightTheme
      ? 'rgba(102, 126, 234, 0.06)'
      : 'rgba(102, 126, 234, 0.1)')

    return (
      <>
        {/* Loading 背景层 - 渐出时也淡出 */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: loadingBackground,
            backgroundSize: needsLoadingAnimation ? '200% 200%' : undefined,
            animation: isLoadingFadingOut
              ? `loading-bg-fade-out ${loadingFadeOutDuration}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
              : (needsLoadingAnimation ? 'gradient-shift 15s ease infinite' : undefined),
            zIndex: 9998,
            pointerEvents: isLoadingFadingOut ? 'none' : 'auto',
          }}
        />

        {/* 网格背景（过渡用） - 渐出时也淡出 */}
        <div
          className="canvas-grid-container-loading"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9999,
            animation: isLoadingFadingOut
              ? `loading-bg-fade-out ${loadingFadeOutDuration}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
              : undefined,
          }}
        >
          {/* 垂直网格线 */}
          {[...Array(12)].map((_, i) => (
            <div
              key={`canvas-v-${i}`}
              style={{
                position: 'absolute',
                left: `${(i + 1) * 8.33}%`,
                top: 0,
                width: '1px',
                height: '100%',
                background: `linear-gradient(90deg, transparent, ${gridLineColor}, transparent)`,
              }}
            />
          ))}
          {/* 水平网格线 */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`canvas-h-${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: `${(i + 1) * 12.5}%`,
                width: '100%',
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${gridLineColor}, transparent)`,
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

          @keyframes loading-bg-fade-out {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }
        `}</style>

        <LoadingScreen
          onFadeStart={handleLoadingFadeStart}
          onComplete={handleLoadingComplete}
          duration={1500}
          fadeOutDuration={loadingFadeOutDuration}
        />
      </>
    )
  }

  // 如果只显示 loading（画布还没准备好），仍然只渲染 loading
  // 但当 loading 开始渐出时，画布已经在下层渲染好了
  if (showLoading && !isLoadingFadingOut) {
    // 首次 loading，画布还没渲染，只显示 loading 层
    return renderLoadingOverlay()
  }

  // 如果显示首页或正在过渡，渲染首页
  if (showLandingPage || isTransitioning) {
    const landingBackground = getThemedCanvasBackground()
    const needsLandingAnimation = landingBackground.includes('gradient')

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
            background: landingBackground,
            backgroundSize: needsLandingAnimation ? '200% 200%' : undefined,
            animation: needsLandingAnimation ? 'gradient-shift 15s ease infinite' : undefined,
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
        />
      </>
    )
  }

  // 主画布界面 - 使用主题背景
  // 如果主题有自定义画布背景，使用它；否则使用默认渐变
  const canvasBackground = theme.canvasBackground && theme.canvasBackground !== 'transparent'
    ? theme.canvasBackground
    : (lightTheme
        ? 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)'
        : 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)')

  // 应用背景是否需要动画（渐变背景需要动画，纯色不需要）
  const needsAnimation = canvasBackground.includes('gradient')

  return (
    <>
      {/* 全局背景层 - 根据主题设置 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: canvasBackground,
          backgroundSize: needsAnimation ? '200% 200%' : undefined,
          animation: needsAnimation ? 'gradient-shift 15s ease infinite' : undefined,
          zIndex: -10,
        }}
      />
      {/* tldraw 主题样式覆盖 */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        /* 覆盖 tldraw 选择框颜色 */
        .tl-user-1 .tl-selection__fg {
          stroke: ${theme.selectionStroke || '#38BDFF'} !important;
        }
        .tl-user-1 .tl-selection__bg {
          fill: ${theme.selectionFill || 'rgba(56, 189, 255, 0.08)'} !important;
        }
        /* 覆盖缩放手柄颜色 */
        .tl-handle {
          fill: ${theme.handleFill || '#38BDFF'} !important;
          stroke: ${theme.handleStroke || '#FFFFFF'} !important;
        }
        .tl-corner-handle {
          fill: ${theme.handleFill || '#38BDFF'} !important;
          stroke: ${theme.handleStroke || '#FFFFFF'} !important;
        }
        /* 覆盖 tldraw 画布背景为透明（由我们的背景层控制） */
        .tl-background {
          background: transparent !important;
        }
        .tl-canvas {
          background: transparent !important;
        }
        /* 生成中效果样式 - 根据主题 */
        .generating-overlay-themed {
          border: ${theme.generatingBorder || '2px solid rgba(56, 189, 255, 0.5)'};
          box-shadow: ${theme.generatingGlow || '0 0 20px rgba(56, 189, 255, 0.3)'};
        }
      `}</style>
      <div
        style={{
          width: '100vw',
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
          background: 'transparent',
        }}
        onContextMenu={handleContextMenu}
      >
      {/* 隐藏的文件上传输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* tldraw 画布 */}
      <div style={{ width: '100%', height: '100%' }}>
        <Tldraw
          shapeUtils={customShapeUtils}
          components={components}
          onMount={handleMount}
          inferDarkMode={false}
          overrides={{
            // 禁用不需要的工具快捷键
            tools(editor, tools) {
              // 只保留 select 和 hand 工具，禁用其他工具的快捷键
              const allowedTools = ['select', 'hand']
              Object.keys(tools).forEach(key => {
                if (!allowedTools.includes(key)) {
                  tools[key] = { ...tools[key], kbd: undefined }
                }
              })
              return tools
            },
            // 禁用不需要的操作快捷键，并自定义缩放行为
            actions(editor, actions) {
              // 保留的操作列表
              const allowedActions = [
                'undo', 'redo',
                'copy', 'cut', 'paste',
                'select-all', 'delete',
                'bring-forward', 'send-backward',
                'bring-to-front', 'send-to-back',
                'toggle-lock',
                'zoom-in', 'zoom-out',
                'reset-zoom', 'zoom-to-fit', 'zoom-to-selection',
              ]
              Object.keys(actions).forEach(key => {
                if (!allowedActions.includes(key)) {
                  actions[key] = { ...actions[key], kbd: undefined }
                }
              })

              // 自定义 zoom-in：每次缩放 10%
              if (actions['zoom-in']) {
                actions['zoom-in'] = {
                  ...actions['zoom-in'],
                  onSelect() {
                    const currentZoom = editor.getZoomLevel()
                    const newZoom = Math.min(currentZoom + 0.1, 8) // 最大 800%
                    editor.setCamera({ ...editor.getCamera(), z: newZoom })
                  },
                }
              }

              // 自定义 zoom-out：每次缩放 10%
              if (actions['zoom-out']) {
                actions['zoom-out'] = {
                  ...actions['zoom-out'],
                  onSelect() {
                    const currentZoom = editor.getZoomLevel()
                    const newZoom = Math.max(currentZoom - 0.1, 0.1) // 最小 10%
                    editor.setCamera({ ...editor.getCamera(), z: newZoom })
                  },
                }
              }

              return actions
            },
          }}
        >
          <CanvasContent
            onLayersChange={setLayers}
            onSelectionChange={setSelectedLayerIds}
            onZoomChange={setZoom}
            onCameraChange={setCamera}
          />
        </Tldraw>
      </div>

      {/* TopBar */}
      <TopBar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        credits={200.20}
        onLogoClick={() => setShowLandingPage(true)}
        onGoHome={() => setShowLandingPage(true)}
        onGoToProjects={() => setShowAllProjectsPage(true)}
        onNewProject={() => {
          setLayers([])
          setSelectedLayerIds([])
          setGenerationTasks([])
          setProjectName('Untitled')
          if (editor) {
            editor.selectNone()
            const shapes = editor.getCurrentPageShapes()
            editor.deleteShapes(shapes.map(s => s.id))
          }
        }}
      />

      {/* LayerPanel */}
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

      {/* BottomDialog */}
      <BottomDialog
        ref={bottomDialogRef}
        isExpanded={isBottomDialogExpanded}
        onToggle={() => setIsBottomDialogExpanded(!isBottomDialogExpanded)}
        selectedLayer={selectedLayer}
        selectedLayerIds={selectedLayerIds}
        layers={layers}
        editMode={editMode}
        onGenerate={handleGenerate}
        onLayerSelect={handleLayerSelect}
        isLandingPage={false}
      />

      {/* 选中图层的名称标签和详情图标 - 图层静止时显示，生成中不显示 */}
      {!isLayerTransforming && selectedLayerIds.length === 1 && selectedLayerScreenPos && selectedLayer &&
       !generationTasks.some(t => t.status === 'generating' && t.shapeId === selectedLayer.id) && (
        <div
          style={{
            position: 'fixed',
            left: selectedLayerScreenPos.x,
            top: selectedLayerScreenPos.y - 24,
            width: selectedLayerScreenPos.width,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1999,
            pointerEvents: 'auto',
          }}
        >
          {/* 左侧：图标 + 生成时间/名称 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              maxWidth: selectedLayerScreenPos.width - 24,
              overflow: 'hidden',
            }}
          >
            <img
              src={selectedLayer.type === 'video' ? '/assets/icons/video.svg' : '/assets/icons/image.svg'}
              alt={selectedLayer.type === 'video' ? 'video' : 'image'}
              width={16}
              height={16}
              style={{
                filter: lightTheme ? 'brightness(0.5)' : 'brightness(0) invert(1)',
                opacity: 0.6,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: lightTheme ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedLayer.name
                || `${selectedLayer.type === 'video' ? 'Video' : 'Image'} ${selectedLayer.id.slice(-4)}`
              }
            </span>
          </div>
          {/* 右侧：详情图标 */}
          <button
            onClick={() => setShowDetailPanel(!showDetailPanel)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = lightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="查看详情"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke={lightTheme ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)'} strokeWidth="1.2" fill="none" />
              <path d="M8 7V11M8 5V5.5" stroke={lightTheme ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)'} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* 选中图层的工具栏 - 图层静止时显示，生成中不显示 */}
      {!isLayerTransforming && selectedLayerIds.length > 0 && selectedLayerScreenPos &&
       !generationTasks.some(t => t.status === 'generating' && selectedLayerIds.includes(t.shapeId || '')) && (
        <ImageToolbar
          selectedLayers={layers.filter(l => selectedLayerIds.includes(l.id))}
          layerPosition={{
            x: selectedLayerScreenPos.x,
            y: selectedLayerScreenPos.y,
            width: selectedLayerScreenPos.width,
            height: selectedLayerScreenPos.height,
          }}
          stagePos={{ x: 0, y: 0 }}
          zoom={100}
          onDownload={handleDownload}
          onBatchDownload={handleDownload}
          onRemix={handleRemix}
          onEdit={handleEdit}
          onFillToDialog={handleFillToDialog}
          onFillToKeyframes={handleFillToKeyframes}
          onFillToImageGen={handleFillToImageGen}
          onMergeLayers={handleMergeLayers}
          imageBottomY={selectedLayerScreenPos.y + selectedLayerScreenPos.height}
        />
      )}

      {/* 详情面板 - 生成中不显示 */}
      {showDetailPanel && selectedLayer && selectedLayerScreenPos &&
       !generationTasks.some(t => t.status === 'generating' && t.shapeId === selectedLayer.id) && (
        <div
          style={{
            position: 'fixed',
            left: selectedLayerScreenPos.x + selectedLayerScreenPos.width + 10,
            top: selectedLayerScreenPos.y,
            zIndex: 1000,
          }}
        >
          <DetailPanelSimple
            layer={selectedLayer}
            onClose={() => setShowDetailPanel(false)}
            onLayerUpdate={handleLayerUpdate}
          />
        </div>
      )}

      {/* 视频控制面板 - 仅在图层静止时显示 */}
      {!isLayerTransforming && selectedLayer?.type === 'video' && selectedLayerScreenPos && (() => {
        const videoElement = videoElementsMap.get(selectedLayer.id)
        if (!videoElement) return null

        return (
          <VideoControls
            video={videoElement}
            width={selectedLayerScreenPos.width}
            position={{
              x: selectedLayerScreenPos.x,
              y: selectedLayerScreenPos.y + selectedLayerScreenPos.height + 10,
            }}
            videoUrl={selectedLayer.url}
          />
        )
      })()}

      {/* 生成中遮罩 */}
      {generationTasks
        .filter(task => task.status === 'generating')
        .map(task => {
          // 如果有关联的shape，使用shape的实时位置
          if (task.shapeId && editor) {
            const shape = editor.getShape(task.shapeId as any)
            if (shape) {
              const bounds = editor.getShapePageBounds(shape)
              if (bounds) {
                const screenPos = editor.pageToScreen({ x: bounds.x, y: bounds.y })
                const screenPosEnd = editor.pageToScreen({
                  x: bounds.x + bounds.width,
                  y: bounds.y + bounds.height
                })
                const screenWidth = screenPosEnd.x - screenPos.x
                const screenHeight = screenPosEnd.y - screenPos.y
                const elapsedTime = task.startedAt ? Math.floor((Date.now() - task.startedAt) / 1000) : 0

                return (
                  <GeneratingOverlay
                    key={task.id}
                    position={{ x: screenPos.x, y: screenPos.y }}
                    width={screenWidth}
                    height={screenHeight}
                    progress={task.progress}
                    taskId={task.id}
                    elapsedTime={elapsedTime}
                    estimatedTime={task.estimatedDuration}
                  />
                )
              }
            }
          }

          // 降级：使用固定位置
          const screenPos = canvasToScreen({
            x: task.position.x - task.width / 2,
            y: task.position.y - task.height / 2,
          })
          const screenPosEnd = canvasToScreen({
            x: task.position.x + task.width / 2,
            y: task.position.y + task.height / 2,
          })
          const screenWidth = screenPosEnd.x - screenPos.x
          const screenHeight = screenPosEnd.y - screenPos.y
          const elapsedTime = task.startedAt ? Math.floor((Date.now() - task.startedAt) / 1000) : 0

          return (
            <GeneratingOverlay
              key={task.id}
              position={{ x: screenPos.x, y: screenPos.y }}
              width={screenWidth}
              height={screenHeight}
              progress={task.progress}
              taskId={task.id}
              elapsedTime={elapsedTime}
              estimatedTime={task.estimatedDuration}
            />
          )
        })}

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuEntries}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 资料库对话框 */}
      {showLibraryDialog && (
        <LibraryDialog
          onClose={() => setShowLibraryDialog(false)}
          onSelect={handleLibrarySelect}
        />
      )}

      {/* Toast */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* 删除确认 */}
      <DeleteConfirmModal
        visible={deleteConfirmVisible}
        onOk={confirmDelete}
        onCancel={() => setDeleteConfirmVisible(false)}
        title="删除图层"
        content={`确定要删除选中的 ${selectedLayerIds.length} 个图层吗？`}
      />

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
            setShowAllProjectsPage(false)
          }}
          onCreateProject={() => {
            setLayers([])
            setSelectedLayerIds([])
            setProjectName('Untitled')
            setShowAllProjectsPage(false)
            if (editor) {
              editor.selectNone()
              const shapes = editor.getCurrentPageShapes()
              editor.deleteShapes(shapes.map(s => s.id))
            }
          }}
          onShowDeleteSuccess={() => addToast('项目删除成功', 'success')}
        />
      )}

      {/* 新手引导 - 仅在画布为空且未完成引导时显示 */}
      {!hasCompletedOnboarding && layers.length === 0 && generationTasks.filter(task => task.status === 'generating').length === 0 && (() => {
        return (
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
                position: 'fixed',
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
                    background: lightTheme
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
                      stroke={lightTheme ? '#38BDFF' : '#38BDFF'}
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
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #38BDFF 0%, #7C3AED 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '-0.02em',
                  }}
                >
                  无限画布
                </h1>

                {/* 副标题 */}
                <p
                  style={{
                    fontSize: 18,
                    color: lightTheme ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
                    fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                    marginBottom: 32,
                    maxWidth: 420,
                    lineHeight: 1.7,
                    fontWeight: 500,
                  }}
                >
                  用文字描述你想要的画面，AI 帮你生成图片或视频
                </p>

                {/* 功能说明 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    marginBottom: 48,
                    maxWidth: 380,
                  }}
                >
                  {[
                    { icon: '✨', text: '输入想法，一键生成' },
                    { icon: '🎨', text: '自由移动、缩放、编辑' },
                    { icon: '🎬', text: '支持图片和视频创作' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 15,
                        color: lightTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                        fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>

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
                      fontSize: 14,
                      color: lightTheme ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                      fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                      animation: 'onboarding-pulse 2s ease-in-out infinite',
                      fontWeight: 500,
                    }}
                  >
                    👇 从这里开始
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
                      stroke={lightTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* 暗色/亮色模式覆盖样式 */}
      <style>{`
        .tl-background {
          background: ${lightTheme
            ? 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)'
            : 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)'} !important;
        }
        .tl-canvas {
          background: transparent !important;
        }
        [data-radix-popper-content-wrapper] {
          display: none !important;
        }
        .tlui-layout {
          background: transparent !important;
        }
        .tlui-layout__top {
          display: none !important;
        }
        .tlui-layout__bottom {
          display: none !important;
        }
        .tl-grid {
          --tl-grid-color: ${lightTheme ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'} !important;
        }
        .tl-selection__fg {
          stroke: #38BDFF !important;
        }
        .tl-selection__bg {
          fill: rgba(56, 189, 255, 0.1) !important;
        }
        .tl-corner-handle {
          fill: #38BDFF !important;
          stroke: white !important;
        }
        .tl-edge-handle {
          stroke: #38BDFF !important;
        }
        .tl-rotate-handle {
          fill: #38BDFF !important;
          stroke: white !important;
        }
        .ai-image-info:hover {
          opacity: 1 !important;
        }
      `}</style>
      </div>
    </>
  )
}

// 带 ThemeProvider 的导出
export default function TldrawPocApp() {
  return (
    <ThemeProvider>
      <TldrawAppContent />
    </ThemeProvider>
  )
}
