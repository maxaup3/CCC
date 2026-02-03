/**
 * 页面卡片形状 - PPT 幻灯片预览
 * 16:9 比例白色卡片，模拟 PPT 幻灯片
 * 支持封面/内容/总结三种页面类型
 */
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'

export interface PageContent {
  subtitle?: string
  bullets: string[]
  note?: string
  sourceCardName?: string
}

export type PageCardShape = TLBaseShape<
  'page-card',
  {
    w: number
    h: number
    pageNumber: number
    pageTitle: string
    content: string         // JSON: PageContent
    pageType: 'cover' | 'content' | 'summary'
    outlineShapeId: string
    isEditing: boolean
  }
>

const CARD_W = 480
const CARD_H = 270  // 16:9

const PURPLE = '#7C3AED'

export class PageCardShapeUtil extends ShapeUtil<any> {
  static override type = 'page-card' as const

  getDefaultProps() {
    return {
      w: CARD_W,
      h: CARD_H,
      pageNumber: 1,
      pageTitle: '',
      content: '{"bullets":[]}',
      pageType: 'content' as const,
      outlineShapeId: '',
      isEditing: false,
    }
  }

  getGeometry(shape: PageCardShape): Geometry2d {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: PageCardShape) {
    const { w, h, pageNumber, pageTitle, content: contentStr, pageType } = shape.props

    let content: PageContent = { bullets: [] }
    try { content = JSON.parse(contentStr) } catch { /* */ }

    // 页码颜色
    const pageNumBg = pageType === 'cover' ? PURPLE
      : pageType === 'summary' ? '#059669'
      : '#6B7280'

    return (
      <HTMLContainer>
        <div style={{
          width: w,
          height: h,
          background: '#FFFFFF',
          borderRadius: 8,
          boxShadow: '0 2px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
          pointerEvents: 'all',
        }}>
          {/* 页码圆标 */}
          <div style={{
            position: 'absolute',
            top: 10,
            left: 12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: pageNumBg,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}>
            {pageNumber}
          </div>

          {/* 页面类型标签 */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: pageType === 'cover' ? '#EDE9FE'
              : pageType === 'summary' ? '#D1FAE5'
              : '#F3F4F6',
            color: pageType === 'cover' ? PURPLE
              : pageType === 'summary' ? '#059669'
              : '#6B7280',
            fontWeight: 500,
          }}>
            {pageType === 'cover' ? '封面' : pageType === 'summary' ? '总结' : '内容'}
          </div>

          {/* 封面页布局 */}
          {pageType === 'cover' && (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 40px',
              background: `linear-gradient(135deg, ${PURPLE}08, ${PURPLE}15)`,
            }}>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1F2937',
                textAlign: 'center',
                lineHeight: 1.3,
                marginBottom: 12,
              }}>
                {pageTitle}
              </div>
              {content.subtitle && (
                <div style={{
                  fontSize: 14,
                  color: '#6B7280',
                  textAlign: 'center',
                }}>
                  {content.subtitle}
                </div>
              )}
              <div style={{
                marginTop: 16,
                fontSize: 12,
                color: '#9CA3AF',
              }}>
                {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          )}

          {/* 内容页布局 */}
          {pageType === 'content' && (
            <div style={{
              height: '100%',
              padding: '44px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* 标题 */}
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#1F2937',
                marginBottom: 14,
                paddingBottom: 8,
                borderBottom: `2px solid ${PURPLE}30`,
              }}>
                {pageTitle}
              </div>

              {/* 要点列表 */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {content.bullets.map((bullet, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 8,
                      fontSize: 13,
                      color: '#374151',
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: PURPLE,
                      flexShrink: 0,
                      marginTop: 5,
                    }} />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              {/* 来源标记 */}
              {content.sourceCardName && (
                <div style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  textAlign: 'right',
                  borderTop: '1px solid #F3F4F6',
                  paddingTop: 6,
                }}>
                  来源：{content.sourceCardName}
                </div>
              )}
            </div>
          )}

          {/* 总结页布局 */}
          {pageType === 'summary' && (
            <div style={{
              height: '100%',
              padding: '44px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(135deg, #05966908, #05966915)',
            }}>
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#1F2937',
                marginBottom: 14,
                paddingBottom: 8,
                borderBottom: '2px solid #05966930',
              }}>
                {pageTitle}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {content.bullets.map((bullet, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 10,
                      fontSize: 13,
                      color: '#374151',
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{
                      fontSize: 14,
                      flexShrink: 0,
                    }}>
                      ✓
                    </span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              {content.note && (
                <div style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  borderTop: '1px solid #D1FAE5',
                  paddingTop: 8,
                }}>
                  {content.note}
                </div>
              )}
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: PageCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }

  override canResize = () => true
  override isAspectRatioLocked = () => false

  override onResize = (shape: PageCardShape, info: any) => {
    return {
      props: {
        w: Math.max(320, shape.props.w * info.scaleX),
        h: Math.max(180, shape.props.h * info.scaleY),
      },
    }
  }
}
