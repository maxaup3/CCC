/**
 * 文件卡片形状 - 导出的文件（PPT / Excel / PDF）
 * 紧凑卡片（220×100），虚线边框
 * 点击下载按钮触发文件下载
 */
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'

export type FileCardShape = TLBaseShape<
  'file-card',
  {
    w: number
    h: number
    fileName: string
    fileSize: string
    fileType: 'pptx' | 'xlsx' | 'pdf'
    downloadUrl: string
    createdAt: number
    sourceData: string   // JSON string: 导出时的原始数据（用于 agent 读取）
  }
>

const CARD_W = 220
const CARD_H = 100

export class FileCardShapeUtil extends ShapeUtil<any> {
  static override type = 'file-card' as const

  getDefaultProps() {
    return {
      w: CARD_W,
      h: CARD_H,
      fileName: 'presentation.pptx',
      fileSize: '',
      fileType: 'pptx' as const,
      downloadUrl: '',
      createdAt: Date.now(),
      sourceData: '',
    }
  }

  getGeometry(shape: FileCardShape): Geometry2d {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: FileCardShape) {
    const { fileName, fileSize, downloadUrl, fileType } = shape.props

    const THEME_MAP = {
      pptx: { color: '#7C3AED', dark: '#5B21B6', shadow: 'rgba(124, 58, 237, 0.3)', label: 'PPT' },
      xlsx: { color: '#059669', dark: '#047857', shadow: 'rgba(5, 150, 105, 0.3)', label: 'XLS' },
      pdf:  { color: '#DC2626', dark: '#B91C1C', shadow: 'rgba(220, 38, 38, 0.3)', label: 'PDF' },
    } as const
    const theme = THEME_MAP[fileType] || THEME_MAP.pptx
    const themeColor = theme.color
    const themeColorDark = theme.dark
    const themeShadow = theme.shadow
    const typeLabel = theme.label

    return (
      <HTMLContainer>
        <div style={{
          width: shape.props.w,
          height: shape.props.h,
          background: '#FFFFFF',
          borderRadius: 10,
          border: '2px dashed #D1D5DB',
          display: 'flex',
          gap: 12,
          padding: '14px 14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          pointerEvents: 'all',
          alignItems: 'center',
        }}>
          {/* 左侧文件图标 */}
          <div style={{
            width: 48,
            height: 56,
            borderRadius: 6,
            background: `linear-gradient(135deg, ${themeColor}, ${themeColorDark})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 2px 6px ${themeShadow}`,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="2" width="14" height="16" rx="2" stroke="white" strokeWidth="1.5" fill="none" />
              <path d="M7 7H13M7 10H13M7 13H10" stroke="white" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span style={{
              fontSize: 9,
              color: '#fff',
              fontWeight: 700,
              marginTop: 2,
              letterSpacing: 0.5,
            }}>
              {typeLabel}
            </span>
          </div>

          {/* 右侧信息 */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4,
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1F2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {fileName}
            </div>
            {fileSize && (
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                {fileSize}
              </div>
            )}

            {/* 下载按钮 */}
            <button
              style={{
                marginTop: 2,
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: themeColor,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                alignSelf: 'flex-start',
                transition: 'opacity 0.15s',
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
                if (downloadUrl) {
                  const a = document.createElement('a')
                  a.href = downloadUrl
                  a.download = fileName
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                }
              }}
            >
              下载
            </button>
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: FileCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={10} />
  }

  override canResize = () => true
  override isAspectRatioLocked = () => false

  override onResize = (shape: FileCardShape, info: any) => {
    return {
      props: {
        w: Math.max(160, shape.props.w * info.scaleX),
        h: Math.max(80, shape.props.h * info.scaleY),
      },
    }
  }
}
