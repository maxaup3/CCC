/**
 * tldraw 整合版本 - 完整功能
 * 使用 tldraw 无限画布 + 所有原有 UI 组件和功能
 */
import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react'
import {
  Tldraw,
  Editor,
  createShapeId,
  useEditor,
  track,
  TLShapeId,
  exportToBlob,
} from 'tldraw'
import html2canvas from 'html2canvas'
import 'tldraw/tldraw.css'
import { AIImageShapeUtil, videoElementsMap, isAIImageShape, createAIImageShapeProps } from './components/tldraw-poc/AIImageShape'
import { AgentCardShapeUtil } from './components/tldraw-poc/AgentCardShape'
import { ProductCardShapeUtil } from './components/tldraw-poc/ProductCardShape'
import { CommentShapeUtil } from './components/tldraw-poc/CommentShape'
import { OutlineCardShapeUtil } from './components/tldraw-poc/OutlineCardShape'
import { PageCardShapeUtil } from './components/tldraw-poc/PageCardShape'
import { FileCardShapeUtil } from './components/tldraw-poc/FileCardShape'
import { DocCardShapeUtil } from './components/tldraw-poc/DocCardShape'
import { TableCardShapeUtil } from './components/tldraw-poc/TableCardShape'
import { AIWorkingZoneShapeUtil } from './components/tldraw-poc/AIWorkingZoneShape'
import VideoControls from './components/tldraw-poc/VideoControls'
import TopBar from './components/TopBar'
import BottomDialog, { BottomDialogRef } from './components/BottomDialog'
import LayerPanel from './components/LayerPanel'
import ToastContainer, { ToastItem } from './components/ToastContainer'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import ImageToolbar from './components/ImageToolbar'
import DetailPanelSimple from './components/DetailPanelSimple'
import ContextMenu, { ContextMenuEntry } from './components/ContextMenu'
import LoadingScreen from './components/LoadingScreen'
import AgentInputBar from './components/AgentInputBar'
import ScreenshotOverlay from './components/ScreenshotOverlay'
// AIWorkingZone 已改为 tldraw 原生 shape（AIWorkingZoneShapeUtil），不再使用 overlay
import ApiKeyDialog, { getApiKey, getNebulaApiKey } from './components/ApiKeyDialog'
import { ImageLayer, GenerationConfig, EditMode } from './types'
import { ThemeProvider, useTheme, getThemeStyles, isLightTheme } from './contexts/ThemeContext'
import { usePageNavigation } from './hooks/usePageNavigation'
import { useUIState } from './hooks/useUIState'
import { useAgentOrchestrator } from './hooks/useAgentOrchestrator'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCanvasPersistence } from './hooks/useCanvasPersistence'
import { agentEvents, AGENT_EVENTS } from './utils/agentEvents'
import {
  getAllProjectsMetadata,
  loadProjectSnapshot,
  createProject,
  deleteProject,
  generateProjectId,
} from './utils/projectPersistence'
import { generateImage, base64ToBlobUrl, IMAGE_MODELS, DEFAULT_MODEL } from './services/imageGeneration'
import { parseImageCommand, detectImageIntent, detectImageEditIntent, IntentDetectionResult } from './utils/imageCommandParser'
import * as XLSX from 'xlsx'
import type { GeminiImageSize } from './services/imageGeneration'

// 懒加载不常用的大型组件
const LibraryDialog = lazy(() => import('./components/LibraryDialog'))
const LandingPage = lazy(() => import('./components/LandingPage'))
const AllProjectsPage = lazy(() => import('./components/AllProjectsPage'))
import {
  getViewportCenter,
  getImageSizeFromAspectRatio,
  calculateGridLayout,
  getGridPosition,
} from './utils/canvasUtils'

