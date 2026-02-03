/**
 * 文档卡片形状 - 上传的 MD/PDF 文件
 * 类似 ProductCard，支持折叠/展开 + 全文弹窗
 *
 * 上传流程：
 * 1. 创建卡片 status='summarizing'，显示加载动画
 * 2. Agent 读取文件内容 → 生成 summary + detail
 * 3. 更新卡片 status='done'，显示摘要，可展开查看全文
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import {
  ShapeUtil,
  TLBaseShape,
  TLOnEditEndHandler,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
  useEditor,
  useValue,
} from 'tldraw'
import { agentEvents, AGENT_EVENTS } from '../../utils/agentEvents'

export type DocCardShape = TLBaseShape<
  'doc-card',
  {
    w: number
    h: number
    fileName: string
    fileType: 'md' | 'pdf'
    fileContent: string      // 原始内容（MD=文本，PDF=base64 data URL）
    preview: string          // 前 200 字预览
    fileSize: string
    uploadedAt: number
    // Agent 总结字段
    summary: string          // Agent 生成的一句话摘要
    detail: string           // Agent 生成的详细分析（Markdown）
    status: 'summarizing' | 'done' | 'error'
    expanded: boolean
    summaryStale: boolean    // 编辑后标记总结已过时
  }
>

const CARD_W = 280
const COLLAPSED_H = 140
const EXPANDED_H = 420
const EDIT_W = 480
const EDIT_H = 500

/** Helper to check if a shape is a doc-card */
export function isDocCardShape(shape: any): shape is DocCardShape {
  return shape?.type === 'doc-card'
}

export class DocCardShapeUtil extends ShapeUtil<any> {
  static override type = 'doc-card' as const

  getDefaultProps() {
    return {
      w: CARD_W,
      h: COLLAPSED_H,
      fileName: 'document.md',
      fileType: 'md' as const,
      fileContent: '',
      preview: '',
      fileSize: '',
      uploadedAt: Date.now(),
      summary: '',
      detail: '',
      status: 'summarizing' as const,
      expanded: false,
      summaryStale: false,
    }
  }

  getGeometry(shape: DocCardShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override canResize = () => true
  override canEdit = (shape: DocCardShape) => {
    return shape.props.fileType === 'md' && shape.props.status === 'done'
  }
  override hideRotateHandle = () => true

  override onEditEnd: TLOnEditEndHandler<DocCardShape> = (shape) => {
    const preview = shape.props.fileContent.slice(0, 200)
    this.editor.updateShapes([{
      id: shape.id,
      type: 'doc-card',
      props: {
        preview,
        w: CARD_W,
        h: shape.props.expanded ? EXPANDED_H : COLLAPSED_H,
      },
    }])
  }

  override onResize = (shape: DocCardShape, info: any) => {
    return {
      props: {
        w: Math.max(200, shape.props.w * info.scaleX),
        h: Math.max(100, shape.props.h * info.scaleY),
      },
    }
  }

  component(shape: DocCardShape) {
    return <DocCardComponent shape={shape} editor={this.editor} />
  }

  indicator(shape: DocCardShape) {
    const isMd = shape.props.fileType === 'md'
    const color = isMd ? '#16A34A' : '#DC2626'
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={12}
        ry={12}
        stroke={color}
      />
    )
  }
}

