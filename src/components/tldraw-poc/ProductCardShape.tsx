/**
 * 产品卡片形状 - 自定义 tldraw ShapeUtil
 * 代表 Agent 搜索到的一个产品，支持折叠/展开
 * 折叠态底部显示来源摘要（信任标记），展开态显示详情 + 完整来源列表
 * 点击来源区域弹出完整报告弹窗
 */
import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'

// 产品卡片属性
export type ProductCardShape = TLBaseShape<
  'product-card',
  {
    w: number
    h: number
    name: string
    tagline: string
    tags: string          // JSON: string[]
    detail: string        // Markdown
    sources: string       // JSON: SourceRef[]
    expanded: boolean
    sourceTaskId: string
    imageUrl: string      // 封面图 URL（可选，为空则不显示）
  }
>

interface SourceRef {
  title: string
  domain: string
  url: string
}

// 左侧彩条颜色池
const STRIPE_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
]

function getStripeColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return STRIPE_COLORS[Math.abs(hash) % STRIPE_COLORS.length]
}

const COLLAPSED_H = 140
const COLLAPSED_H_WITH_IMAGE = 260
const EXPANDED_H = 420
const EXPANDED_H_WITH_IMAGE = 540
const IMAGE_HEIGHT = 120

export class ProductCardShapeUtil extends ShapeUtil<any> {
  static override type = 'product-card' as const

  getDefaultProps() {
    return {
      w: 280,
      h: COLLAPSED_H,
      name: '',
      tagline: '',
      tags: '[]',
      detail: '',
      sources: '[]',
      expanded: false,
      sourceTaskId: '',
      imageUrl: '',
    }
  }

  getGeometry(shape: ProductCardShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override canResize = () => true
  override hideRotateHandle = () => true

  override onResize = (shape: ProductCardShape, info: any) => {
    return {
      props: {
        w: Math.max(200, shape.props.w * info.scaleX),
        h: Math.max(100, shape.props.h * info.scaleY),
      },
    }
  }

  component(shape: ProductCardShape) {
    return <ProductCardComponent shape={shape} editor={this.editor} />
  }

  indicator(shape: ProductCardShape) {
    const stripeColor = getStripeColor(shape.props.name)
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={12}
        ry={12}
        stroke={stripeColor}
      />
    )
  }
}

