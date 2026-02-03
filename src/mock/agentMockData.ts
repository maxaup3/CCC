/**
 * Agent Mock 数据
 * 支持多种场景：通用分析、PPT 产品调研、深入研究、大纲生成、页面生成
 */
import { AgentStep } from '../components/tldraw-poc/AgentCardShape'
import type { OutlineItem } from '../components/tldraw-poc/OutlineCardShape'
import type { PageContent } from '../components/tldraw-poc/PageCardShape'

/** 来源引用 */
export interface SourceRef {
  title: string
  domain: string
  url: string
}

/** 产品数据（用于生成 ProductCardShape） */
export interface ProductData {
  name: string
  tagline: string
  tags: string[]
  detail: string
  sources: SourceRef[]
}

/** PPT 调研场景返回类型 */
export interface PPTResearchResult {
  steps: AgentStep[]
  products: ProductData[]
  summary: string
  prompt?: {
    question: string
    options: string[]
  }
}

/**
 * 生成通用 mock Agent 步骤序列（保留旧逻辑）
 */
export function generateMockAgentSteps(
  userMessage: string,
  canvasNodeCount: number
): { steps: AgentStep[]; summary: string } {
  const steps: AgentStep[] = [
    { type: 'thinking', content: `用户说: "${userMessage}"。让我先了解画布现状...` },
    { type: 'tool_call', content: '查看画布当前状态', toolName: 'get_canvas_tree', toolResult: `${canvasNodeCount} 个节点` },
    { type: 'thinking', content: `画布上有 ${canvasNodeCount} 个节点。根据需求进行分析...` },
    { type: 'result', title: 'Agent 分析', content: `## 分析结果\n\n针对「${userMessage}」：\n\n- 当前画布有 **${canvasNodeCount}** 个元素\n- 已完成内容分析\n- 建议关注元素间的关联性` },
    { type: 'comment', title: '建议', content: `已完成分析。如果需要更详细的内容，可以继续提问。` },
  ]
  return {
    steps,
    summary: `已完成对「${userMessage}」的分析（${canvasNodeCount} 个画布节点）。`,
  }
}

/**
 * PPT 产品调研场景 mock
 * 模拟：用户说「帮我收集一下好的画布产品」
 */