/** 文档卡片 React 组件 */
function DocCardComponent({ shape, editor }: { shape: DocCardShape; editor: any }) {
  const {
    fileName, fileType, fileSize, preview,
    summary, detail, status, expanded, summaryStale,
  } = shape.props
  const [modalOpen, setModalOpen] = useState(false)

  // 编辑状态检测
  const tlEditor = useEditor()
  const isEditing = useValue(
    'isEditingDoc',
    () => tlEditor.getEditingShapeId() === shape.id,
    [tlEditor, shape.id]
  )

  // 本地编辑文本
  const [editText, setEditText] = useState(shape.props.fileContent)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSizeRef = useRef({ w: shape.props.w, h: shape.props.h })

  // 进入编辑时同步文本 & 扩大卡片
  useEffect(() => {
    if (isEditing) {
      setEditText(shape.props.fileContent)
      prevSizeRef.current = { w: shape.props.w, h: shape.props.h }
      tlEditor.updateShape({
        id: shape.id,
        type: 'doc-card' as any,
        props: { w: EDIT_W, h: EDIT_H },
      } as any)
    }
  }, [isEditing])

  // 500ms 防抖同步到 shape props
  const handleEditChange = useCallback((value: string) => {
    setEditText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      tlEditor.updateShape({
        id: shape.id,
        type: 'doc-card' as any,
        props: { fileContent: value, summaryStale: true },
      } as any)
    }, 500)
  }, [tlEditor, shape.id])

  // 清理 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleExitEdit = useCallback(() => {
    // 立即同步剩余的编辑内容
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    tlEditor.updateShape({
      id: shape.id,
      type: 'doc-card' as any,
      props: { fileContent: editText, summaryStale: true },
    } as any)
    tlEditor.setEditingShape(null)
  }, [tlEditor, shape.id, editText])

  const handleResummarize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    tlEditor.updateShape({
      id: shape.id,
      type: 'doc-card' as any,
      props: { status: 'summarizing', summaryStale: false },
    } as any)
    agentEvents.emit(AGENT_EVENTS.SUMMARIZE_DOC, { shapeId: shape.id })
  }, [tlEditor, shape.id])

  const isMd = fileType === 'md'
  const accentColor = isMd ? '#16A34A' : '#DC2626'
  const iconBg = isMd
    ? 'linear-gradient(135deg, #22C55E, #16A34A)'
    : 'linear-gradient(135deg, #EF4444, #DC2626)'
  const iconShadow = isMd
    ? '0 2px 6px rgba(34, 197, 94, 0.25)'
    : '0 2px 6px rgba(239, 68, 68, 0.25)'
  const iconLabel = isMd ? 'MD' : 'PDF'

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (status !== 'done') return
    const newExpanded = !expanded
    editor.updateShape({
      id: shape.id,
      type: 'doc-card' as any,
      props: {
        expanded: newExpanded,
        h: newExpanded ? EXPANDED_H : COLLAPSED_H,
      },
    } as any)
  }

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation()
    setModalOpen(true)
  }

  // 折叠态下显示的文本
  const displayText = status === 'done' && summary
    ? summary
    : status === 'summarizing'
      ? ''
      : (preview || '').split('\n').filter(l => l.trim()).slice(0, 2).join(' ')

  // ===== 编辑模式 UI =====
  if (isEditing) {
    return (
      <HTMLContainer style={{ width: '100%', height: '100%', pointerEvents: 'all' }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          borderRadius: 12,
          border: '2px solid #16A34A',
          boxShadow: '0 4px 20px rgba(22, 163, 74, 0.15)',
          display: 'flex',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          {/* 左侧绿色条纹 */}
          <div style={{
            width: 4,
            background: '#16A34A',
            flexShrink: 0,
            borderRadius: '10px 0 0 10px',
          }} />

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '12px 14px',
            gap: 8,
          }}>
            {/* 标题行 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: iconShadow,
              }}>
                <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, letterSpacing: 0.5 }}>
                  {iconLabel}
                </span>
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: '#111827',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {fileName}
                </div>
              </div>

              <span style={{
                fontSize: 10, fontWeight: 600, color: '#16A34A',
                background: '#F0FDF4', padding: '2px 8px', borderRadius: 4,
                flexShrink: 0,
              }}>
                编辑中
              </span>
            </div>

            {/* 编辑器 */}
            <textarea
              value={editText}
              onChange={(e) => handleEditChange(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') {
                  handleExitEdit()
                }
              }}
              autoFocus
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                lineHeight: 1.6,
                color: '#374151',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, "Cascadia Code", monospace',
                background: '#FAFAFA',
                outline: 'none',
                overflow: 'auto',
              }}
            />

            {/* 底部提示 */}
            <div style={{
              flexShrink: 0,
              fontSize: 10,
              color: '#9CA3AF',
              textAlign: 'center',
            }}>
              Esc 退出编辑
            </div>
          </div>
        </div>
      </HTMLContainer>
    )
  }

  // ===== 查看模式 UI =====
  return (
    <HTMLContainer style={{ width: '100%', height: '100%', pointerEvents: 'all' }}>
      <div style={{
        width: '100%',
        height: '100%',
        background: '#FFFFFF',
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        {/* 左侧彩色条纹 */}
        <div style={{
          width: 4,
          background: accentColor,
          flexShrink: 0,
          borderRadius: '12px 0 0 12px',
        }} />

        {/* 内容区 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '12px 14px',
          gap: 6,
        }}>
          {/* 标题行：图标 + 文件名 + 展开按钮 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            {/* 小图标 */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: iconShadow,
            }}>
              <span style={{
                fontSize: 9,
                color: '#fff',
                fontWeight: 700,
                letterSpacing: 0.5,
              }}>
                {iconLabel}
              </span>
            </div>

            <div style={{
              flex: 1,
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: '#111827',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fileName}
              </div>
              {fileSize && (
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                  {fileSize}
                </div>
              )}
            </div>

            {status === 'done' && (
              <button
                onClick={handleToggle}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#9CA3AF', flexShrink: 0, padding: 0,
                }}
              >
                {expanded ? '▲' : '▼'}
              </button>
            )}
          </div>

          {/* 状态：正在总结 */}
          {status === 'summarizing' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
            }}>
              <div style={{
                width: 14, height: 14,
                border: `2px solid ${accentColor}40`,
                borderTop: `2px solid ${accentColor}`,
                borderRadius: '50%',
                animation: 'docCardSpin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                正在阅读文档...
              </span>
              <style>{`
                @keyframes docCardSpin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {/* 状态：出错 */}
          {status === 'error' && (
            <div style={{
              fontSize: 12, color: '#EF4444',
              padding: '4px 0',
            }}>
              总结失败，请重试
            </div>
          )}

          {/* 折叠态：摘要 */}
          {status === 'done' && !expanded && (
            <>
              <div style={{
                fontSize: 12, lineHeight: 1.5, color: '#6B7280',
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                flexShrink: 0,
              }}>
                {displayText}
              </div>

              {/* 总结已过时提示 */}
              {summaryStale && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 0', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, color: '#D97706' }}>
                    ⚠ 文档已编辑，总结可能过时
                  </span>
                  <button
                    onClick={handleResummarize}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 10, fontWeight: 600, color: '#16A34A',
                      background: '#F0FDF4', border: '1px solid #BBF7D0',
                      borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    重新总结
                  </button>
                </div>
              )}

              {/* 底部：查看全文入口 */}
              {(detail || preview) && (
                <div
                  onClick={handleOpenModal}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    marginTop: 'auto',
                    paddingTop: 6,
                    borderTop: '1px solid rgba(0,0,0,0.05)',
                    fontSize: 10, color: '#9CA3AF', lineHeight: 1.4,
                    display: 'flex', alignItems: 'center', gap: 4,
                    flexShrink: 0,
                    cursor: 'pointer',
                    borderRadius: 4,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 10, flexShrink: 0 }}>📄</span>
                  <span style={{ flex: 1 }}>Agent 总结 · {fileType.toUpperCase()} 文档</span>
                  <span style={{ fontSize: 9, color: '#D1D5DB', flexShrink: 0 }}>查看全文 →</span>
                </div>
              )}
            </>
          )}

          {/* 展开态：详细内容 */}
          {expanded && status === 'done' && (
            <>
              {detail && (
                <div style={{
                  flex: 1, overflow: 'auto', marginTop: 4, paddingTop: 8,
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  fontSize: 12, lineHeight: 1.6, color: '#374151',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {renderDetailMarkdown(detail, accentColor)}
                </div>
              )}

              {/* 总结已过时提示（展开态） */}
              {summaryStale && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 0', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, color: '#D97706' }}>
                    ⚠ 文档已编辑，总结可能过时
                  </span>
                  <button
                    onClick={handleResummarize}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 10, fontWeight: 600, color: '#16A34A',
                      background: '#F0FDF4', border: '1px solid #BBF7D0',
                      borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    重新总结
                  </button>
                </div>
              )}

              {/* 查看原文按钮 */}
              <div
                onClick={handleOpenModal}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  flexShrink: 0, paddingTop: 8, marginTop: 4,
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  fontSize: 10, fontWeight: 600, color: '#9CA3AF',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <span>原始内容 · {fileType.toUpperCase()}</span>
                <span style={{ fontSize: 9, fontWeight: 400 }}>查看全文 →</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 全文弹窗 */}
      {modalOpen && ReactDOM.createPortal(
        <DocModal
          fileName={fileName}
          fileType={fileType}
          fileSize={fileSize}
          summary={summary}
          detail={detail}
          originalContent={fileType === 'md' ? shape.props.fileContent : ''}
          accentColor={accentColor}
          onClose={() => setModalOpen(false)}
        />,
        document.body
      )}
    </HTMLContainer>
  )
}

/** 全文弹窗 */
function DocModal({ fileName, fileType, fileSize, summary, detail, originalContent, accentColor, onClose }: {
  fileName: string
  fileType: string
  fileSize: string
  summary: string
  detail: string
  originalContent: string
  accentColor: string
  onClose: () => void
}) {
  const [tab, setTab] = useState<'summary' | 'original'>('summary')

  return (
    <div
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        animation: 'docModalFadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 顶部色条 */}
        <div style={{ height: 4, background: accentColor, flexShrink: 0 }} />

        {/* 头部 */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <h2 style={{
                margin: 0, fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.3,
              }}>
                {fileName}
              </h2>
              <p style={{
                margin: '6px 0 0', fontSize: 13, color: '#9CA3AF',
              }}>
                {fileType.toUpperCase()} · {fileSize}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'rgba(0,0,0,0.02)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: '#9CA3AF', flexShrink: 0, padding: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Tab 切换 */}
          <div style={{
            display: 'flex', gap: 0, marginTop: 16,
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>
            <button
              onClick={() => setTab('summary')}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                padding: '8px 16px',
                fontSize: 13, fontWeight: tab === 'summary' ? 600 : 400,
                color: tab === 'summary' ? accentColor : '#9CA3AF',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === 'summary' ? `2px solid ${accentColor}` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              Agent 总结
            </button>
            <button
              onClick={() => setTab('original')}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                padding: '8px 16px',
                fontSize: 13, fontWeight: tab === 'original' ? 600 : 400,
                color: tab === 'original' ? accentColor : '#9CA3AF',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === 'original' ? `2px solid ${accentColor}` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              原始内容
            </button>
          </div>
        </div>

        {/* 内容区：可滚动 */}
        <div style={{
          flex: 1, overflow: 'auto', padding: '20px 24px',
        }}>
          {tab === 'summary' && (
            <>
              {summary && (
                <div style={{
                  fontSize: 15, lineHeight: 1.6, color: '#374151',
                  padding: '12px 16px',
                  background: `${accentColor}08`,
                  borderRadius: 10,
                  borderLeft: `3px solid ${accentColor}`,
                  marginBottom: 16,
                }}>
                  {summary}
                </div>
              )}
              {detail && (
                <div style={{
                  fontSize: 14, lineHeight: 1.8, color: '#374151',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {renderDetailMarkdownLarge(detail, accentColor)}
                </div>
              )}
              {!summary && !detail && (
                <div style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: 40 }}>
                  暂无总结内容
                </div>
              )}
            </>
          )}

          {tab === 'original' && (
            <div style={{
              fontSize: 13, lineHeight: 1.7, color: '#374151',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: fileType === 'md'
                ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                : 'ui-monospace, "SF Mono", Menlo, monospace',
            }}>
              {fileType === 'md'
                ? (originalContent || '(空文档)')
                : '(PDF 原文件，请在本地 PDF 阅读器中查看)'
              }
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes docModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/** 简易 Markdown 渲染 */
function renderDetailMarkdown(text: string, accentColor: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) { elements.push(<div key={i} style={{ height: 4 }} />); return }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <div key={i} style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
          {trimmed.slice(3)}
        </div>
      )
      return
    }
    if (trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
      const content = trimmed.replace(/^[-\d.]+\s/, '')
      elements.push(
        <div key={i} style={{ paddingLeft: 10, position: 'relative', marginBottom: 1 }}>
          <span style={{ position: 'absolute', left: 0, color: accentColor }}>·</span>
          {renderInline(content)}
        </div>
      )
      return
    }
    elements.push(<div key={i} style={{ marginBottom: 1 }}>{renderInline(trimmed)}</div>)
  })
  return <>{elements}</>
}

/** 弹窗用的 Markdown 渲染（字号更大） */
function renderDetailMarkdownLarge(text: string, accentColor: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) { elements.push(<div key={i} style={{ height: 8 }} />); return }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <div key={i} style={{
          fontSize: 16, fontWeight: 700, color: '#111827',
          marginBottom: 4, marginTop: i > 0 ? 12 : 0,
          paddingBottom: 4,
          borderBottom: `2px solid ${accentColor}20`,
        }}>
          {trimmed.slice(3)}
        </div>
      )
      return
    }
    if (trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
      const content = trimmed.replace(/^[-\d.]+\s/, '')
      elements.push(
        <div key={i} style={{ paddingLeft: 16, position: 'relative', marginBottom: 4 }}>
          <span style={{ position: 'absolute', left: 2, color: accentColor, fontWeight: 700 }}>·</span>
          {renderInline(content)}
        </div>
      )
      return
    }
    elements.push(<div key={i} style={{ marginBottom: 4 }}>{renderInline(trimmed)}</div>)
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
