# 画布视频剪辑整合方案

## 目标

在 CCC（Claude-infinite-canvas）画布上实现视频剪辑能力：用户在无限画布上拖放素材、编排时间线、预览效果，Agent 辅助生成脚本，最终通过 Remotion 渲染出成品视频。

---

## 三个项目现状

### CCC（Claude-infinite-canvas）— 画布 + Agent
- **技术栈**：React 18 + tldraw 2.4 + Vite 5
- **核心能力**：10 个自定义 Shape、Agent 工具系统（create_card/table/slide/connection/group）、PPT/Excel/PDF 导出
- **架构模式**：Agent 通过 system prompt 定义工具 → Claude 返回 JSON 工具调用 → `executeToolCalls()` 在画布上创建 Shape
- **已有视频相关**：`ai-image` Shape 支持视频播放（isVideo 属性）、VideoControls 组件

### asset-manager-agent（后端）
- **技术栈**：FastAPI + Claude Agent SDK + Remotion + ChromaDB + R2
- **核心能力**：素材管理（上传/索引/语义搜索）、视频分析（Gemini）、Remotion 渲染（Docker）、自定义技能
- **API 端点**：`/api/chat/stream`（SSE Agent）、`/api/render/create`（异步渲染）、`/api/upload/direct`（R2 上传）
- **Remotion 能力**：多片段合成、字幕叠加、转场（fade/slide/wipe）、背景音乐、可配置分辨率/帧率

### omni-platform-ui（前端）
- **技术栈**：React 19 + Ant Design + Tailwind + Zustand
- **核心能力**：Workspace 管理、素材列表、AI 聊天面板、技能管理
- **关键发现**：**没有时间线编辑器**，只有素材元数据展示（片段时间戳、意图关键词）

---

## 整合策略

**核心思路：CCC 画布替代 omni-platform-ui 成为主交互界面，对接 asset-manager-agent 后端。**

画布天然适合视频剪辑：
- **空间排布** = 素材库（拖入画布）
- **Frame** = 时间线轨道
- **Shape 顺序** = 片段时序
- **Agent 工具** = 智能剪辑指令

omni-platform-ui 的功能（素材列表、上传、聊天、技能）全部可以在画布上用更好的方式重现，不需要保留它的独立页面。

---

## Part 1：连接后端 — API 服务层

### 1.1 创建 API 服务模块

**新建文件**：`src/services/assetManagerApi.ts`

```typescript
// 后端地址配置
const API_BASE = import.meta.env.VITE_ASSET_API_BASE || 'http://localhost:8222/api'

// 认证
export async function login(username: string): Promise<{ token: string; user: User }>
export async function getMe(token: string): Promise<User>

// Workspace
export async function listWorkspaces(token: string): Promise<Workspace[]>
export async function createWorkspace(token: string, name: string, desc?: string): Promise<Workspace>
export async function getWorkspaceAssets(token: string, workspaceId: string): Promise<Asset[]>

// 素材上传
export async function getPresignedUrl(token: string, params: PresignedUrlRequest): Promise<PresignedUrlResponse>
export async function uploadToR2(presignedUrl: string, file: File, onProgress?: (pct: number) => void): Promise<void>
export async function completeUpload(token: string, params: CompleteUploadRequest): Promise<Asset>

// 素材搜索（语义）
export async function searchClipsByIntent(token: string, workspaceId: string, query: string): Promise<SearchResult[]>

// 素材索引内容
export async function getAssetIndexedContent(token: string, assetId: string): Promise<IndexedContent>

// 视频渲染
export async function generateVideoScript(token: string, params: ScriptParams): Promise<VideoScript>
export async function createRenderTask(token: string, params: RenderParams): Promise<RenderTask>
export async function getRenderStatus(token: string, taskId: string): Promise<RenderTask>
export async function downloadRender(token: string, taskId: string): Promise<Blob>

// Agent 聊天（SSE）
export function streamChat(token: string, workspaceId: string, message: string): EventSource
```

### 1.2 环境变量

**修改文件**：项目根目录 `.env.local`

```
VITE_ASSET_API_BASE=http://localhost:8222/api
VITE_DEFAULT_WORKSPACE_ID=默认workspace的ID
```

### 1.3 认证状态

**新建文件**：`src/hooks/useAssetAuth.ts`

- 在 localStorage 存 token + user
- 提供 `login()`、`logout()`、`isAuthenticated`
- TopBar 显示用户名和登出按钮
- 首次打开时若无 token，弹出登录对话框

---

## Part 2：新增自定义 Shape

### 2.1 VideoClipShape — 视频片段卡片

**新建文件**：`src/components/tldraw-poc/VideoClipShape.tsx`

用途：表示一个视频片段，可在画布上拖放、排列、预览。

```typescript
type VideoClipShape = TLBaseShape<'video-clip', {
  w: number           // 默认 320
  h: number           // 默认 200
  assetId: string     // 关联的后端 asset ID
  src: string         // 视频 URL（R2）
  thumbnail: string   // 缩略图 URL
  filename: string
  startTime: number   // 片段起始秒
  endTime: number     // 片段结束秒
  duration: number    // 时长（秒）
  description: string // AI 描述
  intentKeyword: string // 意图关键词
  volume: number      // 0-1
  playbackRate: number // 默认 1.0
}>
```

**UI 设计**：
- 顶部：缩略图/视频预览（悬停播放）
- 中间：文件名 + 时长标签（如 `0:15 - 0:45`）
- 底部：意图标签（绿色 tag）+ 音量滑块
- 右上角：删除按钮
- 选中时：蓝色边框 + 显示 trim 手柄（调节 startTime/endTime）

### 2.2 TimelineShape — 时间线轨道

**新建文件**：`src/components/tldraw-poc/TimelineShape.tsx`

用途：一个横向的时间线容器，内部按顺序排列 VideoClip，作为最终渲染的序列。

```typescript
type TimelineShape = TLBaseShape<'timeline', {
  w: number           // 默认 1200
  h: number           // 默认 160
  name: string        // 轨道名（如 "主视频"、"B-roll"）
  fps: number         // 帧率 默认 30
  totalDuration: number // 自动计算
  outputWidth: number  // 输出宽度 默认 1920
  outputHeight: number // 输出高度 默认 1080
  clipOrder: string   // JSON: 有序的 clip shapeId 数组
  transitions: string // JSON: 相邻片段之间的转场配置
  backgroundMusic: string // JSON: { src, volume, loop }
}>
```

**UI 设计**：
- 外观类似 tldraw frame，但横向、底色深灰
- 顶部栏：轨道名 + 总时长 + "预览" 按钮 + "渲染" 按钮
- 内部区域：横向排列的片段缩略图条（宽度按时长比例）
- 片段之间的转场图标（可点击切换类型：fade/slide/wipe）
- 底部：时间刻度尺

**交互**：
- 拖 VideoClipShape 到 Timeline 上方 → 自动 reparent 进入时间线
- 在时间线内拖动 → 调整顺序
- 双击转场图标 → 弹出转场类型选择器

### 2.3 VideoPreviewShape — 预览播放器

**新建文件**：`src/components/tldraw-poc/VideoPreviewShape.tsx`

用途：时间线预览播放器，在画布上内嵌播放合成效果。

```typescript
type VideoPreviewShape = TLBaseShape<'video-preview', {
  w: number           // 默认 640
  h: number           // 默认 360
  timelineShapeId: string // 关联的 timeline shape
  currentTime: number // 当前播放位置
  isPlaying: boolean
  renderedUrl: string // 渲染完成后的视频 URL
}>
```