export function generatePPTResearchMock(userMessage: string): PPTResearchResult {
  const steps: AgentStep[] = [
    {
      type: 'thinking',
      content: `用户想收集画布类产品。我需要搜索目前市面上主流的无限画布 / 白板 / 设计协作产品，找到有代表性的案例。`,
    },
    {
      type: 'tool_call',
      content: '搜索画布类产品',
      toolName: 'web_search',
      toolResult: '找到 23 个相关结果',
    },
    {
      type: 'thinking',
      content: '搜索结果已返回。让我筛选出最具代表性的产品，按不同定位分类整理...',
    },
    {
      type: 'tool_call',
      content: '获取产品详细信息',
      toolName: 'web_search',
      toolResult: '已获取 8 个产品的详细资料',
    },
    {
      type: 'thinking',
      content: '信息收集完毕，现在为每个产品生成卡片。这些产品覆盖了设计、白板、知识管理、开发四个方向。',
    },
  ]

  const products: ProductData[] = [
    {
      name: 'Figma',
      tagline: '实时协作设计工具，无限画布 + 组件系统，设计行业标准。',
      tags: ['设计工具', '实时协作', '组件系统'],
      detail: `## 核心亮点\n\n- **多人实时协作**：光标跟随、实时编辑\n- **Auto Layout**：自动布局系统\n- **Dev Mode**：设计到开发交付\n- **FigJam**：白板协作子产品\n\n## 画布特点\n\n- 无限画布 + 分页管理\n- 矢量编辑精度高\n- 插件生态丰富（2000+ 插件）`,
      sources: [
        { title: 'Figma: The Collaborative Interface Design Tool', domain: 'figma.com', url: 'https://figma.com' },
        { title: 'Figma Review 2025 - Features & Pricing', domain: 'producthunt.com', url: 'https://producthunt.com/products/figma' },
        { title: 'Why Figma Wins', domain: 'kwokchain.com', url: 'https://kwokchain.com/2020/06/19/why-figma-wins/' },
      ],
    },
    {
      name: 'Miro',
      tagline: '在线白板协作平台，强调团队头脑风暴与可视化工作流。',
      tags: ['白板', '头脑风暴', '团队协作'],
      detail: `## 核心亮点\n\n- **模板丰富**：300+ 预设模板\n- **投票 & 计时器**：会议辅助工具\n- **框架集成**：支持嵌入外部内容\n- **Miro AI**：AI 辅助内容生成\n\n## 画布特点\n\n- 无限画布 + 框架分区\n- 便签、连线、思维导图原生支持\n- 大规模团队（100+ 人）同时协作`,
      sources: [
        { title: 'Miro | The Innovation Workspace', domain: 'miro.com', url: 'https://miro.com' },
        { title: 'Miro vs Figma vs FigJam: Comparison', domain: 'g2.com', url: 'https://g2.com/compare/miro-vs-figma' },
      ],
    },
    {
      name: 'tldraw',
      tagline: '开源无限画布引擎，可嵌入任何 Web 应用，开发者友好。',
      tags: ['开源', '开发者工具', '可嵌入'],
      detail: `## 核心亮点\n\n- **完全开源**：MIT 协议\n- **SDK 优先**：作为组件嵌入应用\n- **自定义 Shape**：可扩展形状系统\n- **Make Real**：AI 生成 UI 的实验\n\n## 画布特点\n\n- 轻量（< 200KB）\n- 手绘风格默认主题\n- React 组件，TypeScript 原生`,
      sources: [
        { title: 'tldraw - GitHub Repository', domain: 'github.com', url: 'https://github.com/tldraw/tldraw' },
        { title: 'tldraw Documentation', domain: 'tldraw.dev', url: 'https://tldraw.dev' },
        { title: 'Make Real: tldraw + AI', domain: 'tldraw.com', url: 'https://makereal.tldraw.com' },
      ],
    },
    {
      name: 'Notion',
      tagline: '笔记 + 知识库 + 项目管理一体化工具，块编辑器的标杆。',
      tags: ['知识管理', '块编辑器', '全能工具'],
      detail: `## 核心亮点\n\n- **Block 编辑器**：一切皆 Block\n- **数据库视图**：表格 / 看板 / 日历 / 画廊\n- **Notion AI**：内置 AI 写作助手\n- **API 开放**：丰富的第三方集成\n\n## 与画布的关系\n\n- 非传统画布，但 Block 拖拽理念影响深远\n- 近期推出简单白板功能\n- 知识组织方式值得参考`,
      sources: [
        { title: 'Notion – Your connected workspace', domain: 'notion.so', url: 'https://notion.so' },
        { title: 'Notion Review & Alternatives', domain: 'techcrunch.com', url: 'https://techcrunch.com/tag/notion/' },
      ],
    },
    {
      name: 'Excalidraw',
      tagline: '开源手绘风格白板，极简上手，适合快速草图和架构图。',
      tags: ['开源', '手绘风格', '轻量'],
      detail: `## 核心亮点\n\n- **零学习成本**：打开即用\n- **手绘风格**：让草图更自然\n- **端对端加密**：协作数据安全\n- **库 & 模板**：社区资源丰富\n\n## 画布特点\n\n- 极简交互，无复杂菜单\n- 导出 SVG / PNG 方便\n- 可嵌入 Notion、Obsidian 等`,
      sources: [
        { title: 'Excalidraw - GitHub', domain: 'github.com', url: 'https://github.com/excalidraw/excalidraw' },
        { title: 'Excalidraw: Virtual whiteboard', domain: 'excalidraw.com', url: 'https://excalidraw.com' },
      ],
    },
    {
      name: 'Heptabase',
      tagline: '视觉化知识管理工具，用白板组织笔记和思维，学习者最爱。',
      tags: ['知识管理', '视觉思维', '学习工具'],
      detail: `## 核心亮点\n\n- **卡片 + 白板**：笔记卡片自由排列在画布\n- **多层白板**：白板可嵌套白板\n- **标签 & 搜索**：结构化管理\n- **PDF 标注**：学术阅读友好\n\n## 画布特点\n\n- 卡片式内容，空间位置即关系\n- 支持拖拽连线\n- 台湾团队，中文体验好`,
      sources: [
        { title: 'Heptabase - A note-taking tool for visual learning', domain: 'heptabase.com', url: 'https://heptabase.com' },
        { title: 'Heptabase Review - Product Hunt', domain: 'producthunt.com', url: 'https://producthunt.com/products/heptabase' },
        { title: '詹雨安: Why I built Heptabase', domain: 'medium.com', url: 'https://medium.com/@alanchan/heptabase' },
      ],
    },
    {
      name: 'Canvas（Obsidian）',
      tagline: 'Obsidian 内置画布功能，将 Markdown 笔记在空间中自由组织。',
      tags: ['本地优先', 'Markdown', '知识图谱'],
      detail: `## 核心亮点\n\n- **本地存储**：数据完全在本地\n- **双向链接**：知识图谱自动生成\n- **Markdown 原生**：文件即笔记\n- **插件系统**：社区驱动扩展\n\n## 画布特点\n\n- 将已有笔记拖入画布排列\n- JSON 格式存储画布数据\n- 连线表达笔记间关系`,
      sources: [
        { title: 'Obsidian Canvas', domain: 'obsidian.md', url: 'https://obsidian.md/canvas' },
        { title: 'Obsidian Canvas: A new way to organize', domain: 'obsidian.md', url: 'https://obsidian.md/blog/canvas' },
      ],
    },
    {
      name: 'Whimsical',
      tagline: '一体化可视化工具，流程图 + 线框图 + 思维导图 + 文档。',
      tags: ['流程图', '线框图', '一体化'],
      detail: `## 核心亮点\n\n- **四合一**：Flow / Wireframe / Mind Map / Doc\n- **AI 生成**：输入文本自动生成流程图\n- **精美模板**：开箱即用\n- **轻量协作**：无需复杂设置\n\n## 画布特点\n\n- 自动对齐和吸附\n- 智能连线路由\n- 交互精致，动画流畅`,
      sources: [
        { title: 'Whimsical - Think Together', domain: 'whimsical.com', url: 'https://whimsical.com' },
        { title: 'Whimsical vs Miro Comparison', domain: 'g2.com', url: 'https://g2.com/compare/whimsical-vs-miro' },
      ],
    },
  ]

  return {
    steps,
    products,
    summary: `已收集 ${products.length} 个画布类产品，涵盖设计工具、白板协作、知识管理等方向。`,
    prompt: {
      question: '这份 PPT 给谁看？这会影响内容深度和风格',
      options: ['给领导汇报', '团队内部分享', '客户展示'],
    },
  }
}

// ============ Comment 相关 mock ============

/** 删除时的 Comment 提示 */
export function generateDeleteComment(cardName: string) {
  return {
    message: `你移除了「${cardName}」。需要在 PPT 中说明排除原因吗？`,
    actions: [
      { label: '好主意', type: 'add-exclusion-note' },
      { label: '不需要', type: 'dismiss' },
      { label: '稍后再说', type: 'later' },
    ],
  }
}

/** 产品收集完成后的 Comment 提示 */
export function generateCompletionComment() {
  return {
    message: '产品收集完成！接下来可以选中卡片「深入研究」，或者直接说「组织成大纲」来生成 PPT 结构。',
    actions: [
      { label: '组织大纲', type: 'generate-outline' },
      { label: '知道了', type: 'dismiss' },
    ],
  }
}

// ============ 深入研究 mock ============

/** 各产品的深入研究子话题数据 */
const DEEP_RESEARCH_DATA: Record<string, ProductData[]> = {
  Figma: [
    {
      name: 'Figma Auto Layout',
      tagline: 'Figma 自动布局系统深度解析，响应式设计的核心能力。',
      tags: ['自动布局', '响应式', '组件设计'],
      detail: '## 核心能力\n\n- **弹性布局**：类 CSS Flexbox 模型\n- **嵌套支持**：多层自动布局\n- **间距控制**：精确的 padding 和 gap\n- **对齐方式**：9 种对齐选项\n\n## 设计应用\n\n- 按钮组件自适应文本\n- 列表自动排列\n- 响应式页面布局',
      sources: [
        { title: 'Auto Layout - Figma Help', domain: 'help.figma.com', url: 'https://help.figma.com/hc/en-us/articles/360040451373' },
      ],
    },
    {
      name: 'Figma Dev Mode',
      tagline: 'Figma 开发者模式，设计到代码的交付桥梁。',
      tags: ['开发交付', '代码生成', '标注'],
      detail: '## 核心功能\n\n- **代码片段**：CSS / iOS / Android\n- **属性检查**：间距、颜色、字体\n- **组件文档**：设计系统同步\n- **VS Code 插件**：IDE 集成\n\n## 价值\n\n- 减少设计-开发沟通成本\n- 像素级还原保障',
      sources: [
        { title: 'Dev Mode - Figma', domain: 'figma.com', url: 'https://www.figma.com/dev-mode/' },
      ],
    },
  ],
  Miro: [
    {
      name: 'Miro AI',
      tagline: 'Miro 的 AI 功能矩阵，从内容生成到智能分类。',
      tags: ['AI', '内容生成', '智能分类'],
      detail: '## AI 能力\n\n- **便签聚类**：自动将相似便签分组\n- **内容生成**：基于主题生成便签\n- **思维导图**：文本转思维导图\n- **总结**：会议内容自动总结\n\n## 集成方式\n\n- 右键菜单 AI 选项\n- 侧边栏 AI 助手\n- 批量操作支持',
      sources: [
        { title: 'Miro AI Features', domain: 'miro.com', url: 'https://miro.com/ai/' },
      ],
    },
    {
      name: 'Miro 集成生态',
      tagline: 'Miro 与 100+ 工具的集成能力，工作流中心化。',
      tags: ['集成', '工作流', 'API'],
      detail: '## 主要集成\n\n- **Jira / Asana**：项目管理双向同步\n- **Slack**：通知和快速分享\n- **Google Workspace**：文档嵌入\n- **Confluence**：知识库关联\n\n## 开发者\n\n- REST API\n- SDK (JS/Python)\n- Webhooks',
      sources: [
        { title: 'Miro Marketplace', domain: 'miro.com', url: 'https://miro.com/marketplace/' },
      ],
    },
  ],
  tldraw: [
    {
      name: 'tldraw SDK',
      tagline: 'tldraw 作为可嵌入 SDK 的架构与扩展能力。',
      tags: ['SDK', '可嵌入', 'React'],
      detail: '## 架构\n\n- **React 组件**：`<Tldraw />` 一行代码集成\n- **Store**：不可变状态树\n- **ShapeUtil**：自定义形状系统\n- **Tool**：自定义交互工具\n\n## 扩展方式\n\n- 自定义 Shape 类型\n- 覆盖默认 UI 组件\n- 外部状态同步',
      sources: [
        { title: 'tldraw SDK Docs', domain: 'tldraw.dev', url: 'https://tldraw.dev/docs/editor' },
      ],
    },
    {
      name: 'Make Real (tldraw)',
      tagline: 'tldraw + AI 生成真实 UI 的实验性项目。',
      tags: ['AI', 'UI生成', '实验'],
      detail: '## 工作原理\n\n- 用户在画布上手绘 UI 草图\n- AI 识别并生成 HTML/CSS 代码\n- 生成结果直接嵌入画布预览\n\n## 技术栈\n\n- GPT-4 Vision API\n- tldraw 自定义 Shape\n- iframe 沙盒渲染',
      sources: [
        { title: 'Make Real by tldraw', domain: 'makereal.tldraw.com', url: 'https://makereal.tldraw.com' },
      ],
    },
  ],
}

