/**
 * Agent 输入栏 - 底部浮动输入框，用于与 Agent 对话
 * 位于 BottomDialog 上方
 */
import React, { useState, useRef, useCallback } from 'react'

interface AgentInputBarProps {
  onSend: (message: string) => void
  isThinking: boolean
}

const AgentInputBar: React.FC<AgentInputBarProps> = ({ onSend, isThinking }) => {
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isThinking) return
    onSend(trimmed)
    setMessage('')
  }, [message, isThinking, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '6px 6px 6px 16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
        width: 480,
        maxWidth: 'calc(100vw - 32px)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Claude 图标 */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 10,
          color: '#fff',
          fontWeight: 700,
        }}
      >
        C
      </div>

      {/* 输入框 */}
      <input
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isThinking ? 'Agent 正在思考...' : '让 Agent 帮你分析画布内容...'}
        disabled={isThinking}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          color: '#111827',
          fontFamily: 'inherit',
          lineHeight: '32px',
        }}
      />

      {/* 状态指示器 / 发送按钮 */}
      {isThinking ? (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'rgba(167, 139, 250, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#A78BFA',
              animation: 'agentPulse 1.2s ease-in-out infinite',
            }}
          />
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: 'none',
            background: message.trim()
              ? 'linear-gradient(135deg, #38BDFF 0%, #7C3AED 100%)'
              : 'rgba(0, 0, 0, 0.06)',
            cursor: message.trim() ? 'pointer' : 'default',
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
              stroke={message.trim() ? '#FFFFFF' : '#9CA3AF'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* 脉冲动画 */}
      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}

export default React.memo(AgentInputBar)
