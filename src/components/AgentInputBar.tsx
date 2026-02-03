/**
 * Agent 输入栏 - 底部浮动输入框，用于与 Agent 对话
 * 支持多任务并行状态显示，状态文字平滑过渡不闪烁
 * 支持框选上下文 badge、强提示浮层
 */
import React, { useState, useRef, useCallback, useMemo } from 'react'
import type { AgentPrompt } from '../types/agent'
import type { AgentMode } from '../hooks/useAgentOrchestrator'
import { isImageCommand } from '../utils/imageCommandParser'

/** 单个任务的状态 */
export interface AgentTask {
  id: string
  label: string        // 任务简称，如 "收集竞品"
  statusText: string   // 当前状态，如 "正在搜索..."
  progress?: number    // 0-1，可选进度
}

/** 选中上下文信息 */
export interface SelectionContext {
  productCardCount: number
  /** 选中的总 shape 数量（所有类型） */
  totalCount: number
}

interface AgentInputBarProps {
  onSend: (message: string) => void
  tasks: AgentTask[]   // 当前执行中的任务列表
  selectionContext?: SelectionContext
  /** 选中单张卡片时的信息，用于"卡片指令模式" */
  targetCard?: { name: string } | null
  activePrompt?: AgentPrompt | null
  onPromptSelect?: (option: string) => void
  onPromptDismiss?: () => void
  agentMode?: AgentMode
  onModeChange?: (mode: AgentMode) => void
  /** 是否已配置 API Key（用于模式指示器显示） */
  hasApiKey?: boolean
  /** 截图预览 base64 data URL */
  screenshotPreview?: string | null
  /** 清除截图 */
  onClearScreenshot?: () => void
  /** 进入截图模式 */
  onScreenshotMode?: () => void
}