/** 通用深入研究子话题模板 */
const GENERIC_SUBTOPICS = [
  {
    suffix: '核心功能',
    tagline: (name: string) => `${name} 核心功能深度解析，了解产品的差异化能力。`,
    tags: ['功能分析', '核心能力'],
    detail: (name: string) => `## ${name} 核心功能\n\n- 产品定位与目标用户\n- 核心差异化功能\n- 技术架构特点\n- 与竞品的功能对比`,
  },
  {
    suffix: '用户评价',
    tagline: (name: string) => `${name} 用户口碑与评价汇总，来自多个平台。`,
    tags: ['用户评价', '口碑'],
    detail: (name: string) => `## ${name} 用户评价\n\n- G2 / Capterra 评分\n- 用户好评关键词\n- 常见吐槽点\n- 社区活跃度`,
  },
]

export interface DeepResearchResult {
  steps: AgentStep[]
  subTopics: ProductData[]
  summary: string
}

export function generateDeepResearchMock(productName: string): DeepResearchResult {
  const steps: AgentStep[] = [
    { type: 'thinking', content: `用户想深入了解「${productName}」。让我搜索更详细的信息...` },
    { type: 'tool_call', content: `搜索 ${productName} 详细信息`, toolName: 'web_search', toolResult: '找到 15 个深度分析文章' },
    { type: 'thinking', content: `已找到详细资料，正在整理成子话题卡片...` },
  ]

  // 优先使用预置数据
  let subTopics = DEEP_RESEARCH_DATA[productName]

  // 无预置数据则使用通用模板
  if (!subTopics) {
    subTopics = GENERIC_SUBTOPICS.map(t => ({
      name: `${productName} ${t.suffix}`,
      tagline: t.tagline(productName),
      tags: t.tags,
      detail: t.detail(productName),
      sources: [
        { title: `${productName} Analysis`, domain: 'analysis.com', url: '#' },
      ],
    }))
  }

  return {
    steps,
    subTopics,
    summary: `已为「${productName}」生成 ${subTopics.length} 个深入研究子话题。`,
  }
}

