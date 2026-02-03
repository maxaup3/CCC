# Claude Infinite Canvas

一个基于 tldraw 的 AI 无限画布应用，集成 Claude AI 能力，支持智能卡片生成、图片生成、文档导出等功能。

## 项目简介

Claude Infinite Canvas 是一个创新的 AI 驱动无限画布工具，将 Claude AI 的强大能力与 tldraw 的灵活画布相结合。用户可以通过自然语言与 AI 交互，在画布上创建各种类型的卡片、表格、图片，并支持导出为 PPT、Excel、PDF 等格式。

### 核心特性

- **AI 驱动的内容生成**：通过自然语言指令创建产品卡片、表格、大纲等
- **图片生成**：集成多个 AI 图片生成模型（Gemini、Seedream 等）
- **智能文档处理**：上传 PDF/Markdown 文件，AI 自动生成摘要
- **多格式导出**：支持 PPT、Excel、PDF、PNG 导出
- **深色/浅色主题**：完整的双主题支持
- **项目管理**：多项目支持，自动保存到本地

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 画布引擎 | tldraw 2.4 |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS 4 |
| AI 集成 | Claude API (Anthropic) |
| 导出 | pptxgenjs / xlsx / jspdf |
| 存储 | IndexedDB |

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置 API Key

首次启动时，点击右上角设置按钮配置 Anthropic API Key。

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
├── components/           # React 组件
│   ├── tldraw-poc/      # 10 个自定义 Shape 组件
│   ├── AgentInputBar.tsx
│   ├── TopBar.tsx
│   └── ...
├── hooks/               # React Hooks
│   ├── useAgentOrchestrator.ts  # 核心 Agent 编排逻辑
│   ├── useCanvasPersistence.ts
│   └── ...
├── services/            # 业务服务
│   └── imageGeneration.ts
├── utils/               # 工具函数
│   ├── pptExport.ts
│   ├── excelExport.ts
│   └── ...
├── styles/              # 样式配置
├── types/               # TypeScript 类型
└── TldrawPocApp.tsx     # 主应用入口
```

## 自定义 Shape 类型

项目实现了 10 种自定义 tldraw Shape：

| Shape | 用途 |
|-------|------|
| `ai-image` | AI 生成的图片/视频 |
| `ai-working-zone` | AI 工作区域指示器 |
| `agent-card` | Agent 对话卡片 |
| `product-card` | 产品信息卡片 |
| `agent-comment` | Agent 评论气泡 |
| `doc-card` | 文档卡片 |
| `page-card` | PPT 页面卡片 |
| `file-card` | 导出文件卡片 |
| `outline-card` | 大纲卡片 |
| `table-card` | 表格卡片 |

## 使用指南

### 基本交互

1. 在底部输入框输入自然语言指令
2. AI 会在画布上创建相应的卡片/内容
3. 拖拽、缩放、编辑画布上的元素

### 图片生成

使用以下指令触发图片生成：
- `/img <描述>` - 生成图片
- `/draw <描述>` - 生成图片
- `/画 <描述>` - 生成图片
- 或直接说 "帮我画一张..." / "生成一张..."

### 文档导出

- **PPT 导出**：先让 AI 生成大纲，确认后生成页面，最后导出
- **Excel 导出**：选择表格卡片或产品卡片，导出为 Excel
- **PDF 导出**：选择任意元素导出为 PDF

### 快捷键

- `Cmd/Ctrl + Z` - 撤销
- `Cmd/Ctrl + Shift + Z` - 重做
- `Delete` - 删除选中元素
- `Space + 拖拽` - 平移画布

## 开发指南

详细的开发文档请参考：
- [人类程序员开发指南](./DEVELOPER_GUIDE.md)
- [Claude Code 协作指南](./CLAUDE_CODE_GUIDE.md)

## License

MIT