const AgentInputBar: React.FC<AgentInputBarProps> = ({
  onSend,
  tasks,
  selectionContext,
  targetCard,
  activePrompt,
  onPromptSelect,
  onPromptDismiss,
  agentMode = 'mock',
  onModeChange,
  hasApiKey = false,
  screenshotPreview,
  onClearScreenshot,
  onScreenshotMode,
}) => {
  const [message, setMessage] = useState('')
  const [screenshotHover, setScreenshotHover] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendLockRef = useRef(false)

  const isThinking = tasks.length > 0

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if ((!trimmed && !screenshotPreview) || sendLockRef.current) return
    sendLockRef.current = true
    onSend(trimmed || '请分析这张截图')
    setMessage('')
    // 300ms 防抖，防止连点
    setTimeout(() => { sendLockRef.current = false }, 300)
  }, [message, onSend, screenshotPreview])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // isComposing: 中文/日文输入法正在组字，Enter 是确认候选词，不发送
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const hasSelectionContext = selectionContext && selectionContext.totalCount > 0

  // 检测是否正在输入生图指令
  const showImageHint = useMemo(() => isImageCommand(message), [message])

  return (
    <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 520, maxWidth: 'calc(100vw - 32px)' }}>

      {/* 强提示浮层 */}
      {activePrompt && (
        <div
          style={{
            width: '100%',
            background: '#FFFFFF',
            borderRadius: 14,
            padding: '16px 18px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            animation: 'promptSlideUp 200ms ease-out',
          }}
        >
          {/* 标题行 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              {(() => {
                const parts = activePrompt.question.split('？')
                const title = parts[0] + '？'
                const subtitle = parts.slice(1).join('？').trim()
                return (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', lineHeight: '20px' }}>
                      {title}
                    </div>
                    {subtitle && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {subtitle}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            {/* 关闭按钮 */}
            <button
              onClick={onPromptDismiss}
              style={{
                width: 20, height: 20, borderRadius: 6,
                border: 'none', background: 'transparent',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#9CA3AF', flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {/* 选项按钮 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {activePrompt.options.map((option) => (
              <button
                key={option}
                onClick={() => onPromptSelect?.(option)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#374151',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(167,139,250,0.08)'
                  e.currentTarget.style.borderColor = '#A78BFA'
                  e.currentTarget.style.color = '#7C3AED'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF'
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'
                  e.currentTarget.style.color = '#374151'
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* /img 命令提示 */}
      {showImageHint && (
        <div style={{
          width: '100%',
          padding: '8px 14px',
          background: 'rgba(30, 30, 30, 0.85)',
          borderRadius: 10,
          fontSize: 12,
          color: 'rgba(255,255,255,0.8)',
          fontFamily: 'SF Mono, Menlo, monospace',
          lineHeight: 1.6,
          backdropFilter: 'blur(8px)',
          animation: 'promptSlideUp 150ms ease-out',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
            格式：/img [--model nano] [--ratio 16:9] [--size 2K] 描述文字
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>
            模型：<span style={{ color: '#A78BFA' }}>nano</span>(默认) | <span style={{ color: '#A78BFA' }}>nanopro</span> | <span style={{ color: '#A78BFA' }}>seedream4.5</span> | <span style={{ color: '#A78BFA' }}>seedream4.0</span>
          </div>
        </div>
      )}

      {/* 任务状态列表 */}
      {tasks.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: '100%',
          padding: '0 8px',
        }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                fontSize: 12,
                color: '#6B7280',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 14px',
                background: 'rgba(255,255,255,0.92)',
                borderRadius: 10,
                boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {/* 呼吸指示点 */}
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#A78BFA',
                animation: 'agentBreath 2s ease-in-out infinite',
                flexShrink: 0,
              }} />
              {/* 任务名 */}
              <span style={{
                fontWeight: 600, color: '#374151',
                flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {task.label}
              </span>
              {/* 进度条（可选） */}
              {task.progress != null && task.progress > 0 && (
                <div style={{
                  width: 48, height: 3, borderRadius: 2,
                  background: 'rgba(0,0,0,0.06)',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.round(task.progress * 100)}%`,
                    height: '100%',
                    background: '#A78BFA',
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 输入栏 - 始终可输入 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          width: '100%',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* 截图预览 */}
        {screenshotPreview && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px 0',
            position: 'relative',
          }}>
            {/* hover 大图预览 — 放在外层避免被 overflow:hidden 裁剪 */}
            {screenshotHover && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 16,
                  background: '#FFFFFF',
                  borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
                  padding: 4,
                  zIndex: 10,
                  animation: 'promptSlideUp 150ms ease-out',
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={screenshotPreview}
                  alt="截图预览大图"
                  style={{
                    maxWidth: 320,
                    maxHeight: 220,
                    display: 'block',
                    borderRadius: 7,
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}
            <div
              style={{
                position: 'relative',
                height: 40,
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid rgba(56, 189, 255, 0.3)',
                flexShrink: 0,
                cursor: 'pointer',
              }}
              onMouseEnter={() => setScreenshotHover(true)}
              onMouseLeave={() => setScreenshotHover(false)}
            >
              <img
                src={screenshotPreview}
                alt="截图预览"
                style={{ height: 40, display: 'block', borderRadius: 5 }}
              />
            </div>
            <span style={{
              fontSize: 12,
              color: '#38BDFF',
              fontWeight: 500,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}>
              已截图
            </span>
            <button
              onClick={onClearScreenshot}
              style={{
                width: 18, height: 18, borderRadius: 9,
                border: 'none',
                background: 'rgba(0,0,0,0.08)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#9CA3AF', flexShrink: 0,
                padding: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)' }}
              title="清除截图"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* 上方 badges 行：仅在有 badge 时显示 */}
        {(onModeChange || hasSelectionContext || targetCard) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px 0',
            flexWrap: 'wrap',
          }}>
            {/* 模式切换 + 资源消耗指示 */}
            {onModeChange && (() => {
              const isReal = agentMode === 'real'
              // real 模式下区分 API 直连 vs 本地 Server
              const modeLabel = isReal
                ? (hasApiKey ? 'API 直连' : '本地 Server')
                : '演示模式'
              const costHint = isReal
                ? (hasApiKey ? '消耗 Token' : '需启动 Server')
                : '无消耗'
              const dotColor = isReal
                ? (hasApiKey ? '#059669' : '#D97706')
                : '#9CA3AF'
              const borderColor = isReal
                ? (hasApiKey ? 'rgba(52,211,153,0.3)' : 'rgba(217,119,6,0.3)')
                : 'rgba(0,0,0,0.08)'
              const bgColor = isReal
                ? (hasApiKey ? 'rgba(52,211,153,0.08)' : 'rgba(217,119,6,0.08)')
                : 'rgba(0,0,0,0.03)'
              const textColor = isReal
                ? (hasApiKey ? '#059669' : '#D97706')
                : '#9CA3AF'

              return (
                <button
                  onClick={() => onModeChange(isReal ? 'mock' : 'real')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 10px',
                    borderRadius: 12,
                    border: '1px solid',
                    borderColor,
                    background: bgColor,
                    color: textColor,
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                  }}
                  title={`当前：${modeLabel}（${costHint}）\n点击切换模式`}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                  }} />
                  <span>{modeLabel}</span>
                  <span style={{ color: isReal ? textColor : '#BCBCBC', fontWeight: 400, fontSize: 10 }}>
                    {costHint}
                  </span>
                </button>
              )
            })()}

            {/* 选中上下文 badge：卡片指令模式 or 通用多选 */}
            {targetCard ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 10px',
                borderRadius: 12,
                background: 'rgba(124,58,237,0.12)',
                color: '#7C3AED',
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}>
                {`✏️ 修改「${targetCard.name}」`}
              </span>
            ) : hasSelectionContext ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 10px',
                borderRadius: 12,
                background: 'rgba(167,139,250,0.1)',
                color: '#7C3AED',
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}>
                {`基于选中的 ${selectionContext.totalCount} 个对象`}
              </span>
            ) : null}
          </div>
        )}

        {/* 下方输入行 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 6px 6px 16px',
        }}>
          {/* Claude 图标 */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: isThinking
                ? 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)'
                : 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 10,
              color: '#fff',
              fontWeight: 700,
              transition: 'background 0.3s ease',
            }}
          >
            C
          </div>

          {/* 截图按钮 */}
          {onScreenshotMode && (
            <button
              onClick={onScreenshotMode}
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                border: 'none',
                background: screenshotPreview ? 'rgba(56, 189, 255, 0.12)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                padding: 0,
                color: screenshotPreview ? '#38BDFF' : '#9CA3AF',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 255, 0.12)'
                e.currentTarget.style.color = '#38BDFF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = screenshotPreview ? 'rgba(56, 189, 255, 0.12)' : 'transparent'
                e.currentTarget.style.color = screenshotPreview ? '#38BDFF' : '#9CA3AF'
              }}
              title="框选截图"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1.5" y="3" width="11" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="7" cy="7.25" r="2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4.5 3V2.5C4.5 2.22386 4.72386 2 5 2H9C9.27614 2 9.5 2.22386 9.5 2.5V3" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          )}

          {/* 输入框 - 始终可用 */}
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isThinking ? '继续输入新任务...' : screenshotPreview ? '描述你想要的修改...' : targetCard ? `对「${targetCard.name}」发指令...` : '输入指令，或 /img 生成图片...'}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: '#111827',
              fontFamily: 'inherit',
              lineHeight: '32px',
            }}
          />

          {/* 发送按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!message.trim() && !screenshotPreview}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: 'none',
              background: (message.trim() || screenshotPreview)
                ? 'linear-gradient(135deg, #38BDFF 0%, #7C3AED 100%)'
                : 'rgba(0, 0, 0, 0.06)',
              cursor: (message.trim() || screenshotPreview) ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9"
                stroke={(message.trim() || screenshotPreview) ? '#FFFFFF' : '#9CA3AF'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* 动画 */}
        <style>{`
          @keyframes agentBreath {
            0%, 100% { opacity: 0.3; transform: scale(0.85); }
            50% { opacity: 0.8; transform: scale(1.1); }
          }
          @keyframes promptSlideUp {
            from { transform: translateY(8px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

export default React.memo(AgentInputBar)
