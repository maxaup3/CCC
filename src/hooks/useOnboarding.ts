/**
 * useOnboarding Hook
 * 管理新用户引导、教程和帮助系统
 */

import { useState, useCallback, useEffect } from 'react'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  target?: string // 高亮的元素选择器
  action?: string // 建议的操作
  skipText?: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到无限画布',
    description: '这是一个强大的 AI 驱动的设计工具。您可以在这个无限的画布上创建、编辑和分享内容。',
    action: '点击"下一步"继续',
  },
  {
    id: 'canvas-basics',
    title: '画布基础',
    description: '您可以在画布上自由移动、缩放和编辑元素。使用鼠标滚轮缩放，拖动移动画布。',
    target: '[data-testid="tldraw-canvas"]',
    action: '尝试缩放和移动',
  },
  {
    id: 'ai-input',
    title: 'AI 助手',
    description: '在底部的输入框中输入指令，AI 会帮助您生成内容、创建表格、分析数据等。',
    target: '[data-testid="ai-input-bar"]',
    action: '点击输入框开始',
  },
  {
    id: 'menu-bar',
    title: '工具栏',
    description: '右上角的菜单栏提供撤销、重做、新建项目等功能。⌘Z 快速撤销，⌘Shift+Z 快速重做。',
    target: '[data-testid="top-bar"]',
    action: '了解更多快捷键',
  },
  {
    id: 'keyboard-shortcuts',
    title: '键盘快捷键',
    description: '记住这些快捷键可以大大提高工作效率：⌘Z 撤销、⌘D 复制、Delete 删除。',
    action: '查看完整快捷键列表',
  },
]

export const KEYBOARD_SHORTCUTS = [
  { key: '⌘ Z', description: '撤销' },
  { key: '⌘ ⇧ Z', description: '重做' },
  { key: '⌘ Y', description: '重做（备选）' },
  { key: '⌘ D', description: '复制' },
  { key: 'Delete', description: '删除' },
  { key: '⌘ +', description: '放大' },
  { key: '⌘ −', description: '缩小' },
]

export const HELP_TOPICS = [
  {
    category: '基础操作',
    items: [
      { question: '如何创建新项目？', answer: '在主菜单中点击"新建项目"，或从首页创建。' },
      { question: '如何删除元素？', answer: '选中元素后按 Delete 或 Backspace 键。' },
      { question: '如何撤销操作？', answer: '按 ⌘Z（Mac）或 Ctrl+Z（Windows）。' },
    ],
  },
  {
    category: 'AI 功能',
    items: [
      { question: '如何使用 AI？', answer: '在底部输入框输入指令，AI 会根据您的要求生成内容。' },
      { question: '支持哪些 AI 功能？', answer: '支持内容生成、表格创建、数据分析、代码生成等。' },
      { question: '如何修改 AI 生成的内容？', answer: '点击生成的卡片进行编辑，或直接在画布上修改。' },
    ],
  },
  {
    category: '项目管理',
    items: [
      { question: '如何保存项目？', answer: '项目会自动保存到浏览器本地存储，无需手动保存。' },
      { question: '如何分享项目？', answer: '使用导出功能将项目导出为 JSON，然后分享文件。' },
      { question: '如何删除项目？', answer: '在项目列表中点击删除按钮，确认后删除。' },
    ],
  },
]

/**
 * useOnboarding Hook
 */
export function useOnboarding() {
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    try {
      return localStorage?.getItem?.('canvas-tutorial-seen') === 'true'
    } catch {
      return false
    }
  })

  const [currentStep, setCurrentStep] = useState(0)
  const [showTutorial, setShowTutorial] = useState(!hasSeenTutorial)
  const [showHelp, setShowHelp] = useState(false)

  const markTutorialAsSeen = useCallback(() => {
    try {
      localStorage?.setItem?.('canvas-tutorial-seen', 'true')
      setHasSeenTutorial(true)
      setShowTutorial(false)
    } catch {
      // Silently fail if localStorage is not available
    }
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      markTutorialAsSeen()
    }
  }, [currentStep, markTutorialAsSeen])

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const skipTutorial = useCallback(() => {
    markTutorialAsSeen()
  }, [markTutorialAsSeen])

  const restartTutorial = useCallback(() => {
    setCurrentStep(0)
    setShowTutorial(true)
    try {
      localStorage?.setItem?.('canvas-tutorial-seen', 'false')
      setHasSeenTutorial(false)
    } catch {
      // Silently fail if localStorage is not available
    }
  }, [])

  return {
    hasSeenTutorial,
    currentStep,
    showTutorial,
    setShowTutorial,
    showHelp,
    setShowHelp,
    nextStep,
    previousStep,
    skipTutorial,
    restartTutorial,
    currentStepData: ONBOARDING_STEPS[currentStep],
    totalSteps: ONBOARDING_STEPS.length,
  }
}

/**
 * 获取快捷键显示文本（根据操作系统调整）
 */
export function getShortcutText(): typeof KEYBOARD_SHORTCUTS {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)

  if (isMac) {
    return KEYBOARD_SHORTCUTS
  }

  // Windows/Linux 快捷键
  return [
    { key: 'Ctrl + Z', description: '撤销' },
    { key: 'Ctrl + Shift + Z', description: '重做' },
    { key: 'Ctrl + Y', description: '重做（备选）' },
    { key: 'Ctrl + D', description: '复制' },
    { key: 'Delete', description: '删除' },
    { key: 'Ctrl + +', description: '放大' },
    { key: 'Ctrl + −', description: '缩小' },
  ]
}