**UI 设计**：
- 16:9 黑色区域，播放/暂停按钮
- 进度条 + 当前时间/总时长
- 渲染前：逐片段预览（切换 video src）
- 渲染后：播放完整渲染视频
- "下载" 按钮（渲染完成后可用）

### 2.4 AssetLibraryShape — 素材库面板

**新建文件**：`src/components/tldraw-poc/AssetLibraryShape.tsx`

用途：画布上的素材库面板，展示 workspace 的所有素材，可拖出到画布。

```typescript
type AssetLibraryShape = TLBaseShape<'asset-library', {
  w: number           // 默认 300
  h: number           // 默认 500
  workspaceId: string
  assets: string      // JSON: Asset[]
  searchQuery: string
  filterType: string  // 'all' | 'video' | 'image' | 'audio'
}>
```

**UI 设计**：
- 顶部：搜索框 + 筛选按钮（全部/视频/图片/音频）
- 中间：素材网格（缩略图 + 文件名 + 时长）
- 底部："上传" 按钮
- 每个素材项可拖出 → 在画布上创建 VideoClipShape
- 语义搜索：输入自然语言 → 调用 searchClipsByIntent API

---

## Part 3：Agent 工具扩展

### 3.1 新增 Agent 工具定义

**修改文件**：`src/hooks/useAgentOrchestrator.ts` — system prompt

在 `CANVAS_SYSTEM_PROMPT_SPATIAL` 追加视频剪辑工具：

```
### 视频剪辑工具

#### search_assets
在素材库中语义搜索视频片段。
参数：
- query（必填）：搜索意图描述（如 "产品特写镜头"、"户外场景"）
- type（可选）：'video' | 'image' | 'audio'，默认 'video'

#### create_video_clip
在画布上创建一个视频片段卡片。
参数：
- assetId（必填）：素材 ID
- startTime（可选）：起始秒数
- endTime（可选）：结束秒数
- description（可选）：片段描述

#### create_timeline
创建一条时间线轨道，并按顺序放入片段。
参数：
- name（必填）：轨道名称
- clips（必填）：片段数组，每个元素 { assetId, startTime, endTime }
- transitions（可选）：转场数组，每个元素 { type: 'fade'|'crossfade'|'slide'|'wipe', durationFrames }
- backgroundMusic（可选）：{ url, volume, loop }
- output（可选）：{ width, height, fps }

#### render_timeline
将时间线提交渲染，返回渲染任务 ID。
参数：
- timelineShapeId（必填）：画布上时间线 Shape 的 ID（Agent 可从上下文获取）
- quality（可选）：'low' | 'medium' | 'high'，默认 'medium'
- format（可选）：'mp4' | 'webm'，默认 'mp4'
```

### 3.2 executeToolCalls 新增处理

**修改文件**：`src/hooks/useAgentOrchestrator.ts` — `executeToolCalls`

```typescript
// === 视频剪辑工具 ===

// search_assets → 调用后端 API，结果创建 video-clip shapes
const searchAssets = toolCalls.filter(tc => tc.tool === 'search_assets')
for (const sa of searchAssets) {
  const results = await searchClipsByIntent(token, workspaceId, sa.params.query)
  // 每个结果创建一个 video-clip shape
  for (const clip of results) {
    editor.createShape({ type: 'video-clip', ... })
  }
}

// create_video_clip → 创建 video-clip shape
const videoClips = toolCalls.filter(tc => tc.tool === 'create_video_clip')
for (const vc of videoClips) {
  const asset = await getAssetById(token, vc.params.assetId)
  editor.createShape({ type: 'video-clip', props: { ...vc.params, src: asset.r2_url } })
}

// create_timeline → 创建 timeline shape + 内部 video-clip children
const timelines = toolCalls.filter(tc => tc.tool === 'create_timeline')
for (const tl of timelines) {
  const timelineId = createShapeId()
  editor.createShape({ id: timelineId, type: 'timeline', props: { name: tl.params.name, ... } })

  const clipIds = []
  for (const clip of tl.params.clips) {
    const clipId = createShapeId()
    editor.createShape({ id: clipId, type: 'video-clip', props: { assetId: clip.assetId, ... } })
    clipIds.push(clipId)
  }
  editor.reparentShapes(clipIds, timelineId)

  // 创建预览播放器（在 timeline 下方）
  editor.createShape({ type: 'video-preview', props: { timelineShapeId: timelineId } })
}

// render_timeline → 收集 timeline 数据 → 调用后端渲染 API
const renders = toolCalls.filter(tc => tc.tool === 'render_timeline')
for (const r of renders) {
  const script = buildRemotionScript(editor, r.params.timelineShapeId)
  const task = await createRenderTask(token, { script, quality: r.params.quality })
  // 更新 video-preview shape 显示渲染进度
  pollRenderStatus(task.taskId, (status) => {
    editor.updateShape({ id: previewShapeId, props: { renderedUrl: status.output_url } })
  })
}
```

