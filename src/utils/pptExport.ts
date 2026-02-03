/**
 * PPT 导出工具
 * 使用 pptxgenjs 将页面卡片数据转为 .pptx 文件
 *
 * 两种导出模式：
 * 1. exportToPPTX — 旧模式，从 page-card shape 数据生成
 * 2. exportFramesToPPTX — 新模式，从 tldraw frame 子元素生成可编辑 PPTX
 */
import PptxGenJS from 'pptxgenjs'
import type { Editor, TLShapeId } from 'tldraw'
import type { PageContent } from '../components/tldraw-poc/PageCardShape'

interface SlideData {
  pageNumber: number
  pageTitle: string
  content: PageContent
  pageType: 'cover' | 'content' | 'summary'
}

const PURPLE = '7C3AED'
const DARK_TEXT = '1F2937'
const GRAY_TEXT = '6B7280'
const LIGHT_GRAY = '9CA3AF'

export async function exportToPPTX(
  slides: SlideData[],
  title: string = '画布产品调研报告'
): Promise<Blob> {
  const pptx = new PptxGenJS()

  pptx.defineLayout({ name: 'CUSTOM_16x9', width: 10, height: 5.625 })
  pptx.layout = 'CUSTOM_16x9'
  pptx.title = title
  pptx.author = 'Canvas Agent'

  for (const slideData of slides) {
    const slide = pptx.addSlide()

    if (slideData.pageType === 'cover') {
      // 封面页
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { type: 'solid', color: 'F5F3FF' },
      })

      slide.addText(slideData.pageTitle, {
        x: 1, y: 1.5, w: 8, h: 1.2,
        fontSize: 32,
        fontFace: 'Arial',
        color: DARK_TEXT,
        bold: true,
        align: 'center',
      })

      if (slideData.content.subtitle) {
        slide.addText(slideData.content.subtitle, {
          x: 2, y: 2.8, w: 6, h: 0.6,
          fontSize: 16,
          fontFace: 'Arial',
          color: GRAY_TEXT,
          align: 'center',
        })
      }

      slide.addText(
        new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        {
          x: 3, y: 3.8, w: 4, h: 0.4,
          fontSize: 12,
          fontFace: 'Arial',
          color: LIGHT_GRAY,
          align: 'center',
        }
      )
    } else if (slideData.pageType === 'summary') {
      // 总结页
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { type: 'solid', color: 'F0FDF4' },
      })

      slide.addText(slideData.pageTitle, {
        x: 0.8, y: 0.4, w: 8.4, h: 0.7,
        fontSize: 22,
        fontFace: 'Arial',
        color: DARK_TEXT,
        bold: true,
      })

      // 分隔线
      slide.addShape(pptx.ShapeType.line, {
        x: 0.8, y: 1.1, w: 8.4, h: 0,
        line: { color: '059669', width: 2 },
      })

      // 结论列表
      slideData.content.bullets.forEach((bullet, idx) => {
        slide.addText([
          { text: '✓  ', options: { fontSize: 14, color: '059669', bold: true } },
          { text: bullet, options: { fontSize: 14, color: DARK_TEXT } },
        ], {
          x: 1, y: 1.4 + idx * 0.55, w: 8, h: 0.5,
          fontFace: 'Arial',
        })
      })

      if (slideData.content.note) {
        slide.addText(slideData.content.note, {
          x: 1, y: 4.8, w: 8, h: 0.4,
          fontSize: 10,
          fontFace: 'Arial',
          color: LIGHT_GRAY,
          align: 'center',
        })
      }
    } else {
      // 内容页
      slide.addText(slideData.pageTitle, {
        x: 0.8, y: 0.4, w: 8.4, h: 0.7,
        fontSize: 22,
        fontFace: 'Arial',
        color: DARK_TEXT,
        bold: true,
      })

      // 分隔线
      slide.addShape(pptx.ShapeType.line, {
        x: 0.8, y: 1.1, w: 8.4, h: 0,
        line: { color: PURPLE, width: 2 },
      })

      // 要点列表
      slideData.content.bullets.forEach((bullet, idx) => {
        slide.addText([
          { text: '•  ', options: { fontSize: 14, color: PURPLE, bold: true } },
          { text: bullet, options: { fontSize: 14, color: DARK_TEXT } },
        ], {
          x: 1, y: 1.4 + idx * 0.55, w: 8, h: 0.5,
          fontFace: 'Arial',
        })
      })

      // 来源标记
      if (slideData.content.sourceCardName) {
        slide.addText(`来源：${slideData.content.sourceCardName}`, {
          x: 6, y: 5, w: 3.5, h: 0.3,
          fontSize: 9,
          fontFace: 'Arial',
          color: LIGHT_GRAY,
          align: 'right',
        })
      }
    }

    // 页码
    slide.addText(`${slideData.pageNumber}`, {
      x: 0.3, y: 5, w: 0.5, h: 0.3,
      fontSize: 10,
      fontFace: 'Arial',
      color: LIGHT_GRAY,
    })
  }

  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  return blob
}

