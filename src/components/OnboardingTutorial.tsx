/**
 * OnboardingTutorial 组件
 * 新用户引导教程
 */

import React from 'react'
import { ONBOARDING_STEPS } from '../hooks/useOnboarding'

interface OnboardingTutorialProps {
  visible: boolean
  currentStep: number
  totalSteps: number
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onClose: () => void
}

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  visible,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  onClose,
}) => {
  if (!visible) return null

  const step = ONBOARDING_STEPS[currentStep]
  if (!step) return null

  const progress = ((currentStep + 1) / totalSteps) * 100

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
          padding: '32px',
          maxWidth: '500px',
          width: '90%',
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

        {/* 进度条 */}
        <div
          style={{
            width: '100%',
            height: '4px',
            background: '#e5e7eb',
            borderRadius: '2px',
            marginBottom: '24px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* 标题 */}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: '#1f2937',
          }}
        >
          {step.title}
        </h2>

        {/* 描述 */}
        <p
          style={{
            fontSize: '14px',
            color: '#6b7280',
            lineHeight: '1.6',
            marginBottom: '24px',
          }}
        >
          {step.description}
        </p>

        {/* 操作提示 */}
        {step.action && (
          <div
            style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '24px',
              fontSize: '13px',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>💡</span>
            <span>{step.action}</span>
          </div>
        )}

        {/* 步骤计数 */}
        <div
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            marginBottom: '20px',
          }}
        >
          第 {currentStep + 1} / {totalSteps} 步
        </div>

        {/* 按钮 */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onSkip}
            style={{
              padding: '8px 16px',
              border: '1px solid #e5e7eb',
              background: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'white'
            }}
          >
            跳过
          </button>

          {currentStep > 0 && (
            <button
              onClick={onPrevious}
              style={{
                padding: '8px 16px',
                border: '1px solid #e5e7eb',
                background: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'white'
              }}
            >
              上一步
            </button>
          )}

          <button
            onClick={onNext}
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
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.opacity = '0.9'
              e.currentTarget.style.transform = 'scale(1.02)'
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {currentStep === totalSteps - 1 ? '完成' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingTutorial
