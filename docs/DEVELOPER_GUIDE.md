# 人类程序员开发指南

本文档面向希望理解、维护或扩展 Claude Infinite Canvas 项目的人类开发者。

## 目录

1. [架构概览](#架构概览)
2. [核心模块详解](#核心模块详解)
3. [自定义 Shape 开发](#自定义-shape-开发)
4. [Agent 系统](#agent-系统)
5. [状态管理](#状态管理)
6. [样式系统](#样式系统)
7. [常见开发场景](#常见开发场景)
8. [调试技巧](#调试技巧)
9. [性能优化](#性能优化)

---

## 架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        TldrawPocApp.tsx                         │
│                         (主应用容器)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   TopBar    │  │ LayerPanel  │  │      Tldraw Canvas      │ │
│  │  (顶部栏)   │  │  (图层面板)  │  │       (画布主体)         │ │
│  └─────────────┘  └─────────────┘  │                         │ │
│                                     │  ┌─────────────────┐   │ │
│  ┌─────────────────────────────┐   │  │ Custom Shapes   │   │ │
│  │      AgentInputBar          │   │  │ (10 种自定义形状) │   │ │
│  │       (底部输入栏)            │   │  └─────────────────┘   │ │
│  └─────────────────────────────┘   └─────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                          Hooks Layer                            │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │useAgentOrchestrator│  │useCanvasPersistence│                  │
│  │   (Agent 编排)     │  │   (画布持久化)      │                  │
│  └───────────────────┘  └───────────────────┘                  │
├─────────────────────────────────────────────────────────────────┤
│                        Services / Utils                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │imageGeneration│  │  pptExport   │  │ agentEvents  │         │
│  │  (图片生成)   │  │  (PPT导出)   │  │  (事件系统)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户输入 → AgentInputBar → useAgentOrchestrator
                                    ↓
                            意图检测 & 路由
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
              图片生成          Claude API       文件处理
                    ↓               ↓               ↓
                    └───────────────┼───────────────┘
                                    ↓
                            parseToolCalls
                                    ↓
                            executeToolCalls
                                    ↓
                          editor.createShape
                                    ↓
                              画布渲染更新
```

---

## 核心模块详解

### 1. TldrawPocApp.tsx

主应用入口，职责包括：
- 初始化 tldraw 编辑器
- 注册自定义 Shape
- 集成各个 Hook
- 管理全局 UI 状态

```typescript
// 自定义 Shape 注册
const customShapeUtils = [
  AIImageShapeUtil,
  AgentCardShapeUtil,
  ProductCardShapeUtil,
  // ... 更多
]

// 传递给 Tldraw
<Tldraw
  shapeUtils={customShapeUtils}
  onMount={handleEditorMount}
>
```

### 2. useAgentOrchestrator.ts

**这是项目最核心的文件**，约 4500 行代码，负责：

- **意图检测**：解析用户输入，判断是图片生成、深度研究、PPT 创建还是普通对话
- **API 调用**：与 Claude API 通信，支持 SSE 流式响应
- **工具调用解析**：将 Claude 返回的 JSON 解析为工具调用数组
- **画布对象创建**：根据工具调用在画布上创建对应的 Shape

关键函数：

```typescript
// 入口函数 - 处理用户消息
const handleAgentMessage = async (message: string, screenshot?: string) => {
  // 1. 意图检测
  // 2. 路由到对应处理器
  // 3. 调用 API 或执行本地逻辑
}

// JSON 解析（5 种策略）
const parseToolCalls = (text: string): Array<{ tool: string; params: any }> | null => {
  // 策略 1: 直接 JSON.parse
  // 策略 2: 从 [...] 边界提取
  // 策略 3: 修复截断 JSON
  // 策略 4: 逐个对象解析
  // 策略 5: 手动提取 tool + params
}

// 执行工具调用
const executeToolCalls = (toolCalls: Array<{ tool: string; params: any }>) => {
  // create_card → ProductCardShape
  // create_table → TableCardShape
  // ask_user → CommentShape
  // ...
}
```

### 3. agentEvents.ts

轻量级事件系统，用于 Shape 组件与 Hook 之间的通信：

```typescript
// 事件类型
export const AGENT_EVENTS = {
  GENERATE_PAGES: 'generate_pages',
  ADJUST_OUTLINE: 'adjust_outline',
  COMMENT_ACTION: 'comment_action',
  SUMMARIZE_DOC: 'summarize_doc',
}

// 在 Shape 中发送事件
agentEvents.emit(AGENT_EVENTS.COMMENT_ACTION, { option: '生成图片' })

// 在 Hook 中监听
agentEvents.on(AGENT_EVENTS.COMMENT_ACTION, (data) => {
  // 处理用户选择
})
```

**为什么需要这个？** tldraw 的 ShapeUtil 是纯渲染组件，不能直接访问 React Context 或调用 Hook。事件系统提供了一种解耦的通信方式。

---

## 自定义 Shape 开发

### Shape 的基本结构

每个自定义 Shape 需要：
1. 类型定义 (TypeScript)
2. ShapeUtil 类
3. 组件渲染函数

```typescript
// 1. 类型定义
export type MyCustomShape = TLBaseShape<
  'my-custom', // type 名称，必须唯一
  {
    w: number
    h: number
    // ... 其他属性
  }
>

// 2. ShapeUtil 类
export class MyCustomShapeUtil extends ShapeUtil<MyCustomShape> {
  static override type = 'my-custom' as const

  // 默认属性
  getDefaultProps() {
    return { w: 200, h: 100 }
  }

  // 几何信息（用于碰撞检测）
  getGeometry(shape: MyCustomShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  // 渲染组件
  component(shape: MyCustomShape) {
    return (
      <HTMLContainer>
        <div style={{ width: shape.props.w, height: shape.props.h }}>
          {/* 你的内容 */}
        </div>
      </HTMLContainer>
    )
  }

  // 选中指示器
  indicator(shape: MyCustomShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
```

### 常用 Override 方法

```typescript
// 禁止旋转
override canRotate = () => false

// 禁止编辑
override canEdit = () => false

// 禁止缩放
override canResize = () => false

// 隐藏选中边框
override hideSelectionBoundsBg = () => true
override hideSelectionBoundsFg = () => true

// 自定义调整大小行为
override onResize(shape, info) {
  return {
    props: {
      w: Math.max(100, info.initialBounds.w * info.scaleX),
      h: Math.max(50, info.initialBounds.h * info.scaleY),
    },
  }
}
```

### 注册新 Shape

在 `TldrawPocApp.tsx` 中添加：

```typescript
const customShapeUtils = [
  // ... 现有的
  MyCustomShapeUtil,  // 添加新的
]
```

---

## Agent 系统

### 系统提示词

系统提示词定义在 `useAgentOrchestrator.ts` 中的 `CANVAS_SYSTEM_PROMPT_SPATIAL` 常量：

```typescript
const CANVAS_SYSTEM_PROMPT_SPATIAL = `
你是一个画布 Agent，可以使用以下工具在无限画布上创建内容：

### create_card
创建一张产品/概念卡片
参数：
- name: 卡片标题
- tagline: 副标题
- tags: 标签数组
- detail: 详细描述（Markdown）
- sources: 来源引用数组

### create_table
创建数据表格
参数：
- title: 表格标题
- sheets: 多 sheet 数据

### ask_user
向用户提问
参数：
- question: 问题内容
- options: 选项数组

// ... 更多工具
`
```

### 工具调用格式

Claude 返回的工具调用是 JSON 数组：

```json
[
  {
    "tool": "create_card",
    "params": {
      "name": "产品名称",
      "tagline": "一句话描述",
      "tags": ["标签1", "标签2"],
      "detail": "详细描述...",
      "sources": [{ "title": "来源", "url": "..." }]
    }
  }
]
```

### 添加新工具

1. 在系统提示词中定义工具格式
2. 在 `executeToolCalls` 中添加处理逻辑
3. 创建对应的 Shape（如果需要）

```typescript
// executeToolCalls 中
if (tc.tool === 'my_new_tool') {
  editor.createShape({
    type: 'my-custom',
    x: position.x,
    y: position.y,
    props: tc.params,
  })
}
```

---

## 状态管理

项目使用多种状态管理方式：

### 1. React useState（组件级）

```typescript
const [isLoading, setIsLoading] = useState(false)
```

### 2. tldraw Editor（画布级）

```typescript
// 获取当前页面所有形状
const shapes = editor.getCurrentPageShapes()

// 创建形状
editor.createShape({ type: 'product-card', ... })

// 更新形状属性
editor.updateShape({ id: shapeId, props: { expanded: true } })

// 删除形状
editor.deleteShapes([shapeId])
```

### 3. IndexedDB（持久化）

```typescript
// useCanvasPersistence Hook
const { saveSnapshot, loadSnapshot } = useCanvasPersistence(editor)
```

### 4. localStorage（配置）

```typescript
// API Key 存储
localStorage.setItem('anthropic_api_key', key)
```

---

## 样式系统

### 主题变量

定义在 `src/styles/colors.ts`：

```typescript
export const colors = {
  light: {
    background: '#FFFFFF',
    text: '#1F2937',
    primary: '#38BDFF',
    // ...
  },
  dark: {
    background: '#0F172A',
    text: '#F1F5F9',
    primary: '#38BDFF',
    // ...
  },
}
```

### 在组件中使用

```typescript
import { useTheme } from '../contexts/ThemeContext'

function MyComponent() {
  const { theme, colors } = useTheme()

  return (
    <div style={{
      background: colors.background,
      color: colors.text
    }}>
      当前主题：{theme}
    </div>
  )
}
```

### 品牌色

主品牌色是 `#38BDFF`（亮蓝色），在整个应用中保持一致。

---

## 常见开发场景

### 场景 1：添加新的卡片类型

1. 在 `src/components/tldraw-poc/` 创建新的 Shape 文件
2. 定义类型和 ShapeUtil
3. 在 `TldrawPocApp.tsx` 注册
4. 在系统提示词中添加工具定义
5. 在 `executeToolCalls` 中添加处理逻辑

### 场景 2：修改 Agent 行为

编辑 `useAgentOrchestrator.ts` 中的：
- `CANVAS_SYSTEM_PROMPT_SPATIAL` - 修改系统提示词
- `handleAgentMessage` - 修改意图检测逻辑
- `executeToolCalls` - 修改工具执行逻辑

### 场景 3：添加新的导出格式

1. 在 `src/utils/` 创建导出函数
2. 在需要的地方调用（TopBar 或 Context Menu）
3. 生成 FileCardShape 展示下载链接

### 场景 4：添加新的图片生成模型

编辑 `src/services/imageGeneration.ts`：
1. 添加模型配置
2. 实现 API 调用逻辑
3. 在 UI 中添加模型选择选项

---

## 调试技巧

### 1. 开发环境日志

项目在开发模式下会输出详细日志：

```typescript
if (import.meta.env.DEV) {
  console.log('[parseToolCalls] input:', text)
}
```

### 2. tldraw 调试

```typescript
// 获取编辑器实例
const editor = useEditor()

// 在控制台打印当前状态
console.log('shapes:', editor.getCurrentPageShapes())
console.log('selected:', editor.getSelectedShapeIds())
```

### 3. JSON 解析调试

当解析失败时，控制台会打印：
- 原始文本的前 500 字符
- 错误位置附近的字符
- 字符编码（用于发现隐藏字符）

### 4. 网络请求调试

打开浏览器 DevTools → Network 标签页，查看：
- Claude API 请求/响应
- 图片生成 API 请求/响应

---

## 性能优化

### 1. Shape 渲染优化

- 使用 `React.memo` 包装复杂组件
- 避免在 `component()` 中做重计算
- 使用 `useMemo` 缓存计算结果

### 2. 大量 Shape 优化

- tldraw 自带视口裁剪，只渲染可见区域
- 避免创建过多 Shape（建议 < 500 个）

### 3. API 调用优化

- 使用流式响应减少等待时间
- 缓存重复请求结果

### 4. 存储优化

- IndexedDB 存储画布快照
- 定期清理过期数据

---

## 常见问题

### Q: 为什么我的 Shape 不显示？

检查：
1. ShapeUtil 是否在 `customShapeUtils` 数组中注册
2. `type` 名称是否正确且唯一
3. `getGeometry` 返回的尺寸是否正确

### Q: 为什么工具调用解析失败？

查看控制台日志，检查：
1. Claude 返回的 JSON 格式是否正确
2. 是否有特殊字符（换行、中文引号等）
3. JSON 是否被截断

### Q: 如何调试 Agent 行为？

1. 在 `handleAgentMessage` 入口添加日志
2. 检查 `parseToolCalls` 的返回值
3. 查看 `executeToolCalls` 的执行过程

---

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/my-feature`)
3. 提交更改 (`git commit -m 'Add my feature'`)
4. 推送到分支 (`git push origin feature/my-feature`)
5. 创建 Pull Request

代码规范：
- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 添加必要的注释
- 为新功能编写测试
