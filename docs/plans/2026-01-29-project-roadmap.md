# Canvas Agent 项目发展路线

## 从哪来、到哪去

### 我们走过的路

1. **画布 + Mock Agent**（已完成）：PPT 流程验证了画布交互的核心价值——8 张产品卡片同时可见、可删除、可框选深入研究。这是 CLI 做不到的。
2. **画布 + 真实 CLI**（已完成技术链路）：中继服务 → spawn claude → SSE → agent-card。跑通了，但暴露了核心问题——CLI 吐出文字墙，跟终端没差别。
3. **翻译问题的思考**（已完成认知）：得出关键结论——不应该翻译 CLI 文本，而是给 Claude 画布工具，让它直接在画布上"做事"。

### 核心认知回顾

**工具就是翻译层。**

```
没有工具：Claude → 文本 → [需要翻译] → 画布对象
有工具：  Claude → 调用 create_card() → 画布对象
```

**画布的价值 = 空间关系。** 不是"更好看的聊天界面"，是高亮、位置关系、同时可见、可操作。

**不是所有任务都适合画布。** 画布适合：多内容、可操作、空间有意义。线性长文不适合。

**对象数量由用户决定，不由内容长度决定。** 避免 Flowith 的教训——节点铺满 = 认知超载。

---

## 四个原子工具

画布暴露给 Claude 的最小工具集。像乐高积木一样，四块基础砖可以搭出任何东西。

### 1. `create_card(name, tagline, tags, detail)`

创建一张卡片。这是最基础的画布对象。

- 产品卡片：`create_card("Lovart", "AI设计Agent", ["设计","对话标注"], "详细调研...")`
- 概念卡片：`create_card("方案A", "用Redis做缓存", ["高性能","运维复杂"], "...")`
- 人物卡片：`create_card("张三", "产品负责人", ["决策者"], "...")`
- 任何"一个东西+它的信息"都是卡片

**对应现有 shape**：`product-card`。名字不够通用，后续可重命名为 `canvas-card`。

### 2. `create_image(url_or_prompt, caption?)`

在画布上放一张图。可以是 URL 直接展示，也可以是 prompt 触发生成。

- 截图：`create_image("https://...", "Lovart 的界面")`
- 生成：`create_image("prompt:一个极简的画布交互示意图")`
- 图表：后续可扩展为 `create_chart(data, type)`

**对应现有 shape**：`ai-image`。

### 3. `create_connection(fromId, toId, label?)`

在两个画布对象之间建立可见关系。

- "这个结论 → 基于这份数据"
- "方案A → 对比 → 方案B"
- "这个任务 → 产出 → 这些卡片"

**对应现有 shape**：tldraw 自带的 arrow。

### 4. `create_group(shapeIds, label?)`

把多个画布对象框在一起，表示它们属于同一类/同一任务。

- "这三个是竞品分析的结果"
- "这一组是第一轮迭代"

**对应现有 shape**：tldraw 的 frame 或 group。

### 加上两个读取工具

- `read_canvas()` — Claude 看到画布上有什么，作为上下文
- `read_selection()` — 用户框选了几个对象后，Claude 只看这些

### 加上一个交互工具

- `ask_user(question, options?)` — Agent 问用户一个问题（对应现有的 comment shape）

### 这七个工具能做什么

| 任务 | 工具组合 |
|------|---------|
| 竞品分析 | `read_canvas()` → 8× `create_card()` |
| 方案对比 | 2× `create_card()` + `create_connection()` |
| 架构图 | N× `create_card()` + N× `create_connection()` + `create_group()` |
| 调研报告 | N× `create_card()` + `create_group("调研结果")` |
| PPT 大纲 | 即现有 outline-card，可用 `create_card` 的特化版本 |
| 深入研究 | `read_selection()` → `create_card()` 放在选中对象附近 |
| 头脑风暴 | N× `create_card()` 散列排布 |

---

## 不走 API，用 CLI + System Prompt

### 为什么不用 MCP

MCP 是正路，但现阶段有实际阻碍：
- 需要 Claude CLI 配置 MCP server（用户端配置成本）
- MCP server 是一个长驻进程（开发复杂度）
- 我们还在探索工具的定义，频繁改 MCP schema 太重

### System Prompt + JSON 方案

更轻量的路径：在 `claude -p` 的 prompt 前面注入 system prompt，告诉 Claude 可以用什么工具、输出什么格式。

