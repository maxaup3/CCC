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

// 自定义形状
const customShapeUtils = [AIImageShapeUtil]

// 自定义网格组件 - 匹配原始 Canvas.tsx 设计
function CustomGrid({ x, y, z }: { x: number; y: number; z: number; size: number }) {
  const { themeStyle } = useTheme()
  const lightTheme = isLightTheme(themeStyle)

  const smallGridSize = 20
  const largeGridSize = 100

  // 小网格颜色（蓝紫色调 - 更淡）
  const smallGridColor = lightTheme ? 'rgba(102, 126, 234, 0.04)' : 'rgba(102, 126, 234, 0.06)'
  // 大网格颜色（只比小网格亮一点点）
  const largeGridColor = lightTheme ? 'rgba(102, 126, 234, 0.08)' : 'rgba(102, 126, 234, 0.10)'

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

  return {
    id: shape.id,
    name: shape.props.prompt || 'AI Image',
    url: shape.props.url,
    x: shape.x + shape.props.w / 2,
    y: shape.y + shape.props.h / 2,
    width: shape.props.w,
    height: shape.props.h,
    visible: shape.opacity === 1,
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
      const shapes = editor.getCurrentPageShapes()
      const aiShapes = shapes.filter((s: any) => s.type === 'ai-image')
      // 按 Z 轴倒序排列（最上层的在数组前面，用于图层面板显示）
      const sortedAiShapes = [...aiShapes].reverse()
      const layers = sortedAiShapes.map(shapeToLayer)
      console.log('📊 Layers updated:', layers.map(l => l.id.slice(-6)))
      onLayersChange(layers)
    }, { source: 'all', scope: 'document' })

    return unsubscribe
  }, [editor, onLayersChange])

  // 监听选择变化
  useEffect(() => {
    const unsubscribe = editor.store.listen(() => {
      const selectedIds = editor.getSelectedShapeIds()
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
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [pendingGenerationConfig, setPendingGenerationConfig] = useState<GenerationConfig | null>(null)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [layers, setLayers] = useState<ImageLayer[]>([])
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])
  const [zoom, setZoom] = useState(100)
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 })
  const [credits] = useState(200.20)
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

  // 更新选中图层的屏幕位置（检测变换状态）
  useEffect(() => {
    if (!editor || !selectedLayer) {
      setSelectedLayerScreenPos(null)
      lastBoundsRef.current = null
      setIsLayerTransforming(false)
      return
    }

    const shape = editor.getShape(selectedLayer.id as TLShapeId)
    if (!shape) {
      setSelectedLayerScreenPos(null)
      lastBoundsRef.current = null
      setIsLayerTransforming(false)
      return
    }

    const bounds = editor.getShapePageBounds(shape)
    if (!bounds) {
      setSelectedLayerScreenPos(null)
      lastBoundsRef.current = null
      setIsLayerTransforming(false)
      return
    }

    // 转换为屏幕坐标
    const screenBounds = editor.pageToScreen({ x: bounds.x, y: bounds.y })
    const screenBoundsEnd = editor.pageToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height })

    const newBounds = {
      x: screenBounds.x,
      y: screenBounds.y,
      width: screenBoundsEnd.x - screenBounds.x,
      height: screenBoundsEnd.y - screenBounds.y,
    }

    // 检测位置或尺寸是否变化
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

        // 500ms 后如果没有新的变化，则认为变换结束
        transformTimeoutRef.current = setTimeout(() => {
          setIsLayerTransforming(false)
          setSelectedLayerScreenPos(newBounds)
        }, 500)
      } else {
        // 位置和尺寸稳定，保持当前状态并更新位置
        setSelectedLayerScreenPos(newBounds)
      }
    } else {
      // 首次选中，立即显示工具栏
      setIsLayerTransforming(false)
      setSelectedLayerScreenPos(newBounds)
    }

    lastBoundsRef.current = newBounds
  }, [editor, selectedLayer, camera, zoom])

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
    const viewportBounds = editor.getViewportScreenBounds()
    const centerScreen = {
      x: viewportBounds.x + viewportBounds.width / 2,
      y: viewportBounds.y + viewportBounds.height / 2,
    }
    const centerPage = editor.screenToPage(centerScreen)
    setLibraryInsertPosition(centerPage)
    setShowLibraryDialog(true)
    setContextMenu(null)
  }, [editor])

  // 文件上传处理
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor || !e.target.files) return

    const files = Array.from(e.target.files)
    const viewportBounds = editor.getViewportScreenBounds()
    const centerScreen = {
      x: viewportBounds.x + viewportBounds.width / 2,
      y: viewportBounds.y + viewportBounds.height / 2,
    }
    const position = editor.screenToPage(centerScreen)

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
        const viewportBounds = ed.getViewportScreenBounds()
        const centerScreen = {
          x: viewportBounds.x + viewportBounds.width / 2,
          y: viewportBounds.y + viewportBounds.height / 2,
        }
        const centerPage = ed.screenToPage(centerScreen)

        // 根据 aspectRatio 计算实际尺寸
        // 固定宽边为 256，根据比例计算高度
        const getImageSize = (aspectRatio: string, baseWidth: number = 256) => {
          const ratioMap: { [key: string]: [number, number] } = {
            '1:1': [1, 1],
            '16:9': [16, 9],
            '9:16': [9, 16],
            '4:3': [4, 3],
            '3:4': [3, 4],
          }
          const [w, h] = ratioMap[aspectRatio] || [1, 1]
          return { width: baseWidth, height: Math.round(baseWidth * h / w) }
        }

        const imageSize = getImageSize(config.aspectRatio || '1:1')
        const count = config.count || 1
        const gap = 20 // 多张图片之间的间距

        // 计算布局：4张用2x2，其他用横排
        const is2x2 = count === 4
        const cols = is2x2 ? 2 : count
        const rows = is2x2 ? 2 : 1

        // 计算起始位置（让多张图片居中排列）
        const totalWidth = cols * imageSize.width + (cols - 1) * gap
        const totalHeight = rows * imageSize.height + (rows - 1) * gap
        const startX = centerPage.x - totalWidth / 2
        const startY = centerPage.y - totalHeight / 2

        const newTasks: GenerationTask[] = []
        const batchId = `batch-${Date.now()}`  // 批次ID，用于标识同一批生成的图片

        // 根据数量创建多个 shape
        for (let i = 0; i < count; i++) {
          const taskId = `task-${Date.now()}-${i}`
          const placeholderShapeId = createShapeId()

          // 计算每张图的位置
          const col = is2x2 ? (i % 2) : i
          const row = is2x2 ? Math.floor(i / 2) : 0
          const shapeX = startX + col * (imageSize.width + gap)
          const shapeY = startY + row * (imageSize.height + gap)

          // 扩展 config 添加批次信息
          const configWithBatch = {
            ...config,
            batchId,
            batchIndex: i,
            batchTotal: count,
          }

          // 创建占位符shape
          ed.createShape({
            id: placeholderShapeId,
            type: 'ai-image' as any,
            x: shapeX,
            y: shapeY,
            props: {
              w: imageSize.width,
              h: imageSize.height,
              url: '',
              prompt: config.prompt,
              isVideo: config.mode === 'video',
              generationConfig: JSON.stringify(configWithBatch),
            },
          })

          // 只为第一张图创建遮罩任务
          if (i === 0) {
            const newTask: GenerationTask = {
              id: taskId,
              shapeId: placeholderShapeId as string,
              status: 'generating',
              progress: 0,
              config,
              position: { x: shapeX + imageSize.width / 2, y: shapeY + imageSize.height / 2 },
              width: imageSize.width,
              height: imageSize.height,
              createdAt: new Date().toISOString(),
              startedAt: Date.now(),
              estimatedDuration: 30,
            }
            newTasks.push(newTask)
          }

          // 为每个图片创建独立的进度更新（但只有第一张显示遮罩）
          let progress = 0
          const interval = setInterval(() => {
            progress += 5
            if (i === 0) {
              setGenerationTasks(prev =>
                prev.map(t => t.id === taskId ? { ...t, progress } : t)
              )
            }

            if (progress >= 100) {
              clearInterval(interval)

              // 更新图片/视频 URL
              const isVideoMode = config.mode === 'video'
              const mediaUrl = isVideoMode
                ? 'https://www.w3schools.com/html/mov_bbb.mp4'  // 示例视频
                : `https://picsum.photos/seed/${Date.now() + i}/${imageSize.width * 2}/${imageSize.height * 2}`

              ed.updateShape({
                id: placeholderShapeId as any,
                type: 'ai-image' as any,
                props: {
                  url: mediaUrl,
                  model: config.model,
                  generatedAt: Date.now(),
                },
              })

              // 只有第一张完成时移除遮罩任务
              if (i === 0) {
                setGenerationTasks(prev => prev.filter(t => t.id !== taskId))
              }
            }
          }, 150)
        }

        setGenerationTasks(prev => [...prev, ...newTasks])
        setIsBottomDialogExpanded(true)
        console.log(`📦 Created ${count} generation tasks from pending config`)
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
        updateObj.opacity = updates.visible ? 1 : 0.3
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
    // 在 tldraw 中，shapes 数组的顺序就是 z-index 顺序（后面的在上面）
    // 我们的 layers 是 reversed 的，所以 layers[0] 是实际 shapes 数组的最后一个（最上层）

    // 获取当前所有 ai-image shapes（按 tldraw 的 z-index 顺序，即后面的在上面）
    const shapes = editor.getCurrentPageShapes()
    const aiShapes = shapes.filter((s: any) => s.type === 'ai-image')

    // aiShapes 是 tldraw 的原始顺序（index 越大，z-index 越高）
    // layers 是 reversed 的（index 越小，z-index 越高）
    // 所以 layers[i] 对应 aiShapes[aiShapes.length - 1 - i]

    const fromTldrawIndex = aiShapes.length - 1 - fromIndex
    const toTldrawIndex = aiShapes.length - 1 - toIndex

    console.log('🔄 Tldraw indices:', { fromTldrawIndex, toTldrawIndex })

    const shapeToMove = aiShapes[fromTldrawIndex]
    if (!shapeToMove) {
      console.log('❌ Shape to move not found')
      return
    }

    const shapeId = shapeToMove.id as TLShapeId

    // 在面板中向上拖动 (fromIndex > toIndex) = Z轴变高 = 在 tldraw 中往后移
    // 在面板中向下拖动 (fromIndex < toIndex) = Z轴变低 = 在 tldraw 中往前移

    if (fromIndex > toIndex) {
      // 向上移动（Z轴变高）
      // 使用 bringForward 逐步向上移动
      const steps = fromIndex - toIndex
      console.log('⬆️ Moving up', steps, 'steps')
      for (let i = 0; i < steps; i++) {
        editor.bringForward([shapeId])
      }
    } else {
      // 向下移动（Z轴变低）
      // 使用 sendBackward 逐步向下移动
      const steps = toIndex - fromIndex
      console.log('⬇️ Moving down', steps, 'steps')
      for (let i = 0; i < steps; i++) {
        editor.sendBackward([shapeId])
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

    const viewportBounds = editor.getViewportScreenBounds()
    const centerScreen = {
      x: viewportBounds.x + viewportBounds.width / 2,
      y: viewportBounds.y + viewportBounds.height / 2,
    }
    const centerPage = editor.screenToPage(centerScreen)

    // 根据 aspectRatio 计算实际尺寸
    // 固定宽边为 256，根据比例计算高度
    const getImageSize = (aspectRatio: string, baseWidth: number = 256) => {
      const ratioMap: { [key: string]: [number, number] } = {
        '1:1': [1, 1],
        '16:9': [16, 9],
        '9:16': [9, 16],
        '4:3': [4, 3],
        '3:4': [3, 4],
      }
      const [w, h] = ratioMap[aspectRatio] || [1, 1]
      return { width: baseWidth, height: Math.round(baseWidth * h / w) }
    }

    const imageSize = getImageSize(config.aspectRatio || '1:1')
    const count = config.count || 1
    const gap = 20 // 多张图片之间的间距

    // 计算布局：4张用2x2，其他用横排
    const is2x2 = count === 4
    const cols = is2x2 ? 2 : count
    const rows = is2x2 ? 2 : 1

    // 计算起始位置（让多张图片居中排列）
    const totalWidth = cols * imageSize.width + (cols - 1) * gap
    const totalHeight = rows * imageSize.height + (rows - 1) * gap
    const startX = centerPage.x - totalWidth / 2
    const startY = centerPage.y - totalHeight / 2

    const newTasks: GenerationTask[] = []
    const shapeIds: string[] = []
    const batchId = `batch-${Date.now()}`  // 批次ID，用于标识同一批生成的图片

    // 根据数量创建多个 shape
    for (let i = 0; i < count; i++) {
      const taskId = `task-${Date.now()}-${i}`
      const placeholderShapeId = createShapeId()

      // 计算每张图的位置
      const col = is2x2 ? (i % 2) : i
      const row = is2x2 ? Math.floor(i / 2) : 0
      const shapeX = startX + col * (imageSize.width + gap)
      const shapeY = startY + row * (imageSize.height + gap)

      shapeIds.push(placeholderShapeId as string)

      // 扩展 config 添加批次信息
      const configWithBatch = {
        ...config,
        batchId,
        batchIndex: i,
        batchTotal: count,
      }

      // 创建占位符shape（遮罩会跟随这个shape移动）
      ;(editor as any).createShape({
        id: placeholderShapeId,
        type: 'ai-image' as any,
        x: shapeX,
        y: shapeY,
        props: {
          w: imageSize.width,
          h: imageSize.height,
          url: '',  // 空url表示正在生成
          prompt: config.prompt,
          isVideo: config.mode === 'video',
          generationConfig: JSON.stringify(configWithBatch),
        },
      })

      // 只为第一张图创建遮罩任务
      if (i === 0) {
        const newTask: GenerationTask = {
          id: taskId,
          shapeId: placeholderShapeId as string,
          status: 'generating',
          progress: 0,
          config,
          position: { x: shapeX + imageSize.width / 2, y: shapeY + imageSize.height / 2 },
          width: imageSize.width,
          height: imageSize.height,
          createdAt: new Date().toISOString(),
          startedAt: Date.now(),
          estimatedDuration: 30,
        }
        newTasks.push(newTask)
      }

      // 为每个图片创建独立的进度更新（但只有第一张显示遮罩）
      let progress = 0
      const interval = setInterval(() => {
        progress += 5
        if (i === 0) {
          setGenerationTasks(prev =>
            prev.map(t => t.id === taskId ? { ...t, progress } : t)
          )
        }

        if (progress >= 100) {
          clearInterval(interval)

          // 更新图片/视频 URL
          const isVideoMode = config.mode === 'video'
          const mediaUrl = isVideoMode
            ? 'https://www.w3schools.com/html/mov_bbb.mp4'  // 示例视频
            : `https://picsum.photos/seed/${Date.now() + i}/${imageSize.width * 2}/${imageSize.height * 2}`

          editor.updateShape({
            id: placeholderShapeId as any,
            type: 'ai-image' as any,
            props: {
              url: mediaUrl,
              model: config.model,
              generatedAt: Date.now(),
            },
          })

          // 只有第一张完成时移除遮罩任务
          if (i === 0) {
            setGenerationTasks(prev => prev.filter(t => t.id !== taskId))
          }

          // 最后一张图片完成时显示提示
          if (i === count - 1) {
            addToast(`${count}张${isVideoMode ? '视频' : '图片'}生成完成`, 'success')
            // 选中所有生成的图片
            editor.select(...shapeIds as TLShapeId[])
          }
        }
      }, 150)
    }

    setGenerationTasks(prev => [...prev, ...newTasks])
    console.log(`📦 Created ${count} generation tasks`)
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

  // Remix 操作
  const handleRemix = useCallback(() => {
    if (!selectedLayer) return
    if (selectedLayer.url && bottomDialogRef.current) {
      bottomDialogRef.current.setReferenceImage(selectedLayer.url)
    }
    addToast('已添加为参考图', 'success')
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
    if (!selectedLayer?.url || !bottomDialogRef.current) return
    bottomDialogRef.current.setReferenceImage(selectedLayer.url)
    addToast('已添加为参考图', 'success')
  }, [selectedLayer, addToast])

  // 填充到关键帧
  const handleFillToKeyframes = useCallback(() => {
    if (!selectedLayer?.url || !bottomDialogRef.current) return
    // TODO: 实现关键帧填充
    addToast('已添加到关键帧', 'success')
  }, [selectedLayer, addToast])

  // 填充到图片生成
  const handleFillToImageGen = useCallback(() => {
    if (!selectedLayer?.url || !bottomDialogRef.current) return
    bottomDialogRef.current.setReferenceImage(selectedLayer.url)
    addToast('已添加为参考图', 'success')
  }, [selectedLayer, addToast])

  // 合并图层
  const handleMergeLayers = useCallback(() => {
    if (selectedLayerIds.length < 2) {
      addToast('请选择至少 2 个图层', 'info')
      return
    }
    // TODO: 实现图层合并
    addToast('图层合并功能开发中', 'info')
  }, [selectedLayerIds, addToast])

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

  // Loading 完成回调
  const handleLoadingComplete = useCallback(() => {
    console.log('✅ Loading complete, pendingConfig:', pendingGenerationConfigRef.current)
    setShowLoading(false)
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

  // 如果显示加载屏幕（带过渡网格）
  if (showLoading) {
    const canvasBackground = lightTheme
      ? 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)'
      : 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)'

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

        {/* 网格背景（过渡用） */}
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
              ? 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.06), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.1), transparent)'
            };
          }
        `}</style>

        <LoadingScreen onComplete={handleLoadingComplete} duration={1500} />
      </>
    )
  }

  // 如果显示首页或正在过渡，渲染首页
  if (showLandingPage || isTransitioning) {
    const canvasBackground = lightTheme
      ? 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)'
      : 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)'

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
        />
      </>
    )
  }

  // 主画布界面
  const canvasBackground = lightTheme
    ? 'linear-gradient(135deg, #f8f9ff 0%, #e8ecff 50%, #f0f4ff 100%)'
    : 'linear-gradient(135deg, #0a0b14 0%, #12141f 50%, #0f1118 100%)'

  return (
    <>
      {/* 全局背景层 - 带蓝色渐变 */}
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
            // 禁用不需要的操作快捷键
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
        credits={credits}
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

      {/* 选中图层的名称标签和详情图标 - 仅在图层静止且单选时显示 */}
      {!isLayerTransforming && selectedLayerIds.length === 1 && selectedLayerScreenPos && selectedLayer && (
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
              width={20}
              height={20}
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
              {selectedLayer.generationConfig?.prompt
                || selectedLayer.name
                || `${selectedLayer.type === 'video' ? 'Video' : 'Image'} ${selectedLayer.id.slice(-4)}`
              }
              {selectedLayer.generationConfig?.batchTotal && selectedLayer.generationConfig.batchTotal > 1 && (
                <span style={{ opacity: 0.7 }}>
                  {` (${(selectedLayer.generationConfig.batchIndex || 0) + 1}/${selectedLayer.generationConfig.batchTotal})`}
                </span>
              )}
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
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke={lightTheme ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" fill="none" />
              <path d="M10 9V14M10 6.5V7" stroke={lightTheme ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* 选中图层的工具栏 - 仅在图层静止时显示 */}
      {!isLayerTransforming && selectedLayerIds.length > 0 && selectedLayerScreenPos && (
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

      {/* 详情面板 - 仅在图层静止时显示 */}
      {!isLayerTransforming && showDetailPanel && selectedLayer && selectedLayerScreenPos && (
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
          background-color: ${lightTheme ? '#FFFFFF' : '#181818'} !important;
        }
        .tl-canvas {
          background-color: ${lightTheme ? '#FFFFFF' : '#181818'} !important;
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
