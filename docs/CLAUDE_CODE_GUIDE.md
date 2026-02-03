# Claude Code 协作指南

本文档专门为 Claude Code（AI 编程助手）编写，帮助你快速理解项目结构并高效协作。

---

## 项目快速概览

**项目类型**: AI 驱动的无限画布应用
**核心技术**: React 18 + TypeScript + tldraw 2.4 + Vite 5
**主要功能**: 通过自然语言在画布上创建卡片、表格、图片，支持导出 PPT/Excel/PDF

---

## 关键文件位置（优先阅读）

当需要理解或修改特定功能时，按以下顺序阅读：

### 核心文件

| 文件 | 职责 | 何时阅读 |
|------|------|---------|
| `src/TldrawPocApp.tsx` | 主应用入口，集成所有组件 | 理解整体架构 |
| `src/hooks/useAgentOrchestrator.ts` | **最重要**：Agent 编排、API 调用、工具解析 | 修改 AI 行为 |
| `src/components/tldraw-poc/*.tsx` | 10 个自定义 Shape | 修改卡片 UI |
| `src/utils/agentEvents.ts` | Shape ↔ Hook 事件通信 | 添加新交互 |

### 功能文件

| 文件 | 职责 |
|------|------|
| `src/services/imageGeneration.ts` | 图片生成 API |
| `src/utils/pptExport.ts` | PPT 导出 |
| `src/utils/excelExport.ts` | Excel 导出 |
| `src/utils/imageCommandParser.ts` | 图片生成指令解析 |
| `src/hooks/useCanvasPersistence.ts` | 画布持久化 |
| `src/styles/colors.ts` | 主题色彩系统 |

---

## 自定义 Shape 类型速查

项目有 10 个自定义 Shape，每个都是 `TLBaseShape` 的扩展：

```typescript
// 所有 Shape 的 type 名称
'ai-image'        // AI 生成的图片/视频
'ai-working-zone' // AI 工作区域指示器
'agent-card'      // Agent 对话卡片
'product-card'    // 产品信息卡片
'agent-comment'   // Agent 评论气泡
'doc-card'        // 文档卡片
'page-card'       // PPT 页面卡片
'file-card'       // 导出文件卡片
'outline-card'    // 大纲卡片
'table-card'      // 表格卡片
```

### Shape 属性参考

```typescript
// ProductCardShape
{
  w: number, h: number,
  name: string,           // 产品名称
  tagline: string,        // 副标题
  tags: string,           // JSON: string[]
  detail: string,         // Markdown 详情
  sources: string,        // JSON: SourceRef[]
  expanded: boolean,
  imageUrl: string,
}

// TableCardShape
{
  w: number, h: number,
  title: string,
  sheets: string,         // JSON: { name, headers, rows }[]
}

// AIImageShape
{
  w: number, h: number,
  url: string,
  prompt?: string,
  model?: string,
  isVideo?: boolean,
}
```

---

## useAgentOrchestrator 详解

这是项目最核心的文件（约 4500 行），结构如下：

```typescript
// 文件结构
useAgentOrchestrator.ts
├── 常量定义
│   ├── CANVAS_SYSTEM_PROMPT_SPATIAL  // 系统提示词
│   └── IMAGE_MODELS                   // 图片模型配置
├── 辅助函数
│   ├── stripCodeBlocks()             // 清理代码块
│   ├── parseToolCalls()              // JSON 解析（5 种策略）
│   └── aggressiveJsonFix()           // JSON 修复
├── 主要函数
│   ├── handleAgentMessage()          // 消息入口
│   ├── handleRealAgent()             // 真实 API 调用
│   ├── executeToolCalls()            // 执行工具调用
│   ├── handleImageGeneration()       // 图片生成
│   └── handleExportPPT/Excel()       // 导出功能
└── 返回值
    ├── isProcessing
    ├── agentTasks
    ├── handleAgentMessage
    └── ... 更多
```

### parseToolCalls 解析策略

当 Claude 返回 JSON 时，按以下顺序尝试解析：

1. **策略 1**: 直接 `JSON.parse(trimmed)`
2. **策略 1b**: 修复字符串内换行后解析
3. **策略 1c**: 激进修复（中文引号、尾部逗号等）
4. **策略 2**: 从 `[...]` 边界提取数组
5. **策略 2b**: 从 `{...}` 边界提取单对象
6. **策略 3**: 补全截断的 JSON 数组
7. **策略 4**: 正则匹配 + 括号计数逐个提取
8. **策略 5**: 手动提取 `"tool"` 和 `"params"` 字段

### 工具调用格式

```json
[
  {
    "tool": "create_card",
    "params": {
      "name": "标题",
      "tagline": "副标题",
      "tags": ["标签"],
      "detail": "详情",
      "sources": []
    }
  },
  {
    "tool": "create_table",
    "params": {
      "title": "表格标题",
      "sheets": [{ "name": "Sheet1", "headers": [...], "rows": [...] }]
    }
  }
]
```

---

## 事件系统

Shape 组件无法直接调用 Hook，需要通过事件系统通信：

```typescript
// 事件类型 (src/utils/agentEvents.ts)
AGENT_EVENTS = {
  GENERATE_PAGES: 'generate_pages',    // OutlineCard → 生成页面
  ADJUST_OUTLINE: 'adjust_outline',    // OutlineCard → 调整大纲
  COMMENT_ACTION: 'comment_action',    // CommentShape → 用户选择
  SUMMARIZE_DOC: 'summarize_doc',      // DocCard → 生成摘要
}

// 在 Shape 中发送
agentEvents.emit(AGENT_EVENTS.COMMENT_ACTION, { option: '选项文本' })

// 在 Hook 中监听
useEffect(() => {
  const unsubscribe = agentEvents.on(AGENT_EVENTS.COMMENT_ACTION, handler)
  return unsubscribe
}, [])
```