```
你是画布上的 Agent。你可以使用以下工具来在画布上创建对象：

## 可用工具

### create_card
创建一张卡片。参数：
- name: 卡片标题
- tagline: 一句话描述
- tags: 标签数组
- detail: 详细内容（markdown）

### create_connection
连接两个画布对象。参数：
- from: 来源卡片的 name
- to: 目标卡片的 name
- label: 关系说明

### ask_user
问用户一个问题。参数：
- question: 问题
- options: 可选项数组（可选）

## 输出格式

用 JSON 数组输出你要执行的操作：
```json
[
  { "tool": "create_card", "params": { "name": "...", ... } },
  { "tool": "create_card", "params": { "name": "...", ... } },
  { "tool": "create_connection", "params": { "from": "...", "to": "...", ... } }
]
```

如果任务不适合在画布上展示（比如简单问答、写长文），直接用普通文本回复，不要强行创建卡片。
```

### 前端解析

`useAgentOrchestrator.ts` 的 `handleRealAgent` 接收到 CLI 输出后：

1. 尝试 JSON.parse
2. 如果是工具调用数组 → 逐个执行，在画布上创建对应 shape
3. 如果是普通文本 → 放进一个轻量 agent-card（现有行为）

这样 Claude 自己判断：
- "竞品分析" → 输出 8 个 `create_card`
- "React 和 Vue 哪个好" → 输出普通文本

**翻译问题消失了**，因为 Claude 直接在"说画布的语言"。

---

## 发展阶段

### Phase 0：当前状态（已完成）

- ✅ tldraw 画布基础
- ✅ 7 种自定义 shape（product-card, agent-card, comment, outline-card, page-card, file-card, ai-image）
- ✅ Mock PPT 流程（收集 → 大纲 → 页面 → 导出）
- ✅ 真实 CLI 链路（中继服务 → SSE → agent-card）
- ✅ Mock/CLI 模式切换

### Phase 1：Claude 说画布的语言

**目标**：Claude 能通过 system prompt 直接创建画布对象，不再是文字墙。

**做什么**：
1. 定义 system prompt，描述可用工具和输出格式
2. 修改 `server/index.mjs`，在 spawn claude 时注入 system prompt
3. 修改 `handleRealAgent`，解析 JSON 工具调用，分发到画布
4. 复用 `product-card` 作为通用卡片（可能重命名 props）

**验证**：
- 用户说"帮我分析画布产品的竞品" → 画布上出现多张独立卡片，而不是一段文字
- 用户说"React 和 Vue 哪个好" → 画布上出现一张轻量回复卡片（普通文本），而不是强行拆卡片

**不做什么**：
- 不做 MCP（太重）
- 不做 connection 和 group（先验证卡片就够了）
- 不做 read_canvas（先单向——Claude 产出到画布，还不需要读画布）

### Phase 2：Claude 能看画布

**目标**：Claude 了解画布上有什么，能基于上下文工作。

**做什么**：
1. 实现 `read_canvas()` — 遍历画布上的 shapes，序列化为文本描述
2. 实现 `read_selection()` — 只读用户框选的 shapes
3. 在 system prompt 注入画布上下文
4. 支持"框选 + 一句话"交互：用户框选 3 张卡片 → 说"比较这三个" → Claude 基于这 3 张卡片内容创建对比卡片

**验证**：
- 画布上有 8 张卡片 → 用户说"帮我归类" → Claude 读取画布 → 创建 group 或 connection
- 用户框选 3 张 → "提炼共性" → 新卡片出现在附近，内容基于被选卡片

**这是真正实现"One Thing, Two Views"的阶段**——Claude 和用户看到同一个画布，基于同一个空间协作。

### Phase 3：空间关系

**目标**：产出物的位置有意义，不是随机堆放。

**做什么**：
1. 实现 `create_connection()` — 箭头连线
2. 实现 `create_group()` — 框选分组
3. 布局策略：
   - 深入研究的内容放在来源卡片附近
   - 对比结果放在被比较对象之间
   - 分组结果用 frame 圈起来
4. Claude 的 system prompt 加入空间意识："当你深入研究某个卡片时，把结果放在它附近"

**验证**：
- 用户指着 Lovart 卡片说"深入研究" → 新内容出现在 Lovart 旁边
- "帮我把这些按交互模式分类" → 卡片被 frame 分成几组，每组有标签

### Phase 4：双向协作

**目标**：用户的画布操作本身就是和 Agent 沟通。

**做什么**：
1. 画布操作即意图：
   - 用户删除一张卡片 → Agent 知道"这个不要"
   - 用户把两张卡片拖到一起 → Agent 理解"这两个有关系"
   - 用户在空白处双击 → 新建输入点
2. `ask_user` → comment shape 的结构化版本：Agent 在卡片上留问题，用户点选回答
3. 过程可视化：Agent 调用 `create_card` 时，画布上有创建动画

**这是设计文档里描述的最终形态**——"画布操作即交互"，文本输入降级为辅助。

### Phase 5（远期）：MCP 正式化

