/**
 * useAgentOrchestrator - Agent 编排逻辑 hook
 * 从 TldrawPocApp.tsx 提取，管理所有 Agent 相关状态和操作
 *
 * ═══════════════════════════════════════════════════════════════
 *  CLI / API 模式完整工作流
 * ═══════════════════════════════════════════════════════════════
 *
 *  用户输入                    路由与执行                         画布产出
 *  ────────                   ──────────                        ────────
 *  AgentInputBar              handleAgentMessage()              tldraw shapes
 *   ↓ 文字指令                  │                                  ↑
 *   ↓                          ├─ 意图检测 (深研/大纲/导出/总结)    │
 *   ↓                          │   → 直接调用对应 handler          │
 *   ↓                          │                                  │
 *   ↓                          └─ 通用流程 (real 模式)             │
 *   ↓                              │                              │
 *   ↓                              ├─ Priority 1: Direct API      │
 *   ↓                              │   callAnthropicDirectly()    │
 *   ↓                              │   → SSE 流式解析              │
 *   ↓                              │                              │
 *   ↓                              └─ Priority 2: Server Relay    │
 *   ↓                                  fetch('/api/chat')         │
 *   ↓                                  → SSE 流式解析              │
 *   ↓                                                             │
 *   ↓            ┌─────────── 解析 Claude 输出 ──────────┐        │
 *   ↓            │                                       │        │
 *   ↓       parseToolCalls()                        纯文本回复     │
 *   ↓            │                                       │        │
 *   ↓       JSON 工具调用数组                        agent-card    │
 *   ↓       [{ tool, params }]                       (摘要卡片)    │
 *   ↓            │                                       │        │
 *   ↓       executeToolCalls()                           │        │
 *   ↓            │                                       │        │
 *   ↓       ┌───┴───┐                                   │        │
 *   ↓   create_card  ask_user                            │        │
 *   ↓       │           │                                │        │
 *   ↓   product-card  agent-comment                      │        │
 *   ↓   (网格布局)     (气泡卡片)                          │        │
 *   ↓                   │                                │        │
 *   ↓              用户点击选项                           │        │
 *   ↓                   │                                │        │
 *   ↓              COMMENT_ACTION                        │        │
 *   ↓              (agentEvents)                         │        │
 *   ↓                   │                                │        │
 *   ↓              handleCommentFeedback()               │        │
 *   ↓              → 将选择发回 Claude API                │        │
 *   ↓              → 继续对话（闭环）                     ↓        │
 *   ↓                                              ─────────────→─┘
 *
 *  用户对卡片发修改指令 (USER_COMMENT_ON_SHAPE):
 *   选中卡片 + 输入指令 → handleUserModifyShape()
 *   → 序列化卡片内容 + 用户指令 → Claude API → 更新原卡片 in-place
 *
 *  视觉反馈层:
 *   - AIWorkingZone: 扫描线 + 虚线边框（workingZoneBounds 状态驱动）
 *   - AgentInputBar: 底部任务进度条（agentTasks 状态驱动）
 *   - Comment 气泡: Agent ↔ 用户双向沟通（agentEvents 事件驱动）
 *
 *  API 适用范围:
 *   - 文本生成（create_card, ask_user, 文本回复）→ API
 *   - 文件生成（PPT/Excel 等二进制）→ 需本地 CLI skill 或浏览器端库
 * ═══════════════════════════════════════════════════════════════
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Editor, createShapeId, TLShapeId } from 'tldraw'
import type { AgentTask } from '../components/AgentInputBar'
import type { AgentPrompt } from '../types/agent'
import {
  generatePPTResearchMock,
  generateDeepResearchMock,
  generateOutlineMock,
  generatePagesMock,
  generateCompletionComment,
} from '../mock/agentMockData'
import type { OutlineItem } from '../components/tldraw-poc/OutlineCardShape'
import { getViewportCenter } from '../utils/canvasUtils'
import { agentEvents, AGENT_EVENTS } from '../utils/agentEvents'
import { exportToPPTX, exportFramesToPPTX } from '../utils/pptExport'
import { exportToXLSX } from '../utils/excelExport'
import { exportToPDF } from '../utils/pdfExport'
import type { PageContent } from '../components/tldraw-poc/PageCardShape'
import { getApiKey } from '../components/ApiKeyDialog'

// System prompt embedded for direct API mode (same content as server/canvas-system-prompt.md)
const CANVAS_SYSTEM_PROMPT_BASE = `你是一个运行在无限画布上的 AI Agent。用户在画布上向你发送指令，你的产出会直接呈现为画布上的可视化对象。

## 你的工作方式

画布不是聊天窗口。画布上的对象应该是用户之后会**再看、操作、基于它继续**的东西。

**适合画布的任务**：竞品分析（多张卡片）、方案对比、架构梳理、头脑风暴、素材收集——共性是**多内容、可操作、空间有意义**。

**不适合画布的任务**：简单问答、写长文、翻译——这些用普通文本回复即可。

## 可用工具

### create_card
创建一张信息卡片。这是最基础的画布对象。

参数：
- \`name\`（必填）：卡片标题，简洁有力
- \`tagline\`（必填）：一句话描述，不超过 20 字
- \`tags\`（必填）：标签数组，2-5 个关键词
- \`detail\`（必填）：详细内容，Markdown 格式，包含有价值的信息
- \`imageUrl\`（可选）：封面图片 URL。**画布是视觉化空间，图片是画布相比纯文字的核心优势，请尽量为每张卡片提供 imageUrl。** 不仅限于景点——竞品分析的产品 logo、品牌官网截图、人物头像、技术架构图、美食照片等都应该配图。推荐使用 Unsplash 图片（格式：https://images.unsplash.com/photo-{id}?w=400&h=300&fit=crop），根据卡片主题选择合适的关键词搜索图。也可用 Wikipedia Commons 知名条目主图。

### create_table
创建一张表格卡片，直接显示在画布上。适合行程安排、对比分析、数据列表等结构化内容。
支持多标签页（类似 Excel 底部标签），一张表格卡片可以包含多个维度的数据。

单 sheet 参数：\`title\` + \`headers\` + \`rows\`
多 sheet 参数：\`title\` + \`sheets\`（数组，每个元素含 name、headers、rows）

当内容有多个维度时（如行程+预算+清单），**优先使用多 sheet 模式**，不要拆成多个表格。

### ask_user
向用户提问，让用户做选择。当你需要用户决策时使用。

参数：
- \`question\`（必填）：问题内容
- \`options\`（必填）：选项数组，2-4 个选项

## 画布上下文

如果消息中包含 \`[画布上下文]\` 部分，那是用户画布上当前存在的内容。你应该基于这些内容工作，避免重复创建已有的卡片。

如果消息中包含 \`[选中的卡片]\` 部分，那是用户框选的特定卡片。用户的指令针对这些被选中的内容。

## 输出格式

**当任务适合画布时**，用 JSON 数组输出工具调用：

\`\`\`json
[
  { "tool": "create_card", "params": { "name": "...", "tagline": "...", "tags": ["..."], "detail": "...", "imageUrl": "https://..." } },
  { "tool": "create_table", "params": { "title": "...", "headers": ["列1", "列2"], "rows": [["值1", "值2"]] } }
]
\`\`\`

**当任务不适合画布时**（简单问答、写长文等），直接用普通文本回复，不要包装成 JSON。

## 文档总结

当用户要求总结画布上的文档时，**每篇文档生成一张卡片**：
- \`name\`：文档标题
- \`tagline\`：一句话概括文档主旨
- \`tags\`：文档的关键主题词
- \`detail\`：用 Markdown 写出结构化的内容摘要（关键章节、核心观点、重要数据），300-500 字

如果是多篇文档，输出多张卡片，每张对应一篇文档。不要合并成一张。

## 重要原则

**⚠️ PPT 任务规则（优先级最高）**：
- 当用户说 PPT、演示文稿、幻灯片、演讲稿等包含 PPT 关键词的请求时：
  - 只能输出 JSON 数组，包含多个 create_slide 工具调用
  - 绝对禁止生成任何图片、调用图片生成工具、或提及图片生成功能
  - 不要输出文本、markdown、HTML 或其他任何格式
  - 不要创建 create_card、create_table 或其他非 create_slide 的工具
  - 如果需要图片，只能引用现有 URL（Unsplash 或 Wikipedia Commons）
  - PPT 请求必须只返回 create_slide 工具数组，没有任何例外

1. **不要强行拆卡片**。如果用户要的是一份完整文档，直接给文本，不要把每个章节拆成卡片。
2. **卡片数量由任务决定**，不是越多越好。竞品分析可能 6-10 张，方案对比可能 2-3 张。
3. **每张卡片要有独立价值**。用户应该能单独看一张卡片就理解它在说什么。
4. **detail 要有干货**。不是敷衍的一句话，而是真正有用的分析、数据、观点。用 Markdown 格式组织。
5. **tags 要有区分度**。帮助用户快速识别卡片的类别和特征。
6. **JSON 必须完整**。输出 JSON 工具调用时，确保 JSON 格式完整、可解析。不要输出任何 JSON 之外的文字（不要加"下面是结果"之类的前导语）。直接输出 JSON 数组。
7. **明确区分 PPT 生成和图片生成**：
   - **用户说"做成 PPT / 生成演示文稿 / 制作幻灯片 / 演讲稿"** → 用 \`create_slide\` 工具创建幻灯片 Frame（必须是 JSON 数组格式，绝不涉及图片生成）
   - **用户说"画图 / 生成图 / 绘制 / 设计图"等** → 这是单独的请求，不属于 PPT 生成，用户会通过 canvas UI 的魔法棒功能触发
   - PPT 内容用 \`create_slide\` 呈现在画布上，用户编辑后可导出为可编辑 .pptx
   - 表格等结构化内容用 \`create_table\` 和 \`create_card\` 呈现。如果内容有多个维度（如行程 + 预算 + 清单），用一个 \`create_table\` 的多 sheet 模式（\`sheets\` 参数）。
8. **表格内容要完整**。每个单元格写完整内容，不要用省略号截断。表格是用户直接看的，内容要有用。
9. **每张卡片都尽量配图**。画布的核心价值是视觉化呈现，没有图片的卡片和纯文字没有区别。无论是景点、竞品、产品、品牌、概念，都应该尽量提供 \`imageUrl\`。用 Unsplash 按主题搜索配图（https://images.unsplash.com/photo-{id}?w=400&h=300&fit=crop）或 Wikipedia Commons 知名主图。只有纯抽象概念（如"方案A vs 方案B"）才可以不配图。`

const CANVAS_SYSTEM_PROMPT_SPATIAL = `

### create_connection
在两张卡片之间创建一条箭头连线，表示关系、流程或因果。

参数：
- \`from\`（必填）：起点卡片的 name（必须与已创建的卡片名完全一致）
- \`to\`（必填）：终点卡片的 name
- \`label\`（可选）：连线上的标注文字，简洁说明关系

用途举例：
- 流程：from:"需求分析", to:"方案设计", label:"输出 PRD"
- 因果：from:"用户流失", to:"体验差", label:"导致"
- 对比：from:"方案A", to:"方案B", label:"优于"

**重要**：只能连接同一批 create_card 创建的卡片。from/to 的值必须与卡片的 name 完全匹配。

### create_group
将多张卡片归入一个分组框，表示它们属于同一类别或阶段。

参数：
- \`items\`（必填）：要分组的卡片 name 数组（必须与已创建的卡片名完全一致）
- \`label\`（可选）：分组的标题

用途举例：
- 阶段分组：items:["需求分析","方案设计","技术评审"], label:"策划阶段"
- 类别分组：items:["Figma","Sketch"], label:"设计工具"

**执行顺序**：先输出所有 create_card，再输出 create_connection 和 create_group。

## 空间工具使用原则

- **流程类任务**（如架构梳理、项目规划、用户旅程）：用 create_connection 连线表示先后关系
- **分类类任务**（如竞品分析、方案对比）：用 create_group 将同类卡片归组
- 不是所有任务都需要空间工具。简单的信息收集不需要连线和分组
- create_connection 和 create_group 始终在所有 create_card 之后输出

### create_slide
创建一张 PPT 幻灯片（画布上的一个 Frame）。Frame 内部坐标系为 960×540（16:9）。

参数：
- \`title\`（必填）：幻灯片标题，也作为 Frame 的标签名
- \`slideType\`（可选）：'cover' | 'content' | 'summary'，默认 'content'
- \`background\`（可选）：背景色 tldraw 颜色名（如 'light-violet', 'light-blue'）
- \`elements\`（必填）：元素数组，每个元素是以下之一：

  文本：{ type: 'text', content: '...', x, y, w, h, fontSize?: 's'|'m'|'l'|'xl', color?, align?: 'start'|'middle'|'end', bold?: true }
  图片：{ type: 'image', url: '...', x, y, w, h } — 图片 URL 应该是 Unsplash/Wikipedia Commons/已有的真实 URL，不要生成新图片
  形状：{ type: 'shape', geo: 'rectangle'|'ellipse', x, y, w, h, fill?, color?, text? }

坐标：x,y 是左上角在 Frame 内的位置（0-960, 0-540）。

## 幻灯片使用原则

- **PPT 类任务**（如制作演示文稿、汇报材料）：用 create_slide 创建多个幻灯片 Frame（注意：这是呈现现有内容，不是生成新图片）
- 每张幻灯片用一个 create_slide 调用
- 合理使用 slideType：封面用 'cover'，结尾用 'summary'，其余用 'content'
- 用户编辑后可导出为可编辑 .pptx 文件
- **重要：不要在 create_slide 中触发图片生成工具。如果幻灯片需要图片，使用 Unsplash/Wikipedia Commons 的现有 URL；如果用户要求"画图"或"设计图片"，那是单独的请求，不属于 PPT 生成**`

function buildSystemPrompt(): string {
  return CANVAS_SYSTEM_PROMPT_BASE + CANVAS_SYSTEM_PROMPT_SPATIAL
}

// Brainstorming system prompt — used for the first-pass "clarification" call
const BRAINSTORM_SYSTEM_PROMPT = `你是一个运行在无限画布上的 AI Agent 的头脑风暴模块。

用户给了你一个任务指令。你需要快速分析用户意图，提出一个简短的澄清问题，帮助你更好地完成任务。

## 输出格式

你**必须**用 JSON 数组输出一个 ask_user 工具调用：

\`\`\`json
[
  { "tool": "ask_user", "params": { "question": "你的问题", "options": ["选项1", "选项2", "选项3"] } }
]
\`\`\`

## 规则

1. **必须输出 ask_user**，不要输出其他工具或纯文本。
2. **问题要有价值**：不是确认用户说了什么，而是帮用户明确方向。例如：
   - 用户说"帮我分析竞品" → "你想侧重哪个维度？" → ["功能对比", "定价策略", "用户体验", "技术架构"]
   - 用户说"做个旅游行程" → "你偏好什么风格的旅行？" → ["深度文化游", "打卡网红点", "轻松度假", "美食探店"]
   - 用户说"整理资料" → "你希望以什么形式呈现？" → ["信息卡片", "对比表格", "大纲梳理"]
3. **选项 2-4 个**，简洁有力。
4. **问题控制在 20 字内**，不要啰嗦。
5. **考虑画布上下文**：如果消息中有 [画布上下文]，参考已有内容来提问。
6. **只输出 JSON**，不要有任何前导语或后缀。`

// Next-step suggestion prompt — generates a follow-up comment after task completion
const SUGGEST_NEXT_STEP_PROMPT = `你是一个运行在无限画布上的 AI Agent 的建议模块。

用户刚完成了一个任务。你需要根据画布上的内容和刚完成的任务，给出一个简短的下一步建议。

## 输出格式

你**必须**用 JSON 对象输出：

\`\`\`json
{ "message": "你的建议内容", "options": ["选项1", "选项2"] }
\`\`\`

## 规则

1. **message**：一句话说明下一步可以做什么，15-30 字。语气自然，像同事建议。
2. **options**：2-3 个具体的行动选项，每个 2-6 字。第一个是推荐操作，最后一个始终是"知道了"。
3. **要有上下文感知**：根据画布上已有的内容来建议。例如：
   - 画布上有竞品卡片 → "选中卡片可以深入研究，或者整理成大纲"
   - 画布上有表格 → "可以基于表格生成更多维度的分析"
   - 画布上有大纲 → "大纲就绪，可以展开生成完整内容"
4. **不要重复已完成的事**。
5. **只输出 JSON**，不要有任何前导语或后缀。`

interface UseAgentOrchestratorParams {
  editor: Editor | null
  selectedProductCards: Array<{ id: string; name: string; [key: string]: any }>
  /** 当前画布选中的所有 shape id */
  selectedShapeIds: string[]
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export type AgentMode = 'mock' | 'real'

