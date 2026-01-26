#!/usr/bin/env npx ts-node
/**
 * Canvas 功能对比脚本
 * 对比 Canvas.tsx (Konva) 和 TldrawPocApp.tsx (tldraw) 的功能完整性
 *
 * 运行方式: npx ts-node scripts/compare-canvas.ts
 * 或: npm run compare-canvas
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
}

// 功能定义
interface Feature {
  id: string
  name: string
  category: string
  priority: 'high' | 'medium' | 'low'
  patterns: {
    canvas: string[]
    tldraw: string[]
  }
}

const FEATURES: Feature[] = [
  // ========== 画布基础 ==========
  {
    id: 'grid-background',
    name: '网格背景',
    category: '画布基础',
    priority: 'high',
    patterns: {
      canvas: ['smallGridSize', 'largeGridSize', 'smallGridColor'],
      tldraw: ['CustomGrid', 'smallGridSize', 'isGridMode']
    }
  },
  {
    id: 'canvas-pan',
    name: '画布平移',
    category: '画布基础',
    priority: 'high',
    patterns: {
      canvas: ['stagePos', 'setStagePos'],
      tldraw: ['onCameraChange', 'camera']
    }
  },
  {
    id: 'canvas-zoom',
    name: '画布缩放',
    category: '画布基础',
    priority: 'high',
    patterns: {
      canvas: ['handleWheel', 'onZoomChange'],
      tldraw: ['onZoomChange', 'getZoomLevel']
    }
  },
  {
    id: 'theme-support',
    name: '主题支持',
    category: '画布基础',
    priority: 'medium',
    patterns: {
      canvas: ['useTheme', 'isLightTheme'],
      tldraw: ['useTheme', 'isLightTheme']
    }
  },

  // ========== 图层操作 ==========
  {
    id: 'image-display',
    name: '图片显示',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['KonvaImage', 'layer.url'],
      tldraw: ['AIImageShape', 'ai-image']
    }
  },
  {
    id: 'video-display',
    name: '视频显示',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['HTMLVideoElement', 'video.play'],
      tldraw: ['isVideo', 'HTMLVideoElement']
    }
  },
  {
    id: 'layer-select',
    name: '图层选择',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['onLayerSelect', 'selectedLayerId'],
      tldraw: ['onSelectionChange', 'selectedLayerIds']
    }
  },
  {
    id: 'multi-select',
    name: '多选 (Ctrl/Cmd)',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['isMultiSelect', 'ctrlKey'],
      tldraw: ['selectedLayerIds'] // tldraw 内置
    }
  },
  {
    id: 'box-select',
    name: '框选',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['selectionBox', 'isSelecting'],
      tldraw: ['Tldraw'] // tldraw 内置
    }
  },
  {
    id: 'layer-drag',
    name: '图层拖动',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['onDragStart', 'onDragEnd'],
      tldraw: ['Tldraw'] // tldraw 内置
    }
  },
  {
    id: 'layer-resize',
    name: '图层缩放',
    category: '图层操作',
    priority: 'high',
    patterns: {
      canvas: ['nwse-resize', 'handleFill'],
      tldraw: ['Tldraw'] // tldraw 内置
    }
  },
  {
    id: 'layer-lock',
    name: '图层锁定',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['layer.locked'],
      tldraw: ['isLocked']
    }
  },
  {
    id: 'layer-visibility',
    name: '图层可见性',
    category: '图层操作',
    priority: 'medium',
    patterns: {
      canvas: ['layer.visible'],
      tldraw: ['opacity']
    }
  },

  // ========== UI 组件 ==========
  {
    id: 'image-toolbar',
    name: 'ImageToolbar',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['ImageToolbar', 'onDownload', 'onRemix'],
      tldraw: ['ImageToolbar', 'handleDownload', 'handleRemix']
    }
  },
  {
    id: 'detail-panel',
    name: 'DetailPanel',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['DetailPanelSimple', 'showDetailPanel'],
      tldraw: ['DetailPanelSimple', 'showDetailPanel']
    }
  },
  {
    id: 'generating-overlay',
    name: 'GeneratingOverlay',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['GeneratingOverlay', 'generationTasks'],
      tldraw: ['GeneratingOverlay', 'generationTasks']
    }
  },
  {
    id: 'video-controls',
    name: 'VideoControls',
    category: 'UI 组件',
    priority: 'high',
    patterns: {
      canvas: ['VideoControls', 'togglePlay', 'toggleMute'],
      tldraw: ['VideoControls']
    }
  },
  {
    id: 'context-menu',
    name: '右键菜单',
    category: 'UI 组件',
    priority: 'medium',
    patterns: {
      canvas: ['ContextMenu', 'handleContextMenu'],
      tldraw: ['ContextMenu', 'contextMenu']
    }
  },
  {
    id: 'library-dialog',
    name: '资料库对话框',
    category: 'UI 组件',
    priority: 'medium',
    patterns: {
      canvas: ['LibraryDialog', 'showLibraryDialog'],
      tldraw: ['LibraryDialog']
    }
  },

  // ========== 工具栏功能 ==========
  {
    id: 'toolbar-download',
    name: 'Download',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onDownload'],
      tldraw: ['handleDownload']
    }
  },
  {
    id: 'toolbar-remix',
    name: 'Remix',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onRemix'],
      tldraw: ['handleRemix']
    }
  },
  {
    id: 'toolbar-edit',
    name: 'Edit (Tab)',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onEdit', 'quickEditPrompt'],
      tldraw: ['handleEdit', 'showQuickEdit']
    }
  },
  {
    id: 'toolbar-fill-dialog',
    name: 'Fill to Dialog',
    category: '工具栏功能',
    priority: 'high',
    patterns: {
      canvas: ['onFillToDialog'],
      tldraw: ['handleFillToDialog']
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
    name: 'Merge Layers',
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
      canvas: ['handleUploadLocal', 'FileReader'],
      tldraw: ['registerExternalContentHandler', 'FileReader']
    }
  },
  {
    id: 'drag-drop',
    name: '拖放图片',
    category: '文件操作',
    priority: 'high',
    patterns: {
      canvas: ['dataTransfer'],
      tldraw: ['registerExternalContentHandler']
    }
  },

  // ========== 坐标转换 ==========
  {
    id: 'canvas-to-screen',
    name: '画布→屏幕坐标',
    category: '坐标转换',
    priority: 'high',
    patterns: {
      canvas: ['onGetCanvasToScreen'],
      tldraw: ['pageToScreen']
    }
  },
  {
    id: 'screen-to-canvas',
    name: '屏幕→画布坐标',
    category: '坐标转换',
    priority: 'high',
    patterns: {
      canvas: ['onGetScreenToCanvas'],
      tldraw: ['screenToPage']
    }
  },
]

// 读取文件
function readFile(filePath: string): string {
  const fullPath = path.resolve(__dirname, '..', filePath)
  try {
    return fs.readFileSync(fullPath, 'utf-8')
  } catch {
    console.error(`${colors.red}无法读取文件: ${fullPath}${colors.reset}`)
    return ''
  }
}

// 检查模式
function checkPatterns(content: string, patterns: string[]): number {
  let found = 0
  for (const pattern of patterns) {
    if (content.includes(pattern)) found++
  }
  return found
}

// 获取状态图标
function getStatusIcon(ratio: number): string {
  if (ratio >= 0.8) return `${colors.green}✅${colors.reset}`
  if (ratio >= 0.3) return `${colors.yellow}⚠️${colors.reset}`
  return `${colors.red}❌${colors.reset}`
}

// 获取优先级颜色
function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return colors.red
    case 'medium': return colors.yellow
    case 'low': return colors.gray
    default: return colors.reset
  }
}

// 主函数
function main() {
  console.log(`\n${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.bold}${colors.cyan}║         Canvas 功能对比测试 (Konva vs tldraw)                ║${colors.reset}`)
  console.log(`${colors.bold}${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`)

  // 读取源文件
  const canvasContent = readFile('src/components/Canvas.tsx')
  const tldrawContent = readFile('src/TldrawPocApp.tsx')

  if (!canvasContent || !tldrawContent) {
    console.error('无法读取源文件')
    process.exit(1)
  }

  // 分析结果
  interface Result {
    feature: Feature
    canvasFound: number
    tldrawFound: number
    ratio: number
    status: 'implemented' | 'partial' | 'missing'
  }

  const results: Result[] = FEATURES.map(feature => {
    const canvasFound = checkPatterns(canvasContent, feature.patterns.canvas)
    const tldrawFound = checkPatterns(tldrawContent, feature.patterns.tldraw)
    const ratio = tldrawFound / feature.patterns.tldraw.length

    let status: 'implemented' | 'partial' | 'missing'
    if (ratio >= 0.8) status = 'implemented'
    else if (ratio >= 0.3) status = 'partial'
    else status = 'missing'

    return { feature, canvasFound, tldrawFound, ratio, status }
  })

  // 按分类输出
  const categories = [...new Set(FEATURES.map(f => f.category))]

  for (const category of categories) {
    console.log(`${colors.bold}▸ ${category}${colors.reset}`)
    console.log('─'.repeat(60))

    const categoryResults = results.filter(r => r.feature.category === category)

    for (const result of categoryResults) {
      const icon = getStatusIcon(result.ratio)
      const priorityColor = getPriorityColor(result.feature.priority)
      const pct = (result.ratio * 100).toFixed(0)

      console.log(
        `  ${icon} ${result.feature.name.padEnd(20)} ` +
        `${priorityColor}[${result.feature.priority}]${colors.reset} ` +
        `${colors.gray}${result.tldrawFound}/${result.feature.patterns.tldraw.length} (${pct}%)${colors.reset}`
      )
    }
    console.log('')
  }

  // 统计
  const implemented = results.filter(r => r.status === 'implemented')
  const partial = results.filter(r => r.status === 'partial')
  const missing = results.filter(r => r.status === 'missing')

  const highPriority = results.filter(r => r.feature.priority === 'high')
  const highImplemented = highPriority.filter(r => r.status === 'implemented')

  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bold}                           总结报告${colors.reset}`)
  console.log(`${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}\n`)

  console.log(`  总功能数:     ${results.length}`)
  console.log(`  ${colors.green}✅ 已实现:    ${implemented.length} (${(implemented.length / results.length * 100).toFixed(1)}%)${colors.reset}`)
  console.log(`  ${colors.yellow}⚠️  部分实现: ${partial.length} (${(partial.length / results.length * 100).toFixed(1)}%)${colors.reset}`)
  console.log(`  ${colors.red}❌ 未实现:    ${missing.length} (${(missing.length / results.length * 100).toFixed(1)}%)${colors.reset}`)
  console.log('')
  console.log(`  ${colors.bold}高优先级完成率: ${highImplemented.length}/${highPriority.length} (${(highImplemented.length / highPriority.length * 100).toFixed(1)}%)${colors.reset}`)

  // 列出问题
  if (missing.length > 0) {
    console.log(`\n${colors.red}${colors.bold}未实现功能:${colors.reset}`)
    missing.forEach(r => {
      const priorityColor = getPriorityColor(r.feature.priority)
      console.log(`  • ${priorityColor}[${r.feature.priority}]${colors.reset} ${r.feature.name} (${r.feature.category})`)
    })
  }

  if (partial.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}部分实现功能:${colors.reset}`)
    partial.forEach(r => {
      const priorityColor = getPriorityColor(r.feature.priority)
      const missingPatterns = r.feature.patterns.tldraw.filter(p => !tldrawContent.includes(p))
      console.log(`  • ${priorityColor}[${r.feature.priority}]${colors.reset} ${r.feature.name}`)
      console.log(`    ${colors.gray}缺失: ${missingPatterns.join(', ')}${colors.reset}`)
    })
  }

  console.log(`\n${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}\n`)

  // 返回退出码
  const failThreshold = 0.7
  const highPriorityRatio = highImplemented.length / highPriority.length

  if (highPriorityRatio < failThreshold) {
    console.log(`${colors.red}❌ 高优先级功能完成率低于 ${failThreshold * 100}%，测试失败${colors.reset}`)
    process.exit(1)
  } else {
    console.log(`${colors.green}✅ 测试通过${colors.reset}`)
    process.exit(0)
  }
}

main()
