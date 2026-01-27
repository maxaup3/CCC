/**
 * 画布工具函数
 * 提取重复的逻辑，减少代码重复
 */
import { Editor } from 'tldraw'

/**
 * 获取视口中心的页面坐标
 */
export function getViewportCenter(editor: Editor): { x: number; y: number } {
  const viewportBounds = editor.getViewportScreenBounds()
  const centerScreen = {
    x: viewportBounds.x + viewportBounds.width / 2,
    y: viewportBounds.y + viewportBounds.height / 2,
  }
  return editor.screenToPage(centerScreen)
}

/**
 * 根据宽高比计算图片尺寸
 */
export function getImageSizeFromAspectRatio(
  aspectRatio: string,
  baseWidth: number = 256
): { width: number; height: number } {
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

/**
 * 计算多张图片的网格布局起始位置
 * @param centerPage 中心点坐标
 * @param imageSize 单张图片尺寸
 * @param count 图片数量
 * @param gap 图片间距
 * @returns 布局信息
 */
export function calculateGridLayout(
  centerPage: { x: number; y: number },
  imageSize: { width: number; height: number },
  count: number,
  gap: number = 20
): {
  startX: number
  startY: number
  cols: number
  rows: number
  is2x2: boolean
} {
  const is2x2 = count === 4
  const cols = is2x2 ? 2 : count
  const rows = is2x2 ? 2 : 1

  const totalWidth = cols * imageSize.width + (cols - 1) * gap
  const totalHeight = rows * imageSize.height + (rows - 1) * gap
  const startX = centerPage.x - totalWidth / 2
  const startY = centerPage.y - totalHeight / 2

  return { startX, startY, cols, rows, is2x2 }
}

/**
 * 计算网格中某个索引的位置
 */
export function getGridPosition(
  startX: number,
  startY: number,
  index: number,
  imageSize: { width: number; height: number },
  is2x2: boolean,
  gap: number = 20
): { x: number; y: number } {
  const col = is2x2 ? (index % 2) : index
  const row = is2x2 ? Math.floor(index / 2) : 0
  return {
    x: startX + col * (imageSize.width + gap),
    y: startY + row * (imageSize.height + gap),
  }
}