/** 产品卡片 React 组件 */
function ProductCardComponent({ shape, editor }: { shape: ProductCardShape; editor: any }) {
  const { name, tagline, tags: tagsJson, detail, sources: sourcesJson, expanded, imageUrl } = shape.props
  const [modalOpen, setModalOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const hasImage = !!imageUrl && !imgError

  let tags: string[] = []
  try { tags = JSON.parse(tagsJson) } catch { /* */ }

  let sources: SourceRef[] = []
  try { sources = JSON.parse(sourcesJson) } catch { /* */ }

  const stripeColor = getStripeColor(name)

  const uniqueDomains = [...new Set(sources.map(s => s.domain))]
  const sourcesSummary = sources.length > 0
    ? `基于 ${sources.length} 篇文章分析 · ${uniqueDomains.slice(0, 2).join('、')}${uniqueDomains.length > 2 ? ` 等 ${uniqueDomains.length} 个来源` : ''}`
    : ''

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newExpanded = !expanded
    const collapsedH = hasImage ? COLLAPSED_H_WITH_IMAGE : COLLAPSED_H
    const expandedH = hasImage ? EXPANDED_H_WITH_IMAGE : EXPANDED_H
    editor.updateShape({
      id: shape.id,
      type: 'product-card' as any,
      props: {
        expanded: newExpanded,
        h: newExpanded ? expandedH : collapsedH,
      },
    } as any)
  }

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation()
    setModalOpen(true)
  }

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
        {/* 左侧彩色条纹（无封面图时显示） */}
        {!hasImage && (
          <div style={{
            width: 4,
            background: stripeColor,
            flexShrink: 0,
            borderRadius: '12px 0 0 12px',
          }} />
        )}

        {/* 主体：封面图 + 内容区 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* 封面图 */}
          {hasImage && (
            <div style={{
              width: '100%',
              height: IMAGE_HEIGHT,
              flexShrink: 0,
              overflow: 'hidden',
              borderRadius: '12px 12px 0 0',
              position: 'relative',
            }}>
              <img
                src={imageUrl}
                alt={name}
                onError={() => setImgError(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {/* 图片底部渐变遮罩 */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 32,
                background: 'linear-gradient(transparent, rgba(255,255,255,0.6))',
              }} />
              {/* 彩色顶边条 */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: stripeColor,
              }} />
            </div>
          )}

        {/* 内容区 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '12px 14px',
          gap: 6,
        }}>
          {/* 产品名 + 展开按钮 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: '#111827',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {name}
            </span>
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
          </div>

          {/* 一句话描述 */}
          <div style={{
            fontSize: 12, lineHeight: 1.5, color: '#6B7280',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
            flexShrink: 0,
          }}>
            {tagline}
          </div>

          {/* 标签 */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: `${stripeColor}12`, color: stripeColor,
                  fontWeight: 500, whiteSpace: 'nowrap',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 折叠态：来源摘要（可点击打开弹窗） */}
          {!expanded && sourcesSummary && (
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
              <span style={{ fontSize: 10, flexShrink: 0 }}>🔍</span>
              <span style={{ flex: 1 }}>{sourcesSummary}</span>
              <span style={{ fontSize: 9, color: '#D1D5DB', flexShrink: 0 }}>查看报告 →</span>
            </div>
          )}

          {/* 展开态：详细内容 */}
          {expanded && detail && (
            <div style={{
              flex: 1, overflow: 'auto', marginTop: 4, paddingTop: 8,
              borderTop: '1px solid rgba(0,0,0,0.06)',
              fontSize: 12, lineHeight: 1.6, color: '#374151',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {renderDetailMarkdown(detail)}
            </div>
          )}

          {/* 展开态：来源列表（可点击打开弹窗） */}
          {expanded && sources.length > 0 && (
            <div style={{
              flexShrink: 0, paddingTop: 8, marginTop: 4,
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div
                onClick={handleOpenModal}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  fontSize: 10, fontWeight: 600, color: '#9CA3AF',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <span>来源 · {sources.length} 篇</span>
                <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none' as const }}>查看完整报告 →</span>
              </div>
              {sources.map((src, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: '#6B7280', lineHeight: 1.3,
                  marginBottom: 4,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: 'rgba(0,0,0,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, flexShrink: 0,
                  }}>🔗</span>
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {src.title}
                  </span>
                  <span style={{
                    fontSize: 9, color: '#D1D5DB', flexShrink: 0,
                  }}>
                    {src.domain}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* 完整报告弹窗 */}
      {modalOpen && ReactDOM.createPortal(
        <ReportModal
          name={name}
          tagline={tagline}
          tags={tags}
          detail={detail}
          sources={sources}
          stripeColor={stripeColor}
          imageUrl={hasImage ? imageUrl : undefined}
          onClose={() => setModalOpen(false)}
        />,
        document.body
      )}
    </HTMLContainer>
  )
}

/** 完整报告弹窗 */
function ReportModal({ name, tagline, tags, detail, sources, stripeColor, imageUrl, onClose }: {
  name: string
  tagline: string
  tags: string[]
  detail: string
  sources: SourceRef[]
  stripeColor: string
  imageUrl?: string
  onClose: () => void
}) {
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
        animation: 'modalFadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
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
        <div style={{ height: 4, background: stripeColor, flexShrink: 0 }} />

        {/* 封面图 */}
        {imageUrl && (
          <div style={{
            width: '100%',
            height: 180,
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            <img
              src={imageUrl}
              alt={name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

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
                {name}
              </h2>
              <p style={{
                margin: '6px 0 0', fontSize: 14, color: '#6B7280', lineHeight: 1.5,
              }}>
                {tagline}
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
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
                  background: `${stripeColor}12`, color: stripeColor,
                  fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 内容区：可滚动 */}
        <div style={{
          flex: 1, overflow: 'auto', padding: '20px 24px',
        }}>
          {/* Agent 分析内容 */}
          {detail && (
            <div style={{
              fontSize: 14, lineHeight: 1.8, color: '#374151',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {renderDetailMarkdownLarge(detail, stripeColor)}
            </div>
          )}

          {/* 来源引用 */}
          {sources.length > 0 && (
            <div style={{
              marginTop: 24, paddingTop: 20,
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#9CA3AF',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em',
                marginBottom: 12,
              }}>
                参考来源 · {sources.length} 篇
              </div>
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 6,
                    background: 'rgba(0,0,0,0.02)',
                    textDecoration: 'none',
                    transition: 'background 0.15s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'rgba(0,0,0,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, flexShrink: 0,
                  }}>🔗</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {src.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {src.domain} · 点击查看原文
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: '#D1D5DB', flexShrink: 0 }}>↗</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
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

/** 简易 Markdown 渲染 */
function renderDetailMarkdown(text: string) {
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
