import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useThemedStyles } from '../hooks/useThemedStyles'

interface ApiKeyDialogProps {
  open: boolean
  onClose: () => void
  onSave: (hasKey: boolean) => void
}

const STORAGE_KEY = 'anthropic_api_key'
const STORAGE_TS_KEY = 'anthropic_api_key_ts'
const NEBULA_STORAGE_KEY = 'nebula_api_key'
const NEBULA_STORAGE_TS_KEY = 'nebula_api_key_ts'
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 天

/** 从 localStorage 读取 Anthropic API Key，过期自动清除 */
export function getApiKey(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY)
    const ts = localStorage.getItem(STORAGE_TS_KEY)
    if (!key) return null
    if (ts) {
      const elapsed = Date.now() - parseInt(ts, 10)
      if (elapsed > EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(STORAGE_TS_KEY)
        return null
      }
    }
    return key
  } catch {
    return null
  }
}

/** 从 localStorage 读取 Nebula API Key，过期自动清除 */
export function getNebulaApiKey(): string | null {
  try {
    const key = localStorage.getItem(NEBULA_STORAGE_KEY)
    const ts = localStorage.getItem(NEBULA_STORAGE_TS_KEY)
    if (!key) return null
    if (ts) {
      const elapsed = Date.now() - parseInt(ts, 10)
      if (elapsed > EXPIRY_MS) {
        localStorage.removeItem(NEBULA_STORAGE_KEY)
        localStorage.removeItem(NEBULA_STORAGE_TS_KEY)
        return null
      }
    }
    return key
  } catch {
    return null
  }
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ open, onClose, onSave }) => {
  const { isLight } = useThemedStyles()
  const [inputValue, setInputValue] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [nebulaInputValue, setNebulaInputValue] = useState('')
  const [hasNebulaKey, setHasNebulaKey] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const existing = getApiKey()
      setHasKey(!!existing)
      setInputValue('')
      const existingNebula = getNebulaApiKey()
      setHasNebulaKey(!!existingNebula)
      setNebulaInputValue('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSave = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(STORAGE_KEY, trimmed)
      localStorage.setItem(STORAGE_TS_KEY, String(Date.now()))
    } catch { /* localStorage full or disabled */ }
    setHasKey(true)
    setInputValue('')
    onSave(true)
    onClose()
  }, [inputValue, onSave, onClose])

  const handleClear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_TS_KEY)
    } catch { /* ignore */ }
    setHasKey(false)
    setInputValue('')
    onSave(false)
  }, [onSave])

  const handleNebulaSave = useCallback(() => {
    const trimmed = nebulaInputValue.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(NEBULA_STORAGE_KEY, trimmed)
      localStorage.setItem(NEBULA_STORAGE_TS_KEY, String(Date.now()))
    } catch { /* localStorage full or disabled */ }
    setHasNebulaKey(true)
    setNebulaInputValue('')
  }, [nebulaInputValue])

  const handleNebulaClear = useCallback(() => {
    try {
      localStorage.removeItem(NEBULA_STORAGE_KEY)
      localStorage.removeItem(NEBULA_STORAGE_TS_KEY)
    } catch { /* ignore */ }
    setHasNebulaKey(false)
    setNebulaInputValue('')
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onClose()
  }, [handleSave, onClose])

  const handleNebulaKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNebulaSave()
    if (e.key === 'Escape') onClose()
  }, [handleNebulaSave, onClose])

  if (!open) return null

  const bg = isLight ? '#FFFFFF' : '#2A2A2A'
  const textPrimary = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)'
  const textSecondary = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'
  const border = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'
  const inputBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 20000,
        }}
      />
      {/* Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: bg,
          borderRadius: 16,
          boxShadow: isLight
            ? '0 8px 40px rgba(0,0,0,0.15)'
            : '0 8px 40px rgba(0,0,0,0.5)',
          border: `1px solid ${border}`,
          padding: 24,
          zIndex: 20001,
          fontFamily: 'SF Pro Display, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: textPrimary }}>API 配置</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5L13 13M13 5L5 13" stroke={textSecondary} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* === Anthropic API Key Section === */}
        <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>
          Anthropic API Key
        </div>

        {/* Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          fontSize: 13,
          color: hasKey ? '#34C759' : textSecondary,
        }}>
          {hasKey ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6 10L11 4" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              已配置
            </>
          ) : '未配置'}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="password"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="sk-ant-..."
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            color: textPrimary,
            background: inputBg,
            border: `1px solid ${border}`,
            borderRadius: 8,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'SF Mono, Menlo, monospace',
          }}
        />

        {/* Hint */}
        <p style={{
          fontSize: 12,
          color: textSecondary,
          margin: '10px 0 16px',
          lineHeight: 1.5,
        }}>
          用于 Agent 对话（Claude），7 天后自动清除。
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {hasKey && (
            <button
              onClick={handleClear}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: '#FF3B30',
                background: 'transparent',
                border: `1px solid ${border}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(255,59,48,0.06)' : 'rgba(255,59,48,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              清除
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!inputValue.trim()}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 500,
              color: '#FFFFFF',
              background: inputValue.trim() ? '#007AFF' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'),
              border: 'none',
              borderRadius: 8,
              cursor: inputValue.trim() ? 'pointer' : 'default',
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { if (inputValue.trim()) e.currentTarget.style.background = '#0066DD' }}
            onMouseLeave={e => { if (inputValue.trim()) e.currentTarget.style.background = '#007AFF' }}
          >
            保存
          </button>
        </div>

        {/* === Divider === */}
        <div style={{
          height: 1,
          background: border,
          margin: '20px 0',
        }} />

        {/* === Nebula API Key Section === */}
        <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>
          生图 API Key (Nebula)
        </div>

        {/* Nebula Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          fontSize: 13,
          color: hasNebulaKey ? '#34C759' : textSecondary,
        }}>
          {hasNebulaKey ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6 10L11 4" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              已配置
            </>
          ) : '未配置'}
        </div>

        {/* Nebula Input */}
        <input
          type="password"
          value={nebulaInputValue}
          onChange={e => setNebulaInputValue(e.target.value)}
          onKeyDown={handleNebulaKeyDown}
          placeholder="输入 Nebula API Key..."
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            color: textPrimary,
            background: inputBg,
            border: `1px solid ${border}`,
            borderRadius: 8,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'SF Mono, Menlo, monospace',
          }}
        />

        {/* Nebula Hint */}
        <p style={{
          fontSize: 12,
          color: textSecondary,
          margin: '10px 0 16px',
          lineHeight: 1.5,
        }}>
          用于 AI 图片生成（Gemini / Seedream 模型），7 天后自动清除。
        </p>

        {/* Nebula Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {hasNebulaKey && (
            <button
              onClick={handleNebulaClear}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: '#FF3B30',
                background: 'transparent',
                border: `1px solid ${border}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(255,59,48,0.06)' : 'rgba(255,59,48,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              清除
            </button>
          )}
          <button
            onClick={handleNebulaSave}
            disabled={!nebulaInputValue.trim()}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 500,
              color: '#FFFFFF',
              background: nebulaInputValue.trim() ? '#007AFF' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'),
              border: 'none',
              borderRadius: 8,
              cursor: nebulaInputValue.trim() ? 'pointer' : 'default',
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { if (nebulaInputValue.trim()) e.currentTarget.style.background = '#0066DD' }}
            onMouseLeave={e => { if (nebulaInputValue.trim()) e.currentTarget.style.background = '#007AFF' }}
          >
            保存
          </button>
        </div>
      </div>
    </>
  )
}

export default React.memo(ApiKeyDialog)
