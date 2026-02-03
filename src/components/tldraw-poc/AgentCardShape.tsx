/**
 * Agent 卡片形状 - 自定义 tldraw ShapeUtil
 * 一轮对话 = 一张卡片，内部折叠展示思考链和工具调用
 * 只有最终产出（分析、评论）才显示为重点内容
 */
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'
import { useState } from 'react'

// Agent 卡片形状属性
// steps: JSON 字符串，描述 Agent 执行的步骤序列
export type AgentCardShape = TLBaseShape<
  'agent-card',
  {
    w: number
    h: number
    userMessage: string       // 用户输入
    summary: string           // Agent 最终回复摘要
    steps: string             // JSON: AgentStep[]
    status: 'thinking' | 'executing' | 'done'
    currentStep: number       // 当前执行到第几步（用于动画）
    agentTurnId: string
    timestamp: number
  }
>

// 步骤类型（序列化为 JSON 存入 steps）
export interface AgentStep {
  type: 'thinking' | 'tool_call' | 'result' | 'comment'
  content: string
  toolName?: string
  toolResult?: string
  title?: string
}

// 步骤图标和颜色
const STEP_STYLE: Record<string, { icon: string; color: string }> = {
  thinking:  { icon: '💭', color: '#A78BFA' },
  tool_call: { icon: '🔧', color: '#38BDFF' },
  result:    { icon: '✦',  color: '#34D399' },
  comment:   { icon: '💬', color: '#FBBF24' },
}

export class AgentCardShapeUtil extends ShapeUtil<any> {
  static override type = 'agent-card' as const

  getDefaultProps() {
    return {
      w: 380,
      h: 220,
      userMessage: '',
      summary: '',
      steps: '[]',
      status: 'thinking' as const,
      currentStep: 0,
      agentTurnId: '',
      timestamp: Date.now(),
    }
  }

