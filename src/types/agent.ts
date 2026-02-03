/**
 * Agent 类型定义
 * 用于描述 Agent 在画布上的行为和状态
 */

// Agent 消息角色
export type AgentRole = 'user' | 'agent'

// Agent 动作类型
export type AgentActionType =
  | 'thinking'       // 思考推理
  | 'tool_call'      // 工具调用
  | 'add_node'       // 添加画布节点（派生内容）
  | 'comment'        // 留下评论/批注
  | 'done'           // 完成

// 工具调用定义
export interface AgentToolCall {
  name: string          // 工具名，如 get_canvas_tree, add_derived
  args: Record<string, any>
  result?: string       // 工具返回结果摘要
}

// 单步 Agent 动作
export interface AgentAction {
  id: string
  type: AgentActionType
  content: string           // 显示内容（思考文本/工具描述/评论内容）
  title?: string            // 卡片标题（type=add_node时使用）
  toolCall?: AgentToolCall  // 工具调用详情（type=tool_call时）
  timestamp: number
  // 画布操作相关
  canvasNodeId?: string     // 关联的画布节点ID
  position?: { x: number; y: number } // 放置位置
}

// 一轮 Agent 回复（包含多个 action）
export interface AgentTurn {
  id: string
  role: AgentRole
  content: string           // 用户消息 或 Agent 最终回复摘要
  actions: AgentAction[]    // Agent 的行为序列（role=agent时）
  timestamp: number
}

// 整个 Agent 会话
export interface AgentSession {
  id: string
  turns: AgentTurn[]
  status: 'idle' | 'thinking' | 'executing' | 'done'
  currentActionIndex: number  // 当前正在执行的 action 索引（用于动画）
}

// Agent 卡片在画布上的形状属性
export interface AgentCardProps {
  w: number
  h: number
  cardType: AgentActionType
  title: string
  content: string
  // 思考卡片
  thinkingSteps?: string[]
  // 工具调用卡片
  toolName?: string
  toolArgs?: string       // JSON string
  toolResult?: string
  // 评论卡片
  commentTarget?: string  // 关联的节点ID
  // 状态
  isStreaming?: boolean    // 是否正在流式输出
  agentTurnId?: string     // 所属的 turn ID
  timestamp?: number
}

/** 强提示：Agent 需要用户决策 */
export interface AgentPrompt {
  id: string
  question: string      // "这份 PPT 给谁看？"
  options: string[]      // ["给领导汇报", "团队内部分享", "客户"]
  taskId: string         // 所属任务 ID
}