// ============ 大纲生成 mock ============

export interface OutlineMockResult {
  steps: AgentStep[]
  outline: { title: string; items: OutlineItem[] }
  summary: string
}

export function generateOutlineMock(productNames: string[]): OutlineMockResult {
  const steps: AgentStep[] = [
    { type: 'thinking', content: `画布上有 ${productNames.length} 个产品卡片，我来组织一份 PPT 大纲...` },
    { type: 'tool_call', content: '分析产品定位', toolName: 'analyze_products', toolResult: `${productNames.length} 个产品已分类` },
    { type: 'thinking', content: '大纲结构设计完成，包含封面、产品分析、对比和总结。' },
  ]

  const items: OutlineItem[] = [
    { index: 1, title: '画布产品调研报告', type: 'cover' },
  ]

  // 为每个产品生成一页
  productNames.slice(0, 6).forEach((name, idx) => {
    items.push({
      index: idx + 2,
      title: `${name} 产品分析`,
      cardName: name,
      type: 'content',
    })
  })

  // 对比页
  items.push({
    index: items.length + 1,
    title: '产品功能对比',
    type: 'content',
  })

  // 总结页
  items.push({
    index: items.length + 1,
    title: '结论与建议',
    type: 'summary',
  })

  return {
    steps,
    outline: {
      title: '画布产品调研报告',
      items,
    },
    summary: `已生成 ${items.length} 页 PPT 大纲。`,
  }
}

// ============ 页面生成 mock ============

export interface PageMockResult {
  steps: AgentStep[]
  pages: Array<{
    pageNumber: number
    pageTitle: string
    content: PageContent
    pageType: 'cover' | 'content' | 'summary'
  }>
  summary: string
}