// ============ Frame → 可编辑 PPTX 导出 ============

// tldraw 颜色 → hex 映射
const TLDRAW_COLOR_TO_HEX: Record<string, string> = {
  'black': '1D1D1D',
  'grey': '9FA8B2',
  'light-violet': 'E085F4',
  'violet': 'AE3EC9',
  'blue': '4465E9',
  'light-blue': '4BA1F1',
  'yellow': 'F1AC4B',
  'orange': 'E16919',
  'green': '099268',
  'light-green': '4CB05E',
  'light-red': 'F87777',
  'red': 'E03131',
  'white': 'FFFFFF',
}

// tldraw size → pt
const TLDRAW_SIZE_TO_PT: Record<string, number> = {
  's': 14,
  'm': 18,
  'l': 28,
  'xl': 36,
}

// tldraw font → PPT font
const TLDRAW_FONT_TO_PPTX: Record<string, string> = {
  'draw': 'Comic Sans MS',
  'sans': 'Arial',
  'serif': 'Georgia',
  'mono': 'Courier New',
}

// tldraw textAlign → pptxgenjs align
function mapAlign(align: string | undefined): 'left' | 'center' | 'right' {
  if (align === 'middle' || align === 'center') return 'center'
  if (align === 'end' || align === 'right') return 'right'
  return 'left'
}

// tldraw geo → pptxgenjs shape name
function mapGeoToShape(geo: string): string {
  switch (geo) {
    case 'ellipse': return 'ellipse'
    case 'diamond': return 'diamond'
    case 'triangle': return 'triangle'
    case 'star': return 'star5'
    default: return 'rect'
  }
}

// Fetch image URL and convert to base64 data URI
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * 将 tldraw frame（幻灯片）导出为可编辑 PPTX
 * 子元素（text, geo, image, ai-image）被转换为对应的 PPTX 对象
 */