export function useAgentOrchestrator({
  editor,
  selectedProductCards,
  selectedShapeIds,
  addToast,
}: UseAgentOrchestratorParams) {
  // Agent 模式：mock（演示流程）或 real（真实 Claude CLI）
  const [agentMode, setAgentMode] = useState<AgentMode>('mock')

  // 空间工具始终启用（create_connection / create_group）

  // Agent 多任务状态
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([])

  // AI 工作区 shape ID（画布原生 shape，不再是 overlay）
  const workingZoneShapeIdRef = useRef<TLShapeId | null>(null)
  // 保留 workingZoneBounds 状态给外部读取（兼容）
  const [workingZoneBounds, setWorkingZoneBoundsState] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  /** 创建或更新画布上的 AI 工作区 shape */
  const setWorkingZoneBounds = useCallback((bounds: { x: number; y: number; w: number; h: number } | null) => {
    if (!editor) return
    setWorkingZoneBoundsState(bounds)

    if (bounds) {
      if (workingZoneShapeIdRef.current) {
        // 更新已有 shape
        try {
          const existing = editor.getShape(workingZoneShapeIdRef.current)
          if (existing) {
            editor.updateShape({
              id: workingZoneShapeIdRef.current,
              type: 'ai-working-zone',
              x: bounds.x,
              y: bounds.y,
              props: { w: bounds.w, h: bounds.h, status: 'working' },
            } as any)
            return
          }
        } catch { /* shape 已被删除 */ }
      }
      // 创建新 shape
      const shapeId = createShapeId()
      workingZoneShapeIdRef.current = shapeId
      editor.createShape({
        id: shapeId,
        type: 'ai-working-zone' as any,
        x: bounds.x,
        y: bounds.y,
        props: {
          w: bounds.w,
          h: bounds.h,
          statusText: '正在分析任务...',
          status: 'working',
        },
      })
    } else {
      // 清除: 先设为 completing 状态, 然后延迟删除
      if (workingZoneShapeIdRef.current) {
        const shapeId = workingZoneShapeIdRef.current
        try {
          const existing = editor.getShape(shapeId)
          if (existing) {
            editor.updateShape({
              id: shapeId,
              type: 'ai-working-zone',
              props: { status: 'done' },
            } as any)
            // 延迟删除 shape
            setTimeout(() => {
              try {
                if (editor.getShape(shapeId)) {
                  editor.deleteShapes([shapeId])
                }
              } catch { /* ignore */ }
            }, 800)
          }
        } catch { /* ignore */ }
        workingZoneShapeIdRef.current = null
      }
    }
  }, [editor])

  // 强提示状态
  const [activePrompt, setActivePrompt] = useState<AgentPrompt | null>(null)
  const promptResolverRef = useRef<((option: string) => void) | null>(null)

  // 扫描读取卡片状态：当前正在扫描的 shape ID
  const [scanningShapeId, setScanningShapeId] = useState<string | null>(null)

  // 任务计数器
  const taskIdCounter = useRef(0)

  // Helper — 仅用于让 UI 有一帧渲染时间（~16ms），不再人为等待
  const microYield = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

  /** 计算工作区边界（画布坐标），给定网格参数 */
  const computeZoneBounds = useCallback((
    centerPage: { x: number; y: number },
    count: number,
    cardW = 280,
    cardH = 120,
    gap = 16,
    maxCols = 4,
    padding = 32,
  ) => {
    const cols = Math.min(count || 4, maxCols)
    const rows = Math.max(1, Math.ceil((count || 8) / cols))
    const totalW = cols * (cardW + gap) - gap + padding * 2
    const totalH = rows * (cardH + gap) - gap + padding * 2
    return {
      x: centerPage.x - totalW / 2,
      y: centerPage.y - 100 - padding,
      w: totalW,
      h: totalH,
    }
  }, [])

  /** 延迟清除 workingZoneBounds — 先设为 completing，1.5s 后清除 */
  const clearZoneBoundsDeferred = useCallback(() => {
    if (!editor) return
    // 先设为 completing 状态
    if (workingZoneShapeIdRef.current) {
      try {
        const existing = editor.getShape(workingZoneShapeIdRef.current)
        if (existing) {
          editor.updateShape({
            id: workingZoneShapeIdRef.current,
            type: 'ai-working-zone',
            props: { status: 'completing', statusText: '✓ 完成' },
          } as any)
        }
      } catch { /* ignore */ }
    }
    // 延迟后真正删除
    setTimeout(() => setWorkingZoneBounds(null), 2100)
  }, [editor, setWorkingZoneBounds])

  /** 为图像生成设置工作区边界（可在 TldrawPocApp handleImageGeneration 中调用） */
  const setImageGenerationZoneBounds = useCallback((bounds: { x: number; y: number; w: number; h: number } | null) => {
    if (bounds) {
      // 图像生成时更新 statusText
      setWorkingZoneBounds(bounds)
      if (workingZoneShapeIdRef.current && editor) {
        try {
          editor.updateShape({
            id: workingZoneShapeIdRef.current,
            type: 'ai-working-zone',
            props: { statusText: '正在生成图片...' },
          } as any)
        } catch { /* ignore */ }
      }
    } else {
      setWorkingZoneBounds(null)
    }
  }, [editor, setWorkingZoneBounds])

  // 同步 agent task 状态文本到 working zone shape
  useEffect(() => {
    if (!editor || !workingZoneShapeIdRef.current) return
    const currentTask = agentTasks[0]
    if (!currentTask) return
    try {
      const existing = editor.getShape(workingZoneShapeIdRef.current)
      if (existing) {
        editor.updateShape({
          id: workingZoneShapeIdRef.current,
          type: 'ai-working-zone',
          props: { statusText: currentTask.statusText },
        } as any)
      }
    } catch { /* ignore */ }
  }, [editor, agentTasks])

  // 强提示回调
  const handlePromptSelect = useCallback((option: string) => {
    promptResolverRef.current?.(option)
    promptResolverRef.current = null
    setActivePrompt(null)
  }, [])

  const handlePromptDismiss = useCallback(() => {
    if (activePrompt && activePrompt.options.length > 0) {
      promptResolverRef.current?.(activePrompt.options[0])
    }
    promptResolverRef.current = null
    setActivePrompt(null)
  }, [activePrompt])

  // ============ Comment 创建 ============
  const createComment = useCallback((
    position: { x: number; y: number },
    message: string,
    actions: Array<{ label: string; type: string }>,
    anchorShapeId?: string,
    autoExpand?: boolean,
  ) => {
    if (!editor) return
    const id = createShapeId()
    const expanded = autoExpand ?? false
    editor.createShape({
      id,
      type: 'agent-comment' as any,
      x: position.x,
      y: position.y,
      props: {
        w: expanded ? 260 : 24,
        h: expanded ? 120 : 24,
        message,
        actions: JSON.stringify(actions),
        resolved: false,
        expanded,
        anchorShapeId: anchorShapeId || '',
        createdAt: Date.now(),
      },
    })
    return id
  }, [editor])

  // ============ 深入研究 ============
  const handleDeepResearch = useCallback(async (parentShapeId: string) => {
    if (!editor) return

    const parentShape = editor.getShape(parentShapeId as TLShapeId)
    if (!parentShape) return

    const parentProps = (parentShape as any).props
    const productName = parentProps.name || 'Unknown'

    const taskId = `task-${++taskIdCounter.current}`
    const taskLabel = `深入研究 ${productName}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, statusText: '正在搜索...', progress: 0 }])

    const { steps, subTopics, summary } = generateDeepResearchMock(productName)

    // 执行步骤
    for (let i = 0; i < steps.length; i++) {
      await microYield()
      const step = steps[i]
      const text = step.content.length > 30 ? step.content.slice(0, 30) + '...' : step.content
      updateTask(step.type === 'tool_call' ? `调用 ${step.toolName}...` : text, (i + 1) / (steps.length + subTopics.length))
    }

    // 在父卡片右侧生成子话题卡片
    const parentBounds = editor.getShapePageBounds(parentShape)
    if (!parentBounds) { removeTask(); return }

    const startX = parentBounds.x + parentBounds.width + 40
    const startY = parentBounds.y
    const cardW = 280
    const cardH = 120
    const gap = 16

    editor.batch(() => {
      for (let i = 0; i < subTopics.length; i++) {
        const topic = subTopics[i]
        editor.createShape({
          id: createShapeId(),
          type: 'product-card' as any,
          x: startX,
          y: startY + i * (cardH + gap),
          props: {
            w: cardW,
            h: cardH,
            name: topic.name,
            tagline: topic.tagline,
            tags: JSON.stringify(topic.tags),
            detail: topic.detail,
            sources: JSON.stringify(topic.sources),
            expanded: false,
            sourceTaskId: taskId,
          },
        })
      }
    })
    updateTask(`已生成 ${subTopics.length}/${subTopics.length}`, 1)

    removeTask()
    addToast(summary, 'success')
  }, [editor, addToast])

  // ============ 生成大纲 ============
  const handleGenerateOutline = useCallback(async () => {
    if (!editor) return

    // 扫描画布上所有产品卡片
    const currentPageId = editor.getCurrentPageId()
    const allShapeIds = editor.getSortedChildIdsForParent(currentPageId)
    const productCards: Array<{ id: string; name: string; x: number; y: number; w: number; h: number }> = []

    for (const id of allShapeIds) {
      const shape = editor.getShape(id)
      if (shape && (shape as any).type === 'product-card') {
        const props = (shape as any).props
        const bounds = editor.getShapePageBounds(shape)
        if (bounds) {
          productCards.push({
            id: id as string,
            name: props.name,
            x: bounds.x,
            y: bounds.y,
            w: bounds.width,
            h: bounds.height,
          })
        }
      }
    }

    if (productCards.length === 0) {
      addToast('画布上还没有产品卡片，请先收集产品', 'info')
      return
    }

    const productNames = productCards.map(c => c.name)
    const taskId = `task-${++taskIdCounter.current}`
    const taskLabel = '生成大纲'

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, statusText: '正在分析...', progress: 0 }])

    const { steps, outline } = generateOutlineMock(productNames)

    // 执行步骤
    for (let i = 0; i < steps.length; i++) {
      await microYield()
      const step = steps[i]
      const text = step.content.length > 30 ? step.content.slice(0, 30) + '...' : step.content
      updateTask(step.type === 'tool_call' ? `调用 ${step.toolName}...` : text, (i + 1) / steps.length)
    }

    // 匹配大纲项与实际卡片 shapeId
    const enrichedItems = outline.items.map(item => {
      if (item.cardName) {
        const matchCard = productCards.find(c => c.name === item.cardName)
        if (matchCard) {
          return { ...item, cardRef: matchCard.id }
        }
      }
      return item
    })

    // 计算大纲卡片放置位置：产品卡片群的右侧
    let maxX = -Infinity
    let avgY = 0
    productCards.forEach(c => {
      maxX = Math.max(maxX, c.x + c.w)
      avgY += c.y
    })
    avgY /= productCards.length

    const outlineX = maxX + 60
    const outlineY = avgY

    editor.createShape({
      id: createShapeId(),
      type: 'outline-card' as any,
      x: outlineX,
      y: outlineY,
      props: {
        w: 320,
        h: 200,
        title: outline.title,
        items: JSON.stringify(enrichedItems),
        status: 'draft',
        sourceTaskId: taskId,
      },
    })

    await microYield()
    removeTask()
    addToast(`大纲已生成，包含 ${enrichedItems.length} 页`, 'success')
  }, [editor, addToast])

  // ============ 生成页面 ============
  const handleGeneratePages = useCallback(async (outlineShapeId: string) => {
    if (!editor) return

    const outlineShape = editor.getShape(outlineShapeId as TLShapeId)
    if (!outlineShape) return

    const outlineProps = (outlineShape as any).props
    let items: OutlineItem[] = []
    try { items = JSON.parse(outlineProps.items) } catch { return }

    // 更新大纲状态 → generating
    editor.updateShape({
      id: outlineShapeId as TLShapeId,
      type: 'outline-card' as any,
      props: { status: 'generating' },
    } as any)

    const taskId = `task-${++taskIdCounter.current}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: '生成页面', statusText: '正在生成...', progress: 0 }])

    const { steps, pages } = generatePagesMock(items)

    // 执行步骤
    for (let i = 0; i < steps.length; i++) {
      await microYield()
      const step = steps[i]
      const text = step.content.length > 30 ? step.content.slice(0, 30) + '...' : step.content
      updateTask(step.type === 'tool_call' ? `调用 ${step.toolName}...` : text, (i + 1) / (steps.length + pages.length))
    }

    // 在大纲下方以 3 列网格创建页面卡片
    const outlineBounds = editor.getShapePageBounds(outlineShape)
    if (!outlineBounds) { removeTask(); return }

    const pageW = 480
    const pageH = 270
    const gap = 24
    const cols = 3
    const startX = outlineBounds.x - 100
    const startY = outlineBounds.y + outlineBounds.height + 40

    editor.batch(() => {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        const col = i % cols
        const row = Math.floor(i / cols)

        editor.createShape({
          id: createShapeId(),
          type: 'page-card' as any,
          x: startX + col * (pageW + gap),
          y: startY + row * (pageH + gap),
          props: {
            w: pageW,
            h: pageH,
            pageNumber: page.pageNumber,
            pageTitle: page.pageTitle,
            content: JSON.stringify(page.content),
            pageType: page.pageType,
            outlineShapeId,
            isEditing: false,
          },
        })
      }

      // 更新大纲状态 → done
      editor.updateShape({
        id: outlineShapeId as TLShapeId,
        type: 'outline-card' as any,
        props: { status: 'done' },
      } as any)
    })
    updateTask(`已生成 ${pages.length}/${pages.length} 页`, 1)

    removeTask()
    addToast(`已生成 ${pages.length} 张幻灯片`, 'success')
  }, [editor, addToast])

  // ============ 导出 PPT ============
  const handleExportPPT = useCallback(async () => {
    if (!editor) return

    const taskId = `task-${++taskIdCounter.current}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: '导出 PPT', statusText: '收集页面...', progress: 0 }])

    // 扫描画布所有 page-card shapes
    const currentPageId = editor.getCurrentPageId()
    const allShapeIds = editor.getSortedChildIdsForParent(currentPageId)
    const pageShapes: Array<{
      id: string
      pageNumber: number
      pageTitle: string
      content: PageContent
      pageType: 'cover' | 'content' | 'summary'
      x: number
      y: number
    }> = []

    for (const id of allShapeIds) {
      const shape = editor.getShape(id)
      if (shape && (shape as any).type === 'page-card') {
        const props = (shape as any).props
        let content: PageContent = { bullets: [] }
        try { content = JSON.parse(props.content) } catch { /* */ }
        pageShapes.push({
          id: id as string,
          pageNumber: props.pageNumber,
          pageTitle: props.pageTitle,
          content,
          pageType: props.pageType,
          x: shape.x,
          y: shape.y,
        })
      }
    }

    if (pageShapes.length === 0) {
      removeTask()
      addToast('画布上没有页面卡片，请先生成页面', 'info')
      return
    }

    // 按页码排序
    pageShapes.sort((a, b) => a.pageNumber - b.pageNumber)

    updateTask('正在生成 PPT...', 0.3)
    await microYield()

    try {
      const slides = pageShapes.map(p => ({
        pageNumber: p.pageNumber,
        pageTitle: p.pageTitle,
        content: p.content,
        pageType: p.pageType,
      }))

      const blob = await exportToPPTX(slides)
      const downloadUrl = URL.createObjectURL(blob)
      const fileSize = `${(blob.size / 1024).toFixed(0)} KB`
      const fileName = '画布产品调研报告.pptx'

      updateTask('创建文件卡片...', 0.8)
      await microYield()

      // 在页面卡片附近创建 file-card
      const lastPage = pageShapes[pageShapes.length - 1]
      const fileX = lastPage.x + 480 + 40
      const fileY = lastPage.y

      editor.createShape({
        id: createShapeId(),
        type: 'file-card' as any,
        x: fileX,
        y: fileY,
        props: {
          w: 220,
          h: 100,
          fileName,
          fileSize,
          fileType: 'pptx',
          downloadUrl,
          createdAt: Date.now(),
          sourceData: JSON.stringify({
            type: 'slides',
            slides: slides.map(s => ({ pageNumber: s.pageNumber, pageTitle: s.pageTitle })),
          }),
        },
      })

      removeTask()
      addToast('PPT 导出成功', 'success')
    } catch (err) {
      removeTask()
      addToast('PPT 导出失败', 'error')
      if (import.meta.env.DEV) console.error('PPT export error:', err)
    }
  }, [editor, addToast])

  // ============ 导出 Frame 幻灯片为可编辑 PPTX ============
  const handleExportFramesPPT = useCallback(async () => {
    if (!editor) return

    const taskId = `task-${++taskIdCounter.current}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: '导出 PPT', statusText: '收集幻灯片帧...', progress: 0 }])

    // 收集 frame：优先已选中的 frame，否则当前页所有 frame
    const selectedIds = editor.getSelectedShapeIds()
    let frameIds = selectedIds.filter(id => {
      const s = editor.getShape(id)
      return s?.type === 'frame'
    })

    if (frameIds.length === 0) {
      frameIds = editor.getCurrentPageShapes()
        .filter(s => s.type === 'frame')
        .sort((a, b) => Math.abs(a.y - b.y) < 50 ? a.x - b.x : a.y - b.y)
        .map(s => s.id)
    }

    if (frameIds.length === 0) {
      removeTask()
      addToast('画布上没有幻灯片帧', 'info')
      return
    }

    updateTask('正在生成 PPT...', 0.3)
    await microYield()

    try {
      const blob = await exportFramesToPPTX(editor, frameIds)
      const downloadUrl = URL.createObjectURL(blob)
      const fileSize = `${(blob.size / 1024).toFixed(0)} KB`
      const fileName = '画布演示文稿.pptx'

      updateTask('创建文件卡片...', 0.8)
      await microYield()

      // 找到最后一个 frame 的位置，在旁边放 file-card
      const lastFrame = editor.getShape(frameIds[frameIds.length - 1])
      const lastFrameBounds = lastFrame ? editor.getShapePageBounds(lastFrame.id) : null
      const fileX = lastFrameBounds ? lastFrameBounds.maxX + 40 : 0
      const fileY = lastFrameBounds ? lastFrameBounds.y : 0

      editor.createShape({
        id: createShapeId(),
        type: 'file-card' as any,
        x: fileX,
        y: fileY,
        props: {
          w: 220,
          h: 100,
          fileName,
          fileSize,
          fileType: 'pptx',
          downloadUrl,
          createdAt: Date.now(),
          sourceData: JSON.stringify({
            type: 'frames',
            frameCount: frameIds.length,
          }),
        },
      })

      removeTask()
      addToast(`PPT 导出成功（${frameIds.length} 页）`, 'success')
    } catch (err) {
      removeTask()
      addToast('PPT 导出失败', 'error')
      if (import.meta.env.DEV) console.error('Frame PPT export error:', err)
    }
  }, [editor, addToast])

  // ============ 导出 Excel ============
  const handleExportExcel = useCallback(async () => {
    if (!editor) return

    const taskId = `task-${++taskIdCounter.current}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: '导出 Excel', statusText: '收集产品卡片...', progress: 0 }])

    // 扫描画布所有 product-card shapes
    const currentPageId = editor.getCurrentPageId()
    const allShapeIds = editor.getSortedChildIdsForParent(currentPageId)
    const productCards: Array<{
      id: string
      name: string
      tagline: string
      tags: string[]
      detail: string
      sources: Array<{ title: string; domain: string; url: string }>
      x: number
      y: number
    }> = []

    for (const id of allShapeIds) {
      const shape = editor.getShape(id)
      if (shape && (shape as any).type === 'product-card') {
        const props = (shape as any).props
        let tags: string[] = []
        let sources: Array<{ title: string; domain: string; url: string }> = []
        try { tags = JSON.parse(props.tags || '[]') } catch { /* */ }
        try { sources = JSON.parse(props.sources || '[]') } catch { /* */ }
        productCards.push({
          id: id as string,
          name: props.name || '',
          tagline: props.tagline || '',
          tags,
          detail: props.detail || '',
          sources,
          x: shape.x,
          y: shape.y,
        })
      }
    }

    if (productCards.length === 0) {
      removeTask()
      addToast('画布上没有产品卡片', 'info')
      return
    }

    updateTask('正在生成 Excel...', 0.3)
    await microYield()

    try {
      const products = productCards.map(c => ({
        name: c.name,
        tagline: c.tagline,
        tags: c.tags,
        detail: c.detail,
        sources: c.sources,
      }))

      const blob = await exportToXLSX(products)
      const downloadUrl = URL.createObjectURL(blob)
      const fileSize = `${(blob.size / 1024).toFixed(0)} KB`
      const fileName = '画布产品数据.xlsx'

      updateTask('创建文件卡片...', 0.8)
      await microYield()

      // 在产品卡片附近创建 file-card
      const lastCard = productCards[productCards.length - 1]
      const fileX = lastCard.x + 280 + 40
      const fileY = lastCard.y

      // 将原始数据存入 sourceData，以便 agent 后续读取
      const sourceData = JSON.stringify({
        type: 'product_table',
        headers: ['名称', '描述', '标签', '详细分析', '来源'],
        rows: products.map(p => [
          p.name,
          p.tagline,
          p.tags.join(', '),
          p.detail.slice(0, 200),
          p.sources.map(s => s.title).join(', '),
        ]),
      })

      editor.createShape({
        id: createShapeId(),
        type: 'file-card' as any,
        x: fileX,
        y: fileY,
        props: {
          w: 220,
          h: 100,
          fileName,
          fileSize,
          fileType: 'xlsx',
          downloadUrl,
          createdAt: Date.now(),
          sourceData,
        },
      })

      removeTask()
      addToast('Excel 导出成功', 'success')
    } catch (err) {
      removeTask()
      addToast('Excel 导出失败', 'error')
      if (import.meta.env.DEV) console.error('Excel export error:', err)
    }
  }, [editor, addToast])

  // ============ 导出 PDF ============
  const handleExportPDF = useCallback(async () => {
    if (!editor) return

    const taskId = `task-${++taskIdCounter.current}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: '导出 PDF', statusText: '收集产品卡片...', progress: 0 }])

    // 扫描画布所有 product-card shapes
    const currentPageId = editor.getCurrentPageId()
    const allShapeIds = editor.getSortedChildIdsForParent(currentPageId)
    const productCards: Array<{
      id: string
      name: string
      tagline: string
      tags: string[]
      detail: string
      sources: Array<{ title: string; domain: string; url: string }>
      x: number
      y: number
    }> = []

    for (const id of allShapeIds) {
      const shape = editor.getShape(id)
      if (shape && (shape as any).type === 'product-card') {
        const props = (shape as any).props
        let tags: string[] = []
        let sources: Array<{ title: string; domain: string; url: string }> = []
        try { tags = JSON.parse(props.tags || '[]') } catch { /* */ }
        try { sources = JSON.parse(props.sources || '[]') } catch { /* */ }
        productCards.push({
          id: id as string,
          name: props.name || '',
          tagline: props.tagline || '',
          tags,
          detail: props.detail || '',
          sources,
          x: shape.x,
          y: shape.y,
        })
      }
    }

    if (productCards.length === 0) {
      removeTask()
      addToast('画布上没有产品卡片', 'info')
      return
    }

    updateTask('正在生成 PDF...', 0.3)
    await microYield()

    try {
      const products = productCards.map(c => ({
        name: c.name,
        tagline: c.tagline,
        tags: c.tags,
        detail: c.detail,
        sources: c.sources,
      }))

      const blob = await exportToPDF(products)
      const downloadUrl = URL.createObjectURL(blob)
      const fileSize = `${(blob.size / 1024).toFixed(0)} KB`
      const fileName = '画布产品数据.pdf'

      updateTask('创建文件卡片...', 0.8)
      await microYield()

      // 在产品卡片附近创建 file-card
      const lastCard = productCards[productCards.length - 1]
      const fileX = lastCard.x + 280 + 40
      const fileY = lastCard.y

      // 将原始数据存入 sourceData
      const sourceData = JSON.stringify({
        type: 'product_table',
        headers: ['名称', '描述', '标签', '详细分析', '来源'],
        rows: products.map(p => [
          p.name,
          p.tagline,
          p.tags.join(', '),
          p.detail.slice(0, 200),
          p.sources.map(s => s.title).join(', '),
        ]),
      })

      editor.createShape({
        id: createShapeId(),
        type: 'file-card' as any,
        x: fileX,
        y: fileY,
        props: {
          w: 220,
          h: 100,
          fileName,
          fileSize,
          fileType: 'pdf',
          downloadUrl,
          createdAt: Date.now(),
          sourceData,
        },
      })

      removeTask()
      addToast('PDF 导出成功', 'success')
    } catch (err) {
      removeTask()
      addToast('PDF 导出失败', 'error')
      if (import.meta.env.DEV) console.error('PDF export error:', err)
    }
  }, [editor, addToast])

  // ============ 画布上下文序列化 ============

  /** 序列化画布上所有 shape 为文本描述（Phase 2: read_canvas） */
  const serializeCanvas = useCallback((): string => {
    if (!editor) return ''

    const currentPageId = editor.getCurrentPageId()
    const allShapeIds = editor.getSortedChildIdsForParent(currentPageId)
    const descriptions: string[] = []

    for (const id of allShapeIds) {
      const shape = editor.getShape(id)
      if (!shape) continue
      const props = (shape as any).props
      const type = (shape as any).type

      if (type === 'product-card') {
        let tags: string[] = []
        try { tags = JSON.parse(props.tags || '[]') } catch { /* */ }
        descriptions.push(
          `- 卡片「${props.name}」：${props.tagline}` +
          (tags.length > 0 ? ` [${tags.join(', ')}]` : '') +
          (props.detail ? `\n  详情：${props.detail.slice(0, 100)}${props.detail.length > 100 ? '...' : ''}` : '')
        )
      } else if (type === 'agent-card') {
        descriptions.push(
          `- Agent 回复「${props.userMessage?.slice(0, 30) || ''}」：${props.summary?.slice(0, 80) || '(无内容)'}`
        )
      } else if (type === 'outline-card') {
        descriptions.push(`- 大纲「${props.title}」(${props.status})`)
      } else if (type === 'page-card') {
        descriptions.push(`- 页面 ${props.pageNumber}「${props.pageTitle}」`)
      } else if (type === 'ai-image') {
        const label = props.prompt ? `图片「${props.prompt.slice(0, 30)}」` : `图片`
        descriptions.push(`- ${label}`)
      } else if (type === 'doc-card') {
        const ftLabel = props.fileType === 'md' ? 'MD' : 'PDF'
        const previewSnippet = props.preview ? props.preview.slice(0, 100) : ''
        descriptions.push(
          `- 文档「${props.fileName}」(${ftLabel}, ${props.fileSize})` +
          (previewSnippet ? `：${previewSnippet}${props.preview.length > 100 ? '...' : ''}` : '')
        )
      } else if (type === 'file-card') {
        const ftLabel = props.fileType === 'xlsx' ? 'Excel' : props.fileType === 'pptx' ? 'PPT' : 'PDF'
        descriptions.push(`- 导出文件「${props.fileName}」(${ftLabel}, ${props.fileSize})`)
      } else if (type === 'table-card') {
        let sheetInfo = ''
        try {
          const sheets = JSON.parse(props.sheets || '[]')
          if (Array.isArray(sheets) && sheets.length > 0) {
            sheetInfo = sheets.map((s: any) => `${s.name}(${s.rows?.length || 0}行)`).join(', ')
          }
        } catch { /* */ }
        if (!sheetInfo) {
          try {
            const rows = JSON.parse(props.rows || '[]')
            sheetInfo = `${rows.length}行`
          } catch { /* */ }
        }
        descriptions.push(`- 表格「${props.title}」${sheetInfo ? `(${sheetInfo})` : ''}`)
      } else if (type === 'arrow') {
        const label = props.text || ''
        const bindings = editor.getBindingsFromShape(shape.id, 'arrow')
        let fromName = '?', toName = '?'
        for (const b of bindings) {
          const target = editor.getShape(b.toId)
          const tName = (target as any)?.props?.name || (target as any)?.props?.title || '?'
          if ((b as any).props?.terminal === 'start') fromName = tName
          if ((b as any).props?.terminal === 'end') toName = tName
        }
        descriptions.push(
          `- 连线：${fromName} → ${toName}` + (label ? ` (${label})` : '')
        )
      } else if (type === 'frame') {
        const children = editor.getSortedChildIdsForParent(shape.id)
        const childNames = children.map(cid => {
          const child = editor.getShape(cid)
          return (child as any)?.props?.name || (child as any)?.props?.title || '?'
        })
        descriptions.push(
          `- 分组「${props.name || '未命名'}」：包含 ${childNames.join(', ')}`
        )
      }
    }

    if (descriptions.length === 0) return ''
    return `[画布上下文]\n画布上当前有 ${descriptions.length} 个对象：\n${descriptions.join('\n')}`
  }, [editor])

  /** 序列化选中的 shape 为文本描述（支持所有 shape 类型） */
  const serializeSelection = useCallback((): string => {
    if (!editor || selectedShapeIds.length === 0) return ''

    const descriptions: string[] = []
    for (const id of selectedShapeIds) {
      const shape = editor.getShape(id as TLShapeId)
      if (!shape) continue
      const props = (shape as any).props
      const type = (shape as any).type

      if (type === 'product-card') {
        let tags: string[] = []
        try { tags = JSON.parse(props.tags || '[]') } catch { /* */ }
        descriptions.push(
          `- 卡片「${props.name}」：${props.tagline}` +
          (tags.length > 0 ? ` [${tags.join(', ')}]` : '') +
          (props.detail ? `\n  详情：${props.detail.slice(0, 100)}${props.detail.length > 100 ? '...' : ''}` : '')
        )
      } else if (type === 'agent-card') {
        descriptions.push(
          `- Agent 回复「${props.userMessage?.slice(0, 30) || ''}」：${props.summary?.slice(0, 80) || '(无内容)'}`
        )
      } else if (type === 'outline-card') {
        descriptions.push(`- 大纲「${props.title}」(${props.status})`)
      } else if (type === 'page-card') {
        descriptions.push(`- 页面 ${props.pageNumber}「${props.pageTitle}」`)
      } else if (type === 'ai-image') {
        const label = props.prompt ? `图片「${props.prompt.slice(0, 30)}」` : `图片`
        descriptions.push(`- ${label}`)
      } else if (type === 'doc-card') {
        const ftLabel = props.fileType === 'md' ? 'MD' : 'PDF'
        const previewSnippet = props.preview ? props.preview.slice(0, 100) : ''
        descriptions.push(
          `- 文档「${props.fileName}」(${ftLabel}, ${props.fileSize})` +
          (previewSnippet ? `：${previewSnippet}${props.preview.length > 100 ? '...' : ''}` : '')
        )
      } else if (type === 'file-card') {
        const ftLabel = props.fileType === 'xlsx' ? 'Excel' : props.fileType === 'pptx' ? 'PPT' : 'PDF'
        let dataPreview = ''
        if (props.sourceData) {
          try {
            const src = JSON.parse(props.sourceData)
            if (src.headers && src.rows) {
              dataPreview += `\n  列: ${src.headers.join(' | ')}`
              const preview = src.rows.slice(0, 5).map((r: string[]) => r.join(' | ')).join('\n  ')
              dataPreview += `\n  ${preview}`
              if (src.rows.length > 5) dataPreview += `\n  ... 共 ${src.rows.length} 行`
            }
          } catch { /* */ }
        }
        descriptions.push(`- 导出文件「${props.fileName}」(${ftLabel}, ${props.fileSize})${dataPreview}`)
      } else if (type === 'table-card') {
        // 序列化表格的实际数据，让 agent 可以读取
        let tableContent = ''
        try {
          const sheets = JSON.parse(props.sheets || '[]')
          if (Array.isArray(sheets) && sheets.length > 0) {
            for (const sheet of sheets) {
              tableContent += `\n  [${sheet.name}] `
              if (sheet.headers?.length) tableContent += `列: ${sheet.headers.join(' | ')}`
              if (sheet.rows?.length) {
                tableContent += ` (${sheet.rows.length}行)`
                // 附上前 5 行数据
                const preview = sheet.rows.slice(0, 5).map((r: string[]) => r.join(' | ')).join('\n  ')
                tableContent += `\n  ${preview}`
                if (sheet.rows.length > 5) tableContent += `\n  ... 共 ${sheet.rows.length} 行`
              }
            }
          }
        } catch { /* */ }
        if (!tableContent) {
          try {
            const headers = JSON.parse(props.headers || '[]')
            const rows = JSON.parse(props.rows || '[]')
            if (headers.length) tableContent += `\n  列: ${headers.join(' | ')}`
            if (rows.length) {
              const preview = rows.slice(0, 5).map((r: string[]) => r.join(' | ')).join('\n  ')
              tableContent += `\n  ${preview}`
              if (rows.length > 5) tableContent += `\n  ... 共 ${rows.length} 行`
            }
          } catch { /* */ }
        }
        descriptions.push(`- 表格「${props.title}」${tableContent}`)
      } else if (type === 'arrow') {
        const label = props.text || ''
        const bindings = editor.getBindingsFromShape(shape.id, 'arrow')
        let fromName = '?', toName = '?'
        for (const b of bindings) {
          const target = editor.getShape(b.toId)
          const tName = (target as any)?.props?.name || (target as any)?.props?.title || '?'
          if ((b as any).props?.terminal === 'start') fromName = tName
          if ((b as any).props?.terminal === 'end') toName = tName
        }
        descriptions.push(
          `- 连线：${fromName} → ${toName}` + (label ? ` (${label})` : '')
        )
      } else if (type === 'frame') {
        const children = editor.getSortedChildIdsForParent(shape.id)
        const childNames = children.map(cid => {
          const child = editor.getShape(cid)
          return (child as any)?.props?.name || (child as any)?.props?.title || '?'
        })
        descriptions.push(
          `- 分组「${props.name || '未命名'}」：包含 ${childNames.join(', ')}`
        )
      }
    }

    if (descriptions.length === 0) return ''
    return `[用户选中的对象]\n用户选中了 ${descriptions.length} 个对象（请重点关注这些内容）：\n${descriptions.join('\n')}`
  }, [editor, selectedShapeIds])

  /**
   * 收集画布上的文件（图片 + 文档），用于发送给 server 让 Claude 读取
   * 有选中 → 只收集选中的；无选中 → 收集全部
   */
  const collectCanvasFiles = useCallback((): Array<{ name: string; dataUrl: string; fileType?: string }> => {
    if (!editor) return []

    const hasSelection = selectedShapeIds.length > 0
    const shapeIds = hasSelection
      ? selectedShapeIds.map(id => id as unknown as TLShapeId)
      : editor.getSortedChildIdsForParent(editor.getCurrentPageId())

    const files: Array<{ name: string; dataUrl: string; fileType?: string }> = []

    for (const id of shapeIds) {
      const shape = editor.getShape(id as TLShapeId)
      if (!shape) continue
      const type = (shape as any).type
      const props = (shape as any).props

      if (type === 'ai-image' && props.url && props.url.startsWith('data:image')) {
        const name = props.prompt ? props.prompt.slice(0, 40) : `image-${files.length + 1}`
        files.push({ name, dataUrl: props.url })
      } else if (type === 'doc-card' && props.fileContent) {
        if (props.fileType === 'md') {
          const b64 = btoa(unescape(encodeURIComponent(props.fileContent)))
          files.push({
            name: props.fileName,
            dataUrl: `data:text/markdown;base64,${b64}`,
            fileType: 'md',
          })
        } else if (props.fileType === 'pdf') {
          files.push({
            name: props.fileName,
            dataUrl: props.fileContent,
            fileType: 'pdf',
          })
        }
      }
    }

    return files
  }, [editor, selectedShapeIds])

  // ============ JSON 工具调用解析 ============

  /** 从文本中移除 ```json ``` 代码块，保留前后说明文字 */
  const stripCodeBlocks = (text: string): string => {
    const cleaned = text.replace(/```[\w]*\s*\n?[\s\S]*?\n?```/g, '').replace(/\n{3,}/g, '\n\n').trim()
    // 如果清理后为空（整段都是代码块），尝试从 JSON 中提取摘要
    if (!cleaned) {
      // 尝试从 JSON 中提取 name/tagline 作为文本摘要
      const codeMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (codeMatch) {
        let jsonContent = codeMatch[1].trim()
        // 尝试多种修复方式
        const fixAttempts = [
          jsonContent,
          // 修复字符串内换行
          jsonContent.replace(/"([^"\\]|\\.)*"/g, (m) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')),
          // 更激进修复
          jsonContent
            .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
            .replace(/[""]/g, '"').replace(/['']/g, "'")
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/"([^"\\]|\\.)*"/g, (m) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')),
        ]

        for (const attempt of fixAttempts) {
          try {
            const arr = JSON.parse(attempt)
            if (Array.isArray(arr) && arr.length > 0) {
              const names = arr.map((item: any) => item.params?.name || item.name).filter(Boolean)
              if (names.length > 0) {
                return `Agent 生成了 ${names.length} 个结果：${names.join('、')}`
              }
              // 即使没有 name 也返回数量
              return `Agent 生成了 ${arr.length} 个结果`
            } else if (arr && typeof arr === 'object') {
              const name = arr.params?.name || arr.name
              if (name) return `Agent 生成了结果：${name}`
              return 'Agent 已生成结果'
            }
          } catch { /* try next */ }
        }
      }

      // 如果没有代码块但内容像 JSON，也尝试提取信息
      if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
        try {
          const arr = JSON.parse(text.trim())
          if (Array.isArray(arr) && arr.length > 0) {
            const names = arr.map((item: any) => item.params?.name || item.name).filter(Boolean)
            if (names.length > 0) {
              return `Agent 生成了 ${names.length} 个结果：${names.join('、')}`
            }
            return `Agent 生成了 ${arr.length} 个结果`
          }
        } catch { /* ignore */ }
      }

      // 尝试更激进地从文本中提取工具名称，至少显示识别到了什么
      const toolNames: string[] = []
      const toolRegex = /"tool"\s*:\s*"([^"]+)"/g
      let tm
      while ((tm = toolRegex.exec(text)) !== null) {
        if (!toolNames.includes(tm[1])) toolNames.push(tm[1])
      }
      if (toolNames.length > 0) {
        return `正在处理 ${toolNames.length} 个任务：${toolNames.join('、')}...`
      }
      return 'Agent 返回了结构化数据，但解析未成功。请重试。'
    }
    // 如果清理后还含有大段 JSON（未闭合的代码块），再次清理
    if (cleaned.startsWith('[{') || cleaned.startsWith('{"tool"')) {
      return '已完成分析，结果正在处理中...'
    }
    return cleaned
  }

  /** 尝试从 Claude 输出中解析 JSON 工具调用数组 */
  const parseToolCalls = (text: string): Array<{ tool: string; params: any }> | null => {
    let trimmed = text.trim()
    if (import.meta.env.DEV) {
      console.log('[parseToolCalls] input length:', trimmed.length)
      console.log('[parseToolCalls] first 500 chars:', trimmed.slice(0, 500))
    }

    const isToolCallArray = (arr: any): arr is Array<{ tool: string; params: any }> =>
      Array.isArray(arr) && arr.length > 0 && typeof arr[0].tool === 'string'

    // 预处理：从 markdown 代码块中提取 JSON 内容
    // 支持代码块在文本任意位置（Claude 有时会在 JSON 前输出解释文字）
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g
    const codeBlockMatches: string[] = []
    let cbMatch: RegExpExecArray | null
    while ((cbMatch = codeBlockRegex.exec(trimmed)) !== null) {
      const content = cbMatch[1].trim()
      if (content) codeBlockMatches.push(content)
    }
    // 如果找到代码块，优先用代码块内容（选包含 "tool" 的那个）
    if (codeBlockMatches.length > 0) {
      const toolBlock = codeBlockMatches.find(b => b.includes('"tool"')) || codeBlockMatches[0]
      trimmed = toolBlock
      if (import.meta.env.DEV) {
        console.log('[parseToolCalls] extracted from code block, new length:', trimmed.length)
      }
    } else {
      // 回退：尝试剥离开头的 ``` (未闭合的代码块，如流式截断)
      const codeBlockOpen = trimmed.match(/^```(?:json)?\s*\n?/)
      if (codeBlockOpen) {
        trimmed = trimmed.slice(codeBlockOpen[0].length).trim()
        if (import.meta.env.DEV) {
          console.log('[parseToolCalls] stripped unclosed code block, new length:', trimmed.length)
        }
      }
    }

    // 预处理：修复字符串中的非法字符（换行、制表符等）
    // JSON 字符串中不能有未转义的换行，需要转为 \n
    const fixJsonStringLiterals = (json: string): string => {
      // 在字符串字面量内部将真实换行替换为 \n
      // 这个正则匹配 JSON 字符串内容并修复
      return json.replace(/"([^"\\]|\\.)*"/g, (match) => {
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
      })
    }

    // 更激进的 JSON 修复：处理各种常见问题
    const aggressiveJsonFix = (json: string): string => {
      let fixed = json
      // 1. 修复字符串内的换行
      fixed = fixJsonStringLiterals(fixed)
      // 2. 移除 BOM 和零宽字符
      fixed = fixed.replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
      // 3. 标准化引号（中文引号 → 英文引号）
      fixed = fixed.replace(/[""]/g, '"').replace(/['']/g, "'")
      // 4. 移除注释（// 和 /* */）
      fixed = fixed.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      // 5. 修复尾部逗号（对象/数组最后一项后的逗号）
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
      // 6. 修复单引号属性名和值
      fixed = fixed.replace(/'([^']+)'(\s*:)/g, '"$1"$2')
      // 7. 修复 undefined/NaN 为 null
      fixed = fixed.replace(/:\s*undefined\b/g, ': null').replace(/:\s*NaN\b/g, ': null')
      return fixed
    }

    // 策略 1：整体 JSON.parse
    try {
      const parsed = JSON.parse(trimmed)
      if (isToolCallArray(parsed)) return parsed
      // 单个工具对象 {"tool": "...", "params": {...}}
      if (parsed && typeof parsed.tool === 'string' && parsed.params) return [parsed]
    } catch (e1) {
      if (import.meta.env.DEV) {
        console.warn('[parseToolCalls] strategy 1 failed:', (e1 as Error).message)
        // 找到 JSON.parse 报错的位置附近字符
        const posMatch = (e1 as Error).message.match(/position\s+(\d+)/)
        if (posMatch) {
          const pos = parseInt(posMatch[1])
          console.warn('[parseToolCalls] error at pos', pos, '| around:', JSON.stringify(trimmed.slice(Math.max(0, pos - 20), pos + 20)))
          console.warn('[parseToolCalls] charCodes around pos:', Array.from(trimmed.slice(Math.max(0, pos - 5), pos + 5)).map(c => c.charCodeAt(0)))
        }
      }
      // 策略 1b：尝试修复字符串中的非法换行后重新解析
      try {
        const fixed = fixJsonStringLiterals(trimmed)
        const parsed = JSON.parse(fixed)
        if (isToolCallArray(parsed)) return parsed
        if (parsed && typeof parsed.tool === 'string' && parsed.params) return [parsed]
      } catch {
        // 策略 1c：更激进的修复
        try {
          const aggressiveFixed = aggressiveJsonFix(trimmed)
          const parsed = JSON.parse(aggressiveFixed)
          if (isToolCallArray(parsed)) return parsed
          if (parsed && typeof parsed.tool === 'string' && parsed.params) return [parsed]
        } catch {
          // 修复也失败，继续下一策略
        }
      }
    }

    // 策略 2：尝试找到 JSON 数组的开始和结束
    const firstBracket = trimmed.indexOf('[')
    const lastBracket = trimmed.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const slice = trimmed.slice(firstBracket, lastBracket + 1)
      try {
        const parsed = JSON.parse(slice)
        if (isToolCallArray(parsed)) return parsed
      } catch (e2) {
        if (import.meta.env.DEV) console.warn('[parseToolCalls] strategy 2 failed:', (e2 as Error).message)
        // 策略 2 修复版：修复换行后重试
        try {
          const fixed = aggressiveJsonFix(slice)
          const parsed = JSON.parse(fixed)
          if (isToolCallArray(parsed)) return parsed
        } catch { /* 修复也失败 */ }
      }
    }

    // 策略 2b：尝试找到 JSON 对象 {...}（单个工具调用）
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = trimmed.slice(firstBrace, lastBrace + 1)
      try {
        const parsed = JSON.parse(slice)
        if (parsed && typeof parsed.tool === 'string' && parsed.params) return [parsed]
      } catch {
        // 策略 2b 修复版：修复换行后重试
        try {
          const fixed = aggressiveJsonFix(slice)
          const parsed = JSON.parse(fixed)
          if (parsed && typeof parsed.tool === 'string' && parsed.params) return [parsed]
        } catch { /* 修复也失败 */ }
      }
    }

    // 策略 3：修复截断 JSON — 找到 [ 开头，截断到最后一个完整的 }
    if (firstBracket !== -1) {
      const jsonPart = trimmed.slice(firstBracket)
      // 找到最后一个完整对象的结尾 "}," 或 "}"
      const lastCompleteObj = jsonPart.lastIndexOf('}')
      if (lastCompleteObj > 0) {
        // 尝试补全为合法 JSON 数组
        let candidate = jsonPart.slice(0, lastCompleteObj + 1)
        // 移除尾部逗号
        candidate = candidate.replace(/,\s*$/, '')
        // 如果不以 ] 结尾则补 ]
        if (!candidate.endsWith(']')) candidate += ']'
        try {
          const parsed = JSON.parse(candidate)
          if (isToolCallArray(parsed)) return parsed
        } catch {
          // 策略 3 修复版
          try {
            const fixed = aggressiveJsonFix(candidate)
            const parsed = JSON.parse(fixed)
            if (isToolCallArray(parsed)) return parsed
          } catch { /* 修复也失败 */ }
        }
      }
    }

    // 策略 4：逐个对象解析（处理不完整的数组）
    // 当数组格式不完整时，尝试手动查找并解析 {...} 对象
    const parsedObjects: Array<{ tool: string; params: any }> = []

    // 方法 4a：使用简单正则匹配浅层嵌套（一层大括号）
    const simpleMatches = trimmed.matchAll(/\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{[^{}]*\}\s*\}/g)
    for (const match of simpleMatches) {
      try {
        const obj = JSON.parse(aggressiveJsonFix(match[0]))
        if (obj && typeof obj.tool === 'string' && obj.params) {
          parsedObjects.push(obj)
        }
      } catch { /* 单个对象解析失败，跳过 */ }
    }

    // 方法 4b：使用括号计数法查找完整的 tool call 对象（支持深层嵌套）
    if (parsedObjects.length === 0) {
      const toolStart = /"tool"\s*:\s*"/g
      let startMatch
      while ((startMatch = toolStart.exec(trimmed)) !== null) {
        // 向前找到这个对象的开始 {
        let startIdx = startMatch.index
        while (startIdx > 0 && trimmed[startIdx] !== '{') startIdx--
        if (trimmed[startIdx] !== '{') continue

        // 从 { 开始，用括号计数找到配对的 }
        let depth = 0
        let endIdx = startIdx
        let inString = false
        let escapeNext = false
        for (let i = startIdx; i < trimmed.length; i++) {
          const c = trimmed[i]
          if (escapeNext) {
            escapeNext = false
            continue
          }
          if (c === '\\') {
            escapeNext = true
            continue
          }
          if (c === '"') {
            inString = !inString
            continue
          }
          if (inString) continue
          if (c === '{') depth++
          if (c === '}') {
            depth--
            if (depth === 0) {
              endIdx = i
              break
            }
          }
        }
        if (depth === 0 && endIdx > startIdx) {
          const candidate = trimmed.slice(startIdx, endIdx + 1)
          try {
            const obj = JSON.parse(aggressiveJsonFix(candidate))
            if (obj && typeof obj.tool === 'string' && obj.params) {
              // 检查是否重复
              const isDup = parsedObjects.some(p => p.tool === obj.tool && JSON.stringify(p.params) === JSON.stringify(obj.params))
              if (!isDup) {
                parsedObjects.push(obj)
              }
            }
          } catch { /* 解析失败，跳过 */ }
        }
      }
    }

    if (parsedObjects.length > 0) {
      if (import.meta.env.DEV) {
        console.log('[parseToolCalls] strategy 4 succeeded, parsed', parsedObjects.length, 'objects')
      }
      return parsedObjects
    }

    // 策略 5：超级激进修复 - 尝试从文本中重建 JSON
    // 有时 Claude 返回的 JSON 中存在无法预见的格式问题
    // 我们尝试直接提取字段内容并重建 JSON
    if (trimmed.includes('"tool"') && trimmed.includes('"params"')) {
      console.log('[parseToolCalls] strategy 5: attempting to rebuild JSON from text')

      // 找出所有 tool 调用的边界
      const toolMatches: Array<{ tool: string; params: any }> = []

      // 用正则提取 tool 名称和 params 块
      // 匹配模式：{ "tool": "xxx", "params": {...} } 或 { "tool": "xxx", "params": [...] }
      const toolNameRegex = /"tool"\s*:\s*"([^"]+)"/g
      let toolMatch

      while ((toolMatch = toolNameRegex.exec(trimmed)) !== null) {
        const toolName = toolMatch[1]
        const afterToolPos = toolMatch.index + toolMatch[0].length

        // 从 tool 声明之后找 params
        const paramsStartMatch = trimmed.slice(afterToolPos).match(/^\s*,\s*"params"\s*:\s*/)
        if (!paramsStartMatch) continue

        const paramsContentStart = afterToolPos + paramsStartMatch[0].length
        const paramsStartChar = trimmed[paramsContentStart]

        if (paramsStartChar !== '{' && paramsStartChar !== '[') continue

        // 使用括号计数提取 params 内容
        const openChar = paramsStartChar
        const closeChar = openChar === '{' ? '}' : ']'
        let depth = 0
        let inString = false
        let escapeNext = false
        let endPos = paramsContentStart

        for (let i = paramsContentStart; i < trimmed.length; i++) {
          const c = trimmed[i]
          if (escapeNext) {
            escapeNext = false
            continue
          }
          if (c === '\\') {
            escapeNext = true
            continue
          }
          if (c === '"') {
            inString = !inString
            continue
          }
          if (inString) continue
          if (c === openChar) depth++
          if (c === closeChar) {
            depth--
            if (depth === 0) {
              endPos = i
              break
            }
          }
        }

        if (depth === 0 && endPos > paramsContentStart) {
          const paramsStr = trimmed.slice(paramsContentStart, endPos + 1)
          // 尝试解析 params
          try {
            // 修复 params 中的问题
            let fixedParams = paramsStr
              .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
              .replace(/[""]/g, '"').replace(/['']/g, "'")
              .replace(/,(\s*[}\]])/g, '$1')
            // 修复字符串内的换行
            fixedParams = fixedParams.replace(/"([^"\\]|\\.)*"/g, (m) =>
              m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
            )

            const params = JSON.parse(fixedParams)
            // 检查是否重复
            const isDup = toolMatches.some(p => p.tool === toolName && JSON.stringify(p.params) === JSON.stringify(params))
            if (!isDup) {
              toolMatches.push({ tool: toolName, params })
            }
          } catch (e) {
            console.warn('[parseToolCalls] strategy 5: failed to parse params for', toolName, ':', (e as Error).message)
          }
        }
      }

      if (toolMatches.length > 0) {
        console.log('[parseToolCalls] strategy 5 succeeded, parsed', toolMatches.length, 'objects')
        return toolMatches
      }
    }

    // 打印更详细的调试信息（生产环境也打印，便于排查）
    console.warn('[parseToolCalls] all strategies failed, returning null')
    console.warn('[parseToolCalls] original text length:', text.length)
    console.warn('[parseToolCalls] trimmed length:', trimmed.length)
    console.warn('[parseToolCalls] first 500 chars:', trimmed.slice(0, 500))
    console.warn('[parseToolCalls] last 200 chars:', trimmed.slice(-200))
    // 打印一些关键位置的字符码，帮助发现隐藏字符
    if (trimmed.length > 0) {
      console.warn('[parseToolCalls] first 10 charCodes:', Array.from(trimmed.slice(0, 10)).map(c => c.charCodeAt(0)))
      const bracket = trimmed.indexOf('[')
      if (bracket !== -1) {
        console.warn('[parseToolCalls] chars around first [:', Array.from(trimmed.slice(Math.max(0, bracket - 5), bracket + 10)).map(c => `${c}(${c.charCodeAt(0)})`).join(' '))
      }
    }
    return null
  }

  /** 执行工具调用，在画布上创建对应 shape */
  const executeToolCalls = useCallback((
    toolCalls: Array<{ tool: string; params: any }>,
    taskId: string,
  ) => {
    if (!editor) return

    const cards = toolCalls.filter(tc => tc.tool === 'create_card')
    const tables = toolCalls.filter(tc => tc.tool === 'create_table')
    const connections = toolCalls.filter(tc => tc.tool === 'create_connection')
    const groups = toolCalls.filter(tc => tc.tool === 'create_group')
    const slides = toolCalls.filter(tc => tc.tool === 'create_slide')

    if (cards.length === 0 && tables.length === 0 && connections.length === 0 && groups.length === 0 && slides.length === 0) return

    // 批量执行所有 shape 操作，减少中间渲染
    editor.batch(() => {

    // 名称 → ShapeId 映射，用于 create_connection / create_group 引用
    const nameToId = new Map<string, TLShapeId>()

    // 网格布局 for cards
    const centerPage = getViewportCenter(editor)
    const cardW = 280
    const cardH = 120
    const gap = 16

    let bottomY = centerPage.y - 100 // track bottom edge for table placement

    if (cards.length > 0) {
      const hasSpatialLayout = connections.length > 0 || groups.length > 0

      if (hasSpatialLayout) {
        // ====== 拓扑感知布局 ======

        // 1. 构建有向图（邻接表 + 入度表）
        const adj = new Map<string, string[]>()
        const inDeg = new Map<string, number>()
        const allCardNames = cards.map(c => c.params.name || '未命名')

        for (const name of allCardNames) {
          adj.set(name, [])
          inDeg.set(name, 0)
        }

        for (const conn of connections) {
          const { from, to } = conn.params
          if (adj.has(from) && inDeg.has(to)) {
            adj.get(from)!.push(to)
            inDeg.set(to, (inDeg.get(to) || 0) + 1)
          }
        }

        // 2. Kahn 算法 — 分层拓扑排序
        const layers: string[][] = []
        const remaining = new Set(allCardNames)

        while (remaining.size > 0) {
          const currentLayer = Array.from(remaining).filter(n => (inDeg.get(n) || 0) === 0)

          if (currentLayer.length === 0) {
            // 有环或孤立节点 → 把剩余全部放到当前层
            layers.push(Array.from(remaining))
            break
          }

          layers.push(currentLayer)

          for (const node of currentLayer) {
            remaining.delete(node)
            for (const neighbor of (adj.get(node) || [])) {
              inDeg.set(neighbor, (inDeg.get(neighbor) || 1) - 1)
            }
          }
        }

        // 3. 如果有 groups，在每层内把同组卡片排在一起
        const cardToGroup = new Map<string, string>()
        for (const g of groups) {
          for (const name of (g.params.items || [])) {
            cardToGroup.set(name, g.params.label || '')
          }
        }

        for (const layer of layers) {
          layer.sort((a, b) => {
            const ga = cardToGroup.get(a) || ''
            const gb = cardToGroup.get(b) || ''
            return ga.localeCompare(gb)
          })
        }

        // 4. 计算位置
        const layerGap = 60
        let currentY = centerPage.y - 100

        for (const layer of layers) {
          const layerWidth = layer.length * (cardW + gap) - gap
          const layerStartX = centerPage.x - layerWidth / 2

          for (let i = 0; i < layer.length; i++) {
            const cardName = layer[i]
            const cardData = cards.find(c => (c.params.name || '未命名') === cardName)
            if (!cardData) continue

            const hasImage = !!cardData.params.imageUrl
            const thisCardH = hasImage ? 260 : cardH

            const shapeId = createShapeId()
            nameToId.set(cardName, shapeId)

            editor.createShape({
              id: shapeId,
              type: 'product-card' as any,
              x: layerStartX + i * (cardW + gap),
              y: currentY,
              props: {
                w: cardW,
                h: thisCardH,
                name: cardName,
                tagline: cardData.params.tagline || '',
                tags: JSON.stringify(cardData.params.tags || []),
                detail: cardData.params.detail || '',
                sources: '[]',
                expanded: false,
                sourceTaskId: taskId,
                imageUrl: cardData.params.imageUrl || '',
              },
            })
          }

          // 这一层最高的卡片高度决定 currentY 推进
          const maxH = Math.max(...layer.map(name => {
            const cd = cards.find(c => (c.params.name || '未命名') === name)
            return cd?.params.imageUrl ? 260 : cardH
          }))
          currentY += maxH + layerGap
        }

        // 5. 拓扑布局后计算实际边界
        const allIds = Array.from(nameToId.values())
        let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
        for (const sid of allIds) {
          const b = editor.getShapePageBounds(sid)
          if (!b) continue
          bMinX = Math.min(bMinX, b.x)
          bMinY = Math.min(bMinY, b.y)
          bMaxX = Math.max(bMaxX, b.maxX)
          bMaxY = Math.max(bMaxY, b.maxY)
        }
        const pad = 40
        setWorkingZoneBounds({ x: bMinX - pad, y: bMinY - pad, w: bMaxX - bMinX + pad * 2, h: bMaxY - bMinY + pad * 2 })

        if (tables.length === 0) {
          editor.zoomToBounds(
            { x: bMinX - pad, y: bMinY - pad, w: bMaxX - bMinX + pad * 2, h: bMaxY - bMinY + pad * 2 },
            { animation: { duration: 600 } }
          )
        }

        bottomY = bMaxY + gap

        // 处理 ask_user 工具调用
        const asks = toolCalls.filter(tc => tc.tool === 'ask_user')
        if (asks.length > 0) {
          const ask = asks[0].params
          createComment(
            { x: centerPage.x - 120, y: bMaxY + 20 },
            ask.question || '需要你的决定',
            (ask.options || []).map((opt: string) => ({ label: opt, type: 'option' })),
          )
        }
      } else {
        // ====== 原有网格布局（不变） ======
        const cols = Math.min(cards.length, 4)
        const totalRowWidth = cols * (cardW + gap) - gap
        const startX = centerPage.x - totalRowWidth / 2
        const startY = centerPage.y - 100

        setWorkingZoneBounds(computeZoneBounds(centerPage, cards.length, cardW, cardH, gap, 4))

        for (let i = 0; i < cards.length; i++) {
          const { params } = cards[i]
          const col = i % cols
          const row = Math.floor(i / cols)
          const hasImage = !!params.imageUrl
          const thisCardH = hasImage ? 260 : cardH

          const shapeId = createShapeId()
          const cardName = params.name || '未命名'
          nameToId.set(cardName, shapeId)

          editor.createShape({
            id: shapeId,
            type: 'product-card' as any,
            x: startX + col * (cardW + gap),
            y: startY + row * (thisCardH + gap),
            props: {
              w: cardW,
              h: thisCardH,
              name: cardName,
              tagline: params.tagline || '',
              tags: JSON.stringify(params.tags || []),
              detail: params.detail || '',
              sources: '[]',
              expanded: false,
              sourceTaskId: taskId,
              imageUrl: params.imageUrl || '',
            },
          })
        }

        const lastRow = Math.floor((cards.length - 1) / cols)
        bottomY = startY + (lastRow + 1) * (cardH + gap)

        if (tables.length === 0) {
          editor.zoomToBounds(
            {
              x: startX - 40,
              y: startY - 40,
              w: totalRowWidth + 80,
              h: (lastRow + 1) * (cardH + gap) + 80,
            },
            { animation: { duration: 600 } }
          )
        }

        const asks = toolCalls.filter(tc => tc.tool === 'ask_user')
        if (asks.length > 0) {
          const ask = asks[0].params
          const commentX = startX + totalRowWidth / 2 - 120
          const commentY = startY + (lastRow + 1) * (cardH + gap) + 20
          createComment(
            { x: commentX, y: commentY },
            ask.question || '需要你的决定',
            (ask.options || []).map((opt: string) => ({ label: opt, type: 'option' })),
          )
        }
      }
    }

    // 创建表格卡片
    if (tables.length > 0) {
      const tableStartY = cards.length > 0 ? bottomY + 20 : centerPage.y - 100
      let currentY = tableStartY

      for (const table of tables) {
        const { title, headers, rows, sheets } = table.params
        const headersStr = JSON.stringify(headers || [])
        const rowsStr = JSON.stringify(rows || [])
        const sheetsStr = JSON.stringify(sheets || [])

        // 估算表格宽度用于居中（考虑多 sheet 取最大列数）
        let maxCols = Math.max((headers || []).length, 1)
        let maxRows = (rows || []).length
        if (Array.isArray(sheets) && sheets.length > 0) {
          maxCols = Math.max(...sheets.map((s: any) => (s.headers || []).length), 1)
          maxRows = Math.max(...sheets.map((s: any) => (s.rows || []).length), 1)
        }
        const tableW = Math.max(400, Math.min(1200, maxCols * 160 + 40))

        const tableId = createShapeId()
        const tableName = title || '表格'
        nameToId.set(tableName, tableId)

        editor.createShape({
          id: tableId,
          type: 'table-card' as any,
          x: centerPage.x - tableW / 2,
          y: currentY,
          props: {
            title: tableName,
            headers: headersStr,
            rows: rowsStr,
            sheets: sheetsStr,
            sourceTaskId: taskId,
          },
        })

        // 估算高度，为下一个表格留空间
        const tabBarH = Array.isArray(sheets) && sheets.length > 1 ? 36 : 0
        const tableH = 44 + 36 + maxRows * 36 + tabBarH + 12
        currentY += tableH + 20
      }

      // 更新工作区边界并缩放
      const totalH = currentY - tableStartY
      const boundsX = centerPage.x - 380
      const boundsY = cards.length > 0 ? centerPage.y - 100 - 40 : tableStartY - 40
      const boundsH = cards.length > 0 ? (currentY - (centerPage.y - 100)) + 80 : totalH + 80
      setWorkingZoneBounds({ x: boundsX, y: boundsY, w: 760, h: boundsH })

      editor.zoomToBounds(
        { x: boundsX, y: boundsY, w: 760, h: boundsH },
        { animation: { duration: 600 } }
      )
    }

    // 如果只有 ask_user 没有 cards 也没有 tables
    if (cards.length === 0 && tables.length === 0) {
      const asks = toolCalls.filter(tc => tc.tool === 'ask_user')
      if (asks.length > 0) {
        const ask = asks[0].params
        createComment(
          { x: centerPage.x - 120, y: centerPage.y },
          ask.question || '需要你的决定',
          (ask.options || []).map((opt: string) => ({ label: opt, type: 'option' })),
        )
      }
    }

    // ====== 空间工具：create_connection（箭头连线） ======
    for (const conn of connections) {
      const { from, to, label } = conn.params
      const fromId = nameToId.get(from)
      const toId = nameToId.get(to)
      if (!fromId || !toId) continue

      const fromBounds = editor.getShapePageBounds(fromId)
      const toBounds = editor.getShapePageBounds(toId)
      if (!fromBounds || !toBounds) continue

      const arrowId = createShapeId()
      editor.createShape({
        id: arrowId,
        type: 'arrow',
        x: 0,
        y: 0,
        props: {
          start: { x: fromBounds.midX, y: fromBounds.midY },
          end: { x: toBounds.midX, y: toBounds.midY },
          text: label || '',
        },
      })

      // 创建绑定，让箭头跟随卡片移动
      editor.createBindings([
        {
          type: 'arrow',
          fromId: arrowId,
          toId: fromId,
          props: {
            terminal: 'start',
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
            isPrecise: false,
          },
        },
        {
          type: 'arrow',
          fromId: arrowId,
          toId: toId,
          props: {
            terminal: 'end',
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
            isPrecise: false,
          },
        },
      ])
    }

    // ====== 空间工具：create_group（Frame 分组） ======
    for (const group of groups) {
      const { items, label } = group.params
      if (!Array.isArray(items) || items.length === 0) continue

      const childIds: TLShapeId[] = []
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

      for (const name of items) {
        const id = nameToId.get(name)
        if (!id) continue
        childIds.push(id)
        const bounds = editor.getShapePageBounds(id)
        if (!bounds) continue
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.maxX)
        maxY = Math.max(maxY, bounds.maxY)
      }

      if (childIds.length === 0) continue

      const padding = 20
      const frameId = createShapeId()
      editor.createShape({
        id: frameId,
        type: 'frame',
        x: minX - padding,
        y: minY - padding - 30, // 额外 30px 给 frame 标题
        props: {
          w: (maxX - minX) + padding * 2,
          h: (maxY - minY) + padding * 2 + 30,
          name: label || '',
        },
      })

      // 将卡片移入 frame
      editor.reparentShapes(childIds, frameId)
    }

    // ====== create_slide：PPT 幻灯片（Frame + 子元素） ======
    if (slides.length > 0) {
      const SLIDE_W = 960
      const SLIDE_H = 540
      const slideGap = 60

      // 幻灯片放在现有内容下方
      const slideStartX = centerPage.x - SLIDE_W / 2
      const slideStartY = bottomY + 80

      for (let si = 0; si < slides.length; si++) {
        const slide = slides[si]
        const { title, elements, background } = slide.params
        const col = si % 2
        const row = Math.floor(si / 2)
        const frameX = slideStartX + col * (SLIDE_W + slideGap)
        const frameY = slideStartY + row * (SLIDE_H + slideGap)

        const frameId = createShapeId()
        editor.createShape({
          id: frameId,
          type: 'frame',
          x: frameX,
          y: frameY,
          props: { w: SLIDE_W, h: SLIDE_H, name: `Slide ${si + 1}: ${title || ''}` },
        })

        const slideChildIds: TLShapeId[] = []

        // 背景色块（geo rectangle，第一个子元素）
        if (background) {
          const bgId = createShapeId()
          editor.createShape({
            id: bgId,
            type: 'geo',
            x: frameX,
            y: frameY,
            props: {
              w: SLIDE_W, h: SLIDE_H,
              geo: 'rectangle', fill: 'solid', color: background,
              dash: 'draw', size: 'm', font: 'sans',
              text: '', align: 'middle', verticalAlign: 'middle',
              growY: 0, url: '', scale: 1, labelColor: 'black',
            },
          })
          slideChildIds.push(bgId)
        }

        // 元素
        for (const el of (elements || [])) {
          if (el.type === 'text') {
            const id = createShapeId()
            editor.createShape({
              id,
              type: 'text',
              x: frameX + (el.x || 0),
              y: frameY + (el.y || 0),
              props: {
                text: el.content || '',
                size: el.fontSize || 'm',
                color: el.color || 'black',
                font: 'sans',
                textAlign: el.align || 'start',
                w: el.w || 400,
                autoSize: false,
                scale: 1,
              },
            })
            slideChildIds.push(id)
          } else if (el.type === 'image') {
            const id = createShapeId()
            editor.createShape({
              id,
              type: 'ai-image' as any,
              x: frameX + (el.x || 0),
              y: frameY + (el.y || 0),
              props: { w: el.w || 300, h: el.h || 200, url: el.url || '' },
            })
            slideChildIds.push(id)
          } else if (el.type === 'shape') {
            const id = createShapeId()
            const shapeColor = el.color || 'black'
            editor.createShape({
              id,
              type: 'geo',
              x: frameX + (el.x || 0),
              y: frameY + (el.y || 0),
              props: {
                w: el.w || 200, h: el.h || 100,
                geo: el.geo || 'rectangle',
                fill: el.fill ? 'solid' : 'none',
                color: shapeColor,
                labelColor: shapeColor,
                text: el.text || '',
                font: 'sans', size: 'm', align: 'middle', verticalAlign: 'middle',
                dash: 'draw', growY: 0, url: '', scale: 1,
              },
            })
            slideChildIds.push(id)
          }
        }

        // 把所有子元素移入 frame
        if (slideChildIds.length > 0) {
          editor.reparentShapes(slideChildIds, frameId)
        }
      }

      // 更新 bottomY
      const totalSlideRows = Math.ceil(slides.length / 2)
      bottomY = slideStartY + totalSlideRows * (SLIDE_H + slideGap)

      // 缩放到幻灯片区域
      const slideBoundsW = slides.length > 1 ? 960 * 2 + slideGap : 960
      const slideBoundsH = totalSlideRows * (540 + slideGap)
      const slideBoundsX = slideStartX - 40
      const slideBoundsY = slideStartY - 40
      setWorkingZoneBounds({ x: slideBoundsX, y: slideBoundsY, w: slideBoundsW + 80, h: slideBoundsH + 80 })
      editor.zoomToBounds(
        { x: slideBoundsX, y: slideBoundsY, w: slideBoundsW + 80, h: slideBoundsH + 80 },
        { animation: { duration: 600 } }
      )
    }

    }) // end editor.batch()
  }, [editor, createComment])

  // ============ Claude CLI 真实调用 ============

  /** 检测中继服务是否在线 */
  const isClaudeServerRunning = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 1000)
      const res = await fetch('/api/health', { signal: controller.signal })
      clearTimeout(timer)
      return res.ok
    } catch {
      return false
    }
  }, [])

  /**
   * 直连 Anthropic Messages API（前端直调，无需 server 中继）
   * 返回完整响应文本，如果失败返回 null
   */
  const callAnthropicDirectly = useCallback(async (
    userMessage: string,
    canvasContext: string,
    canvasFiles: Array<{ name: string; dataUrl: string; fileType?: string }>,
    onProgress?: (text: string) => void,
  ): Promise<string | null> => {
    const apiKey = getApiKey()
    if (!apiKey) return null

    // Build system prompt with canvas context + file content (MD embedded as text)
    let systemText = buildSystemPrompt()
    if (canvasContext) {
      systemText += '\n\n' + canvasContext
    }

    // Embed MD file contents directly into system prompt
    const mdFiles = canvasFiles.filter(f => f.fileType === 'md')
    if (mdFiles.length > 0) {
      systemText += '\n\n[画布上的文件]\n'
      for (const f of mdFiles) {
        let text = ''
        try {
          const b64Part = f.dataUrl.split(',')[1]
          text = decodeURIComponent(escape(atob(b64Part)))
        } catch { /* ignore decode error */ }
        systemText += `\n--- ${f.name} ---\n${text}\n`
      }
    }

    // Build user message content blocks
    const userContent: any[] = []

    // Add image files as image content blocks (for vision)
    const imageFiles = canvasFiles.filter(f => f.fileType?.startsWith('image/'))
    for (const f of imageFiles) {
      const b64Part = f.dataUrl.split(',')[1]
      if (b64Part) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: f.fileType!,
            data: b64Part,
          },
        })
      }
    }

    // Add PDF files as document blocks
    const pdfFiles = canvasFiles.filter(f => f.fileType === 'pdf')
    for (const f of pdfFiles) {
      const b64Part = f.dataUrl.split(',')[1]
      if (b64Part) {
        userContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: b64Part,
          },
        })
      }
    }

    userContent.push({ type: 'text', text: userMessage })

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          stream: true,
          system: systemText,
          messages: [{ role: 'user', content: userContent }],
        }),
      })

      if (!res.ok || !res.body) {
        const statusInfo = `${res.status} ${res.statusText}`
        console.error('Anthropic API error:', statusInfo)
        // 存储错误信息供上层使用
        ;(callAnthropicDirectly as any).__lastError = statusInfo
        return null
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const chunks: string[] = []
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('event:')) continue
          if (!trimmed.startsWith('data:')) continue

          const jsonStr = trimmed.slice(5).trim()
          if (jsonStr === '[DONE]') continue

          let event: any
          try { event = JSON.parse(jsonStr) } catch { continue }

          if (event.type === 'content_block_delta') {
            const delta = event.delta
            if (delta?.type === 'text_delta' && delta.text) {
              chunks.push(delta.text)
              onProgress?.(chunks.join(''))
            }
          }
          // message_stop → stream finished, handled by done check
        }
      }

      return chunks.join('').trim()
    } catch (err) {
      console.error('Anthropic direct call error:', err)
      const msg = err instanceof Error ? err.message : 'Network error'
      ;(callAnthropicDirectly as any).__lastError = msg
      return null
    }
  }, [])

  /**
   * 头脑风暴阶段：快速调用 Claude 分析用户意图，返回一个 ask_user 澄清问题。
   * 返回 null 表示跳过（API 不可用），返回 { question, options } 表示成功。
   */
  const brainstormIntent = useCallback(async (
    userMessage: string,
    canvasContext: string,
    canvasFiles: Array<{ name: string; dataUrl: string; fileType?: string }>,
    onProgress?: (text: string) => void,
  ): Promise<{ question: string; options: string[] } | null> => {
    if (import.meta.env.DEV) console.log('[brainstorm] starting for:', userMessage.slice(0, 50))

    // Build brainstorm system prompt with canvas context
    let systemText = BRAINSTORM_SYSTEM_PROMPT
    if (canvasContext) {
      systemText += '\n\n' + canvasContext
    }

    const apiKey = getApiKey()

    try {
      let fullText = ''

      if (apiKey) {
        // ====== Direct API path ======
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 512,
            stream: true,
            system: systemText,
            messages: [{ role: 'user', content: userMessage }],
          }),
        })

        if (!res.ok || !res.body) {
          if (import.meta.env.DEV) console.log('[brainstorm] API error:', res.status, res.statusText)
          return null
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        const bsChunks: string[] = []
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('event:')) continue
            if (!trimmed.startsWith('data:')) continue
            const jsonStr = trimmed.slice(5).trim()
            if (jsonStr === '[DONE]') continue
            let event: any
            try { event = JSON.parse(jsonStr) } catch { continue }
            if (event.type === 'content_block_delta') {
              const delta = event.delta
              if (delta?.type === 'text_delta' && delta.text) {
                bsChunks.push(delta.text)
                onProgress?.(bsChunks.join(''))
              }
            }
            if (event.type === 'error') {
              if (import.meta.env.DEV) console.log('[brainstorm] stream error event:', event)
            }
          }
        }
        fullText = bsChunks.join('')
      } else {
        // ====== Server relay path ======
        if (import.meta.env.DEV) console.log('[brainstorm] using server relay')
        const serverUp = await isClaudeServerRunning()
        if (!serverUp) {
          if (import.meta.env.DEV) console.log('[brainstorm] server not running, skipping')
          return null
        }

        const res = await fetch('/api/brainstorm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            canvasContext,
            systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
          }),
        })

        if (!res.ok) {
          if (import.meta.env.DEV) console.log('[brainstorm] server error:', res.status)
          return null
        }

        const data = await res.json()
        fullText = data.text || ''
      }

      // Parse the brainstorm result to extract ask_user
      if (import.meta.env.DEV) console.log('[brainstorm] raw response:', fullText.slice(0, 300))
      const toolCalls = parseToolCalls(fullText.trim())
      if (toolCalls && toolCalls.length > 0) {
        const askUser = toolCalls.find(tc => tc.tool === 'ask_user')
        if (askUser && askUser.params?.question && Array.isArray(askUser.params?.options)) {
          if (import.meta.env.DEV) console.log('[brainstorm] success:', askUser.params.question)
          return { question: askUser.params.question, options: askUser.params.options }
        }
      }

      if (import.meta.env.DEV) console.log('[brainstorm] parse failed, returning null')
      return null
    } catch (err) {
      if (import.meta.env.DEV) console.error('Brainstorm call error:', err)
      return null
    }
  }, [isClaudeServerRunning])

  /**
   * 通过底部强提示浮层（activePrompt）等待用户选择。
   * 弹出气泡卡片，返回用户点击的选项文字。
   */
  const waitForPromptSelection = useCallback((
    taskId: string,
    question: string,
    options: string[],
  ): Promise<string> => {
    return new Promise<string>(resolve => {
      setActivePrompt({
        id: `prompt-${taskId}`,
        question,
        options,
        taskId,
      })
      promptResolverRef.current = resolve
    })
  }, [])

  /**
   * 任务完成后，调用 Claude 生成下一步建议，以 comment 气泡显示在画布上。
   * 后台执行，不阻塞主流程。
   */
  const suggestNextStep = useCallback(async (
    completedTask: string,
    canvasContext: string,
  ) => {
    if (!editor) return
    if (import.meta.env.DEV) console.log('[suggestNextStep] starting for:', completedTask.slice(0, 50))

    try {
      let text = ''

      const apiKey = getApiKey()
      if (apiKey) {
        // ====== Direct API path ======
        let systemText = SUGGEST_NEXT_STEP_PROMPT
        if (canvasContext) {
          systemText += '\n\n' + canvasContext
        }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 256,
            stream: false,
            system: systemText,
            messages: [{ role: 'user', content: `刚完成的任务：${completedTask}` }],
          }),
        })

        if (!res.ok) {
          if (import.meta.env.DEV) console.log('[suggestNextStep] API error:', res.status, res.statusText)
          return
        }

        const data = await res.json()
        text = data.content?.[0]?.text?.trim() || ''
      } else {
        // ====== Server relay path ======
        if (import.meta.env.DEV) console.log('[suggestNextStep] using server relay')
        const serverUp = await isClaudeServerRunning()
        if (!serverUp) {
          if (import.meta.env.DEV) console.log('[suggestNextStep] server not running, skipping')
          return
        }

        const res = await fetch('/api/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            completedTask,
            canvasContext,
            systemPrompt: SUGGEST_NEXT_STEP_PROMPT,
          }),
        })

        if (!res.ok) {
          if (import.meta.env.DEV) console.log('[suggestNextStep] server error:', res.status)
          return
        }

        const data = await res.json()
        text = data.text?.trim() || ''
      }

      if (!text) return

      // 解析 JSON — 从可能的 code block 中提取（支持代码块在文本任意位置）
      let jsonStr = text
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim()
      }
      if (import.meta.env.DEV) console.log('[suggestNextStep] raw text:', text.slice(0, 200))

      let suggestion: { message: string; options: string[] }
      try {
        suggestion = JSON.parse(jsonStr)
      } catch (parseErr) {
        if (import.meta.env.DEV) console.log('[suggestNextStep] JSON parse failed:', jsonStr.slice(0, 100), parseErr)
        return
      }

      if (!suggestion.message || !Array.isArray(suggestion.options)) {
        if (import.meta.env.DEV) console.log('[suggestNextStep] invalid format:', suggestion)
        return
      }
      if (import.meta.env.DEV) console.log('[suggestNextStep] will create comment:', suggestion.message)

      // 找到画布上最新创建的卡片，把 comment 放在其下方
      const allShapes = editor.getCurrentPageShapes()
      const recentShapes = allShapes
        .filter((s: any) => s.type === 'product-card' || s.type === 'table-card' || s.type === 'agent-card')
        .sort((a: any, b: any) => (b.y + (b.props?.h || 0)) - (a.y + (a.props?.h || 0)))

      let commentPos: { x: number; y: number }
      if (recentShapes.length > 0) {
        const bottomShape = recentShapes[0] as any
        commentPos = {
          x: bottomShape.x,
          y: bottomShape.y + (bottomShape.props?.h || 200) + 20,
        }
      } else {
        const center = getViewportCenter(editor)
        commentPos = { x: center.x - 120, y: center.y + 100 }
      }

      // 将 options 转换为 comment actions
      const actions = suggestion.options.map(opt => ({
        label: opt,
        type: opt === '知道了' ? 'dismiss' : 'option',
      }))

      createComment(commentPos, suggestion.message, actions, undefined, true)
      if (import.meta.env.DEV) console.log('[suggestNextStep] comment created at', commentPos)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Suggest next step error:', err)
    }
  }, [editor, createComment, isClaudeServerRunning])

  /** 通过真实 Claude CLI 处理消息，返回 true=成功，false=需要 fallback */
  const handleRealAgent = useCallback(async (userMessage: string, screenshotBase64?: string): Promise<boolean> => {
    if (!editor) return false

    // Priority 1: Direct Anthropic API
    const apiKey = getApiKey()
    if (import.meta.env.DEV) console.log('[handleRealAgent] apiKey:', apiKey ? 'present' : 'SKIPPED (forced server relay)')
    if (apiKey) {
      const taskId = `task-${++taskIdCounter.current}`
      const taskLabel = userMessage

      const updateTask = (statusText: string, progress?: number) => {
        setAgentTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, statusText, progress } : t
        ))
      }
      const removeTask = () => {
        setAgentTasks(prev => prev.filter(t => t.id !== taskId))
      }

      setAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, statusText: '正在读取内容...', progress: 0 }])

      // 收集上下文
      const hasSelection = selectedShapeIds.length > 0
      const canvasContext = hasSelection ? serializeSelection() : serializeCanvas()
      const canvasFiles = collectCanvasFiles()
      // 如果有截图，加入文件列表
      if (screenshotBase64) {
        canvasFiles.push({ name: 'region-screenshot.png', dataUrl: screenshotBase64, fileType: 'image/png' })
      }

      // 立即显示工作区，让用户感知 agent 已开始工作
      const defaultCenter = getViewportCenter(editor)
      setWorkingZoneBounds(computeZoneBounds(defaultCenter, 1))

      // ====== Phase 0: 扫描读取选中卡片 ======
      if (hasSelection && selectedShapeIds.length > 0) {
        for (let i = 0; i < selectedShapeIds.length; i++) {
          const shapeId = selectedShapeIds[i]
          const shape = editor.getShape(shapeId as TLShapeId)
          const shapeName = (shape as any)?.props?.name || (shape as any)?.props?.title || (shape as any)?.props?.fileName || `对象 ${i + 1}`
          setScanningShapeId(shapeId)
          updateTask(`正在读取「${shapeName}」...`, (i + 1) / (selectedShapeIds.length + 2) * 0.1)
          // 每个 shape 停留 600ms，让用户看到扫描动画
          await new Promise(r => setTimeout(r, 600))
        }
        setScanningShapeId(null)
        updateTask(`已读取 ${selectedShapeIds.length} 个对象`, 0.1)
        await microYield()
      }

      // ====== Phase 1: 头脑风暴 — 澄清用户意图 ======
      // PPT / Excel / PDF 导出类任务跳过头脑风暴，直接执行
      const isPPT = /ppt|幻灯片|演示文稿/.test(userMessage.toLowerCase())
      const isExport = /导出|转成|整理成|做成|输出|转换|变成|excel|xlsx|表格|pdf/.test(userMessage.toLowerCase())
      const skipBrainstorm = isPPT || isExport

      updateTask('正在分析任务...', 0.1)
      let brainstormResult = null
      if (!skipBrainstorm) {
        brainstormResult = await brainstormIntent(
          userMessage,
          canvasContext,
          canvasFiles,
          (partialText) => updateTask('正在分析任务...', 0.15),
        )
      }

      if (import.meta.env.DEV) console.log('[handleRealAgent] brainstormResult:', brainstormResult ? 'got question' : 'null (skipping)', 'skipBrainstorm:', skipBrainstorm)

      let enrichedMessage = userMessage
      if (brainstormResult) {
        updateTask('等待你的选择...', 0.2)

        // 弹出底部强提示浮层，等待用户选择
        const userChoice = await waitForPromptSelection(
          taskId,
          brainstormResult.question,
          brainstormResult.options,
        )

        // 将用户选择追加到指令中
        enrichedMessage = `${userMessage}\n\n用户补充说明：${userChoice}`
        updateTask(`已选择「${userChoice}」，正在执行...`, 0.3)
        await microYield()
      }

      // ====== Phase 2: 正式执行 ======
      updateTask('连接 Anthropic API...', 0.35)

      let streamCharCount = 0
      const result = await callAnthropicDirectly(
        enrichedMessage,
        canvasContext,
        canvasFiles,
        (partialText) => {
          streamCharCount = partialText.length
          // 根据内容阶段展示有意义的状态
          if (partialText.includes('"tool"') || partialText.includes('"create_card"') || partialText.includes('"create_table"') || partialText.includes('"create_slide"')) {
            const cardMatches = partialText.match(/"create_card"/g)
            const tableMatches = partialText.match(/"create_table"/g)
            const slideMatches = partialText.match(/"create_slide"/g)
            const cardCount = cardMatches ? cardMatches.length : 0
            const tableCount = tableMatches ? tableMatches.length : 0
            const slideCount = slideMatches ? slideMatches.length : 0
            const parts = [cardCount > 0 && `${cardCount} 张卡片`, tableCount > 0 && `${tableCount} 个表格`, slideCount > 0 && `${slideCount} 张幻灯片`].filter(Boolean)
            updateTask(`正在生成${parts.join(' + ') || '内容'}...`, 0.6)
          } else if (streamCharCount < 100) {
            updateTask('Agent 正在思考...', 0.4)
          } else {
            updateTask('Agent 正在组织内容...', 0.5)
          }
        },
      )

      if (result !== null) {
        updateTask('正在解析结果...', 0.9)
        const toolCalls = parseToolCalls(result)

        if (import.meta.env.DEV) {
          console.log('[handleRealAgent] parseToolCalls result:', toolCalls ? `${toolCalls.length} tool calls` : 'null')
          if (toolCalls) {
            const toolTypes = toolCalls.map(tc => tc.tool).join(', ')
            console.log('[handleRealAgent] tool types:', toolTypes)
          }
        }

        if (toolCalls && toolCalls.length > 0) {
          updateTask('正在创建画布对象...', 0.95)
          executeToolCalls(toolCalls, taskId)
          const cardCount = toolCalls.filter(tc => tc.tool === 'create_card').length
          const tableCount = toolCalls.filter(tc => tc.tool === 'create_table').length
          const connCount = toolCalls.filter(tc => tc.tool === 'create_connection').length
          const groupCount = toolCalls.filter(tc => tc.tool === 'create_group').length
          const slideCount = toolCalls.filter(tc => tc.tool === 'create_slide').length
          await microYield()
          removeTask()
          clearZoneBoundsDeferred()
          const parts = [cardCount > 0 && `${cardCount} 张卡片`, tableCount > 0 && `${tableCount} 个表格`, connCount > 0 && `${connCount} 条连线`, groupCount > 0 && `${groupCount} 个分组`, slideCount > 0 && `${slideCount} 张幻灯片`].filter(Boolean)
          addToast(`已创建 ${parts.join(' + ')}`, 'success')
        } else {
          // parseToolCalls 返回 null，可能是：
          // 1. Claude 真的返回了纯文本
          // 2. Claude 返回了 JSON 但格式有问题
          // 先尝试再次解析，用更宽松的方式
          let finalToolCalls: Array<{ tool: string; params: any }> | null = null

          // 如果原始结果包含 "tool" 关键字，说明 Claude 想返回工具调用，再试一次
          if (result.includes('"tool"') && result.includes('"params"')) {
            console.log('[handleRealAgent] Retry parsing: result contains tool keywords')
            // 尝试手动提取 JSON 块
            const jsonBlockMatch = result.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
            if (jsonBlockMatch) {
              const jsonContent = jsonBlockMatch[1].trim()
              // 超级激进修复
              let fixed = jsonContent
                .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
                .replace(/[""]/g, '"').replace(/['']/g, "'")
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/"([^"\\]|\\.)*"/g, (m) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'))

              // 尝试补全不完整的 JSON
              if (!fixed.endsWith(']') && fixed.startsWith('[')) {
                // 找最后一个完整的 }
                const lastBrace = fixed.lastIndexOf('}')
                if (lastBrace > 0) {
                  fixed = fixed.slice(0, lastBrace + 1).replace(/,\s*$/, '') + ']'
                }
              }

              try {
                const parsed = JSON.parse(fixed)
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].tool) {
                  finalToolCalls = parsed
                  console.log('[handleRealAgent] Retry parsing succeeded:', parsed.length, 'tool calls')
                }
              } catch (e) {
                console.warn('[handleRealAgent] Retry parsing failed:', e)

                // 策略 5：手动提取 tool 和 params（和 parseToolCalls 策略 5 相同）
                const textToParse = jsonBlockMatch ? jsonBlockMatch[1].trim() : result
                const toolMatches: Array<{ tool: string; params: any }> = []
                const toolNameRegex = /"tool"\s*:\s*"([^"]+)"/g
                let toolMatch

                while ((toolMatch = toolNameRegex.exec(textToParse)) !== null) {
                  const toolName = toolMatch[1]
                  const afterToolPos = toolMatch.index + toolMatch[0].length

                  // 从 tool 声明之后找 params
                  const paramsStartMatch = textToParse.slice(afterToolPos).match(/^\s*,\s*"params"\s*:\s*/)
                  if (!paramsStartMatch) continue

                  const paramsContentStart = afterToolPos + paramsStartMatch[0].length
                  const paramsStartChar = textToParse[paramsContentStart]

                  if (paramsStartChar !== '{' && paramsStartChar !== '[') continue

                  // 使用括号计数提取 params 内容
                  const openChar = paramsStartChar
                  const closeChar = openChar === '{' ? '}' : ']'
                  let depth = 0
                  let inString = false
                  let escapeNext = false
                  let endPos = paramsContentStart

                  for (let i = paramsContentStart; i < textToParse.length; i++) {
                    const c = textToParse[i]
                    if (escapeNext) {
                      escapeNext = false
                      continue
                    }
                    if (c === '\\') {
                      escapeNext = true
                      continue
                    }
                    if (c === '"') {
                      inString = !inString
                      continue
                    }
                    if (inString) continue
                    if (c === openChar) depth++
                    if (c === closeChar) {
                      depth--
                      if (depth === 0) {
                        endPos = i
                        break
                      }
                    }
                  }

                  if (depth === 0 && endPos > paramsContentStart) {
                    const paramsStr = textToParse.slice(paramsContentStart, endPos + 1)
                    try {
                      let fixedParams = paramsStr
                        .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
                        .replace(/[""]/g, '"').replace(/['']/g, "'")
                        .replace(/,(\s*[}\]])/g, '$1')
                      fixedParams = fixedParams.replace(/"([^"\\]|\\.)*"/g, (m) =>
                        m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
                      )
                      const params = JSON.parse(fixedParams)
                      const isDup = toolMatches.some(p => p.tool === toolName && JSON.stringify(p.params) === JSON.stringify(params))
                      if (!isDup) {
                        toolMatches.push({ tool: toolName, params })
                      }
                    } catch (e2) {
                      console.warn('[handleRealAgent] strategy 5: failed to parse params for', toolName)
                    }
                  }
                }

                if (toolMatches.length > 0) {
                  finalToolCalls = toolMatches
                  console.log('[handleRealAgent] Retry strategy 5 succeeded:', toolMatches.length, 'tool calls')
                }
              }
            }
          }

          // 如果重试解析成功，执行工具调用
          if (finalToolCalls && finalToolCalls.length > 0) {
            updateTask('正在创建画布对象...', 0.95)
            executeToolCalls(finalToolCalls, taskId)
            const cardCount = finalToolCalls.filter(tc => tc.tool === 'create_card').length
            const tableCount = finalToolCalls.filter(tc => tc.tool === 'create_table').length
            const connCount = finalToolCalls.filter(tc => tc.tool === 'create_connection').length
            const groupCount = finalToolCalls.filter(tc => tc.tool === 'create_group').length
            const slideCount = finalToolCalls.filter(tc => tc.tool === 'create_slide').length
            await microYield()
            removeTask()
            clearZoneBoundsDeferred()
            const parts = [cardCount > 0 && `${cardCount} 张卡片`, tableCount > 0 && `${tableCount} 个表格`, connCount > 0 && `${connCount} 条连线`, groupCount > 0 && `${groupCount} 个分组`, slideCount > 0 && `${slideCount} 张幻灯片`].filter(Boolean)
            addToast(`已创建 ${parts.join(' + ')}`, 'success')
          } else {
            // Text response → agent card (strip any leftover code blocks)
            const cleanText = stripCodeBlocks(result) || result

            // 检查是否为PPT请求但没有生成 create_slide（这可能表示 API 误解了请求）
            const lc = userMessage.toLowerCase()
            const isPPT = lc.includes('ppt') || lc.includes('幻灯片') || lc.includes('演示文稿')
            if (isPPT && import.meta.env.DEV) {
              console.warn('[handleRealAgent] PPT request but got text response instead of create_slide:', cleanText.slice(0, 100))
            }

            const centerPage = getViewportCenter(editor)
            const cardId = createShapeId()
            const summaryLines = cleanText.split('\n').filter((l: string) => l.trim())
            const shortSummary = summaryLines.slice(0, 4).join('\n')
            const truncatedSummary = shortSummary.length > 200
              ? shortSummary.slice(0, 200) + '...'
              : (summaryLines.length > 4 ? shortSummary + '\n...' : shortSummary)

            editor.createShape({
              id: cardId,
              type: 'agent-card' as any,
              x: centerPage.x - 190,
              y: centerPage.y - 160,
              props: {
                w: 380,
                h: 220,
                userMessage,
                summary: truncatedSummary,
                steps: '[]',
                status: 'done',
                currentStep: 0,
                agentTurnId: taskId,
                timestamp: Date.now(),
              },
            })

            editor.zoomToBounds(
              { x: centerPage.x - 250, y: centerPage.y - 160, w: 500, h: 320 },
              { animation: { duration: 400 } }
            )
            removeTask()
            clearZoneBoundsDeferred()
          }
        }

        // ====== Phase 3: 后台生成下一步建议 comment ======
        const postCanvasContext = serializeCanvas()
        suggestNextStep(userMessage, postCanvasContext)

        return true
      }

      // API call returned null (failed)
      removeTask()
      setWorkingZoneBounds(null)
      const errDetail = (callAnthropicDirectly as any).__lastError || '网络错误'
      addToast(`API 调用失败 (${errDetail})，请检查 API Key`, 'error')
      return true // 不再 fallback 到 server relay，避免意外消耗本地 token
    }

    // Priority 2: Server relay (仅在没有 API Key 时使用)
    const serverUp = await isClaudeServerRunning()
    if (!serverUp) return false

    const taskId = `task-${++taskIdCounter.current}`
    const taskLabel = userMessage

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, statusText: '正在读取内容...', progress: 0 }])

    // 收集上下文：有选中 → 只发选中内容；无选中 → 发全部画布
    const hasSelection = selectedShapeIds.length > 0
    const canvasContext = hasSelection
      ? serializeSelection()
      : serializeCanvas()

    // 收集画布上的文件（图片 + 文档）
    const canvasFiles = collectCanvasFiles()
    // 如果有截图，加入文件列表
    if (screenshotBase64) {
      canvasFiles.push({ name: 'region-screenshot.png', dataUrl: screenshotBase64, fileType: 'image/png' })
    }

    // 立即显示工作区（单卡片大小，实际创建时会重算）
    const defaultCenter2 = getViewportCenter(editor)
    setWorkingZoneBounds(computeZoneBounds(defaultCenter2, 1))

    // ====== Phase 0: 扫描读取选中卡片 ======
    if (hasSelection && selectedShapeIds.length > 0) {
      for (let i = 0; i < selectedShapeIds.length; i++) {
        const shapeId = selectedShapeIds[i]
        const shape = editor.getShape(shapeId as TLShapeId)
        const shapeName = (shape as any)?.props?.name || (shape as any)?.props?.title || (shape as any)?.props?.fileName || `对象 ${i + 1}`
        setScanningShapeId(shapeId)
        updateTask(`正在读取「${shapeName}」...`, (i + 1) / (selectedShapeIds.length + 2) * 0.1)
        await new Promise(r => setTimeout(r, 600))
      }
      setScanningShapeId(null)
      updateTask(`已读取 ${selectedShapeIds.length} 个对象`, 0.1)
      await microYield()
    }

    // ====== Phase 1: 头脑风暴（通过 server relay） ======
    updateTask('正在分析任务...', 0.1)
    const brainstormResult = await brainstormIntent(
      userMessage,
      canvasContext,
      canvasFiles,
      (partialText) => updateTask('正在分析任务...', 0.15),
    )

    let enrichedMessage = userMessage
    if (brainstormResult) {
      updateTask('等待你的选择...', 0.2)
      const userChoice = await waitForPromptSelection(
        taskId,
        brainstormResult.question,
        brainstormResult.options,
      )
      enrichedMessage = `${userMessage}\n\n用户补充说明：${userChoice}`
      updateTask(`已选择「${userChoice}」，正在执行...`, 0.3)
      await microYield()
    }

    // ====== Phase 2: 正式执行 ======
    updateTask('连接 Claude Code...', 0.35)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: enrichedMessage, canvasContext, files: canvasFiles, spatialTools: true }),
      })

      if (!res.ok || !res.body) {
        removeTask()
        return false
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      const textChunks: string[] = []
      let fullText = '' // 保留用于 result 事件直接赋值
      const steps: Array<{ type: string; content: string; toolName?: string }> = []
      let buffer = ''
      let thinkingTimer: ReturnType<typeof setInterval> | null = null

      // 流式读取，只更新状态栏，不创建占位卡片
      updateTask('已连接 Claude Code...', 0.05)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          // SSE format: "data: {...}"
          let jsonStr = trimmed
          if (trimmed.startsWith('data: ')) {
            jsonStr = trimmed.slice(6)
          }

          let event: any
          try { event = JSON.parse(jsonStr) } catch (parseErr) {
            if (import.meta.env.DEV) {
              console.log('[server-relay] JSON parse failed, line length:', jsonStr.length, 'first 80:', jsonStr.slice(0, 80))
            }
            continue
          }

          if (import.meta.env.DEV) {
            console.log('[server-relay] event type:', event.type, event.subtype || '')
          }

          if (event.type === 'done') continue
          if (event.type === 'error') {
            updateTask(`错误: ${event.error || '未知错误'}`)
            await microYield()
            removeTask()
            return false
          }

          // stream-json event types from Claude CLI
          if (event.type === 'system') {
            updateTask('Agent 正在思考...', 0.15)
            // Claude CLI stream-json 不是真正的流式，system 后要等完整生成
            // 用定时器给用户动态反馈
            const thinkingStart = Date.now()
            thinkingTimer = setInterval(() => {
              const elapsed = Math.round((Date.now() - thinkingStart) / 1000)
              if (elapsed < 10) {
                updateTask('Agent 正在思考...', 0.15 + elapsed * 0.01)
              } else if (elapsed < 30) {
                updateTask(`Agent 正在深度分析... (${elapsed}s)`, 0.25 + (elapsed - 10) * 0.005)
              } else {
                updateTask(`Agent 仍在努力生成中... (${elapsed}s)`, 0.35)
              }
            }, 500)
          } else if (event.type === 'assistant') {
            // 清除 thinking timer
            if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null }
            const contentBlocks = event.message?.content || []
            for (const block of contentBlocks) {
              if (block.type === 'text' && block.text) {
                textChunks.push(block.text)
                // 根据内容展示有意义的状态
                const joined = textChunks.join('')
                if (joined.includes('"create_card"') || joined.includes('"create_table"') || joined.includes('"create_slide"')) {
                  const cardMatches = joined.match(/"create_card"/g)
                  const tableMatches = joined.match(/"create_table"/g)
                  const slideMatches = joined.match(/"create_slide"/g)
                  const cardCount = cardMatches ? cardMatches.length : 0
                  const tableCount = tableMatches ? tableMatches.length : 0
                  const slideCount = slideMatches ? slideMatches.length : 0
                  const parts = [cardCount > 0 && `${cardCount} 张卡片`, tableCount > 0 && `${tableCount} 个表格`, slideCount > 0 && `${slideCount} 张幻灯片`].filter(Boolean)
                  updateTask(`正在生成${parts.join(' + ') || '内容'}...`, 0.6)
                } else {
                  updateTask('Agent 正在组织内容...', 0.5)
                }
              } else if (block.type === 'tool_use') {
                const toolName = block.name || 'tool'
                steps.push({ type: 'tool_call', content: `调用 ${toolName}`, toolName })
                updateTask(`正在使用 ${toolName}...`, 0.6)
              }
            }
          } else if (event.type === 'result') {
            if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null }
            const resultText = event.result || ''
            if (import.meta.env.DEV) {
              console.log('[server-relay] result event, result length:', resultText.length)
              console.log('[server-relay] result first 200:', resultText.slice(0, 200))
            }
            if (resultText) fullText = resultText
            updateTask('正在解析结果...', 0.9)
          }
        }
      }

      // 处理残留 buffer（流可能在最后一行没有尾部换行就结束了）
      if (buffer.trim()) {
        let jsonStr = buffer.trim()
        if (jsonStr.startsWith('data: ')) jsonStr = jsonStr.slice(6)
        try {
          const event = JSON.parse(jsonStr)
          if (event.type === 'result') {
            const resultText = event.result || ''
            if (import.meta.env.DEV) console.log('[server-relay] flushed buffer result, length:', resultText.length)
            if (resultText) fullText = resultText
          } else if (event.type === 'assistant') {
            const contentBlocks = event.message?.content || []
            for (const block of contentBlocks) {
              if (block.type === 'text' && block.text) textChunks.push(block.text)
            }
          }
        } catch { /* ignore parse error on remaining buffer */ }
      }

      // 流结束，合并 chunks 并解析完整输出
      // fullText 可能已被 result 事件直接赋值，否则从 chunks 合并
      if (!fullText && textChunks.length > 0) fullText = textChunks.join('')
      const rawText = fullText.trim()

      if (import.meta.env.DEV) {
        console.log('[server-relay] fullText length:', fullText.length)
        console.log('[server-relay] rawText first 300:', rawText.slice(0, 300))
        console.log('[server-relay] rawText last 100:', rawText.slice(-100))
        // 临时调试：保存到 window 方便 console 检查
        ;(window as any).__lastRawText = rawText
        ;(window as any).__lastFullText = fullText
      }

      // 尝试解析为工具调用
      const toolCalls = parseToolCalls(rawText)

      if (toolCalls && toolCalls.length > 0) {
        // 工具调用模式：创建画布对象
        updateTask('正在创建画布对象...', 0.95)
        executeToolCalls(toolCalls, taskId)
        const cardCount = toolCalls.filter(tc => tc.tool === 'create_card').length
        const tableCount = toolCalls.filter(tc => tc.tool === 'create_table').length
        const connCount = toolCalls.filter(tc => tc.tool === 'create_connection').length
        const groupCount = toolCalls.filter(tc => tc.tool === 'create_group').length
        const slideCount = toolCalls.filter(tc => tc.tool === 'create_slide').length
        await microYield()
        removeTask()
        clearZoneBoundsDeferred()
        const parts = [cardCount > 0 && `${cardCount} 张卡片`, tableCount > 0 && `${tableCount} 个表格`, connCount > 0 && `${connCount} 条连线`, groupCount > 0 && `${groupCount} 个分组`, slideCount > 0 && `${slideCount} 张幻灯片`].filter(Boolean)
        addToast(`已创建 ${parts.join(' + ')}`, 'success')
      } else {
        // 普通文本模式：创建 agent-card (strip any leftover code blocks)
        const cleanText = stripCodeBlocks(rawText) || rawText
        const centerPage = getViewportCenter(editor)
        const cardId = createShapeId()
        const summaryLines = cleanText.split('\n').filter(l => l.trim())
        const shortSummary = summaryLines.slice(0, 4).join('\n')
        const truncatedSummary = shortSummary.length > 200
          ? shortSummary.slice(0, 200) + '...'
          : (summaryLines.length > 4 ? shortSummary + '\n...' : shortSummary)

        editor.createShape({
          id: cardId,
          type: 'agent-card' as any,
          x: centerPage.x - 190,
          y: centerPage.y - 160,
          props: {
            w: 380,
            h: 220,
            userMessage,
            summary: truncatedSummary,
            steps: JSON.stringify(steps),
            status: 'done',
            currentStep: steps.length,
            agentTurnId: taskId,
            timestamp: Date.now(),
          },
        })

        editor.zoomToBounds(
          { x: centerPage.x - 250, y: centerPage.y - 160, w: 500, h: 320 },
          { animation: { duration: 400 } }
        )

        removeTask()
        clearZoneBoundsDeferred()
      }

      // ====== Phase 3: 后台生成下一步建议 comment ======
      const postCanvasContext2 = serializeCanvas()
      suggestNextStep(userMessage, postCanvasContext2)

      return true
    } catch (err) {
      if (import.meta.env.DEV) console.error('Real agent error:', err)
      removeTask()
      setWorkingZoneBounds(null)
      addToast('请求失败，请重试', 'error')
      return false
    }
  }, [editor, isClaudeServerRunning, callAnthropicDirectly, brainstormIntent, waitForPromptSelection, suggestNextStep, selectedShapeIds, serializeCanvas, serializeSelection, collectCanvasFiles, executeToolCalls, addToast, computeZoneBounds, clearZoneBoundsDeferred])

  // ============ 主消息处理（含意图检测）============
  const handleAgentMessage = useCallback(async (userMessage: string, screenshotBase64?: string) => {
    if (!editor) return

    // 意图检测：深入研究
    if (userMessage.includes('深入研究') && selectedProductCards.length === 1) {
      handleDeepResearch(selectedProductCards[0].id)
      return
    }

    // 意图检测：生成大纲
    if (userMessage.includes('组织成大纲') || userMessage.includes('生成大纲') || userMessage.includes('PPT大纲') || userMessage.includes('PPT 大纲')) {
      handleGenerateOutline()
      return
    }

    // ====== 意图检测：PPT（统一入口）======
    // 只要提到 ppt / 幻灯片 / 演示文稿，全部在这里处理
    {
      const lc = userMessage.toLowerCase()
      const isPPT = lc.includes('ppt') || lc.includes('幻灯片') || lc.includes('演示文稿')
      if (isPPT && editor) {
        const isExport = /导出|下载|保存/.test(lc)
        const hasSlideFrames = editor.getCurrentPageShapes().some(
          s => s.type === 'frame' && ((s as any).props?.name || '').startsWith('Slide ')
        )

        if (isExport && hasSlideFrames) {
          // 导出已有幻灯片 frame
          handleExportFramesPPT()
          return
        }

        // 其余都视为"生成 PPT"→ 走 PPT 生成流程（下方统一处理）
        // 不 return，继续走到下面的 PPT 生成块
      }
    }

    // ====== 意图检测：导出 Excel / PDF ======
    {
      const lc = userMessage.toLowerCase()
      const hasExportVerb = /导出|转成|整理成|做成|输出|转换|变成/.test(lc)
      const isPPT = lc.includes('ppt') || lc.includes('幻灯片') || lc.includes('演示文稿')

      if (hasExportVerb && !isPPT && editor) {
        const hasProductCards = editor.getCurrentPageShapes().some((s: any) => s.type === 'product-card')
        if (hasProductCards) {
          if (lc.includes('excel') || lc.includes('xlsx') || lc.includes('表格') || lc.includes('表单') || lc.includes('电子表格')) {
            handleExportExcel()
            return
          }
          if (lc.includes('pdf')) {
            handleExportPDF()
            return
          }
        }
      }
    }

    // 意图检测：总结文档 → 找到画布上的 doc-card，逐个触发总结
    const isSummarizeIntent = /总结|摘要|概括|归纳|梳理/.test(userMessage)
      && /文[章档]|文件|内容|资料|报告/.test(userMessage)
    if (isSummarizeIntent && editor) {
      // 优先用选中的 doc-card，没有选中的则用画布上所有 doc-card
      const allShapes = editor.getCurrentPageShapes()
      const selectedSet = new Set(selectedShapeIds)
      let docCards = allShapes.filter((s: any) =>
        s.type === 'doc-card' && selectedSet.has(s.id)
      )
      if (docCards.length === 0) {
        docCards = allShapes.filter((s: any) => s.type === 'doc-card')
      }

      if (docCards.length > 0) {
        for (const dc of docCards) {
          // 将 status 设为 summarizing 以触发总结流程
          editor.updateShape({
            id: dc.id,
            type: 'doc-card' as any,
            props: { status: 'summarizing' },
          } as any)
          handleSummarizeDoc(dc.id)
        }
        addToast(`正在总结 ${docCards.length} 篇文档...`, 'success')
        return
      }
    }

    // PPT 幻灯片生成（上方 PPT 意图块未 return 则到此）
    {
      const lc = userMessage.toLowerCase()
      const isPPT = lc.includes('ppt') || lc.includes('幻灯片') || lc.includes('演示文稿')
      if (isPPT && editor) {
        if (import.meta.env.DEV) console.log('[handleAgentMessage] PPT detected, agentMode:', agentMode)

        // 收集选中卡片的内容作为幻灯片素材
        const allShapes = editor.getCurrentPageShapes()
        const selectedSet = new Set(selectedShapeIds)
        let sourceCards = allShapes.filter((s: any) =>
          (s.type === 'product-card' || s.type === 'agent-card') && selectedSet.has(s.id)
        )
        if (sourceCards.length === 0) {
          sourceCards = allShapes.filter((s: any) => s.type === 'product-card')
        }

        // 如果 real 模式且有 API key，让 Agent 处理（会用 create_slide 工具）
        if (agentMode === 'real') {
          if (import.meta.env.DEV) console.log('[handleAgentMessage] PPT in real mode, calling handleRealAgent')
          const realSuccess = await handleRealAgent(userMessage, screenshotBase64)
          if (import.meta.env.DEV) console.log('[handleAgentMessage] handleRealAgent returned:', realSuccess)
          if (realSuccess) {
            if (import.meta.env.DEV) console.log('[handleAgentMessage] PPT real mode success, returning')
            return
          }
          // real 模式失败时的警告
          if (import.meta.env.DEV) console.log('[handleAgentMessage] PPT real mode failed, will use mock fallback')
        }

        // Mock 模式或 real 失败：基于卡片内容生成 mock 幻灯片

        // 扫描选中卡片 — 让用户看到 Agent 在"阅读"指定内容
        const taskId = `task-${++taskIdCounter.current}`
        setAgentTasks(prev => [...prev, { id: taskId, label: '生成幻灯片', statusText: '正在读取内容...', progress: 0 }])

        if (sourceCards.length > 0) {
          for (let i = 0; i < sourceCards.length; i++) {
            const card = sourceCards[i]
            const cardName = (card as any).props?.name || (card as any).props?.title || `卡片 ${i + 1}`
            setScanningShapeId(card.id as string)
            setAgentTasks(prev => prev.map(t =>
              t.id === taskId ? { ...t, statusText: `正在读取「${cardName}」...`, progress: (i + 1) / (sourceCards.length + 2) * 0.3 } : t
            ))
            await new Promise(r => setTimeout(r, 600)) // 每张卡片停留 600ms，让用户看到扫描效果
          }
          setScanningShapeId(null)
          setAgentTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, statusText: `已读取 ${sourceCards.length} 张卡片，正在生成幻灯片...`, progress: 0.35 } : t
          ))
          await microYield()
        }

        const slideToolCalls: Array<{ tool: string; params: any }> = []

        // 封面页
        const topicName = userMessage.replace(/帮我|请|把|这些|做成|生成|制作|一[份个张]|ppt|PPT|幻灯片|演示文稿/g, '').trim() || '演示文稿'
        slideToolCalls.push({
          tool: 'create_slide',
          params: {
            title: topicName,
            slideType: 'cover',
            background: 'light-violet',
            elements: [
              // 背景装饰线
              { type: 'shape', geo: 'rectangle', x: 0, y: 0, w: 960, h: 8, fill: 'violet', color: 'violet' },
              // 标题
              { type: 'text', content: topicName, x: 60, y: 120, w: 840, h: 100, fontSize: 'xl', color: 'violet', align: 'middle', bold: true },
              // 分隔线
              { type: 'shape', geo: 'rectangle', x: 200, y: 235, w: 560, h: 2, fill: 'violet', color: 'violet' },
              // 日期
              { type: 'text', content: new Date().toLocaleDateString('zh-CN'), x: 300, y: 270, w: 360, h: 35, fontSize: 'm', color: 'grey', align: 'middle' },
              // 底部装饰
              { type: 'shape', geo: 'rectangle', x: 0, y: 532, w: 960, h: 8, fill: 'violet', color: 'violet' },
            ],
          },
        })

        // 每张卡片生成一页内容幻灯片
        for (const card of sourceCards) {
          const props = (card as any).props || {}
          const name = props.name || props.title || '内容'
          const tagline = props.tagline || ''
          const detail = props.detail || ''
          const tags = (() => { try { return JSON.parse(props.tags || '[]') } catch { return [] } })()

          const elements: any[] = [
            // 顶部装饰线
            { type: 'shape', geo: 'rectangle', x: 0, y: 0, w: 960, h: 4, fill: 'violet', color: 'violet' },
            // 标题
            { type: 'text', content: name, x: 50, y: 25, w: 860, h: 45, fontSize: 'l', color: 'violet', align: 'start', bold: true },
            // 分隔线
            { type: 'shape', geo: 'rectangle', x: 50, y: 75, w: 860, h: 2, fill: 'violet', color: 'violet' },
          ]

          if (tagline) {
            elements.push({ type: 'text', content: tagline, x: 50, y: 90, w: 860, h: 30, fontSize: 'm', color: 'grey', align: 'start' })
          }

          // 详情截取前 300 字，分行展示
          const detailText = detail.replace(/[#*`]/g, '').slice(0, 300)
          if (detailText) {
            const startY = tagline ? 130 : 95
            elements.push({ type: 'text', content: detailText, x: 50, y: startY, w: 860, h: 350, fontSize: 's', color: 'black', align: 'start' })
          }

          // 标签 - 底部
          if (tags.length > 0) {
            const tagStr = tags.map((t: string) => `#${t}`).join('  ')
            elements.push({ type: 'text', content: tagStr, x: 50, y: 495, w: 860, h: 25, fontSize: 's', color: 'violet', align: 'start' })
          }

          slideToolCalls.push({
            tool: 'create_slide',
            params: { title: name, slideType: 'content', elements },
          })
        }

        // 如果没有源卡片，生成一个示例幻灯片
        if (sourceCards.length === 0) {
          slideToolCalls.push({
            tool: 'create_slide',
            params: {
              title: '内容概览',
              slideType: 'content',
              elements: [
                { type: 'text', content: '内容概览', x: 40, y: 30, w: 880, h: 50, fontSize: 'l', color: 'black' },
                { type: 'shape', geo: 'rectangle', x: 40, y: 85, w: 880, h: 3, fill: 'violet', color: 'violet' },
                { type: 'text', content: '请在画布上选中卡片后再生成 PPT，\n或直接编辑此幻灯片内容。', x: 40, y: 150, w: 880, h: 100, fontSize: 'm', color: 'grey', align: 'start' },
              ],
            },
          })
        }

        // 总结页
        slideToolCalls.push({
          tool: 'create_slide',
          params: {
            title: '总结',
            slideType: 'summary',
            background: 'light-green',
            elements: [
              // 顶部装饰线
              { type: 'shape', geo: 'rectangle', x: 0, y: 0, w: 960, h: 8, fill: 'green', color: 'green' },
              // 标题
              { type: 'text', content: '总结', x: 60, y: 60, w: 840, h: 60, fontSize: 'l', color: 'green', align: 'middle', bold: true },
              // 主要信息
              { type: 'text', content: `共 ${sourceCards.length} 个主题已生成`, x: 150, y: 180, w: 660, h: 80, fontSize: 'xl', color: 'black', align: 'middle' },
              // 分隔线
              { type: 'shape', geo: 'rectangle', x: 200, y: 280, w: 560, h: 2, fill: 'green', color: 'green' },
              // 提示信息
              { type: 'text', content: '✓ 幻灯片已生成', x: 100, y: 320, w: 760, h: 30, fontSize: 'm', color: 'green', align: 'middle' },
              { type: 'text', content: '可在画布上直接编辑幻灯片内容', x: 100, y: 365, w: 760, h: 25, fontSize: 's', color: 'grey', align: 'middle' },
              { type: 'text', content: '完成后输入"导出 PPT"将幻灯片导出为可编辑的 .pptx 文件', x: 100, y: 400, w: 760, h: 30, fontSize: 's', color: 'grey', align: 'middle' },
              // 底部装饰
              { type: 'shape', geo: 'rectangle', x: 0, y: 532, w: 960, h: 8, fill: 'green', color: 'green' },
            ],
          },
        })

        // 执行
        setAgentTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, statusText: '正在创建幻灯片...', progress: 0.5 } : t
        ))
        await microYield()

        executeToolCalls(slideToolCalls, taskId)

        setAgentTasks(prev => prev.filter(t => t.id !== taskId))
        addToast(`已生成 ${slideToolCalls.length} 页幻灯片`, 'success')

        // 完成提示
        const center = getViewportCenter(editor)
        createComment(
          { x: center.x + 540, y: center.y - 100 },
          '幻灯片已生成！你可以直接编辑内容，完成后输入"导出PPT"生成文件。',
          [
            { label: '导出 PPT', type: 'action' },
            { label: '知道了', type: 'dismiss' },
          ],
        )
        return
      }
    }

    // 根据模式选择：real 走真实 API/CLI，mock 走演示流程
    if (agentMode === 'real') {
      const realSuccess = await handleRealAgent(userMessage, screenshotBase64)
      if (realSuccess) return
      // 失败时提示
      const hasKey = !!getApiKey()
      if (hasKey) {
        addToast('API 调用失败，请检查 API Key 是否有效', 'error')
      } else {
        addToast('请配置 API Key 或启动本地 server（npm run server）', 'error')
      }
      return
    }

    // Fallback：PPT 产品调研 mock 流程
    const { steps, products, prompt } = generatePPTResearchMock(userMessage)

    const taskId = `task-${++taskIdCounter.current}`

    let taskLabel: string
    if (selectedProductCards.length > 0) {
      const names = selectedProductCards.slice(0, 2).map((c: any) => c.name).join('、')
      const suffix = selectedProductCards.length > 2 ? ' 等' : ''
      taskLabel = `基于 ${names}${suffix} 对比分析`
    } else {
      taskLabel = userMessage
    }

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, statusText: '正在思考...', progress: 0 }])

    // 设置工作区边界（基于即将生成的产品数）
    const mockCenter = getViewportCenter(editor)
    setWorkingZoneBounds(computeZoneBounds(mockCenter, products.length))

    const run = async () => {
      const totalSteps = steps.length

      // Phase 1: Show first 2 thinking steps, then prompt
      const phase1End = prompt ? Math.min(2, totalSteps) : totalSteps

      for (let idx = 0; idx < phase1End; idx++) {
        await microYield()
        const step = steps[idx]
        const progress = (idx + 1) / (totalSteps + products.length)

        if (step.type === 'thinking') {
          const text = step.content.length > 30 ? step.content.slice(0, 30) + '...' : step.content
          updateTask(text, progress)
        } else if (step.type === 'tool_call') {
          updateTask(`调用 ${step.toolName}...`, progress)
        }
      }

      // Show prompt if available
      let userChoice: string | undefined
      if (prompt) {
        updateTask('正在等待决策...', phase1End / (totalSteps + products.length))

        userChoice = await new Promise<string>(resolve => {
          setActivePrompt({
            id: `prompt-${taskId}`,
            question: prompt.question,
            options: prompt.options,
            taskId,
          })
          promptResolverRef.current = resolve
        })

        updateTask(`已选择「${userChoice}」，继续执行...`, (phase1End + 0.5) / (totalSteps + products.length))
        await microYield()
      }

      // Phase 2: Continue remaining steps
      for (let idx = phase1End; idx < totalSteps; idx++) {
        await microYield()
        const step = steps[idx]
        const progress = (idx + 1) / (totalSteps + products.length)

        if (step.type === 'thinking') {
          const text = step.content.length > 30 ? step.content.slice(0, 30) + '...' : step.content
          updateTask(text, progress)
        } else if (step.type === 'tool_call') {
          updateTask(`调用 ${step.toolName}...`, progress)
        }
      }

      // Generate product cards
      updateTask('正在整理结果...', totalSteps / (totalSteps + products.length))

      const centerPage = getViewportCenter(editor)
      const productCardW = 280
      const productCardH = 120
      const gap = 16
      const cols = 4
      const totalRowWidth = Math.min(products.length, cols) * (productCardW + gap) - gap
      const startX = centerPage.x - totalRowWidth / 2
      const startY = centerPage.y - 100

      editor.batch(() => {
        for (let pIdx = 0; pIdx < products.length; pIdx++) {
          const product = products[pIdx]
          const col = pIdx % cols
          const row = Math.floor(pIdx / cols)
          const px = startX + col * (productCardW + gap)
          const py = startY + row * (productCardH + gap)

          editor.createShape({
            id: createShapeId(),
            type: 'product-card' as any,
            x: px,
            y: py,
            props: {
              w: productCardW,
              h: productCardH,
              name: product.name,
              tagline: product.tagline,
              tags: JSON.stringify(product.tags),
              detail: product.detail,
              sources: JSON.stringify(product.sources),
              expanded: false,
              sourceTaskId: taskId,
            },
          })
        }
      })

      updateTask(`已生成 ${products.length}/${products.length}`, 1)

      const lastRow = Math.floor((products.length - 1) / cols)
      editor.zoomToBounds(
        {
          x: startX - 40,
          y: startY - 40,
          w: totalRowWidth + 80,
          h: (lastRow + 1) * (productCardH + gap) + 80,
        },
        { animation: { duration: 600 } }
      )

      // 创建完成提示 comment
      const commentData = generateCompletionComment()
      const commentX = startX + totalRowWidth / 2 - 120
      const commentY = startY + (lastRow + 1) * (productCardH + gap) + 20
      createComment(
        { x: commentX, y: commentY },
        commentData.message,
        commentData.actions,
      )

      removeTask()
      clearZoneBoundsDeferred()
    }

    run()
  }, [editor, selectedProductCards, handleDeepResearch, handleGenerateOutline, handleExportPPT, handleExportExcel, handleExportPDF, handleRealAgent, createComment, agentMode, addToast, computeZoneBounds, clearZoneBoundsDeferred])

  // ============ 文档自动总结 ============

  /** 上传文档后自动调 Agent 生成总结（不显示底部任务栏，卡片自身有 spinner） */
  const handleSummarizeDoc = useCallback(async (shapeId: string) => {
    if (!editor) return

    const shape = editor.getShape(shapeId as TLShapeId)
    if (!shape) return
    const props = (shape as any).props
    if (!props || props.status !== 'summarizing') return

    // 安全超时：60 秒后如果还在 summarizing 则强制设为 error
    const safetyTimer = setTimeout(() => {
      try {
        const current = editor.getShape(shapeId as TLShapeId)
        if (current && (current as any).props?.status === 'summarizing') {
          editor.updateShape({
            id: shapeId as TLShapeId,
            type: 'doc-card' as any,
            props: { status: 'error' },
          } as any)
        }
      } catch { /* shape 可能已被删除 */ }
    }, 60000)

    try {

    // 准备文件数据
    let fileDataUrl: string
    if (props.fileType === 'md') {
      const b64 = btoa(unescape(encodeURIComponent(props.fileContent)))
      fileDataUrl = `data:text/markdown;base64,${b64}`
    } else {
      fileDataUrl = props.fileContent
    }

    const summarizePrompt = `请阅读并总结这份文档「${props.fileName}」。请按以下格式回复（不要输出其他内容）：

[摘要]
用一句话概括文档主题和核心内容（不超过 80 字）

[详细分析]
用 Markdown 格式输出文档的关键内容摘要，包含主要章节、核心观点、重要数据等。控制在 300-500 字。`

    /** Helper: parse summary/detail from raw text */
    const parseSummaryResult = (rawText: string) => {
      let summary = ''
      let detail = ''

      // 清理：去掉 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）
      let cleaned = rawText.trim()
      cleaned = cleaned.replace(/^```(?:json|markdown|md|text)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim()

      const summaryMatch = cleaned.match(/\[摘要\]\s*\n([\s\S]*?)(?=\[详细分析\]|$)/)
      const detailMatch = cleaned.match(/\[详细分析\]\s*\n([\s\S]*)/)

      if (summaryMatch) summary = summaryMatch[1].trim()
      if (detailMatch) detail = detailMatch[1].trim()

      // 备用格式：## 摘要 / ## 详细分析
      if (!summary && !detail) {
        const altSummaryMatch = cleaned.match(/(?:##?\s*摘要|Summary)\s*\n([\s\S]*?)(?=(?:##?\s*详细|##?\s*分析|Detail)|$)/i)
        const altDetailMatch = cleaned.match(/(?:##?\s*详细分析|##?\s*分析|Detail)\s*\n([\s\S]*)/i)
        if (altSummaryMatch) summary = altSummaryMatch[1].trim()
        if (altDetailMatch) detail = altDetailMatch[1].trim()
      }

      // 最终 fallback：取前几行作摘要，其余作详细
      if (!summary && !detail) {
        const lines = cleaned.split('\n').filter((l: string) => l.trim())
        summary = lines.slice(0, 2).join(' ').slice(0, 120)
        detail = lines.slice(2).join('\n')
      }
      return { summary, detail }
    }

    // Priority 1: Direct Anthropic API
    const apiKey = getApiKey()
    if (apiKey) {
      try {
        const result = await callAnthropicDirectly(
          summarizePrompt,
          '',
          [{ name: props.fileName, dataUrl: fileDataUrl, fileType: props.fileType }],
        )

        if (result) {
          const { summary, detail } = parseSummaryResult(result)
          editor.updateShape({
            id: shapeId as TLShapeId,
            type: 'doc-card' as any,
            props: { summary, detail, status: 'done' },
          } as any)
          return
        }
        // Direct API failed, fall through to server relay
      } catch (err) {
        if (import.meta.env.DEV) console.error('Doc summarize direct API error:', err)
        // Fall through
      }
    }

    // Priority 2: Server relay
    const serverUp = await isClaudeServerRunning()
    if (!serverUp) {
      // No API Key, no server → local fallback
      const fallbackSummary = props.fileType === 'md'
        ? props.fileContent.split('\n').filter((l: string) => l.trim()).slice(0, 3).join(' ').slice(0, 120)
        : `PDF 文档「${props.fileName}」已导入，启动本地 Server 或配置 API Key 后可自动总结`
      const fallbackDetail = props.fileType === 'md'
        ? props.fileContent.slice(0, 800)
        : '当前无可用的 AI 服务来解析 PDF 内容。请启动本地 Server（cd server && node index.mjs）或在顶栏配置 API Key。'

      editor.updateShape({
        id: shapeId as TLShapeId,
        type: 'doc-card' as any,
        props: {
          summary: fallbackSummary || props.fileName,
          detail: fallbackDetail,
          status: 'done',
        },
      } as any)
      return
    }

    // Server relay path
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: summarizePrompt,
          canvasContext: '',
          files: [{ name: props.fileName, dataUrl: fileDataUrl, fileType: props.fileType }],
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error('请求失败')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          let jsonStr = trimmed
          if (trimmed.startsWith('data: ')) jsonStr = trimmed.slice(6)

          let event: any
          try { event = JSON.parse(jsonStr) } catch { continue }

          if (event.type === 'assistant') {
            const contentBlocks = event.message?.content || []
            for (const block of contentBlocks) {
              if (block.type === 'text' && block.text) {
                fullText += block.text
              }
            }
          } else if (event.type === 'result') {
            if (event.result) fullText = event.result
          }
        }
      }

      const { summary, detail } = parseSummaryResult(fullText.trim())

      editor.updateShape({
        id: shapeId as TLShapeId,
        type: 'doc-card' as any,
        props: { summary, detail, status: 'done' },
      } as any)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Doc summarize error:', err)

      editor.updateShape({
        id: shapeId as TLShapeId,
        type: 'doc-card' as any,
        props: { status: 'error' },
      } as any)
    }

    } finally {
      clearTimeout(safetyTimer)
    }
  }, [editor, isClaudeServerRunning, callAnthropicDirectly])

  // ============ Comment 反馈闭环：ask_user 选项 → 继续 Claude 对话 ============

  /** 用户在 Comment 上点击了 ask_user 选项，把选择反馈给 Claude API 继续对话 */
  const handleCommentFeedback = useCallback(async (
    label: string,
    anchorShapeId: string,
  ) => {
    if (!editor) return

    // 构造后续消息：用户的选择 + 画布上下文
    const followUpMessage = `用户选择了「${label}」，请基于此继续工作。`

    const taskId = `task-${++taskIdCounter.current}`
    const taskLabel = `处理反馈: ${label}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, statusText: '正在处理选择...', progress: 0 }])

    // 设置工作区（单卡片大小，实际创建时会重算）
    const center = getViewportCenter(editor)
    setWorkingZoneBounds(computeZoneBounds(center, 1))

    const canvasContext = serializeCanvas()
    const canvasFiles = collectCanvasFiles()

    // 优先直连 API
    const apiKey = getApiKey()
    if (apiKey) {
      const result = await callAnthropicDirectly(
        followUpMessage,
        canvasContext,
        canvasFiles,
        (partialText) => {
          const preview = partialText.length > 40 ? '...' + partialText.slice(-40) : partialText
          updateTask(preview, 0.5)
        },
      )

      if (result !== null) {
        updateTask('正在解析结果...', 0.9)
        const toolCalls = parseToolCalls(result)

        if (toolCalls && toolCalls.length > 0) {
          updateTask('正在创建画布对象...', 0.95)
          executeToolCalls(toolCalls, taskId)
          const cardCount = toolCalls.filter(tc => tc.tool === 'create_card').length
          const tableCount = toolCalls.filter(tc => tc.tool === 'create_table').length
          const connCount = toolCalls.filter(tc => tc.tool === 'create_connection').length
          const groupCount = toolCalls.filter(tc => tc.tool === 'create_group').length
          await microYield()
          removeTask()
          clearZoneBoundsDeferred()
          const parts = [cardCount > 0 && `${cardCount} 张卡片`, tableCount > 0 && `${tableCount} 个表格`, connCount > 0 && `${connCount} 条连线`, groupCount > 0 && `${groupCount} 个分组`].filter(Boolean)
          addToast(`已创建 ${parts.join(' + ')}`, 'success')
        } else {
          // 文本回复 → agent-card
          const cleanText = stripCodeBlocks(result) || result
          const centerPage = getViewportCenter(editor)
          const summaryLines = cleanText.split('\n').filter((l: string) => l.trim())
          const shortSummary = summaryLines.slice(0, 4).join('\n')
          const truncatedSummary = shortSummary.length > 200
            ? shortSummary.slice(0, 200) + '...'
            : (summaryLines.length > 4 ? shortSummary + '\n...' : shortSummary)

          editor.createShape({
            id: createShapeId(),
            type: 'agent-card' as any,
            x: centerPage.x - 190,
            y: centerPage.y - 160,
            props: {
              w: 380, h: 220,
              userMessage: followUpMessage,
              summary: truncatedSummary,
              steps: '[]',
              status: 'done',
              currentStep: 0,
              agentTurnId: taskId,
              timestamp: Date.now(),
            },
          })
          removeTask()
          clearZoneBoundsDeferred()
        }
        return
      }
    }

    // Fallback: server relay
    const serverUp = await isClaudeServerRunning()
    if (serverUp) {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: followUpMessage, canvasContext, files: canvasFiles }),
        })

        if (res.ok && res.body) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let fullText = ''
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              let jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
              let event: any
              try { event = JSON.parse(jsonStr) } catch { continue }

              if (event.type === 'assistant') {
                const contentBlocks = event.message?.content || []
                for (const block of contentBlocks) {
                  if (block.type === 'text' && block.text) fullText += block.text
                }
              } else if (event.type === 'result' && event.result) {
                fullText = event.result
              }
            }
          }

          const rawText = fullText.trim()
          const toolCalls = parseToolCalls(rawText)

          if (toolCalls && toolCalls.length > 0) {
            executeToolCalls(toolCalls, taskId)
            const cardCount = toolCalls.filter(tc => tc.tool === 'create_card').length
            const tableCount = toolCalls.filter(tc => tc.tool === 'create_table').length
            const connCount = toolCalls.filter(tc => tc.tool === 'create_connection').length
            const groupCount = toolCalls.filter(tc => tc.tool === 'create_group').length
            removeTask()
            clearZoneBoundsDeferred()
            const parts = [cardCount > 0 && `${cardCount} 张卡片`, tableCount > 0 && `${tableCount} 个表格`, connCount > 0 && `${connCount} 条连线`, groupCount > 0 && `${groupCount} 个分组`].filter(Boolean)
            addToast(`已创建 ${parts.join(' + ')}`, 'success')
          } else {
            const cleanText = stripCodeBlocks(rawText) || rawText
            const centerPage = getViewportCenter(editor)
            const summaryLines = cleanText.split('\n').filter(l => l.trim())
            const shortSummary = summaryLines.slice(0, 4).join('\n')
            const truncatedSummary = shortSummary.length > 200
              ? shortSummary.slice(0, 200) + '...'
              : (summaryLines.length > 4 ? shortSummary + '\n...' : shortSummary)

            editor.createShape({
              id: createShapeId(),
              type: 'agent-card' as any,
              x: centerPage.x - 190,
              y: centerPage.y - 160,
              props: {
                w: 380, h: 220,
                userMessage: followUpMessage,
                summary: truncatedSummary,
                steps: '[]',
                status: 'done',
                currentStep: 0,
                agentTurnId: taskId,
                timestamp: Date.now(),
              },
            })
            removeTask()
            clearZoneBoundsDeferred()
          }
          return
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Comment feedback server error:', err)
      }
    }

    // 无可用 API → 提示
    removeTask()
    setWorkingZoneBounds(null)
    addToast('请配置 API Key 或启动本地 server', 'error')
  }, [editor, callAnthropicDirectly, isClaudeServerRunning, executeToolCalls, serializeCanvas, collectCanvasFiles, addToast, computeZoneBounds, clearZoneBoundsDeferred])

  // ============ 用户对卡片发修改指令 ============

  /** 用户选中某张卡片 + 输入修改意见 → Agent 读取卡片内容 + 修改指令 → Claude API → 更新卡片 */
  const handleUserModifyShape = useCallback(async (
    targetShapeId: string,
    userInstruction: string,
    screenshotBase64?: string,
  ) => {
    if (!editor) return

    const targetShape = editor.getShape(targetShapeId as TLShapeId)
    if (!targetShape) {
      addToast('找不到目标卡片', 'error')
      return
    }

    const targetType = (targetShape as any).type
    const targetProps = (targetShape as any).props

    // 序列化目标卡片内容
    let cardDescription = ''
    if (targetType === 'product-card') {
      let tags: string[] = []
      try { tags = JSON.parse(targetProps.tags || '[]') } catch { /* */ }
      cardDescription = `卡片「${targetProps.name}」
- 标语：${targetProps.tagline}
- 标签：${tags.join(', ')}
- 详细内容：
${targetProps.detail}`
    } else if (targetType === 'agent-card') {
      cardDescription = `Agent 回复卡片
- 用户消息：${targetProps.userMessage}
- 摘要：${targetProps.summary}`
    } else if (targetType === 'page-card') {
      let content: any = {}
      try { content = JSON.parse(targetProps.content) } catch { /* */ }
      cardDescription = `页面卡片 #${targetProps.pageNumber}「${targetProps.pageTitle}」
- 类型：${targetProps.pageType}
- 内容：${JSON.stringify(content).slice(0, 500)}`
    } else {
      cardDescription = `${targetType} 对象，属性：${JSON.stringify(targetProps).slice(0, 300)}`
    }

    // 构造修改指令
    const hasScreenshot = !!screenshotBase64
    const modifyPrompt = `用户要求修改以下画布上的卡片：

${cardDescription}
${hasScreenshot ? '\n（附带了卡片的截图，请结合截图中的视觉内容来理解用户的指令）\n' : ''}
用户的修改要求：${userInstruction}

请按照用户的要求修改卡片内容。输出格式要求：
- 如果是 product-card 类型，输出一个 JSON 工具调用：[{ "tool": "create_card", "params": { "name": "...", "tagline": "...", "tags": [...], "detail": "...", "imageUrl": "..." } }]（imageUrl 可选）
- 只输出修改后的一张卡片，不要创建额外卡片
- 保留原卡片中用户未要求修改的部分`

    const taskId = `task-${++taskIdCounter.current}`
    const taskLabel = `修改: ${targetProps.name || '卡片'}`

    const updateTask = (statusText: string, progress?: number) => {
      setAgentTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, statusText, progress } : t
      ))
    }
    const removeTask = () => {
      setAgentTasks(prev => prev.filter(t => t.id !== taskId))
    }

    setAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, statusText: '正在修改卡片...', progress: 0 }])

    // 优先直连 API
    const apiKey = getApiKey()
    let result: string | null = null

    // 如有截图，作为 image file 传入
    const screenshotFiles = screenshotBase64
      ? [{ name: 'card-screenshot.png', dataUrl: screenshotBase64, fileType: 'image/png' }]
      : []

    if (apiKey) {
      result = await callAnthropicDirectly(
        modifyPrompt, '', screenshotFiles,
        (partialText) => {
          const preview = partialText.length > 40 ? '...' + partialText.slice(-40) : partialText
          updateTask(preview, 0.5)
        },
      )
    }

    // Fallback: server relay
    if (result === null) {
      const serverUp = await isClaudeServerRunning()
      if (serverUp) {
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: modifyPrompt, canvasContext: '', files: [] }),
          })

          if (res.ok && res.body) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let fullText = ''
            let buffer = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                let jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
                let event: any
                try { event = JSON.parse(jsonStr) } catch { continue }

                if (event.type === 'assistant') {
                  const contentBlocks = event.message?.content || []
                  for (const block of contentBlocks) {
                    if (block.type === 'text' && block.text) fullText += block.text
                  }
                } else if (event.type === 'result' && event.result) {
                  fullText = event.result
                }
              }
            }
            result = fullText.trim()
          }
        } catch (err) {
          if (import.meta.env.DEV) console.error('Modify shape server error:', err)
        }
      }
    }

    if (result === null) {
      removeTask()
      addToast('请配置 API Key 或启动本地 server', 'error')
      return
    }

    // 解析结果，更新原卡片
    updateTask('正在更新卡片...', 0.9)
    const toolCalls = parseToolCalls(result)

    if (toolCalls && toolCalls.length > 0 && targetType === 'product-card') {
      const updatedParams = toolCalls[0].params
      const updatedImageUrl = updatedParams.imageUrl !== undefined ? updatedParams.imageUrl : targetProps.imageUrl
      editor.updateShape({
        id: targetShapeId as TLShapeId,
        type: 'product-card' as any,
        props: {
          name: updatedParams.name || targetProps.name,
          tagline: updatedParams.tagline || targetProps.tagline,
          tags: JSON.stringify(updatedParams.tags || JSON.parse(targetProps.tags || '[]')),
          detail: updatedParams.detail || targetProps.detail,
          imageUrl: updatedImageUrl || '',
        },
      } as any)
      removeTask()
      addToast('卡片已更新', 'success')

      // 在卡片旁创建完成 comment
      const bounds = editor.getShapePageBounds(targetShape)
      if (bounds) {
        createComment(
          { x: bounds.x + bounds.width + 8, y: bounds.y },
          `已根据要求修改：${userInstruction.slice(0, 40)}${userInstruction.length > 40 ? '...' : ''}`,
          [],
          targetShapeId,
        )
      }
    } else {
      // 文本回复 → 在卡片旁创建 agent-card 说明
      const cleanText = stripCodeBlocks(result) || result
      const bounds = editor.getShapePageBounds(targetShape)
      const posX = bounds ? bounds.x + bounds.width + 24 : targetShape.x + 300
      const posY = bounds ? bounds.y : targetShape.y

      const summaryLines = cleanText.split('\n').filter(l => l.trim())
      const shortSummary = summaryLines.slice(0, 4).join('\n')
      const truncatedSummary = shortSummary.length > 200
        ? shortSummary.slice(0, 200) + '...'
        : (summaryLines.length > 4 ? shortSummary + '\n...' : shortSummary)

      editor.createShape({
        id: createShapeId(),
        type: 'agent-card' as any,
        x: posX,
        y: posY,
        props: {
          w: 380, h: 220,
          userMessage: `修改: ${userInstruction}`,
          summary: truncatedSummary,
          steps: '[]',
          status: 'done',
          currentStep: 0,
          agentTurnId: taskId,
          timestamp: Date.now(),
        },
      })
      removeTask()
      addToast('Agent 已回复修改建议', 'success')
    }
  }, [editor, callAnthropicDirectly, isClaudeServerRunning, addToast, createComment])

  // ============ 事件监听 ============
  useEffect(() => {
    // 监听大纲卡片的「开始生成」按钮
    const unsubGenerate = agentEvents.on(AGENT_EVENTS.GENERATE_PAGES, ({ shapeId }: { shapeId: string }) => {
      handleGeneratePages(shapeId)
    })

    // 监听 Comment 操作按钮
    const unsubComment = agentEvents.on(AGENT_EVENTS.COMMENT_ACTION, ({ action, label, anchorShapeId }: { action: string; label: string; anchorShapeId: string }) => {
      if (action === 'generate-outline') {
        handleGenerateOutline()
      } else if (action === 'option') {
        // ask_user 反馈闭环：用户选择了一个选项 → 继续 Claude 对话
        handleCommentFeedback(label, anchorShapeId)
      }
      // 其他 action 类型可以在这里扩展
    })

    // 监听文档上传 → 自动总结
    const unsubDoc = agentEvents.on(AGENT_EVENTS.SUMMARIZE_DOC, ({ shapeId }: { shapeId: string }) => {
      handleSummarizeDoc(shapeId)
    })

    // 监听用户对卡片发修改指令
    const unsubUserComment = agentEvents.on(AGENT_EVENTS.USER_COMMENT_ON_SHAPE, ({ shapeId, instruction, screenshotBase64 }: { shapeId: string; instruction: string; screenshotBase64?: string }) => {
      handleUserModifyShape(shapeId, instruction, screenshotBase64)
    })

    return () => {
      unsubGenerate()
      unsubComment()
      unsubDoc()
      unsubUserComment()
    }
  }, [handleGeneratePages, handleGenerateOutline, handleSummarizeDoc, handleCommentFeedback, handleUserModifyShape])

  return {
    agentTasks,
    agentMode,
    setAgentMode,
    activePrompt,
    workingZoneBounds,
    scanningShapeId,
    handleAgentMessage,
    handleDeepResearch,
    handleGenerateOutline,
    handleGeneratePages,
    handleExportPPT,
    handleExportFramesPPT,
    handleExportExcel,
    handleExportPDF,
    handlePromptSelect,
    handlePromptDismiss,
    createComment,
    handleCommentFeedback,
    handleUserModifyShape,
    setImageGenerationZoneBounds,
  }
}
