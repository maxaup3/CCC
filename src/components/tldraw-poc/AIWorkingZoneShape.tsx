/**
 * AIWorkingZoneShape - tldraw 原生自定义形状
 * 替代原来的 fixed overlay，直接活在画布上
 * - 虚线蚂蚁线边框 + 四角 L 形括号
 * - 内部扫描线动画
 * - 左上角状态标签药丸
 * - 可被拖动，随画布缩放/平移
 * - pointerEvents: auto（可拖动），但不可被选中编辑
 */
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'
import { useEffect, useState, useRef } from 'react'

export type AIWorkingZoneShape = TLBaseShape<
  'ai-working-zone',
  {
    w: number
    h: number
    statusText: string
    status: 'working' | 'completing' | 'done'
  }
>

export class AIWorkingZoneShapeUtil extends ShapeUtil<AIWorkingZoneShape> {
  static override type = 'ai-working-zone' as const

  getDefaultProps() {
    return {
      w: 400,
      h: 300,
      statusText: '正在分析任务...',
      status: 'working' as const,
    }
  }

  // 返回空几何体（0x0），使其无法被点选/框选
  getGeometry(shape: AIWorkingZoneShape): Geometry2d {
    return new Rectangle2d({
      width: 0,
      height: 0,
      isFilled: false,
    })
  }

  // 禁止所有交互
  override canBind = () => false
  override canEdit = () => false
  override canSnap = () => false
  override canResize = () => false
  override canCrop = () => false
  override canDropShapes = () => false
  override hideRotateHandle = () => true
  override hideSelectionBoundsBg = () => true
  override hideSelectionBoundsFg = () => true


  component(shape: AIWorkingZoneShape) {
    const { w, h, statusText, status } = shape.props

    return (
      <HTMLContainer>
        <AIWorkingZoneContent w={w} h={h} statusText={statusText} status={status} />
      </HTMLContainer>
    )
  }

  indicator(shape: AIWorkingZoneShape) {
    return null
  }
}

/** 内部渲染组件（带动画） */
function AIWorkingZoneContent({
  w,
  h,
  statusText,
  status,
}: {
  w: number
  h: number
  statusText: string
  status: 'working' | 'completing' | 'done'
}) {
  const isCompleting = status === 'completing'
  const isDone = status === 'done'

  // Colors
  const borderColor = isCompleting
    ? 'rgba(52,211,153,0.35)'
    : 'rgba(167,139,250,0.35)'
  const fillColor = isCompleting
    ? 'rgba(52,211,153,0.03)'
    : 'rgba(167,139,250,0.03)'
  const scanColor = isCompleting
    ? 'rgba(52,211,153,0.15)'
    : 'rgba(167,139,250,0.15)'
  const dotColor = isCompleting ? '#34D399' : '#A78BFA'

  const r = 12
  const cornerLen = 20
  const strokeW = 1.5

  // 生成唯一 ID 避免多个实例 SVG id 冲突
  const idRef = useRef(`wz-${Math.random().toString(36).slice(2, 8)}`)
  const uid = idRef.current

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        pointerEvents: 'none',
        opacity: isDone ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: -2,
          top: -2,
          width: w + 4,
          height: h + 4,
          overflow: 'visible',
        }}
      >
        {/* Background fill */}
        <rect x={2} y={2} width={w} height={h} rx={r} ry={r} fill={fillColor} />

        {/* Marching ants dashed border */}
        <rect
          x={2} y={2} width={w} height={h} rx={r} ry={r}
          fill="none" stroke={borderColor} strokeWidth={strokeW}
          strokeDasharray="8 4"
          style={{ transition: 'stroke 0.5s ease', animation: 'marchingAnts 8s linear infinite' }}
        />

        {/* Four corner L-brackets */}
        <path
          d={`M ${2} ${2 + cornerLen} L ${2} ${2 + r} Q ${2} ${2} ${2 + r} ${2} L ${2 + cornerLen} ${2}`}
          fill="none" stroke={borderColor} strokeWidth={2} strokeLinecap="round"
          style={{ transition: 'stroke 0.5s ease' }}
        />
        <path
          d={`M ${w + 2 - cornerLen} ${2} L ${w + 2 - r} ${2} Q ${w + 2} ${2} ${w + 2} ${2 + r} L ${w + 2} ${2 + cornerLen}`}
          fill="none" stroke={borderColor} strokeWidth={2} strokeLinecap="round"
          style={{ transition: 'stroke 0.5s ease' }}
        />
        <path
          d={`M ${2} ${h + 2 - cornerLen} L ${2} ${h + 2 - r} Q ${2} ${h + 2} ${2 + r} ${h + 2} L ${2 + cornerLen} ${h + 2}`}
          fill="none" stroke={borderColor} strokeWidth={2} strokeLinecap="round"
          style={{ transition: 'stroke 0.5s ease' }}
        />
        <path
          d={`M ${w + 2 - cornerLen} ${h + 2} L ${w + 2 - r} ${h + 2} Q ${w + 2} ${h + 2} ${w + 2} ${h + 2 - r} L ${w + 2} ${h + 2 - cornerLen}`}
          fill="none" stroke={borderColor} strokeWidth={2} strokeLinecap="round"
          style={{ transition: 'stroke 0.5s ease' }}
        />

        {/* Scan line */}
        {!isCompleting && !isDone && (
          <g>
            <defs>
              <linearGradient id={`${uid}-scanGrad`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={scanColor} stopOpacity="0" />
                <stop offset="30%" stopColor={scanColor} stopOpacity="0.6" />
                <stop offset="50%" stopColor={scanColor} stopOpacity="1" />
                <stop offset="70%" stopColor={scanColor} stopOpacity="0.6" />
                <stop offset="100%" stopColor={scanColor} stopOpacity="0" />
              </linearGradient>
              <clipPath id={`${uid}-zoneClip`}>
                <rect x={2} y={2} width={w} height={h} rx={r} ry={r} />
              </clipPath>
            </defs>
            <rect
              x={2} y={2} width={w} height={3}
              fill={`url(#${uid}-scanGrad)`}
              clipPath={`url(#${uid}-zoneClip)`}
              style={{
                animation: `scanLine-${uid} 3s ease-in-out infinite`,
                transformOrigin: `${w / 2 + 2}px ${h / 2 + 2}px`,
              }}
            />
          </g>
        )}
      </svg>

      {/* Status pill label */}
      {statusText && !isDone && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: -14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px 3px 8px',
            background: isCompleting ? 'rgba(236,253,245,0.9)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: 10,
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
            fontSize: 11,
            fontWeight: 500,
            color: '#374151',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            whiteSpace: 'nowrap',
            transition: 'background 0.5s ease',
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: dotColor, flexShrink: 0,
              animation: 'zonePulse 1.5s ease-in-out infinite',
              transition: 'background 0.5s ease',
            }}
          />
          <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isCompleting ? '✓ 完成' : statusText}
          </span>
        </div>
      )}

      {/* CSS Animations (scoped) */}
      <style>{`
        @keyframes marchingAnts {
          to { stroke-dashoffset: -48; }
        }
        @keyframes scanLine-${uid} {
          0% { transform: translateY(0); }
          100% { transform: translateY(${h}px); }
        }
        @keyframes zonePulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