// 自定义形状
const customShapeUtils = [
  AIImageShapeUtil,
  AgentCardShapeUtil,
  ProductCardShapeUtil,
  CommentShapeUtil,
  OutlineCardShapeUtil,
  PageCardShapeUtil,
  FileCardShapeUtil,
  DocCardShapeUtil,
  TableCardShapeUtil,
  AIWorkingZoneShapeUtil,
]

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
// v2 alpha 版本不需要 TLComponents 类型
const components = {
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
  // 注意: InFrontOfTheCanvas 包含 "Made with tldraw" 水印
  // 保留水印可以免费用于生产环境 (tldraw v4 许可证要求)
  // 如果要移除水印，需要购买商业许可证 ($6,000/年)
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
  projectId,
  projectName,
}: {
  onLayersChange: (layers: ImageLayer[]) => void
  onSelectionChange: (ids: string[]) => void
  onZoomChange: (zoom: number) => void
  onCameraChange: (camera: { x: number; y: number; z: number }) => void
  projectId?: string
  projectName?: string
}) {
  const editor = useEditor()

  // 启用画布持久化
  useCanvasPersistence(editor, {
    projectId: projectId || 'default-project',
    projectName: projectName || 'Untitled Project',
    enabled: true,
  })

  // 监听形状变化
  useEffect(() => {
    const unsubscribe = editor.store.listen(() => {
      // 使用 getSortedChildIdsForParent 获取按 Z 轴排序的 shape IDs
      const currentPageId = editor.getCurrentPageId()
      const sortedIds = editor.getSortedChildIdsForParent(currentPageId)

      // 根据排序后的 ID 获取 ai-image shapes
      const aiShapes = sortedIds
        .map(id => editor.getShape(id))
        .filter((s): s is NonNullable<typeof s> => s !== undefined && isAIImageShape(s))

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

// 扫描读取卡片高亮 overlay
function ScanningOverlay({ editor, shapeId }: { editor: Editor; shapeId: string }) {
  const [screen, setScreen] = useState({ left: 0, top: 0, width: 0, height: 0 })

  useEffect(() => {
    const shape = editor.getShape(shapeId as TLShapeId)
    if (!shape) return

    const update = () => {
      const s = shape as any
      const w = s.props?.w || 280
      const h = s.props?.h || 120
      const topLeft = editor.pageToScreen({ x: s.x, y: s.y })
      const bottomRight = editor.pageToScreen({ x: s.x + w, y: s.y + h })
      setScreen({
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      })
    }

    update()
    // 跟踪相机变化
    const unsub = editor.store.listen(update, { scope: 'document' })
    return unsub
  }, [editor, shapeId])

  if (screen.width === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: screen.left - 4,
        top: screen.top - 4,
        width: screen.width + 8,
        height: screen.height + 8,
        border: '2px solid #7C3AED',
        borderRadius: 12,
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden',
        boxShadow: '0 0 20px rgba(124, 58, 237, 0.3)',
      }}
    >
      {/* 扫描光效 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.15), transparent)',
          animation: 'scan-sweep 0.8s ease-in-out infinite',
        }}
      />
      {/* 角标 */}
      <div
        style={{
          position: 'absolute',
          top: -1,
          right: -1,
          padding: '2px 8px',
          background: '#7C3AED',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          borderRadius: '0 10px 0 8px',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        读取中
      </div>
      <style>{`
        @keyframes scan-sweep {
          0% { left: -100%; }
          100% { left: 200%; }
        }
      `}</style>
    </div>
  )
}

// 主应用组件
function TldrawAppContent() {
  const { themeStyle } = useTheme()
  const theme = getThemeStyles(themeStyle)
  const lightTheme = isLightTheme(themeStyle)

  const {
    showLandingPage, setShowLandingPage,
    showAllProjectsPage, setShowAllProjectsPage,
    showLoading, setShowLoading,
    isLoadingFadingOut,
    handleLoadingFadeStart, handleLoadingComplete,
  } = usePageNavigation()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [pendingGenerationConfig, setPendingGenerationConfig] = useState<GenerationConfig | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [layers, setLayers] = useState<ImageLayer[]>([])
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])
  const [zoom, setZoom] = useState(100)
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 })
  const [projectName, setProjectName] = useState('Untitled')
  const [projectId, setProjectId] = useState(() => {
    // Try to load last opened project ID from localStorage
    const lastProjectId = localStorage?.getItem?.('canvas-last-project')
    if (lastProjectId) {
      return lastProjectId
    }
    // Generate a new project ID if none found
    return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  })
  const {
    deleteConfirmVisible, setDeleteConfirmVisible,
    showDetailPanel, setShowDetailPanel,
    showLibraryDialog, setShowLibraryDialog,
    libraryInsertPosition, setLibraryInsertPosition,
    contextMenu, setContextMenu,
    isLayerPanelOpen, setIsLayerPanelOpen,
    isBottomDialogExpanded, setIsBottomDialogExpanded,
  } = useUIState()
  const [editMode, setEditMode] = useState<EditMode>('normal')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [clipboardLayers, setClipboardLayers] = useState<ImageLayer[]>([])
  const [isLayerTransforming, setIsLayerTransforming] = useState(false)
  const [isCameraPanning, setIsCameraPanning] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(() => !!getApiKey())
  const [screenshotMode, setScreenshotMode] = useState(false)
  const [pendingScreenshot, setPendingScreenshot] = useState<string | null>(null)
  // 截图的从属信息：来源 shape + 区域
  const [screenshotSource, setScreenshotSource] = useState<{
    shapeId: string
    shapeType: string
    regionBounds: { x: number; y: number; w: number; h: number }  // 相对于 shape 的坐标
  } | null>(null)
  // 待确认的模糊意图
  const [pendingAmbiguousIntent, setPendingAmbiguousIntent] = useState<{
    message: string
    intent: IntentDetectionResult
    screenshot?: string
  } | null>(null)

  // 删除感知
  const productCardSnapshotRef = useRef<Map<string, { name: string, tags: string[], x: number, y: number }>>(new Map())
  const tldrawContainerRef = useRef<HTMLDivElement>(null)

  const cameraPanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCameraRef = useRef({ x: 0, y: 0, z: 1 })
  const bottomDialogRef = useRef<BottomDialogRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transformTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingGenerationConfigRef = useRef<GenerationConfig | null>(null)

  const selectedLayer = useMemo(() =>
    selectedLayerIds.length === 1
      ? layers.find(l => l.id === selectedLayerIds[0]) || null
      : null,
    [selectedLayerIds, layers]
  )

  // 选中的产品卡片（用于框选 + 输入上下文）
  const selectedProductCards = useMemo(() => {
    if (!editor || selectedLayerIds.length === 0) return []
    return selectedLayerIds
      .map(id => editor.getShape(id as TLShapeId))
      .filter(s => s && (s as any).type === 'product-card')
      .map(s => ({ id: s!.id, ...(s as any).props }))
  }, [editor, selectedLayerIds])

  // 选中单张卡片时，提取信息用于"卡片指令模式"
  const CARD_TYPES = useMemo(() => new Set([
    'product-card', 'agent-card', 'page-card',
    'doc-card', 'file-card', 'table-card',
  ]), [])

  const selectedCardForComment = useMemo(() => {
    if (!editor || selectedLayerIds.length !== 1) return null
    const shape = editor.getShape(selectedLayerIds[0] as TLShapeId)
    if (!shape) return null
    if (!CARD_TYPES.has((shape as any).type)) return null
    return {
      id: shape.id as string,
      type: (shape as any).type,
      name: (shape as any).props?.name
        || (shape as any).props?.pageTitle
        || (shape as any).props?.fileName
        || (shape as any).props?.title
        || '卡片',
    }
  }, [editor, selectedLayerIds, CARD_TYPES])

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

  // 相机变化时也需要更新位置，并检测是否正在平移
  useEffect(() => {
    const lastCamera = lastCameraRef.current
    const isPanning = Math.abs(camera.x - lastCamera.x) > 0.5 || Math.abs(camera.y - lastCamera.y) > 0.5

    if (isPanning) {
      // 相机正在移动，隐藏工具栏
      setIsCameraPanning(true)

      // 清除之前的超时
      if (cameraPanTimeoutRef.current) {
        clearTimeout(cameraPanTimeoutRef.current)
      }

      // 停止移动后 200ms 显示工具栏
      cameraPanTimeoutRef.current = setTimeout(() => {
        setIsCameraPanning(false)
        cameraPanTimeoutRef.current = null
      }, 200)
    }

    lastCameraRef.current = camera
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

  // Agent 编排 hook
  const {
    agentTasks,
    agentMode,
    setAgentMode,
    activePrompt,
    scanningShapeId,
    handleAgentMessage,
    handlePromptSelect,
    handlePromptDismiss,
    createComment,
    setImageGenerationZoneBounds,
  } = useAgentOrchestrator({ editor, selectedProductCards, selectedShapeIds: selectedLayerIds, addToast })

  // 将选中的 shape 截图为 PNG base64 data URL（使用 html2canvas 支持自定义 shape）
  const captureShapeScreenshot = useCallback(async (shapeId: string): Promise<string | undefined> => {
    if (!editor) return undefined
    try {
      // 获取 shape 的 page bounds，转换为 screen 坐标
      const shapeBounds = editor.getShapePageBounds(shapeId as TLShapeId)
      if (!shapeBounds) return undefined

      const padding = 12
      const screenStart = editor.pageToScreen({ x: shapeBounds.x - padding, y: shapeBounds.y - padding })
      const screenEnd = editor.pageToScreen({
        x: shapeBounds.x + shapeBounds.width + padding,
        y: shapeBounds.y + shapeBounds.height + padding,
      })

      // 优先使用 ref，否则尝试多个选择器
      let container: HTMLElement | null = tldrawContainerRef.current
      if (!container) {
        container = document.querySelector('.tl-container') as HTMLElement
      }
      if (!container) {
        container = document.querySelector('.tl-canvas')?.parentElement as HTMLElement
      }
      if (!container) {
        container = document.querySelector('.tldraw') as HTMLElement
      }
      if (!container) return undefined

      const containerRect = container.getBoundingClientRect()

      const x = screenStart.x - containerRect.left
      const y = screenStart.y - containerRect.top
      const w = screenEnd.x - screenStart.x
      const h = screenEnd.y - screenStart.y

      if (w < 1 || h < 1) return undefined

      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        x: x,
        y: y,
        width: w,
        height: h,
        scrollX: 0,
        scrollY: 0,
      })

      if (canvas.width < 1 || canvas.height < 1) return undefined
      return canvas.toDataURL('image/png')
    } catch {
      return undefined
    }
  }, [editor])

  // 截取画布指定区域为 PNG base64（使用 html2canvas 支持自定义 shape）
  const captureRegionScreenshot = useCallback(async (
    pageBounds: { x: number; y: number; w: number; h: number }
  ): Promise<string | undefined> => {
    console.log('[captureRegionScreenshot] Start', pageBounds)
    if (!editor) {
      console.error('[captureRegionScreenshot] No editor')
      return undefined
    }
    try {
      // 将 page 坐标转换为 screen 坐标
      const screenStart = editor.pageToScreen({ x: pageBounds.x, y: pageBounds.y })
      const screenEnd = editor.pageToScreen({
        x: pageBounds.x + pageBounds.w,
        y: pageBounds.y + pageBounds.h,
      })
      console.log('[captureRegionScreenshot] Screen coords', { screenStart, screenEnd })

      // 优先使用 ref，否则尝试多个选择器
      let container: HTMLElement | null = tldrawContainerRef.current
      if (container) {
        console.log('[captureRegionScreenshot] Using ref container')
      } else {
        // 回退：尝试多个选择器
        container = document.querySelector('.tl-container') as HTMLElement
        if (!container) {
          container = document.querySelector('.tl-canvas')?.parentElement as HTMLElement
        }
        if (!container) {
          container = document.querySelector('[data-testid="canvas"]') as HTMLElement
        }
        if (!container) {
          container = document.querySelector('.tldraw') as HTMLElement
        }
        if (!container) {
          console.error('[captureRegionScreenshot] No tldraw container found')
          return undefined
        }
        console.log('[captureRegionScreenshot] Using selector container:', container.className)
      }

      const containerRect = container.getBoundingClientRect()
      console.log('[captureRegionScreenshot] Container rect', containerRect)

      // 计算截取区域相对于容器的偏移
      const x = Math.max(0, screenStart.x - containerRect.left)
      const y = Math.max(0, screenStart.y - containerRect.top)
      const w = Math.max(1, screenEnd.x - screenStart.x)
      const h = Math.max(1, screenEnd.y - screenStart.y)

      console.log('[captureRegionScreenshot] Crop region', { x, y, w, h })

      if (w < 10 || h < 10) {
        console.warn('[captureRegionScreenshot] Region too small')
        return undefined
      }

      // 使用 html2canvas 截取整个容器
      console.log('[captureRegionScreenshot] Calling html2canvas...')
      const fullCanvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: true, // 启用日志帮助调试
        scrollX: 0,
        scrollY: 0,
        allowTaint: true,
      })
      console.log('[captureRegionScreenshot] html2canvas done, canvas size:', fullCanvas.width, fullCanvas.height)

      // 创建新 canvas 用于裁剪
      const croppedCanvas = document.createElement('canvas')
      const scale = 2
      croppedCanvas.width = w * scale
      croppedCanvas.height = h * scale

      const ctx = croppedCanvas.getContext('2d')
      if (!ctx) {
        console.error('[captureRegionScreenshot] Failed to get 2d context')
        return undefined
      }

      // 从完整 canvas 中裁剪指定区域
      try {
        ctx.drawImage(
          fullCanvas,
          x * scale,
          y * scale,
          w * scale,
          h * scale,
          0,
          0,
          w * scale,
          h * scale
        )
        console.log('[captureRegionScreenshot] Draw complete')
      } catch (drawError) {
        console.error('[captureRegionScreenshot] Failed to draw cropped image:', drawError)
        return undefined
      }

      const dataUrl = croppedCanvas.toDataURL('image/png')
      console.log('[captureRegionScreenshot] Success, dataUrl length:', dataUrl.length)
      return dataUrl
    } catch (error) {
      console.error('[captureRegionScreenshot] Failed:', error)
      return undefined
    }
  }, [editor])

  // 截图完成回调：屏幕坐标 → page 坐标 → 使用 tldraw 原生导出
  const handleScreenshotCapture = useCallback(async (
    screenStart: { x: number; y: number },
    screenEnd: { x: number; y: number }
  ) => {
    console.log('[Screenshot] handleScreenshotCapture called', { screenStart, screenEnd })

    if (!editor) {
      console.warn('[Screenshot] Editor not available')
      addToast('截图失败：编辑器不可用', 'error')
      setScreenshotMode(false)
      return
    }

    try {
      // 1. 计算屏幕选区（用于 html2canvas 截图）
      const screenBounds = {
        x: Math.min(screenStart.x, screenEnd.x),
        y: Math.min(screenStart.y, screenEnd.y),
        w: Math.abs(screenEnd.x - screenStart.x),
        h: Math.abs(screenEnd.y - screenStart.y),
      }

      // 2. 屏幕坐标转 page 坐标（用于查找相交的 shapes）
      const pageStart = editor.screenToPage(screenStart)
      const pageEnd = editor.screenToPage(screenEnd)
      const selectionBounds = {
        x: Math.min(pageStart.x, pageEnd.x),
        y: Math.min(pageStart.y, pageEnd.y),
        w: Math.abs(pageEnd.x - pageStart.x),
        h: Math.abs(pageEnd.y - pageStart.y),
      }
      console.log('[Screenshot] Selection bounds (page coords):', selectionBounds)

      // 3. 找出与选区相交的 shapes
      const allShapes = editor.getCurrentPageShapes()
      const intersectingShapes = allShapes.filter(shape => {
        // 排除 ai-working-zone
        if (shape.type === 'ai-working-zone') return false
        const shapeBounds = editor.getShapePageBounds(shape.id)
        if (!shapeBounds) return false
        // 检查矩形相交
        return !(
          shapeBounds.x + shapeBounds.width < selectionBounds.x ||
          shapeBounds.x > selectionBounds.x + selectionBounds.w ||
          shapeBounds.y + shapeBounds.height < selectionBounds.y ||
          shapeBounds.y > selectionBounds.y + selectionBounds.h
        )
      })
      console.log('[Screenshot] Intersecting shapes:', intersectingShapes.length)

      if (intersectingShapes.length === 0) {
        addToast('截图区域内没有内容', 'info')
        setScreenshotMode(false)
        return
      }

      // 4. 找主要的从属 shape（面积占比最大的那个）
      let primaryShape = intersectingShapes[0]
      let maxOverlapArea = 0
      for (const shape of intersectingShapes) {
        const shapeBounds = editor.getShapePageBounds(shape.id)
        if (!shapeBounds) continue
        // 计算相交面积
        const overlapX = Math.max(0, Math.min(shapeBounds.x + shapeBounds.width, selectionBounds.x + selectionBounds.w) - Math.max(shapeBounds.x, selectionBounds.x))
        const overlapY = Math.max(0, Math.min(shapeBounds.y + shapeBounds.height, selectionBounds.y + selectionBounds.h) - Math.max(shapeBounds.y, selectionBounds.y))
        const overlapArea = overlapX * overlapY
        if (overlapArea > maxOverlapArea) {
          maxOverlapArea = overlapArea
          primaryShape = shape
        }
      }
      console.log('[Screenshot] Primary shape:', primaryShape.type, primaryShape.id)

      // 5. 计算选区相对于主 shape 的坐标
      const primaryBounds = editor.getShapePageBounds(primaryShape.id)!
      const regionBounds = {
        x: selectionBounds.x - primaryBounds.x,
        y: selectionBounds.y - primaryBounds.y,
        w: selectionBounds.w,
        h: selectionBounds.h,
      }

      // 6. 截图：使用 html2canvas 截取屏幕上的实际像素
      // 关键：先关闭遮罩，等待 DOM 更新，再截图
      setScreenshotMode(false)

      // 等待一帧让遮罩消失
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      addToast('正在截图...', 'info')

      let screenshot: string

      try {
        // 使用 html2canvas 截取 document.body 的指定区域
        console.log('[Screenshot] Using html2canvas to capture screen region:', screenBounds)

        const html2canvasResult = await html2canvas(document.body, {
          x: screenBounds.x,
          y: screenBounds.y,
          width: screenBounds.w,
          height: screenBounds.h,
          scale: window.devicePixelRatio || 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null, // 透明背景，保留原有颜色
          logging: false,
          ignoreElements: (element) => {
            // 忽略截图遮罩本身（如果还在的话）
            return element.classList?.contains('screenshot-overlay') ||
                   element.getAttribute?.('data-screenshot-ignore') === 'true'
          },
        })

        screenshot = html2canvasResult.toDataURL('image/png')
        console.log('[Screenshot] html2canvas successful, dataURL length:', screenshot.length)

      } catch (html2canvasError) {
        console.log('[Screenshot] html2canvas failed, trying tldraw export...', html2canvasError)

        // 备选方案：使用 tldraw 的 exportToBlob
        const shapeIds = intersectingShapes.map(s => s.id)
        try {
          const blob = await exportToBlob({
            editor,
            ids: shapeIds,
            format: 'png',
            opts: { background: true, padding: 0, scale: 2 },
          })

          if (blob) {
            screenshot = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            console.log('[Screenshot] tldraw export API successful')
          } else {
            throw new Error('exportToBlob returned null')
          }
        } catch (exportError) {
          console.log('[Screenshot] All methods failed, creating placeholder...', exportError)

          // 最终回退：创建一个带有形状信息的占位图
          const canvas = document.createElement('canvas')
          const scale = 2
          canvas.width = screenBounds.w * scale
          canvas.height = screenBounds.h * scale
          const ctx = canvas.getContext('2d')!

          // 绘制渐变背景
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
          gradient.addColorStop(0, '#f8f9fa')
          gradient.addColorStop(1, '#e9ecef')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // 绘制边框
          ctx.strokeStyle = '#dee2e6'
          ctx.lineWidth = 2
          ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

          // 绘制信息
          ctx.fillStyle = '#495057'
          ctx.font = `${16 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`截图区域 (${intersectingShapes.length} 个图层)`, canvas.width / 2, canvas.height / 2 - 15 * scale)
          ctx.font = `${12 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`
          ctx.fillStyle = '#868e96'
          ctx.fillText(`${Math.round(screenBounds.w)} × ${Math.round(screenBounds.h)} px`, canvas.width / 2, canvas.height / 2 + 15 * scale)

          screenshot = canvas.toDataURL('image/png')
        }
      }
      console.log('[Screenshot] Capture successful, size:', screenshot.length)

      setPendingScreenshot(screenshot)
      setScreenshotSource({
        shapeId: primaryShape.id,
        shapeType: primaryShape.type,
        regionBounds,
      })
      addToast('截图完成', 'success')

    } catch (error) {
      console.error('[Screenshot] Error:', error)
      addToast(`截图出错: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
      // 出错时确保遮罩也关闭
      setScreenshotMode(false)
    }
    // 注意：成功时 setScreenshotMode(false) 已在截图前调用
  }, [editor, addToast])

  // AI 生图处理
  const handleImageGeneration = useCallback(async (
    cmd: ReturnType<typeof parseImageCommand>,
    screenshotBase64?: string
  ) => {
    console.log('[handleImageGeneration] called with:', { prompt: cmd.prompt, hasScreenshot: !!screenshotBase64 })
    if (!editor) {
      console.log('[handleImageGeneration] no editor, returning')
      return
    }

    // 1. 检查 API Key
    if (!getNebulaApiKey()) {
      console.log('[handleImageGeneration] no API key, showing dialog')
      setShowApiKeyDialog(true)
      addToast('请先配置生图 API Key', 'info')
      return
    }

    // 2. 确定模型和参数
    const model = (cmd.modelId && IMAGE_MODELS.find(m => m.id === cmd.modelId)) || DEFAULT_MODEL
    const aspectRatio = cmd.aspectRatio || '1:1'
    const count = cmd.count || 1

    // 3. 计算占位尺寸和位置
    const centerPage = getViewportCenter(editor)
    const imageSize = getImageSizeFromAspectRatio(aspectRatio, 320)
    const layout = calculateGridLayout(centerPage, imageSize, count, 20)

    // 4. 创建占位 shapes
    const batchId = `imggen-${Date.now()}`
    const shapeIds: TLShapeId[] = []

    for (let i = 0; i < count; i++) {
      const shapeId = createShapeId()
      const pos = getGridPosition(layout.startX, layout.startY, i, imageSize, layout.is2x2, 20)

      editor.createShape(createAIImageShapeProps({
        id: shapeId,
        x: pos.x,
        y: pos.y,
        w: imageSize.width,
        h: imageSize.height,
        url: '', // 空 url → 占位渲染
        prompt: cmd.prompt,
        model: model.name,
      }))

      shapeIds.push(shapeId)
    }

    // 计算图像生成区域的总边界，用于 AIWorkingZone 显示
    let minX = layout.startX
    let minY = layout.startY
    let maxX = layout.startX
    let maxY = layout.startY

    for (let i = 0; i < count; i++) {
      const pos = getGridPosition(layout.startX, layout.startY, i, imageSize, layout.is2x2, 20)
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + imageSize.width)
      maxY = Math.max(maxY, pos.y + imageSize.height)
    }

    const padding = 40
    setImageGenerationZoneBounds({
      x: minX - padding,
      y: minY - padding,
      w: maxX - minX + padding * 2,
      h: maxY - minY + padding * 2,
    })

    // 5. 逐个生成图片
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < count; i++) {
      const shapeId = shapeIds[i]

      try {
        const result = await generateImage({
          prompt: cmd.prompt,
          modelId: model.id,
          aspectRatio,
          imageSize: (cmd.imageSize as GeminiImageSize) || undefined,
          referenceImages: screenshotBase64 ? [screenshotBase64] : undefined,
        })

        // base64 → Blob URL → 更新 shape
        const blobUrl = base64ToBlobUrl(result.base64, result.mimeType)
        editor.updateShape({
          id: shapeId,
          type: 'ai-image',
          props: { url: blobUrl, model: model.name, generatedAt: Date.now() },
        } as any)

        successCount++
      } catch (error: any) {
        failCount++
        addToast(`生图失败: ${error?.message || '未知错误'}`, 'error')
        editor.deleteShapes([shapeId])
      }
    }

    // 清除工作区边界
    setTimeout(() => setImageGenerationZoneBounds(null), 2100)

    // 选中所有生成的图片并显示完成消息
    const remainingIds = shapeIds.filter(id => {
      try { return !!editor.getShape(id) } catch { return false }
    })
    if (successCount > 0) {
      editor.select(...remainingIds)
      addToast(`${successCount}张图片生成完成`, 'success')
    }
  }, [editor, addToast, setImageGenerationZoneBounds])

  // 输入栏发送：选中单张卡片时截图 + emit USER_COMMENT_ON_SHAPE，否则走通用 handleAgentMessage
  const handleInputBarSend = useCallback(async (message: string) => {
    console.log('[handleInputBarSend] message:', message)

    // 取出截图和从属信息并清除
    const screenshot = pendingScreenshot
    const sourceInfo = screenshotSource
    if (screenshot) {
      setPendingScreenshot(null)
      setScreenshotSource(null)
    }

    // 检测生图指令（/img 前缀）
    const imgCmd = parseImageCommand(message)
    console.log('[handleInputBarSend] imgCmd:', imgCmd)
    if (imgCmd.isImageCommand) {
      console.log('[handleInputBarSend] detected /img command, calling handleImageGeneration')
      handleImageGeneration(imgCmd, screenshot || undefined)
      return
    }

    // 检测自然语言生图意图（"帮我生一张图"、"画一张星空"等）
    const imgIntent = detectImageIntent(message)
    console.log('[handleInputBarSend] imgIntent:', imgIntent)
    if (imgIntent.isImage) {
      if (imgIntent.confidence === 'high') {
        // 高置信度：直接执行生图
        console.log('[handleInputBarSend] detected HIGH confidence image intent, calling handleImageGeneration')
        handleImageGeneration({ isImageCommand: true, prompt: imgIntent.prompt }, screenshot || undefined)
        return
      } else if (imgIntent.confidence === 'low' && imgIntent.ambiguousType) {
        // 低置信度：保存待确认状态，显示确认对话框
        console.log('[handleInputBarSend] detected LOW confidence image intent, showing confirmation')
        setPendingAmbiguousIntent({
          message,
          intent: imgIntent,
          screenshot: screenshot || undefined,
        })
        return
      }
      // 中等置信度：也执行生图（但可以根据需要调整）
      console.log('[handleInputBarSend] detected MEDIUM confidence image intent, calling handleImageGeneration')
      handleImageGeneration({ isImageCommand: true, prompt: imgIntent.prompt }, screenshot || undefined)
      return
    }

    // 检测图片编辑意图（"把猫改成狗"等）—— 需要有截图才触发图生图
    if (screenshot && sourceInfo) {
      const editIntent = detectImageEditIntent(message)
      console.log('[handleInputBarSend] editIntent:', editIntent, 'sourceType:', sourceInfo.shapeType)
      if (editIntent.isEdit) {
        // 这是图片编辑请求：以截图为参考图，生成新图片
        console.log('[handleInputBarSend] detected image edit intent with screenshot, triggering image generation')
        handleImageGeneration({ isImageCommand: true, prompt: editIntent.prompt }, screenshot)
        return
      }
    }

    // 如果有截图从属信息但不是图片编辑意图，说明是针对非图片类型 shape 的修改（如卡片文字等）
    if (sourceInfo && screenshot) {
      agentEvents.emit(AGENT_EVENTS.USER_COMMENT_ON_SHAPE, {
        shapeId: sourceInfo.shapeId,
        instruction: message,
        screenshotBase64: screenshot,
        regionBounds: sourceInfo.regionBounds,  // 额外传递区域信息
      })
      return
    }

    if (selectedCardForComment) {
      // 异步截图，不阻塞（截图失败也能用纯文本）
      const screenshotBase64 = screenshot || await captureShapeScreenshot(selectedCardForComment.id)
      agentEvents.emit(AGENT_EVENTS.USER_COMMENT_ON_SHAPE, {
        shapeId: selectedCardForComment.id,
        instruction: message,
        screenshotBase64,
      })
    } else {
      handleAgentMessage(message, screenshot || undefined)
    }
  }, [selectedCardForComment, handleAgentMessage, handleImageGeneration, captureShapeScreenshot, pendingScreenshot, screenshotSource])

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

  // 删除感知：监听产品卡片删除
  useEffect(() => {
    if (!editor) return

    const unsubscribe = editor.store.listen(() => {
      const currentPageId = editor.getCurrentPageId()
      const allShapeIds = editor.getSortedChildIdsForParent(currentPageId)
      const currentProductCards = new Map<string, { name: string, tags: string[], x: number, y: number }>()

      for (const id of allShapeIds) {
        const shape = editor.getShape(id)
        if (shape && (shape as any).type === 'product-card') {
          const props = (shape as any).props
          let tags: string[] = []
          try {
            tags = JSON.parse(props.tags || '[]')
          } catch { /* ignore */ }
          currentProductCards.set(id, { name: props.name || '', tags, x: shape.x, y: shape.y })
        }
      }

      // Compare with snapshot to find deletions
      const snapshot = productCardSnapshotRef.current
      const deletedCards: { name: string, tags: string[], x: number, y: number }[] = []

      snapshot.forEach((data, id) => {
        if (!currentProductCards.has(id)) {
          deletedCards.push(data)
        }
      })

      // Update snapshot
      productCardSnapshotRef.current = currentProductCards
    }, { source: 'all', scope: 'document' })

    return () => {
      unsubscribe()
    }
  }, [editor, addToast, createComment])

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
            const newId = createShapeId()
            editor.createShape(createAIImageShapeProps({
              id: newId,
              x: layer.x - layer.width / 2 + offset,
              y: layer.y - layer.height / 2 + offset,
              w: layer.width,
              h: layer.height,
              url: layer.url,
              prompt: `${layer.name} (副本)`,
              isVideo: layer.type === 'video',
              generationConfig: layer.generationConfig ? JSON.stringify(layer.generationConfig) : '',
            }))
          })
          addToast(`已粘贴 ${clipboardLayers.length} 个图层`, 'success')
        }
        return
      }

      // C：进入截图模式
      if ((e.key === 'c' || e.key === 'C') && !cmdOrCtrl && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        console.log('[KeyPress] C pressed, entering screenshot mode')
        setScreenshotMode(true)
        addToast('进入截图模式', 'info')
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
      const ext = file.name.split('.').pop()?.toLowerCase()

      // MD 文件处理
      if (ext === 'md' || file.type === 'text/markdown') {
        const textContent = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (ev) => resolve(ev.target?.result as string)
          reader.readAsText(file)
        })
        const fileSizeStr = file.size < 1024
          ? `${file.size} B`
          : file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        const preview = textContent.slice(0, 200)

        const shapeId = createShapeId()
        editor.createShape({
          id: shapeId,
          type: 'doc-card' as any,
          x: position.x - 140,
          y: position.y - 70,
          props: {
            w: 280,
            h: 140,
            fileName: file.name,
            fileType: 'md',
            fileContent: textContent,
            preview,
            fileSize: fileSizeStr,
            uploadedAt: Date.now(),
            summary: '',
            detail: '',
            status: 'summarizing',
            expanded: false,
          },
        })
        editor.select(shapeId)
        // 触发自动总结
        agentEvents.emit(AGENT_EVENTS.SUMMARIZE_DOC, { shapeId: shapeId as string })
        continue
      }

      // PDF 文件处理
      if (ext === 'pdf' || file.type === 'application/pdf') {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (ev) => resolve(ev.target?.result as string)
          reader.readAsDataURL(file)
        })
        const fileSizeStr = file.size < 1024
          ? `${file.size} B`
          : file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

        const shapeId = createShapeId()
        editor.createShape({
          id: shapeId,
          type: 'doc-card' as any,
          x: position.x - 140,
          y: position.y - 70,
          props: {
            w: 280,
            h: 140,
            fileName: file.name,
            fileType: 'pdf',
            fileContent: dataUrl,
            preview: 'PDF 文件，需 Agent 读取',
            fileSize: fileSizeStr,
            uploadedAt: Date.now(),
            summary: '',
            detail: '',
            status: 'summarizing',
            expanded: false,
          },
        })
        editor.select(shapeId)
        // 触发自动总结
        agentEvents.emit(AGENT_EVENTS.SUMMARIZE_DOC, { shapeId: shapeId as string })
        continue
      }

      // Excel 文件处理
      if (ext === 'xlsx' || ext === 'xls' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const sheets = workbook.SheetNames.map(name => {
            const ws = workbook.Sheets[name]
            const jsonData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
            const headers = jsonData.length > 0 ? jsonData[0].map(String) : []
            const rows = jsonData.slice(1).map(row => row.map(String))
            return { name, headers, rows }
          }).filter(s => s.headers.length > 0)

          if (sheets.length > 0) {
            const shapeId = createShapeId()
            editor.createShape({
              id: shapeId,
              type: 'table-card' as any,
              x: position.x - 240,
              y: position.y - 100,
              props: {
                title: file.name.replace(/\.(xlsx|xls)$/i, ''),
                headers: JSON.stringify(sheets[0].headers),
                rows: JSON.stringify(sheets[0].rows),
                sheets: JSON.stringify(sheets),
                sourceTaskId: '',
              },
            })
            editor.select(shapeId)
            addToast(`已导入 ${file.name}（${sheets.length} 个工作表）`, 'success')
          }
        } catch (err) {
          console.error('Excel 解析失败:', err)
          addToast(`Excel 解析失败: ${file.name}`, 'error')
        }
        continue
      }

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
          const shapeId = createShapeId()
          editor.createShape(createAIImageShapeProps({
            id: shapeId,
            x: position.x - video.videoWidth / 2,
            y: position.y - video.videoHeight / 2,
            w: video.videoWidth,
            h: video.videoHeight,
            url: dataUrl,
            prompt: file.name,
            model: 'local-upload',
            generatedAt: Date.now(),
            isVideo: true,
          }))
          editor.select(shapeId)
        }
      } else {
        // 图片处理
        const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ width: img.width, height: img.height })
          img.src = dataUrl
        })

        const shapeId = createShapeId()
        editor.createShape(createAIImageShapeProps({
          id: shapeId,
          x: position.x - width / 2,
          y: position.y - height / 2,
          w: width,
          h: height,
          url: dataUrl,
          prompt: file.name,
          model: 'local-upload',
          generatedAt: Date.now(),
          isVideo: false,
        }))
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
      const shapeId = createShapeId()
      editor.createShape(createAIImageShapeProps({
        id: shapeId,
        x: libraryInsertPosition.x - img.width / 2,
        y: libraryInsertPosition.y - img.height / 2,
        w: img.width,
        h: img.height,
        url: imageUrl,
        prompt: 'Library Image',
        model: 'library',
        generatedAt: Date.now(),
        isVideo: false,
      }))
      editor.select(shapeId)
    }
    img.src = imageUrl
    setShowLibraryDialog(false)
  }, [editor, libraryInsertPosition])

  // 编辑器加载
  const handleMount = useCallback((ed: Editor) => {
    ed.setCurrentTool('select')
    setEditor(ed)

    // Store editor on window for shape component access
    ;(window as any).__tldrawEditor = ed

    // 启用网格背景
    ed.updateInstanceState({ isGridMode: true })

    // 初始视口：100% 缩放，居中在原点
    ed.setCamera({ x: 0, y: 0, z: 1 })

    // 检查是否有从首页带来的待处理生成任务
    if (pendingGenerationConfigRef.current) {
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

        const batchId = `batch-${Date.now()}`  // 批次ID，用于标识同一批生成的图片

        // 创建所有占位 shape
        const allShapeIds: string[] = []
        const isVideoMode = config.mode === 'video'

        for (let i = 0; i < count; i++) {
          const shapeId = createShapeId()
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

          ed.createShape(createAIImageShapeProps({
            id: shapeId,
            x: shapeX,
            y: shapeY,
            w: imageSize.width,
            h: imageSize.height,
            url: mediaUrl,
            prompt: config.prompt,
            model: config.model,
            generatedAt: Date.now(),
            isVideo: isVideoMode,
            generationConfig: JSON.stringify(configWithBatch),
          }))

          allShapeIds.push(shapeId as string)
        }

        ed.select(...allShapeIds as TLShapeId[])
        setIsBottomDialogExpanded(true)
      }, 200)
    }

    // 覆盖文件拖放处理器
    ed.registerExternalContentHandler('files', async ({ point, files }) => {
      const position = point ?? ed.getViewportPageBounds().center

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase()

        // MD 文件拖拽
        if (ext === 'md' || file.type === 'text/markdown') {
          const textContent = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = (ev) => resolve(ev.target?.result as string)
            reader.readAsText(file)
          })
          const fileSizeStr = file.size < 1024
            ? `${file.size} B`
            : file.size < 1024 * 1024
              ? `${(file.size / 1024).toFixed(1)} KB`
              : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

          const shapeId = createShapeId()
          ed.createShape({
            id: shapeId,
            type: 'doc-card' as any,
            x: position.x - 140,
            y: position.y - 70,
            props: {
              w: 280,
              h: 140,
              fileName: file.name,
              fileType: 'md',
              fileContent: textContent,
              preview: textContent.slice(0, 200),
              fileSize: fileSizeStr,
              uploadedAt: Date.now(),
              summary: '',
              detail: '',
              status: 'summarizing',
              expanded: false,
            },
          })
          ed.select(shapeId)
          agentEvents.emit(AGENT_EVENTS.SUMMARIZE_DOC, { shapeId: shapeId as string })
          continue
        }

        // PDF 文件拖拽
        if (ext === 'pdf' || file.type === 'application/pdf') {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = (ev) => resolve(ev.target?.result as string)
            reader.readAsDataURL(file)
          })
          const fileSizeStr = file.size < 1024
            ? `${file.size} B`
            : file.size < 1024 * 1024
              ? `${(file.size / 1024).toFixed(1)} KB`
              : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

          const shapeId = createShapeId()
          ed.createShape({
            id: shapeId,
            type: 'doc-card' as any,
            x: position.x - 140,
            y: position.y - 70,
            props: {
              w: 280,
              h: 140,
              fileName: file.name,
              fileType: 'pdf',
              fileContent: dataUrl,
              preview: 'PDF 文件，需 Agent 读取',
              fileSize: fileSizeStr,
              uploadedAt: Date.now(),
              summary: '',
              detail: '',
              status: 'summarizing',
              expanded: false,
            },
          })
          ed.select(shapeId)
          agentEvents.emit(AGENT_EVENTS.SUMMARIZE_DOC, { shapeId: shapeId as string })
          continue
        }

        // Excel 文件拖拽
        if (ext === 'xlsx' || ext === 'xls' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const workbook = XLSX.read(arrayBuffer, { type: 'array' })
            const sheets = workbook.SheetNames.map(name => {
              const ws = workbook.Sheets[name]
              const jsonData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
              const headers = jsonData.length > 0 ? jsonData[0].map(String) : []
              const rows = jsonData.slice(1).map(row => row.map(String))
              return { name, headers, rows }
            }).filter(s => s.headers.length > 0)

            if (sheets.length > 0) {
              const shapeId = createShapeId()
              ed.createShape({
                id: shapeId,
                type: 'table-card' as any,
                x: position.x - 240,
                y: position.y - 100,
                props: {
                  title: file.name.replace(/\.(xlsx|xls)$/i, ''),
                  headers: JSON.stringify(sheets[0].headers),
                  rows: JSON.stringify(sheets[0].rows),
                  sheets: JSON.stringify(sheets),
                  sourceTaskId: '',
                },
              })
              ed.select(shapeId)
              addToast(`已导入 ${file.name}（${sheets.length} 个工作表）`, 'success')
            }
          } catch (err) {
            console.error('Excel 解析失败:', err)
            addToast(`Excel 解析失败: ${file.name}`, 'error')
          }
          continue
        }

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
            ed.createShape(createAIImageShapeProps({
              id: shapeId,
              x: position.x - video.videoWidth / 2,
              y: position.y - video.videoHeight / 2,
              w: video.videoWidth,
              h: video.videoHeight,
              url: dataUrl,
              prompt: file.name,
              model: 'local-upload',
              generatedAt: Date.now(),
              isVideo: true,
            }))
            ed.select(shapeId)
          }
        } else {
          const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
            const img = new Image()
            img.onload = () => resolve({ width: img.width, height: img.height })
            img.src = dataUrl
          })

          const shapeId = createShapeId()
          ed.createShape(createAIImageShapeProps({
            id: shapeId,
            x: position.x - width / 2,
            y: position.y - height / 2,
            w: width,
            h: height,
            url: dataUrl,
            prompt: file.name,
            model: 'local-upload',
            generatedAt: Date.now(),
            isVideo: false,
          }))
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
    const id = createShapeId()
    editor.createShape(createAIImageShapeProps({
      id,
      x: layer.x - layer.width / 2,
      y: layer.y - layer.height / 2,
      w: layer.width,
      h: layer.height,
      url: layer.url,
      prompt: layer.name,
      isVideo: layer.type === 'video',
      generationConfig: layer.generationConfig ? JSON.stringify(layer.generationConfig) : '',
    }))
    return id as string
  }, [editor])

  // 图层重排序（改变 Z 轴顺序）
  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (!editor) return
    if (fromIndex === toIndex) return

    // layers 数组是从上到下排列的（index 0 是最上层，Z轴最高）
    // 使用 getSortedChildIdsForParent 获取真正按 Z 轴排序的 shapes
    const currentPageId = editor.getCurrentPageId()
    const sortedIds = editor.getSortedChildIdsForParent(currentPageId)

    // 只获取 ai-image shapes
    const aiShapeIds = sortedIds.filter(id => {
      const shape = editor.getShape(id)
      return shape && isAIImageShape(shape)
    })

    // aiShapeIds 是 tldraw 的原始顺序（index 越大，z-index 越高）
    // layers 是 reversed 的（index 越小，z-index 越高）
    // 所以 layers[i] 对应 aiShapeIds[aiShapeIds.length - 1 - i]

    const fromTldrawIndex = aiShapeIds.length - 1 - fromIndex
    const toTldrawIndex = aiShapeIds.length - 1 - toIndex

    const shapeIdToMove = aiShapeIds[fromTldrawIndex]
    if (!shapeIdToMove) {
      return
    }

    // 在面板中向上拖动 (fromIndex > toIndex) = Z轴变高 = 在 tldraw 中往后移
    // 在面板中向下拖动 (fromIndex < toIndex) = Z轴变低 = 在 tldraw 中往前移

    if (fromIndex > toIndex) {
      // 向上移动（Z轴变高）
      // 使用 bringForward 逐步向上移动
      const steps = fromIndex - toIndex
      for (let i = 0; i < steps; i++) {
        editor.bringForward([shapeIdToMove as TLShapeId])
      }
    } else {
      // 向下移动（Z轴变低）
      // 使用 sendBackward 逐步向下移动
      const steps = toIndex - fromIndex
      for (let i = 0; i < steps; i++) {
        editor.sendBackward([shapeIdToMove as TLShapeId])
      }
    }

  }, [editor, layers])

  // 生成图片
  const handleGenerate = useCallback((config: GenerationConfig) => {
    if (!editor) {
      return
    }

    const centerPage = getViewportCenter(editor)
    const imageSize = getImageSizeFromAspectRatio(config.aspectRatio || '1:1', 320)
    const count = config.count || 1
    const gap = 20

    // 计算网格布局
    const { startX, startY, is2x2 } = calculateGridLayout(centerPage, imageSize, count, gap)

    const batchId = `batch-${Date.now()}`  // 批次ID，用于标识同一批生成的图片
    const isVideoMode = config.mode === 'video'
    const allShapeIds: string[] = []

    // 创建所有占位 shape
    for (let i = 0; i < count; i++) {
      const shapeId = createShapeId()
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

      editor.createShape(createAIImageShapeProps({
        id: shapeId,
        x: shapeX,
        y: shapeY,
        w: imageSize.width,
        h: imageSize.height,
        url: mediaUrl,
        prompt: config.prompt,
        model: config.model,
        generatedAt: Date.now(),
        isVideo: isVideoMode,
        generationConfig: JSON.stringify(configWithBatch),
      }))

      allShapeIds.push(shapeId as string)
    }

    // 显示完成提示并选中所有生成的图片
    addToast(`${count}张${isVideoMode ? '视频' : '图片'}生成完成`, 'success')
    editor.select(...allShapeIds as TLShapeId[])
  }, [editor, addToast])

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
            if (import.meta.env.DEV) console.error('Failed to load image:', layer.url)
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
      editor.createShape(createAIImageShapeProps({
        id: newShapeId,
        x: minX,
        y: minY,
        w: mergedWidth,
        h: mergedHeight,
        url: mergedUrl,
        prompt: '合并图层',
        model: '',
        generatedAt: Date.now(),
        isVideo: false,
      }))

      // 选中新创建的图层
      editor.select(newShapeId)

      addToast(`已合并 ${sortedSelectedLayers.length} 个图层`, 'success')
    } catch (error) {
      if (import.meta.env.DEV) console.error('Merge layers error:', error)
      addToast('合并图层失败', 'error')
    }
  }, [editor, layers, selectedLayerIds, addToast])

  // 处理创建新项目
  const handleCreateProject = useCallback(() => {
    // Create new project in persistence system
    const newProject = createProject('Untitled')
    setProjectId(newProject.id)
    setLayers([])
    setSelectedLayerIds([])
    setProjectName('Untitled')
    setShowLandingPage(false)
    setShowLoading(true)

    // 1.5秒后隐藏 loading
    setTimeout(() => {
      setShowLoading(false)
    }, 1500)
  }, [])

  // 处理打开项目
  const handleOpenProject = useCallback((projectIdToOpen: string) => {
    // Load project from localStorage
    const snapshot = loadProjectSnapshot(projectIdToOpen)
    if (snapshot) {
      setProjectId(projectIdToOpen)
      setProjectName(snapshot.name)
      // Canvas content will be restored via useCanvasPersistence hook
    }
    setShowLandingPage(false)
  }, [])

  // 撤销处理
  const handleUndo = useCallback(() => {
    if (editor) {
      editor.undo()
    }
  }, [editor])

  // 重做处理
  const handleRedo = useCallback(() => {
    if (editor) {
      editor.redo()
    }
  }, [editor])

  // 复制处理
  const handleDuplicate = useCallback(() => {
    if (editor) {
      const selectedIds = editor.getSelectedShapeIds()
      if (selectedIds.length > 0) {
        editor.duplicateShapes(selectedIds)
      }
    }
  }, [editor])

  // 使用键盘快捷键 hook
  useKeyboardShortcuts({
    editor,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: () => {
      // Toast 提示可选
    },
    onDuplicate: handleDuplicate,
    enabled: !showLandingPage && !showLoading,
  })

  // 处理从首页开始生成
  const handleStartGeneration = useCallback((config: GenerationConfig) => {
    setPendingGenerationConfig(config)
    pendingGenerationConfigRef.current = config  // 同时保存到ref
    setIsTransitioning(true)

    // 网格脉冲过渡时长：700ms
    const gridTransitionDuration = 700

    setTimeout(() => {
      // 网格动画结束后，隐藏首页内容，显示 loading
      setShowLandingPage(false)
      setIsTransitioning(false)
      setShowLoading(true)
    }, gridTransitionDuration)
  }, [])

  // 右键菜单已移除

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
          {/* 网格线 - 使用单个 SVG 替代 20 个 DOM 节点 */}
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={`v-${i}`}
                x1={`${(i + 1) * 8.33}%`} y1="0"
                x2={`${(i + 1) * 8.33}%`} y2="100%"
                stroke={gridLineColor} strokeWidth="1"
              />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={`h-${i}`}
                x1="0" y1={`${(i + 1) * 12.5}%`}
                x2="100%" y2={`${(i + 1) * 12.5}%`}
                stroke={gridLineColor} strokeWidth="1"
              />
            ))}
          </svg>
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
        <Suspense fallback={<LoadingScreen />}>
          <LandingPage
            onCreateProject={handleCreateProject}
            onOpenProject={handleOpenProject}
            onStartGeneration={handleStartGeneration}
          />
        </Suspense>
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
        onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
      >
      {/* 隐藏的文件上传输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.md,.pdf,.xlsx,.xls"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* tldraw 画布 */}
      <div ref={tldrawContainerRef} style={{ width: '100%', height: '100%' }}>
        <Tldraw
          shapeUtils={customShapeUtils}
          components={components}
          onMount={handleMount}
          inferDarkMode={false}
          overrides={{
            // 禁用不需要的工具快捷键
            tools(editor, tools) {
              // 只保留 select 和 hand 工具，移除其他工具（包括 text，防止双击空白创建文本框）
              const allowedTools = ['select', 'hand']
              Object.keys(tools).forEach(key => {
                if (!allowedTools.includes(key)) {
                  delete tools[key]
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
            projectId={projectId}
            projectName={projectName}
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
          setProjectName('Untitled')
          setProjectId(`proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
          if (editor) {
            editor.selectNone()
            const shapes = editor.getCurrentPageShapes()
            editor.deleteShapes(shapes.map(s => s.id))
          }
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDuplicate={handleDuplicate}
        onOpenApiKeyDialog={() => setShowApiKeyDialog(true)}
        hasApiKey={hasApiKey}
      />

      {/* LayerPanel - 暂时隐藏，功能未完善 */}
      {/* <LayerPanel
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
      /> */}

      {/* BottomDialog - 暂时隐藏，MVP 阶段只用 Agent 输入栏 */}
      {/* <BottomDialog
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
      /> */}

      {/* AI 工作区视觉反馈 - 已改为画布原生 shape，不再需要 overlay */}

      {/* 扫描读取卡片高亮 */}
      {editor && scanningShapeId && <ScanningOverlay editor={editor} shapeId={scanningShapeId} />}

      {/* 截图模式遮罩 */}
      {screenshotMode && (
        <ScreenshotOverlay
          onCapture={handleScreenshotCapture}
          onCancel={() => setScreenshotMode(false)}
        />
      )}

      {/* Agent 输入栏 */}
      <AgentInputBar
        onSend={handleInputBarSend}
        tasks={agentTasks}
        selectionContext={{ productCardCount: selectedProductCards.length, totalCount: selectedLayerIds.length }}
        targetCard={selectedCardForComment}
        activePrompt={activePrompt}
        onPromptSelect={handlePromptSelect}
        onPromptDismiss={handlePromptDismiss}
        agentMode={agentMode}
        onModeChange={setAgentMode}
        hasApiKey={!!getApiKey()}
        screenshotPreview={pendingScreenshot}
        onClearScreenshot={() => {
          setPendingScreenshot(null)
          setScreenshotSource(null)
        }}
        onScreenshotMode={() => setScreenshotMode(true)}
      />

      {/* 选中图层的名称标签和详情图标 - 图层静止时显示，画布移动时隐藏 */}
      {!isLayerTransforming && !isCameraPanning && selectedLayerIds.length === 1 && selectedLayerScreenPos && selectedLayer && (
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

      {/* 选中图层的工具栏 - 图层静止时显示，生成中不显示，画布移动时隐藏 */}
      {!isLayerTransforming && !isCameraPanning && selectedLayerIds.length > 0 && selectedLayerScreenPos && (
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
      {showDetailPanel && selectedLayer && selectedLayerScreenPos && (
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

      {/* 视频控制面板 - 仅在图层静止时显示，画布移动时隐藏 */}
      {!isLayerTransforming && !isCameraPanning && selectedLayer?.type === 'video' && selectedLayerScreenPos && (() => {
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


      {/* 右键菜单已移除 */}

      {/* 资料库对话框 */}
      {showLibraryDialog && (
        <Suspense fallback={null}>
          <LibraryDialog
            onClose={() => setShowLibraryDialog(false)}
            onSelect={handleLibrarySelect}
          />
        </Suspense>
      )}

      {/* API Key Dialog */}
      <ApiKeyDialog
        open={showApiKeyDialog}
        onClose={() => setShowApiKeyDialog(false)}
        onSave={(has) => setHasApiKey(has)}
      />

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
        <Suspense fallback={<LoadingScreen />}>
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
        </Suspense>
      )}

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
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
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