当工具定义稳定后，把 system prompt 方案迁移到 MCP：
- 画布暴露为 MCP server
- Claude CLI 通过 MCP 协议调用画布工具
- 好处：类型安全、标准协议、可被其他 Agent 复用

---

## Mock 和 Real 的关系

### Mock 不是废弃品

Mock 流程（PPT 场景）验证了核心交互设计：
- 信息层级（表面/暗示/深层）
- 多卡片布局
- 框选 + 操作
- 强提示浮层

这些设计决策在 Real 模式下完全复用。Mock 是设计的验证场，Real 是能力的扩展。

### 两条线并行

```
Mock 线：固定场景，精心设计的交互流程（PPT 制作）
         → 产品演示、设计验证、交互打磨

Real 线：开放场景，Claude 自主决定产出什么
         → 真实能力、灵活应用、用户自由度
```

最终两条线合并：Real 模式下 Claude 使用的工具 = Mock 模式下我们手动编排的工具，只是谁来编排不同。

---

## 什么任务适合这个画布

### 适合的（多内容、可操作、空间有意义）

| 任务 | 画布产出 | 为什么适合 |
|------|---------|----------|
| 竞品分析 | N 张产品卡片 | 多个对象同时可见，可删选 |
| 方案对比 | 2-3 张方案卡片 + 连线 | 并排比较，空间关系有意义 |
| 架构梳理 | 模块卡片 + 依赖连线 | 拓扑关系天然是空间的 |
| 头脑风暴 | N 张想法卡片，散列排布 | 发散思维 = 空间发散 |
| PPT 制作 | 调研 → 大纲 → 页面 | 多阶段、多产出、可编辑 |
| 素材收集 | 图片/链接/摘要卡片 | 收集 + 整理 = 画布核心能力 |

### 不适合的（线性、一次性、不需要空间）

| 任务 | 为什么不适合 | 应该怎么处理 |
|------|-----------|------------|
| 简单问答 | 看一眼就够了 | 轻量气泡，不留画布对象 |
| 写长文/文档 | 线性阅读，不需要空间 | 普通文本卡片或直接在 CLI |
| 改代码/跑命令 | 操作在文件系统，不在画布 | 状态栏显示过程，不上画布 |
| 翻译/润色 | 输入→输出，一对一 | 轻量卡片或气泡 |

### 引导而不限制

不应该硬性限制用户"这个不能在画布上做"。而是：
- Claude 自己判断——适合画布的用工具创建对象，不适合的用普通文本回复
- 系统引导——输入栏的 placeholder 暗示适合画布的任务类型
- 渐进发现——用户自然会发现什么任务在画布上更好用

---

## 技术实现要点

### system prompt 注入

`server/index.mjs` 修改 spawn 参数：

```javascript
const systemPrompt = fs.readFileSync('./server/canvas-system-prompt.md', 'utf-8')
const fullMessage = `${systemPrompt}\n\n---\n\n用户的请求：${userMessage}`
spawn('claude', ['-p', fullMessage, '--output-format', 'stream-json', '--verbose'])
```

### JSON 解析策略

Claude 的输出可能是：
1. 纯 JSON 数组（工具调用）
2. 纯文本（普通回复）
3. 混合（文本 + JSON 代码块）

解析优先级：
1. 尝试整体 JSON.parse → 工具调用
2. 尝试提取 ```json ``` 代码块 → 工具调用
3. 都不是 → 当作普通文本

### 卡片创建

复用现有 `ProductCardShapeUtil`，调用方式和 mock 流程中 `handleAgentMessage` 创建卡片的方式一致：

```typescript
editor.createShape({
  type: 'product-card',
  x, y,
  props: {
    name: params.name,
    tagline: params.tagline,
    tags: JSON.stringify(params.tags),
    detail: params.detail,
    // ...
  }
})
```

布局：多张卡片用网格排列，和现有 mock 流程相同。

---

## 下一步行动

**立即可做的**（Phase 1 的第一步）：

1. 创建 `server/canvas-system-prompt.md` — 定义工具和输出格式
2. 修改 `server/index.mjs` — 注入 system prompt
3. 修改 `useAgentOrchestrator.ts` 的 `handleRealAgent` — 解析 JSON，分发到画布
4. 测试："帮我分析画布产品的竞品" → 预期看到多张卡片而不是文字墙

这一步的工作量不大（改 3 个文件），但验证的是核心假设：**给 Claude 工具描述后，它能正确产出结构化的画布对象。**

如果假设成立，后续每个 Phase 都是在这个基础上加工具、加能力。如果假设不成立（Claude 不按格式输出、工具描述太复杂、输出质量不稳定），我们就需要回到 prompt engineering 或者提前上 MCP。