---

## 常见修改任务指南

### 任务 1：修改 Agent 系统提示词

**文件**: `src/hooks/useAgentOrchestrator.ts`
**位置**: 搜索 `CANVAS_SYSTEM_PROMPT_SPATIAL`

```typescript
const CANVAS_SYSTEM_PROMPT_SPATIAL = `
你是一个画布 Agent...
// 在这里修改提示词
`
```

### 任务 2：添加新的工具调用

1. 在系统提示词中定义工具格式
2. 在 `executeToolCalls` 函数中添加处理：

```typescript
// 搜索 "executeToolCalls"
const executeToolCalls = (toolCalls, taskId) => {
  // ... 现有代码

  // 添加新工具处理
  if (tc.tool === 'my_new_tool') {
    editor.createShape({
      type: 'my-shape-type',
      x: position.x,
      y: position.y,
      props: tc.params,
    })
  }
}
```

### 任务 3：创建新的 Shape

1. 创建文件 `src/components/tldraw-poc/MyNewShape.tsx`:

```typescript
import { ShapeUtil, TLBaseShape, HTMLContainer, Rectangle2d } from 'tldraw'

export type MyNewShape = TLBaseShape<'my-new', { w: number; h: number; /* props */ }>

export class MyNewShapeUtil extends ShapeUtil<MyNewShape> {
  static override type = 'my-new' as const

  getDefaultProps() {
    return { w: 200, h: 100 }
  }

  getGeometry(shape: MyNewShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: MyNewShape) {
    return (
      <HTMLContainer>
        <div style={{ width: shape.props.w, height: shape.props.h }}>
          内容
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: MyNewShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
```

2. 在 `TldrawPocApp.tsx` 注册：

```typescript
import { MyNewShapeUtil } from './components/tldraw-poc/MyNewShape'

const customShapeUtils = [
  // ... 现有
  MyNewShapeUtil,
]
```

### 任务 4：修复 JSON 解析问题

**文件**: `src/hooks/useAgentOrchestrator.ts`
**位置**: 搜索 `parseToolCalls`

解析失败时会打印调试信息：
```
[parseToolCalls] all strategies failed, returning null
[parseToolCalls] first 500 chars: ...
```

根据日志添加新的修复策略。

### 任务 5：修改主题颜色

**文件**: `src/styles/colors.ts`

```typescript
export const colors = {
  light: {
    background: '#FFFFFF',
    primary: '#38BDFF',  // 品牌色
    // ...
  },
  dark: {
    background: '#0F172A',
    // ...
  },
}
```

### 任务 6：添加新的导出格式

1. 创建导出函数 `src/utils/myExport.ts`
2. 在需要的地方调用
3. 创建 FileCardShape 显示下载链接

---

## 代码模式参考

### 创建 Shape

```typescript
const shapeId = createShapeId()
editor.createShape({
  id: shapeId,
  type: 'product-card',
  x: centerX,
  y: centerY,
  props: {
    w: 280,
    h: 200,
    name: '产品名称',
    // ...
  },
})
```

### 更新 Shape

```typescript
editor.updateShape({
  id: existingShapeId,
  type: 'product-card',
  props: {
    expanded: true,
    detail: '新内容',
  },
})
```

### 获取 Shape

```typescript
// 获取单个
const shape = editor.getShape(shapeId)

// 获取所有
const allShapes = editor.getCurrentPageShapes()

// 获取选中的
const selectedIds = editor.getSelectedShapeIds()
```

### 视口操作

```typescript
// 获取视口中心
const center = editor.getViewportScreenCenter()
const pagePoint = editor.screenToPage(center)

// 缩放到指定区域
editor.zoomToBounds(bounds, { animation: { duration: 400 } })
```

---

## 调试提示

### 开发环境日志

```typescript
if (import.meta.env.DEV) {
  console.log('[模块名] 信息:', data)
}
```

### 关键日志位置

- `[parseToolCalls]` - JSON 解析过程
- `[handleRealAgent]` - API 调用流程
- `[executeToolCalls]` - 工具执行过程
- `[imageGeneration]` - 图片生成

### TypeScript 编译检查

```bash
npx tsc --noEmit
```

### 启动开发服务器

```bash
npm run dev
```

---

## 注意事项

1. **不要修改 tldraw 核心代码**，只通过 ShapeUtil 扩展
2. **Shape 组件中不能使用 React Hook**，用事件系统代替
3. **JSON 字符串属性**（如 `tags`, `sheets`）需要 `JSON.parse/stringify`
4. **颜色使用主题变量**，不要硬编码
5. **大文件修改前先理解上下文**，特别是 `useAgentOrchestrator.ts`

---

## 快速问答

**Q: 如何找到某个功能的代码？**
A: 使用 Grep 搜索关键词，如 "create_card"、"PPT"、"导出"

**Q: Shape 之间如何通信？**
A: 通过 `agentEvents` 事件系统，或通过 `editor.updateShape` 修改属性

**Q: 如何添加新的 AI 模型？**
A: 修改 `src/services/imageGeneration.ts` 中的模型配置

**Q: 持久化数据存在哪里？**
A: IndexedDB，通过 `useCanvasPersistence` Hook 管理

**Q: 如何调试 API 调用？**
A: 查看浏览器 Network 标签页，或在代码中添加 console.log

---

## 项目统计

- **总代码行数**: ~28,000 行 TypeScript/TSX
- **自定义 Shape**: 10 个
- **主要 Hook**: 8 个
- **导出格式**: PPT / Excel / PDF / PNG
- **支持的图片模型**: Gemini、Seedream 等

---

**最后更新**: 2026-02-03