/** 各产品的页面内容数据 */
const PRODUCT_PAGE_CONTENT: Record<string, string[]> = {
  Figma: [
    '多人实时协作设计，支持光标跟随和实时编辑',
    '强大的 Auto Layout 自动布局系统',
    'Dev Mode 实现设计到开发的无缝交付',
    '2000+ 插件生态，可扩展性强',
  ],
  Miro: [
    '300+ 预设模板，覆盖各类协作场景',
    '支持 100+ 人大规模团队同时协作',
    'Miro AI 支持内容生成和智能分类',
    '深度集成 Jira、Slack 等主流工具',
  ],
  tldraw: [
    '完全开源（MIT 协议），可自由商用',
    'SDK 优先架构，一行代码嵌入任何 Web 应用',
    '可扩展的自定义 Shape 系统',
    '轻量级（< 200KB），React + TypeScript 原生',
  ],
  Notion: [
    'Block 编辑器标杆，一切皆 Block 的设计理念',
    '数据库视图：表格 / 看板 / 日历 / 画廊',
    'Notion AI 内置写作助手',
    '开放 API 支持丰富的第三方集成',
  ],
  Excalidraw: [
    '零学习成本，打开即用的手绘风格',
    '端对端加密，协作数据安全',
    '可嵌入 Notion、Obsidian 等工具',
    '导出 SVG / PNG，轻量高效',
  ],
  Heptabase: [
    '卡片 + 白板的创新知识组织方式',
    '多层嵌套白板，空间位置即关系',
    'PDF 标注功能，学术阅读友好',
    '中文体验优秀，台湾团队打造',
  ],
  'Canvas（Obsidian）': [
    '本地存储优先，数据完全可控',
    '双向链接 + 知识图谱自动生成',
    'Markdown 原生，文件即笔记',
    '社区驱动的插件扩展系统',
  ],
  Whimsical: [
    '四合一：流程图 / 线框图 / 思维导图 / 文档',
    'AI 驱动：输入文本自动生成流程图',
    '自动对齐和智能连线路由',
    '交互精致，动画流畅',
  ],
}

export function generatePagesMock(outlineItems: OutlineItem[]): PageMockResult {
  const steps: AgentStep[] = [
    { type: 'thinking', content: `正在根据大纲生成 ${outlineItems.length} 张幻灯片...` },
    { type: 'tool_call', content: '生成幻灯片内容', toolName: 'generate_slides', toolResult: `${outlineItems.length} 张幻灯片已就绪` },
    { type: 'thinking', content: '所有幻灯片内容已生成，正在创建页面卡片...' },
  ]

  const pages = outlineItems.map(item => {
    if (item.type === 'cover') {
      return {
        pageNumber: item.index,
        pageTitle: item.title,
        content: {
          subtitle: '——基于市场主流产品的深度分析',
          bullets: [],
        } as PageContent,
        pageType: 'cover' as const,
      }
    }

    if (item.type === 'summary') {
      return {
        pageNumber: item.index,
        pageTitle: item.title,
        content: {
          bullets: [
            '设计协作领域 Figma 占据主导地位，生态最完善',
            '开源方案（tldraw / Excalidraw）适合定制化场景',
            '知识管理类（Notion / Heptabase）侧重内容组织',
            '建议根据团队规模和场景选择合适的产品',
          ],
          note: '以上分析基于公开资料整理，仅供参考',
        } as PageContent,
        pageType: 'summary' as const,
      }
    }

    // 内容页
    const cardName = item.cardName || ''
    const bullets = PRODUCT_PAGE_CONTENT[cardName] || [
      `${item.title}的核心特点和优势`,
      '目标用户群体和使用场景',
      '与同类产品的差异化分析',
      '未来发展趋势和潜力评估',
    ]

    return {
      pageNumber: item.index,
      pageTitle: item.title,
      content: {
        bullets,
        sourceCardName: cardName || undefined,
      } as PageContent,
      pageType: 'content' as const,
    }
  })

  return {
    steps,
    pages,
    summary: `已生成 ${pages.length} 张幻灯片。`,
  }
}
