/**
 * 截图框选遮罩 - 在画布上方绘制矩形框选区域并截图
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'

interface ScreenshotOverlayProps {
  onCapture: (start: { x: number; y: number }, end: { x: number; y: number }) => void
  onCancel: () => void
}

const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({ onCapture, onCancel }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // ESC 退出
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const point = { x: e.clientX, y: e.clientY }
    setStart(point)
    setCurrent(point)
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    e.preventDefault()
    e.stopPropagation()
    setCurrent({ x: e.clientX, y: e.clientY })
  }, [isDragging])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    console.log('[ScreenshotOverlay] handlePointerUp triggered', { isDragging, start, clientX: e.clientX, clientY: e.clientY })

    // 释放 pointer capture
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch (err) {
      // ignore
    }

    if (!isDragging || !start) {
      console.log('[ScreenshotOverlay] Early return: not dragging or no start')
      return
    }

    e.preventDefault()
    e.stopPropagation()

    const end = { x: e.clientX, y: e.clientY }

    // 先保存 start 的值，因为后面会 reset state
    const captureStart = { ...start }
    const captureEnd = { ...end }

    // Reset state
    setIsDragging(false)
    setStart(null)
    setCurrent(null)

    // 忽略太小的框选（< 10px）
    const dx = Math.abs(captureEnd.x - captureStart.x)
    const dy = Math.abs(captureEnd.y - captureStart.y)
    console.log('[ScreenshotOverlay] Selection size:', { dx, dy, start: captureStart, end: captureEnd })

    if (dx < 10 || dy < 10) {
      console.log('[ScreenshotOverlay] Selection too small, canceling')
      return
    }

    console.log('[ScreenshotOverlay] Calling onCapture with:', captureStart, captureEnd)
    // 使用 setTimeout 确保在当前事件循环结束后调用，避免 React 批处理问题
    setTimeout(() => {
      console.log('[ScreenshotOverlay] onCapture executing now')
      onCapture(captureStart, captureEnd)
    }, 0)
  }, [isDragging, start, onCapture])

  // 处理 pointer cancel（例如被其他应用打断）
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    console.log('[ScreenshotOverlay] handlePointerCancel')
    setIsDragging(false)
    setStart(null)
    setCurrent(null)
  }, [])

  // 计算矩形
  const rect = start && current ? {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  } : null

  return (
    <div
      ref={overlayRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: 'crosshair',
        zIndex: 3000,
        pointerEvents: 'auto',
        background: 'rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* 顶部提示文字 */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 20px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        拖拽框选截图区域 · ESC 取消
      </div>

      {/* 选区矩形 */}
      {rect && rect.w > 0 && rect.h > 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              background: 'rgba(56, 189, 255, 0.12)',
              border: '2px solid rgba(56, 189, 255, 0.6)',
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
          {/* 尺寸标注 */}
          <div
            style={{
              position: 'absolute',
              left: rect.x + rect.w / 2,
              top: rect.y + rect.h + 8,
              transform: 'translateX(-50%)',
              padding: '2px 8px',
              background: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {Math.round(rect.w)} × {Math.round(rect.h)} px
          </div>
        </>
      )}
    </div>
  )
}

export default React.memo(ScreenshotOverlay)