### 3.3 buildRemotionScript — 画布数据 → Remotion 脚本

**新建文件**：`src/utils/videoExport.ts`

核心函数：遍历 timeline shape 的子 video-clip shapes，转换为后端 Remotion 需要的 VideoScript JSON：

```typescript
export function buildRemotionScript(editor: Editor, timelineShapeId: TLShapeId): VideoScript {
  const timeline = editor.getShape(timelineShapeId) // timeline shape
  const childIds = editor.getSortedChildIdsForParent(timelineShapeId)

  const clips: VideoClip[] = childIds.map(id => {
    const shape = editor.getShape(id) // video-clip shape
    return {
      id: shape.id,
      src: shape.props.src,
      startTime: shape.props.startTime,
      endTime: shape.props.endTime,
      volume: shape.props.volume,
      playbackRate: shape.props.playbackRate,
    }
  })

  const transitions = JSON.parse(timeline.props.transitions || '[]')
  const bgMusic = JSON.parse(timeline.props.backgroundMusic || 'null')

  return {
    clips,
    captions: [],  // 后续可扩展字幕工具
    transitions,
    outputSettings: {
      fps: timeline.props.fps,
      width: timeline.props.outputWidth,
      height: timeline.props.outputHeight,
    },
    backgroundMusic: bgMusic,
  }
}
```

---

## Part 4：用户交互流程

### 4.1 典型工作流

```
1. 用户打开画布 → 登录（TopBar 登录按钮）→ 选择/创建 Workspace

2. 素材准备：
   a. Agent 方式："帮我找产品特写的镜头" → Agent 调用 search_assets → 画布出现 video-clip 卡片
   b. 手动方式：打开素材库面板（Asset Library Shape）→ 搜索/筛选 → 拖出到画布

3. 编排时间线：
   a. Agent 方式："用这些片段做一个30秒的宣传视频" → Agent 调用 create_timeline → 画布出现排好的时间线
   b. 手动方式：创建空时间线 → 拖 video-clip 进去 → 调整顺序和转场

4. 预览：
   点击时间线的"预览"按钮 → VideoPreview 播放器逐片段预览

5. 渲染：
   a. Agent 方式："渲染这个时间线" → Agent 调用 render_timeline
   b. 手动方式：点击"渲染"按钮
   → 后端 Docker Remotion 渲染 → 进度更新 → 完成后 Preview 播放器可播放/下载

6. 迭代：
   用户直接在画布上调整（拖动片段顺序、修改 trim 时间、换转场）→ 再次预览/渲染
```

### 4.2 画布上下文给 Agent

当用户发送消息时，`read_canvas` 需要包含视频相关信息：

```typescript
// 在 buildCanvasContext() 中，遇到 video-clip 和 timeline 类型时：
if (shape.type === 'video-clip') {
  context += `[视频片段] ${shape.props.filename} (${shape.props.startTime}s-${shape.props.endTime}s) 描述: ${shape.props.description}\n`
}
if (shape.type === 'timeline') {
  const childCount = editor.getSortedChildIdsForParent(shape.id).length
  context += `[时间线] "${shape.props.name}" 包含 ${childCount} 个片段, 总时长 ${shape.props.totalDuration}s\n`
}
```

