/**
 * 大纲卡片形状 - PPT 大纲
 * 紫色左侧条纹，编号列表，底部操作按钮
 * 按钮点击通过 agentEvents 通信到 hook
 */
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'
import { agentEvents, AGENT_EVENTS } from '../../utils/agentEvents'

export interface OutlineItem {
  index: number
  title: string
  cardRef?: string    // 关联的 shape ID
  cardName?: string   // 关联卡片名称
  type: 'cover' | 'content' | 'summary'
}

export type OutlineCardShape = TLBaseShape<
  'outline-card',
  {
    w: number
    h: number
    title: string
    items: string         // JSON: OutlineItem[]
    status: 'draft' | 'confirmed' | 'generating' | 'done'
    sourceTaskId: string
  }
>

const CARD_W = 320
const ITEM_H = 36
const PURPLE = '#7C3AED'

export class OutlineCardShapeUtil extends ShapeUtil<any> {
  static override type = 'outline-card' as const

  getDefaultProps() {
    return {
      w: CARD_W,
      h: 200,
      title: 'PPT 大纲',
      items: '[]',
      status: 'draft' as const,
      sourceTaskId: '',
    }
  }

  getGeometry(shape: OutlineCardShape): Geometry2d {
    let items: OutlineItem[] = []
    try { items = JSON.parse(shape.props.items) } catch { /* */ }
    // Header(48) + items + buttons(48) + padding
    const minH = 48 + items.length * ITEM_H + (shape.props.status === 'draft' ? 52 : 20) + 16
    const h = Math.max(shape.props.h, minH)
    return new Rectangle2d({ width: shape.props.w, height: h, isFilled: true })
  }

  component(shape: OutlineCardShape) {
    const { title, items: itemsStr, status } = shape.props
    let items: OutlineItem[] = []
    try { items = JSON.parse(itemsStr) } catch { /* */ }

    const minH = 48 + items.length * ITEM_H + (status === 'draft' ? 52 : 20) + 16
    const cardW = shape.props.w
    const cardH = Math.max(shape.props.h, minH)

    // 状态标签
    const statusLabels: Record<string, { text: string; color: string; bg: string }> = {
      draft: { text: '草稿', color: '#7C3AED', bg: '#EDE9FE' },
      confirmed: { text: '已确认', color: '#059669', bg: '#D1FAE5' },
      generating: { text: '生成中...', color: '#D97706', bg: '#FEF3C7' },
      done: { text: '已完成', color: '#059669', bg: '#D1FAE5' },
    }
    const statusInfo = statusLabels[status] || statusLabels.draft

    return (
      <HTMLContainer>
        <div style={{
          width: cardW,
          minHeight: cardH,
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          pointerEvents: 'all',
          display: 'flex',
        }}>
          {/* 左侧紫色条纹 */}
          <div style={{
            width: 4,
            background: PURPLE,
            flexShrink: 0,
          }} />

          <div style={{ flex: 1, padding: '12px 14px' }}>
            {/* 标题行 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="3" width="14" height="12" rx="2" stroke={PURPLE} strokeWidth="1.5" fill="none" />
                  <path d="M5 7H13M5 10H10" stroke={PURPLE} strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>
                  {title}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: statusInfo.bg,
                color: statusInfo.color,
                fontWeight: 500,
              }}>
                {statusInfo.text}
              </span>
            </div>

            {/* 大纲列表 */}
            <div style={{ marginBottom: status === 'draft' ? 10 : 0 }}>
              {items.map((item, idx) => {
                const typeIcons: Record<string, string> = {
                  cover: '🎬',
                  content: '📄',
                  summary: '📊',
                }
                return (
                  <div
                    key={idx}
                    style={{
                      height: ITEM_H,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderBottom: idx < items.length - 1 ? '1px solid #F3F4F6' : 'none',
                      padding: '0 4px',
                    }}
                  >
                    {/* 编号 */}
                    <span style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: item.type === 'cover' ? PURPLE : item.type === 'summary' ? '#059669' : '#E5E7EB',
                      color: item.type === 'cover' || item.type === 'summary' ? '#fff' : '#6B7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {item.index}
                    </span>

                    {/* 标题 */}
                    <span style={{
                      fontSize: 13,
                      color: '#374151',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {typeIcons[item.type] || ''} {item.title}
                    </span>

                    {/* 卡片引用标记 */}
                    {item.cardName && (
                      <span style={{
                        fontSize: 11,
                        color: PURPLE,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: '#EDE9FE',
                        whiteSpace: 'nowrap',
                      }}>
                        → {item.cardName}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 底部按钮 - 仅草稿状态 */}
            {status === 'draft' && (
              <div style={{
                display: 'flex',
                gap: 8,
                paddingTop: 8,
                borderTop: '1px solid #F3F4F6',
              }}>
                <button
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    background: '#F9FAFB',
                    color: '#6B7280',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    agentEvents.emit(AGENT_EVENTS.ADJUST_OUTLINE, { shapeId: shape.id })
                  }}
                >
                  调整大纲
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 8,
                    border: 'none',
                    background: PURPLE,
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    agentEvents.emit(AGENT_EVENTS.GENERATE_PAGES, { shapeId: shape.id })
                  }}
                >
                  开始生成
                </button>
              </div>
            )}

            {/* 生成中状态 */}
            {status === 'generating' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 0',
                color: '#D97706',
                fontSize: 13,
              }}>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: '2px solid #D97706',
                  borderTopColor: 'transparent',
                  animation: 'outline-spin 0.8s linear infinite',
                }} />
                正在生成页面...
                <style>{`
                  @keyframes outline-spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: OutlineCardShape) {
    let items: OutlineItem[] = []
    try { items = JSON.parse(shape.props.items) } catch { /* */ }
    const minH = 48 + items.length * ITEM_H + (shape.props.status === 'draft' ? 52 : 20) + 16
    const h = Math.max(shape.props.h, minH)
    return <rect width={shape.props.w} height={h} rx={12} />
  }

  override canResize = () => true
  override isAspectRatioLocked = () => false

  override onResize = (shape: OutlineCardShape, info: any) => {
    return {
      props: {
        w: Math.max(240, shape.props.w * info.scaleX),
        h: Math.max(100, shape.props.h * info.scaleY),
      },
    }
  }
}