export async function exportFramesToPPTX(
  editor: Editor,
  frameIds: TLShapeId[],
  title?: string,
): Promise<Blob> {
  const pptx = new PptxGenJS()

  // PPTX slide size: 10 × 5.625 inches (16:9)
  const PPTX_W = 10
  const PPTX_H = 5.625
  pptx.defineLayout({ name: 'CUSTOM_16x9', width: PPTX_W, height: PPTX_H })
  pptx.layout = 'CUSTOM_16x9'
  pptx.title = title || '画布演示文稿'
  pptx.author = 'Canvas Agent'

  for (let fi = 0; fi < frameIds.length; fi++) {
    const frameId = frameIds[fi]
    const frameShape = editor.getShape(frameId)
    if (!frameShape) continue

    const frameProps = (frameShape as any).props || {}
    const frameW = frameProps.w || 960
    const frameH = frameProps.h || 540

    // Scale factors: frame coords → inches
    const scaleX = PPTX_W / frameW
    const scaleY = PPTX_H / frameH

    const slide = pptx.addSlide()

    // Get sorted children of this frame
    const childIds = editor.getSortedChildIdsForParent(frameId)

    for (const childId of childIds) {
      const child = editor.getShape(childId)
      if (!child) continue

      const childType = (child as any).type
      const props = (child as any).props || {}

      // Child x,y are relative to the frame (tldraw reparenting)
      const cx = child.x * scaleX
      const cy = child.y * scaleY

      if (childType === 'text') {
        const fontSize = TLDRAW_SIZE_TO_PT[props.size] || 18
        const fontFace = TLDRAW_FONT_TO_PPTX[props.font] || 'Arial'
        const color = TLDRAW_COLOR_TO_HEX[props.color] || '1D1D1D'
        const align = mapAlign(props.textAlign)
        const w = (props.w || 400) * scaleX
        // Estimate height from text content: use generous auto-height
        const lineCount = (props.text || '').split('\n').length
        const estimatedH = Math.max(0.4, lineCount * fontSize * 1.4 / 72)

        slide.addText(props.text || '', {
          x: cx,
          y: cy,
          w: Math.min(w, PPTX_W - cx),
          h: estimatedH,
          fontSize,
          fontFace,
          color,
          align,
          valign: 'top',
          bold: props.bold || false,
          wrap: true,
        })
      } else if (childType === 'geo') {
        const geoType = props.geo || 'rectangle'
        const w = (props.w || 200) * scaleX
        const h = (props.h || 100) * scaleY
        const fillColor = props.fill === 'solid' ? (TLDRAW_COLOR_TO_HEX[props.color] || 'FFFFFF') : undefined
        const lineColor = TLDRAW_COLOR_TO_HEX[props.color] || '1D1D1D'

        const shapeOpts: any = {
          x: cx,
          y: cy,
          w: Math.min(w, PPTX_W - cx),
          h: Math.min(h, PPTX_H - cy),
        }

        if (fillColor) {
          shapeOpts.fill = { type: 'solid', color: fillColor }
        }

        // For shapes with no fill, add a border
        if (props.fill !== 'solid') {
          shapeOpts.line = { color: lineColor, width: 1 }
        }

        const pptxShapeName = mapGeoToShape(geoType)

        // Map string shape names to PptxGenJS shape types
        const shapeTypeMap: Record<string, any> = {
          'rect': pptx.ShapeType.rect,
          'ellipse': pptx.ShapeType.ellipse,
          'diamond': pptx.ShapeType.diamond,
          'triangle': pptx.ShapeType.triangle,
          'star5': pptx.ShapeType.star5,
        }

        slide.addShape(shapeTypeMap[pptxShapeName] || pptx.ShapeType.rect, shapeOpts)

        // If the geo has text (label), overlay a text box
        if (props.text) {
          const labelColor = TLDRAW_COLOR_TO_HEX[props.labelColor] || TLDRAW_COLOR_TO_HEX[props.color] || '1D1D1D'
          const labelSize = TLDRAW_SIZE_TO_PT[props.size] || 14
          slide.addText(props.text, {
            x: cx,
            y: cy,
            w: shapeOpts.w,
            h: shapeOpts.h,
            fontSize: labelSize,
            fontFace: TLDRAW_FONT_TO_PPTX[props.font] || 'Arial',
            color: labelColor,
            align: mapAlign(props.align),
            valign: 'middle',
            wrap: true,
          })
        }
      } else if (childType === 'image') {
        // Native tldraw image shape
        const w = (props.w || 300) * scaleX
        const h = (props.h || 200) * scaleY
        const assetId = props.assetId
        if (assetId) {
          const asset = editor.getAsset(assetId)
          const src = (asset as any)?.props?.src
          if (src) {
            try {
              if (src.startsWith('data:')) {
                slide.addImage({ data: src, x: cx, y: cy, w, h })
              } else {
                const base64 = await fetchImageAsBase64(src)
                if (base64) {
                  slide.addImage({ data: base64, x: cx, y: cy, w, h })
                }
              }
            } catch {
              // Skip image on error
            }
          }
        }
      } else if (childType === 'ai-image') {
        // Custom AI image shape
        const w = (props.w || 300) * scaleX
        const h = (props.h || 200) * scaleY
        const url = props.url
        if (url) {
          try {
            if (url.startsWith('data:')) {
              slide.addImage({ data: url, x: cx, y: cy, w, h })
            } else {
              const base64 = await fetchImageAsBase64(url)
              if (base64) {
                slide.addImage({ data: base64, x: cx, y: cy, w, h })
              }
            }
          } catch {
            // Skip image on error
          }
        }
      }
      // Other shape types (arrow, etc.) are skipped
    }

    // Page number
    slide.addText(`${fi + 1}`, {
      x: 0.3, y: 5.1, w: 0.5, h: 0.3,
      fontSize: 10,
      fontFace: 'Arial',
      color: '9CA3AF',
    })
  }

  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  return blob
}
