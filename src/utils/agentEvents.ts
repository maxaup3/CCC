/**
 * 简单事件发射器
 * 用于 Shape 内部按钮 → Hook 的通信
 * 避免在 tldraw ShapeUtil 中直接调用 React 状态
 */

type EventHandler = (...args: any[]) => void

class AgentEventEmitter {
  private listeners = new Map<string, Set<EventHandler>>()

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(handler => handler(...args))
  }
}

export const agentEvents = new AgentEventEmitter()

// 事件名常量
export const AGENT_EVENTS = {
  /** 大纲卡片 → 开始生成页面 */
  GENERATE_PAGES: 'generate-pages',
  /** 大纲卡片 → 调整大纲 */
  ADJUST_OUTLINE: 'adjust-outline',
  /** Comment → 操作按钮点击 */
  COMMENT_ACTION: 'comment-action',
  /** 文档上传 → 自动总结 */
  SUMMARIZE_DOC: 'summarize-doc',
  /** 用户对某张卡片发起修改意见 */
  USER_COMMENT_ON_SHAPE: 'user-comment-on-shape',
} as const
