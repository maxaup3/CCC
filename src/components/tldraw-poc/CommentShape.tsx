/**
 * Comment 形状 - Agent 双向沟通气泡
 * 折叠态为品牌色 "C" 徽标圆点，展开态为 Figma 风格气泡卡片
 * 支持：Agent 提问 / Agent 建议 / 用户修改意见
 * 操作按钮点击通过 agentEvents 通信，同时传递选项文本
 */
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'
import { agentEvents, AGENT_EVENTS } from '../../utils/agentEvents'

export type CommentShape = TLBaseShape<
  'agent-comment',
  {
    w: number
    h: number
    message: string
    actions: string       // JSON: { label: string, type: string }[]
    resolved: boolean
    expanded: boolean
    anchorShapeId: string
    createdAt: number
  }
>

interface CommentAction {
  label: string
  type: string
}

const DOT_SIZE = 28
const CARD_W = 260

export class CommentShapeUtil extends ShapeUtil<any> {
  static override type = 'agent-comment' as const

  getDefaultProps() {
    return {
      w: DOT_SIZE,
      h: DOT_SIZE,
      message: '',
      actions: '[]',
      resolved: false,
      expanded: false,
      anchorShapeId: '',
      createdAt: Date.now(),
    }
  }

  getGeometry(shape: CommentShape): Geometry2d {
    const { expanded, resolved } = shape.props
    if (resolved || !expanded) {
      return new Rectangle2d({ width: DOT_SIZE, height: DOT_SIZE, isFilled: true })
    }
    let actions: CommentAction[] = []
    try { actions = JSON.parse(shape.props.actions) } catch { /* */ }
    const messageLines = Math.ceil(shape.props.message.length / 18)
    const h = 44 + messageLines * 18 + (actions.length > 0 ? 44 : 0) + 12
    return new Rectangle2d({ width: CARD_W, height: h, isFilled: true })
  }

  component(shape: CommentShape) {
    const { message, resolved, expanded, actions: actionsStr } = shape.props

    let actions: CommentAction[] = []
    try { actions = JSON.parse(actionsStr) } catch { /* */ }

    // 展开操作（供折叠态 & 已解决态共用）
    const handleExpand = () => {
      const editor = (window as any).__tldrawEditor
      if (editor) {
        editor.updateShape({
          id: shape.id,
          type: 'agent-comment',
          props: { expanded: true, w: CARD_W, h: 100 },
        })
      }
    }

    // 已解决态：绿色小勾
    if (resolved) {
      return (
        <HTMLContainer>
          <div
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: '50%',
              background: 'rgba(52, 211, 153, 0.15)',
              border: '1.5px solid rgba(52, 211, 153, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s',
              pointerEvents: 'all',
            }}
            onClick={handleExpand}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7.5L5.5 10L11 4" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </HTMLContainer>
      )
    }

    // 折叠态：品牌色 C 徽标
    if (!expanded) {
      return (
        <HTMLContainer>
          <div
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #D97706, #B45309)',
              cursor: 'pointer',
              animation: 'comment-pulse 2s ease-in-out infinite',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              pointerEvents: 'all',
            }}
            onClick={handleExpand}
            onPointerDown={(e) => e.stopPropagation()}
          >
            C
            <style>{`
              @keyframes comment-pulse {
                0%, 100% { transform: scale(1); opacity: 0.9; }
                50% { transform: scale(1.1); opacity: 1; }
              }
            `}</style>
          </div>
        </HTMLContainer>
      )
    }

    // 展开态：Figma 风格气泡卡片
    const messageLines = Math.ceil(message.length / 18)
    const cardH = 44 + messageLines * 18 + (actions.length > 0 ? 44 : 0) + 12

    return (
      <HTMLContainer>
        <div style={{ position: 'relative' }}>
          {/* 气泡尾巴 - 指向左下方锚点 */}
          <div style={{
            position: 'absolute',
            left: 10,
            top: -6,
            width: 12,
            height: 12,
            background: '#FFFFFF',
            transform: 'rotate(45deg)',
            boxShadow: '-1px -1px 2px rgba(0,0,0,0.06)',
            zIndex: 0,
          }} />

          {/* 卡片主体 */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: CARD_W,
              minHeight: cardH,
              background: '#FFFFFF',
              borderRadius: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
              padding: '10px 14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              pointerEvents: 'all',
            }}
          >
            {/* 头部：C 徽标 + 标签 + 关闭 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: 'linear-gradient(135deg, #D97706, #B45309)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                color: '#fff',
                fontWeight: 700,
                flexShrink: 0,
              }}>C</div>
              <span style={{
                fontSize: 11,
                color: '#9CA3AF',
                fontWeight: 500,
                flex: 1,
              }}>
                {actions.length > 0 ? 'Agent 提问' : 'Agent 提示'}
              </span>
              {/* 关闭按钮 */}
              <button
                style={{
                  width: 20,
                  height: 20,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  color: '#9CA3AF',
                  fontSize: 15,
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}
                onClick={() => {
                  const editor = (window as any).__tldrawEditor
                  if (editor) {
                    editor.updateShape({
                      id: shape.id,
                      type: 'agent-comment',
                      props: { expanded: false, w: DOT_SIZE, h: DOT_SIZE },
                    })
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerEnter={(e) => {
                  (e.target as HTMLElement).style.background = 'rgba(0,0,0,0.05)'
                }}
                onPointerLeave={(e) => {
                  (e.target as HTMLElement).style.background = 'none'
                }}
              >
                ×
              </button>
            </div>

            {/* 消息文字 */}
            <div style={{
              fontSize: 13,
              color: '#374151',
              lineHeight: 1.5,
              marginBottom: actions.length > 0 ? 10 : 0,
              wordBreak: 'break-word',
            }}>
              {message}
            </div>

            {/* 操作按钮 */}
            {actions.length > 0 && (
              <div style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                borderTop: '1px solid rgba(0,0,0,0.06)',
                paddingTop: 10,
              }}>
                {actions.map((action, idx) => (
                  <button
                    key={idx}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: idx === 0 ? 'none' : '1px solid #E5E7EB',
                      background: idx === 0
                        ? 'linear-gradient(135deg, #D97706, #B45309)'
                        : '#F9FAFB',
                      color: idx === 0 ? '#fff' : '#374151',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: idx === 0 ? 600 : 400,
                      transition: 'all 0.15s',
                      boxShadow: idx === 0 ? '0 1px 4px rgba(217,119,6,0.3)' : 'none',
                    }}
                    onClick={() => {
                      agentEvents.emit(AGENT_EVENTS.COMMENT_ACTION, {
                        shapeId: shape.id,
                        action: action.type,
                        label: action.label,
                        anchorShapeId: shape.props.anchorShapeId,
                      })
                      // 处理完毕后直接删除评论
                      const editor = (window as any).__tldrawEditor
                      if (editor) {
                        editor.deleteShape(shape.id)
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: CommentShape) {
    const { expanded, resolved } = shape.props
    if (resolved || !expanded) {
      return <circle cx={DOT_SIZE / 2} cy={DOT_SIZE / 2} r={DOT_SIZE / 2} />
    }
    let actions: CommentAction[] = []
    try { actions = JSON.parse(shape.props.actions) } catch { /* */ }
    const messageLines = Math.ceil(shape.props.message.length / 18)
    const h = 44 + messageLines * 18 + (actions.length > 0 ? 44 : 0) + 12
    return <rect width={CARD_W} height={h} rx={12} />
  }

  override canResize = () => false
  override canBind = () => false
  override isAspectRatioLocked = () => true
}