  getGeometry(shape: AgentCardShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override canResize = () => true
  override hideRotateHandle = () => true

  override onResize = (shape: AgentCardShape, info: any) => {
    return {
      props: {
        w: Math.max(280, shape.props.w * info.scaleX),
        h: Math.max(200, shape.props.h * info.scaleY),
      },
    }
  }

  component(shape: AgentCardShape) {
    const { userMessage, summary, steps: stepsJson, status, currentStep } = shape.props
    const [isExpanded, setIsExpanded] = useState(false)

    let steps: AgentStep[] = []
    try { steps = JSON.parse(stepsJson) } catch { /* */ }

    const isDone = status === 'done'
    const visibleSteps = isDone ? steps : steps.slice(0, currentStep + 1)

    // 过程步骤（thinking / tool_call）
    const processSteps = visibleSteps.filter(s => s.type === 'thinking' || s.type === 'tool_call')
    const toolCallCount = processSteps.filter(s => s.type === 'tool_call').length
    const hasDetails = processSteps.length > 0 && isDone

    return (
      <HTMLContainer style={{ width: '100%', height: '100%', pointerEvents: 'all' }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          borderRadius: 14,
          border: isDone ? '1.5px solid rgba(52, 211, 153, 0.2)' : '1.5px solid rgba(167, 139, 250, 0.3)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          opacity: isDone ? 0.9 : 1,
          transition: 'opacity 0.3s',
        }}>

          {/* 头部：用户消息 */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              background: 'linear-gradient(135deg, #D97706, #B45309)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#fff', fontWeight: 700, flexShrink: 0,
            }}>C</div>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#374151',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {userMessage || 'Agent Task'}
            </span>
            {!isDone && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#A78BFA',
                animation: 'pulse 1.2s ease-in-out infinite',
                flexShrink: 0,
              }} />
            )}
            {isDone && (
              <span style={{ fontSize: 11, color: '#34D399', fontWeight: 500 }}>✓ Done</span>
            )}
          </div>

          {/* 内容区 */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Done 态：执行详情摘要行（可展开） */}
            {isDone && summary && hasDetails && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 0,
                  cursor: 'pointer',
                  background: isExpanded ? '#F3F4F6' : 'transparent',
                  borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 500 }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span style={{ fontSize: 10 }}>🔧</span>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                  {processSteps.length} 个步骤{toolCallCount > 0 ? `（${toolCallCount} 个工具调用）` : ''}
                </span>
              </div>
            )}

            {/* 执行中：逐步展开显示，或者 Done 态的展开详情 */}
            {((!isDone && processSteps.length > 0) || (isDone && isExpanded && processSteps.length > 0)) && (
              <div style={{
                padding: '8px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                flexShrink: isExpanded ? 0 : 1,
                overflow: isExpanded ? 'auto' : 'hidden',
                background: isExpanded ? '#FAFAFA' : 'transparent',
              }}>
                {processSteps.map((step, i) => {
                  const style = STEP_STYLE[step.type] || STEP_STYLE.thinking
                  const isToolCall = step.type === 'tool_call'
                  return (
                    <div key={i}>
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                        fontSize: 11, color: '#6B7280', lineHeight: 1.4,
                      }}>
                        <span style={{ flexShrink: 0, fontSize: 10 }}>{style.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <code style={{
                            color: isToolCall ? style.color : '#6B7280',
                            fontSize: 10,
                            fontFamily: '"SF Mono", monospace',
                            fontWeight: 500,
                          }}>
                            {isToolCall ? `${step.toolName}()` : step.title || '思考'}
                          </code>
                          {isToolCall && step.content && (
                            <div style={{
                              fontSize: 10,
                              color: '#9CA3AF',
                              marginTop: 2,
                              paddingLeft: 8,
                              borderLeft: `1px solid ${style.color}33`,
                              overflow: 'auto',
                              maxHeight: '60px',
                            }}>
                              {step.content.substring(0, 200)}
                              {step.content.length > 200 ? '...' : ''}
                            </div>
                          )}
                          {step.toolResult && isExpanded && (
                            <div style={{
                              fontSize: 10,
                              color: '#34D399',
                              marginTop: 2,
                              paddingLeft: 8,
                              borderLeft: '1px solid #34D39933',
                              fontStyle: 'italic',
                              overflow: 'auto',
                              maxHeight: '60px',
                            }}>
                              ✓ {step.toolResult.substring(0, 200)}
                              {step.toolResult.length > 200 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 执行中：显示等待 */}
            {!isDone && processSteps.length > 0 && (
              <div style={{
                padding: '8px 14px', flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#9CA3AF',
              }}>
                Agent 正在执行...
              </div>
            )}

            {/* 摘要：done 态显示，Markdown 渲染，可滚动 */}
            {isDone && summary && (
              <div style={{
                padding: '8px 14px',
                borderTop: '1px solid rgba(0,0,0,0.05)',
                fontSize: 11, color: '#6B7280', lineHeight: 1.5,
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
              }}>
                {renderMarkdownLite(summary)}
              </div>
            )}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: AgentCardShape) {
    const isDone = shape.props.status === 'done'
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={14}
        ry={14}
        stroke={isDone ? '#34D399' : '#A78BFA'}
      />
    )
  }
}

/** 简易 Markdown：## 标题、**粗体**、列表 */
function renderMarkdownLite(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: JSX.Element[] = []

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) { elements.push(<div key={i} style={{ height: 4 }} />); return }

    if (trimmed.startsWith('## ')) {
      elements.push(<div key={i} style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{trimmed.slice(3)}</div>)
      return
    }
    if (trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
      const content = trimmed.replace(/^[-\d.]+\s/, '')
      elements.push(
        <div key={i} style={{ paddingLeft: 10, position: 'relative', marginBottom: 1 }}>
          <span style={{ position: 'absolute', left: 0, color: '#9CA3AF' }}>·</span>
          {renderInline(content)}
        </div>
      )
      return
    }
    elements.push(<div key={i} style={{ marginBottom: 1 }}>{renderInline(trimmed)}</div>)
  })
  return <>{elements}</>
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ fontWeight: 600, color: '#111827' }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )}</>
}
