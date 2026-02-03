/**
 * HelpDialog 组件
 * 帮助和快捷键参考
 */

import React, { useState } from 'react'
import { getShortcutText, HELP_TOPICS } from '../hooks/useOnboarding'

interface HelpDialogProps {
  visible: boolean
  onClose: () => void
  onStartTutorial?: () => void
}

const HelpDialog: React.FC<HelpDialogProps> = ({
  visible,
  onClose,
  onStartTutorial,
}) => {
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'faq'>('shortcuts')
  const shortcuts = getShortcutText()

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>

        {/* 头部 */}
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0,
            }}
          >
            帮助和快捷键
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#9ca3af',
            }}
          >
            ✕
          </button>
        </div>

        {/* 标签页 */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e5e7eb',
            padding: '0 32px',
          }}
        >
          <button
            onClick={() => setActiveTab('shortcuts')}
            style={{
              background: 'none',
              border: 'none',
              padding: '16px 0',
              fontSize: '14px',
              fontWeight: activeTab === 'shortcuts' ? '600' : '500',
              color: activeTab === 'shortcuts' ? '#667eea' : '#9ca3af',
              borderBottom: activeTab === 'shortcuts' ? '2px solid #667eea' : 'none',
              cursor: 'pointer',
              marginRight: '24px',
              transition: 'all 0.2s',
            }}
          >
            ⌨️ 快捷键
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            style={{
              background: 'none',
              border: 'none',
              padding: '16px 0',
              fontSize: '14px',
              fontWeight: activeTab === 'faq' ? '600' : '500',
              color: activeTab === 'faq' ? '#667eea' : '#9ca3af',
              borderBottom: activeTab === 'faq' ? '2px solid #667eea' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ❓ FAQ
          </button>
        </div>

        {/* 内容 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px 32px',
          }}
        >
          {activeTab === 'shortcuts' && (
            <div>
              <p
                style={{
                  color: '#6b7280',
                  marginBottom: '16px',
                  fontSize: '14px',
                }}
              >
                使用这些快捷键可以快速完成常见操作：
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                }}
              >
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        color: '#6b7280',
                      }}
                    >
                      {shortcut.description}
                    </span>
                    <kbd
                      style={{
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        color: '#1f2937',
                      }}
                    >
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div>
              {HELP_TOPICS.map((topic) => (
                <div
                  key={topic.category}
                  style={{
                    marginBottom: '24px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '12px',
                      paddingBottom: '8px',
                      borderBottom: '2px solid #e5e7eb',
                    }}
                  >
                    {topic.category}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {topic.items.map((item) => (
                      <div key={item.question}>
                        <p
                          style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#374151',
                            margin: '0 0 4px 0',
                          }}
                        >
                          Q: {item.question}
                        </p>
                        <p
                          style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            margin: '0',
                            marginLeft: '16px',
                          }}
                        >
                          A: {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div
          style={{
            padding: '16px 32px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          {onStartTutorial && (
            <button
              onClick={() => {
                onStartTutorial()
                onClose()
              }}
              style={{
                padding: '8px 16px',
                border: '1px solid #667eea',
                background: 'white',
                color: '#667eea',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'white'
              }}
            >
              📚 查看教程
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1'
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default HelpDialog