---

## Part 5：改动文件清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/services/assetManagerApi.ts` | 新建 | 后端 API 封装 |
| `src/hooks/useAssetAuth.ts` | 新建 | 认证状态管理 |
| `src/components/tldraw-poc/VideoClipShape.tsx` | 新建 | 视频片段 Shape |
| `src/components/tldraw-poc/TimelineShape.tsx` | 新建 | 时间线 Shape |
| `src/components/tldraw-poc/VideoPreviewShape.tsx` | 新建 | 预览播放器 Shape |
| `src/components/tldraw-poc/AssetLibraryShape.tsx` | 新建 | 素材库面板 Shape |
| `src/utils/videoExport.ts` | 新建 | 画布 → Remotion 脚本转换 |
| `src/hooks/useAgentOrchestrator.ts` | 修改 | 新增工具定义 + executeToolCalls 处理 |
| `src/TldrawPocApp.tsx` | 修改 | 注册新 Shape、添加登录/workspace 逻辑 |
| `src/components/TopBar.tsx` | 修改 | 添加登录状态、workspace 切换、素材库按钮 |
| `.env.local` | 新建 | 环境变量 |

---

## Part 6：实施顺序

### Phase 1：基础连接
1. 创建 `assetManagerApi.ts` 和 `useAssetAuth.ts`
2. TopBar 添加登录功能 + workspace 选择
3. 确认可以调通后端 API（列出素材、上传、搜索）

### Phase 2：素材 Shape
4. 实现 `VideoClipShape` — 视频片段卡片（带预览、trim、音量）
5. 实现 `AssetLibraryShape` — 素材库面板（搜索、筛选、拖出）
6. 注册 Shape，验证可在画布上创建和操作

### Phase 3：时间线
7. 实现 `TimelineShape` — 时间线轨道（拖入排序、转场配置）
8. 实现 `VideoPreviewShape` — 预览播放器
9. 实现拖放交互：video-clip → timeline 的 reparent 逻辑

### Phase 4：Agent 工具
10. 系统提示词追加视频工具定义
11. `executeToolCalls` 添加 search_assets / create_video_clip / create_timeline / render_timeline
12. 实现 `buildRemotionScript()` 转换函数
13. 实现渲染状态轮询 + preview 更新

### Phase 5：打磨
14. 素材上传对话框（拖放上传到 workspace）
15. 时间线内拖动排序优化
16. 渲染进度动画
17. 错误处理和 toast 提示

---

## 后端需要确认的事项

1. **CORS 配置**：后端 FastAPI 需要允许画布前端的 origin（`http://localhost:5174`）
2. **WebSocket vs SSE**：当前后端支持两种，建议统一用 SSE（`/api/chat/stream`），与 CCC 现有的 Anthropic SSE 模式一致
3. **素材预览 URL**：R2 的视频 URL 是否支持 range request（用于视频 seek）？
4. **渲染服务器**：Docker Remotion 渲染需要在后端机器上可用
5. **认证**：后端的 JWT token 格式和获取方式

---

## 设计原则

1. **画布即界面**：所有操作（素材浏览、时间线编排、预览、渲染）都在画布上完成，不跳转页面
2. **Agent 辅助非必需**：用户可以纯手动拖放完成剪辑，Agent 只是加速器
3. **渐进增强**：Phase 1-2 不依赖后端也能工作（mock 数据），Phase 3-4 才需要真实后端
4. **复用现有模式**：新 Shape 遵循 CCC 现有的 ShapeUtil 模式，新工具遵循 executeToolCalls 模式
5. **不改后端**：整合方案不修改 asset-manager-agent 的代码，只消费其 API
