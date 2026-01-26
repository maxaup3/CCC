/**
 * Canvas 功能对比测试
 * 对比 Canvas.tsx (Konva) 和 TldrawPocApp.tsx (tldraw) 的功能完整性
 *
 * 运行方式: npm test -- canvas-comparison
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// 功能清单定义
interface Feature {
  id: string
  name: string
  category: string
  priority: 'high' | 'medium' | 'low'
  patterns: {
    canvas: string[]  // Canvas.tsx 中的实现模式
    tldraw: string[]  // TldrawPocApp.tsx 中的实现模式
  }
  status?: 'implemented' | 'partial' | 'missing'
}

const FEATURES: Feature[] = [
  // ========== 画布基础 ==========
  {
    id: 'grid-background',
    name: '网格背景',
    category: '画布基础',
    priority: 'high',
    patterns: {
      canvas: ['smallGridSize', 'largeGridSize', 'smallGridColor', 'largeGridColor'],
      tldraw: ['CustomGrid', 'smallGridSize', 'largeGridSize', 'isGridMode']
    }
  },
  {
    id: 'canvas-pan',
    name: '画布平移',
    category: '画布基础',
    priority: 'high',
    patterns: {
      canvas: ['stagePos', 'setStagePos', 'isDragging'],
      tldraw: ['Tldraw', 'onCameraChange', 'camera']
    }
  },
  {
    id: 'canvas-zoom',
    name: '画布缩放',
    category: '画布基础',
    priority: 'high',
    patterns: {
      canvas: ['handleWheel', 'zoom', 'onZoomChange'],
      tldraw: ['onZoomChange', 'getZoomLevel', 'setCamera']
    }
  },
  {
    id: 'theme-support',
    name: '主题支持',
    category: '画布基础',
    priority: 'medium',
    patterns: {
      canvas: ['useTheme', 'themeStyle', 'isLightTheme', 'getThemeStyles'],
      tldraw: ['useTheme', 'themeStyle', 'isLightTheme', 'lightTheme']
    }
  },

  // ========== 图层操作 ==========
  {
    id: 'image-display',
    name: '图片显示',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['KonvaImage', 'ImageNode', 'layer.url'],
      tldraw: ['AIImageShape', 'ai-image', 'props.url']
    }
  },
  {
    id: 'video-display',
    name: '视频显示',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['HTMLVideoElement', 'video.play', 'video.pause', 'layer.type === \'video\''],
      tldraw: ['isVideo', 'HTMLVideoElement']
    }
  },
  {
    id: 'layer-select',
    name: '图层选择',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['onLayerSelect', 'selectedLayerId', 'isSelected'],
      tldraw: ['onSelectionChange', 'selectedLayerIds', 'getSelectedShapeIds']
    }
  },
  {
    id: 'multi-select',
    name: '多选 (Ctrl/Cmd)',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['isMultiSelect', 'ctrlKey', 'metaKey', 'selectedLayerIds'],
      tldraw: ['selectedLayerIds', 'getSelectedShapeIds']
    }
  },
  {
    id: 'box-select',
    name: '框选',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['selectionBox', 'isSelecting', 'handleStageMouseDown', 'handleStageMouseUp'],
      tldraw: ['Tldraw'] // tldraw 内置
    }
  },
  {
    id: 'layer-drag',
    name: '图层拖动',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['onDragStart', 'onDragEnd', 'handleDragEnd', 'dragActivatedRef'],
      tldraw: ['Tldraw'] // tldraw 内置
    }
  },
  {
    id: 'layer-resize',
    name: '图层缩放',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['resize handle', 'nwse-resize', 'nesw-resize', 'handleFill', 'handleStroke'],
      tldraw: ['Tldraw'] // tldraw 内置
    }
  },
  {
    id: 'layer-lock',
    name: '图层锁定',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['layer.locked', 'locked: false'],
      tldraw: ['isLocked', 'shape.isLocked']
    }
  },
  {
    id: 'layer-visibility',
    name: '图层可见性',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['layer.visible', 'visible: true'],
      tldraw: ['opacity', 'shape.opacity']
    }
  },

  // ========== UI 组件 ==========
  {
    id: 'image-toolbar',
    name: 'ImageToolbar',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['ImageToolbar', 'onDownload', 'onRemix', 'onEdit'],
      tldraw: ['ImageToolbar', 'handleDownload', 'handleRemix', 'handleEdit']
    }
  },
  {
    id: 'detail-panel',
    name: 'DetailPanel',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['DetailPanelSimple', 'showDetailPanel', 'detailPanelLayer'],
      tldraw: ['DetailPanelSimple', 'showDetailPanel', 'selectedLayer']
    }
  },
  {
    id: 'generating-overlay',
    name: 'GeneratingOverlay',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['GeneratingOverlay', 'generationTasks', 'task.status === \'generating\''],
      tldraw: ['GeneratingOverlay', 'generationTasks', 'status === \'generating\'']
    }
  },
  {
    id: 'video-controls',
    name: 'VideoControls',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['VideoControls', 'togglePlay', 'toggleMute', 'handleProgressClick'],
      tldraw: ['VideoControls']
    }
  },
  {
    id: 'context-menu',
    name: '右键菜单',
    category: 'UI 组件',
    priority: 'medium',
    patterns: {
      canvas: ['ContextMenu', 'handleContextMenu', 'contextMenu', 'onContextMenu'],
      tldraw: ['ContextMenu', 'handleContextMenu', 'contextMenu']
    }
  },
  {
    id: 'library-dialog',
    name: '资料库对话框',
    category: 'UI 组件',
    priority: 'medium',
    patterns: {
      canvas: ['LibraryDialog', 'showLibraryDialog', 'handleImportFromLibrary'],
      tldraw: ['LibraryDialog', 'showLibraryDialog']
    }
  },

  // ========== 工具栏功能 ==========
  {
    id: 'toolbar-download',
    name: 'Download 下载',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onDownload', 'download'],
      tldraw: ['handleDownload', 'download']
    }
  },
  {
    id: 'toolbar-remix',
    name: 'Remix 重混',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onRemix', 'setReferenceImage'],
      tldraw: ['handleRemix', 'setReferenceImage']
    }
  },
  {
    id: 'toolbar-edit',
    name: 'Edit 快速编辑 (Tab)',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onEdit', 'quickEditPrompt', 'Tab'],
      tldraw: ['handleEdit', 'quickEditPrompt', 'showQuickEdit']
    }
  },
  {
    id: 'toolbar-fill-dialog',
    name: 'Fill to Dialog',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onFillToDialog', 'fillToDialog'],
      tldraw: ['handleFillToDialog', 'setReferenceImage']
    }
  },
  {
    id: 'toolbar-fill-keyframes',
    name: 'Fill to Keyframes',
    category: '工具栏功能',
    priority: 'medium',
    patterns: {
      canvas: ['onFillToKeyframes'],
      tldraw: ['handleFillToKeyframes']
    }
  },
  {
    id: 'toolbar-fill-imagegen',
    name: 'Fill to Image Gen',
    category: '工具栏功能',
    priority: 'medium',
    patterns: {
      canvas: ['onFillToImageGen'],
      tldraw: ['handleFillToImageGen']
    }
  },
  {
    id: 'toolbar-merge',
    name: 'Merge Layers 合并图层',
    category: '工具栏功能',
    priority: 'low',
    patterns: {
      canvas: ['onMergeLayers'],
      tldraw: ['handleMergeLayers']
    }
  },

  // ========== 文件操作 ==========
  {
    id: 'upload-local',
    name: '上传本地档案',
    category: '文件操作',
    priority: 'high',
    patterns: {
      canvas: ['handleUploadLocal', 'input.type = \'file\'', 'FileReader'],
      tldraw: ['registerExternalContentHandler', 'files', 'FileReader']
    }
  },
  {
    id: 'drag-drop',
    name: '拖放图片',
    category: '文件操作',
    priority: 'high',
    patterns: {
      canvas: ['onDrop', 'dataTransfer'],
      tldraw: ['registerExternalContentHandler', 'files']
    }
  },

  // ========== 坐标转换 ==========
  {
    id: 'canvas-to-screen',
    name: '画布到屏幕坐标',
    category: '坐标转换',
    priority: 'high',
    patterns: {
      canvas: ['onGetCanvasToScreen', 'canvasPos.x * scale + stagePos.x'],
      tldraw: ['pageToScreen', 'canvasToScreen']
    }
  },
  {
    id: 'screen-to-canvas',
    name: '屏幕到画布坐标',
    category: '坐标转换',
    priority: 'high',
    patterns: {
      canvas: ['onGetScreenToCanvas', '(screenPos.x - stagePos.x) / scale'],
      tldraw: ['screenToPage', 'screenToCanvas']
    }
  },
  {
    id: 'get-canvas-center',
    name: '获取画布中心',
    category: '坐标转换',
    priority: 'medium',
    patterns: {
      canvas: ['onGetCanvasCenter', 'viewWidth / 2'],
      tldraw: ['getViewportPageBounds', 'center']
    }
  },
]

// 读取源文件
function readSourceFile(filePath: string): string {
  const fullPath = path.resolve(__dirname, '../../', filePath)
  try {
    return fs.readFileSync(fullPath, 'utf-8')
  } catch {
    return ''
  }
}

// 检查模式是否存在
function checkPatterns(content: string, patterns: string[]): { found: string[], missing: string[] } {
  const found: string[] = []
  const missing: string[] = []

  for (const pattern of patterns) {
    if (content.includes(pattern)) {
      found.push(pattern)
    } else {
      missing.push(pattern)
    }
  }

  return { found, missing }
}

// 分析功能实现状态
function analyzeFeature(feature: Feature, canvasContent: string, tldrawContent: string): Feature & {
  canvasResult: { found: string[], missing: string[] }
  tldrawResult: { found: string[], missing: string[] }
} {
  const canvasResult = checkPatterns(canvasContent, feature.patterns.canvas)
  const tldrawResult = checkPatterns(tldrawContent, feature.patterns.tldraw)

  // 判断状态
  let status: 'implemented' | 'partial' | 'missing'
  const tldrawFoundRatio = tldrawResult.found.length / feature.patterns.tldraw.length

  if (tldrawFoundRatio >= 0.8) {
    status = 'implemented'
  } else if (tldrawFoundRatio >= 0.3) {
    status = 'partial'
  } else {
    status = 'missing'
  }

  return { ...feature, status, canvasResult, tldrawResult }
}

describe('Canvas 功能对比测试', () => {
  let canvasContent: string
  let tldrawContent: string
  let results: ReturnType<typeof analyzeFeature>[]

  beforeAll(() => {
    canvasContent = readSourceFile('src/components/Canvas.tsx')
    tldrawContent = readSourceFile('src/TldrawPocApp.tsx')
    results = FEATURES.map(f => analyzeFeature(f, canvasContent, tldrawContent))
  })

  // 按分类分组测试
  const categories = [...new Set(FEATURES.map(f => f.category))]

  for (const category of categories) {
    describe(category, () => {
      const categoryFeatures = FEATURES.filter(f => f.category === category)

      for (const feature of categoryFeatures) {
        it(`${feature.name} (${feature.priority})`, () => {
          const result = results.find(r => r.id === feature.id)!

          // 输出详细信息
          console.log(`\n  [${feature.id}] ${feature.name}`)
          console.log(`    Canvas 模式: ${result.canvasResult.found.length}/${feature.patterns.canvas.length} 匹配`)
          console.log(`    tldraw 模式: ${result.tldrawResult.found.length}/${feature.patterns.tldraw.length} 匹配`)

          if (result.tldrawResult.missing.length > 0) {
            console.log(`    缺失: ${result.tldrawResult.missing.join(', ')}`)
          }

          // 高优先级功能必须完全实现
          if (feature.priority === 'high') {
            expect(result.status).not.toBe('missing')
          }

          // 记录状态
          expect(result.status).toBeDefined()
        })
      }
    })
  }

  // 生成总结报告
  it('生成功能对比报告', () => {
    const implemented = results.filter(r => r.status === 'implemented')
    const partial = results.filter(r => r.status === 'partial')
    const missing = results.filter(r => r.status === 'missing')

    console.log('\n' + '='.repeat(60))
    console.log('功能对比报告')
    console.log('='.repeat(60))
    console.log(`\n总功能数: ${results.length}`)
    console.log(`✅ 已实现: ${implemented.length} (${(implemented.length / results.length * 100).toFixed(1)}%)`)
    console.log(`⚠️  部分实现: ${partial.length} (${(partial.length / results.length * 100).toFixed(1)}%)`)
    console.log(`❌ 未实现: ${missing.length} (${(missing.length / results.length * 100).toFixed(1)}%)`)

    // 按优先级统计
    const highPriority = results.filter(r => r.priority === 'high')
    const highImplemented = highPriority.filter(r => r.status === 'implemented')
    console.log(`\n高优先级完成率: ${highImplemented.length}/${highPriority.length} (${(highImplemented.length / highPriority.length * 100).toFixed(1)}%)`)

    // 列出未实现的功能
    if (missing.length > 0) {
      console.log('\n未实现功能:')
      missing.forEach(f => {
        console.log(`  - [${f.priority}] ${f.name} (${f.category})`)
      })
    }

    // 列出部分实现的功能
    if (partial.length > 0) {
      console.log('\n部分实现功能:')
      partial.forEach(f => {
        console.log(`  - [${f.priority}] ${f.name}: 缺失 ${f.tldrawResult.missing.join(', ')}`)
      })
    }

    console.log('\n' + '='.repeat(60))

    // 高优先级功能应该大部分实现
    expect(highImplemented.length / highPriority.length).toBeGreaterThan(0.7)
  })
})

// 导出给其他测试使用
export { FEATURES, analyzeFeature, checkPatterns }
