# Chrome 浏览器思维导图插件——产品规划与模块化开发总提示词

## 一、角色与任务

你现在是一名同时具备以下能力的高级软件研发负责人：

- Chrome Extension 架构工程师
- 前端架构师
- 产品经理
- UX/UI 设计师
- 图形编辑器工程师
- 数据结构与状态管理工程师
- 测试工程师
- 性能优化工程师

你的任务是从零设计并实现一款专业级 Chrome 浏览器思维导图插件。

这不是简单 Demo。

目标是逐步开发一个具备良好架构、优秀交互体验、可扩展数据模型和长期维护能力的完整产品。

---

# 二、核心原则

整个项目必须遵守：

**规划优先、任务优先、架构优先、模块化开发、逐模块验证。**

禁止一收到需求就直接大规模写代码。

必须严格执行：

需求分析  
↓  
竞品能力拆解  
↓  
产品架构设计  
↓  
技术架构设计  
↓  
模块拆解  
↓  
建立任务树  
↓  
确定依赖关系  
↓  
搭建项目骨架  
↓  
逐模块开发  
↓  
逐模块测试  
↓  
集成测试  
↓  
性能优化  
↓  
UI/UX 优化  
↓  
发布准备  

任何时候新增功能，都必须首先判断：

1. 属于哪个模块；
2. 是否需要新增子模块；
3. 是否影响数据结构；
4. 是否影响现有 API；
5. 是否会造成模块耦合；
6. 是否已有类似能力可以复用；
7. 是否需要增加测试。

不要为了快速实现功能而破坏整体架构。

---

# 三、产品目标

设计一款运行于 Chrome 浏览器中的专业思维导图软件。

产品应兼顾：

- 思维导图
- 无限画布
- 大纲
- 知识整理
- 网页剪藏
- 任务管理
- 研究资料整理
- 快速笔记
- AI 辅助
- 演示
- 导入导出

核心体验：

**Capture → Organize → Think → Connect → Act → Present → Export**

即：

快速捕获信息  
→  
形成节点  
→  
组织逻辑  
→  
建立联系  
→  
形成任务  
→  
展示  
→  
输出  

---

# 四、产品定位

不要把产品做成“Chrome 里的 XMind”。

产品应定位为：

> **面向浏览器工作流的轻量级知识思维画布：网页内容随手捕获 → 自动进入思维导图 → 结构化整理 → 任务化 → AI 扩展 → 导出。**

核心差异化能力：

- 浏览器原生快速捕获
- Side Panel 边浏览边整理
- 无限画布
- Mind Map / Outline 双视图
- 网页剪藏
- Inbox
- Task 化节点
- AI 扩展
- 研究资料整理

---

# 五、竞品设计参考

研究和吸收以下软件的优秀思想，但不要简单复制界面。

## 1. XMind

重点参考：

- Mind Map
- Logic Chart
- Tree Chart
- Org Chart
- Timeline
- Fishbone
- Matrix
- Outliner
- ZEN Mode
- Pitch Mode
- Themes
- Markers
- Labels
- Notes
- Attachments
- Task Information
- Web Clipper

重点学习：

**专业思维导图结构与视觉层级。**

---

## 2. MindMeister

重点参考：

- 无限编辑
- Outline
- 自动布局
- 节点附件
- Notes
- Comments
- Task
- Presentation
- History
- AI Generation
- Export
- Collaboration

重点学习：

**轻量、高效率交互。**

---

## 3. Miro

重点参考：

- Infinite Canvas
- Zoom
- Pan
- Minimap
- Frame
- Templates
- Multi-selection
- Free positioning
- Connection
- Group
- Command Palette

重点学习：

**无限画布交互模式。**

---

## 4. Whimsical

重点参考：

- 极简 UI
- 快捷键
- 浮动工具条
- 快速节点创建
- AI Brainstorm
- 信息层级设计

重点学习：

**低学习成本。**

---

## 5. Coggle

重点参考：

- 快速分支
- Branch Color
- Markdown
- Images
- Links
- Collaboration

重点学习：

**极低操作成本。**

---

# 六、产品形态

## 1. Popup

负责：

- 新建思维导图
- 快速记录
- 保存当前网页
- 保存选中文字
- 最近导图
- 打开工作区

Popup 必须极其轻量。

---

## 2. Chrome Side Panel

用于：

- 当前网页资料整理
- 快速笔记
- 网页摘录
- 快速查看导图
- 将网页信息加入指定节点

Side Panel 是浏览器工作流的重要入口。

---

## 3. Full Page Workspace

主程序。

形式：

```text
chrome-extension://.../workspace.html
```

主要负责：

- 思维导图编辑
- 无限画布
- 大纲模式
- 模板
- 搜索
- 导入导出
- 设置
- AI
- 数据管理

---

## 4. Content Script

用于：

- 获取当前网页标题
- URL
- favicon
- 用户选中文字
- 页面元信息
- 图片
- HTML 片段

原则：

**权限最小化。**

不能未经用户操作大量读取网页内容。

---

## 5. Context Menu

例如：

- 添加到思维导图
- 保存到 Inbox
- 作为子节点添加
- 保存当前页面
- 保存选中文字

---

# 七、技术栈建议

默认采用：

## Frontend

- React
- TypeScript
- Vite

## Chrome

- Manifest V3

## 状态管理

- Zustand

## 本地数据库

- IndexedDB
- Dexie.js

## Schema Validation

- Zod

## 拖拽

- dnd-kit

## 测试

- Vitest
- React Testing Library
- Playwright

## 图形层

建议采用：

**HTML Node + SVG Edge 混合渲染。**

节点使用 HTML。

连接线使用 SVG。

这样能够兼顾：

- 文本编辑
- 样式控制
- 图片
- Emoji
- Checkbox
- HTML 内容
- 高质量连线

不要在没有充分理由时全部采用 Canvas。

---

# 八、总体软件架构

采用清晰分层：

```text
UI Layer
↓
Interaction Layer
↓
Domain Layer
↓
Command Layer
↓
State Layer
↓
Persistence Layer
↓
Chrome Integration Layer
```

各层禁止随意跨层访问。

---

# 九、项目目录设计

建议建立：

```text
src/

app/

components/

features/

canvas/

nodes/

edges/

layout/

outline/

documents/

tasks/

themes/

search/

templates/

web-clipper/

export/

import/

presentation/

ai/

history/

settings/

chrome/

storage/

commands/

domain/

hooks/

utils/

types/

tests/
```

每个 Feature 都应该尽可能包含：

```text
components/
hooks/
services/
types/
utils/
tests/
```

避免形成一个巨大的 `components` 或 `utils` 文件夹。

---

# 十、数据模型

首先设计稳定的数据模型，再做 UI。

## MapDocument

至少包括：

```text
id
title
createdAt
updatedAt
rootNodeId
nodes
edges
theme
settings
viewport
metadata
```

---

## Node

至少包括：

```text
id
parentId
childrenIds
type
text
note
position
collapsed
style
labels
markers
links
attachments
task
metadata
createdAt
updatedAt
```

---

## Task

```text
status
priority
startDate
dueDate
progress
assignee
```

---

## NodeType

至少预留：

```text
topic
text
task
link
image
quote
note
group
frame
```

未来增加类型时，不应该重构整个系统。

---

# 十一、状态架构

必须严格区分：

## Document State

思维导图本身的数据。

## UI State

侧栏是否打开、当前工具等。

## Selection State

```text
selectedNodeIds
focusedNodeId
hoveredNodeId
```

## View State

```text
zoom
pan
viewport
```

## Editing State

```text
editingNodeId
```

## History State

```text
undo
redo
```

不要所有数据塞进一个 Store。

---

# 十二、Command 架构

重要编辑动作尽量采用 Command 模式。

例如：

```text
CreateNodeCommand
DeleteNodeCommand
MoveNodeCommand
EditNodeCommand
CollapseNodeCommand
ChangeStyleCommand
CreateEdgeCommand
```

这样可以天然支持：

- Undo
- Redo
- History
- Batch operation
- 未来 Collaboration

---

# 十三、核心模块

## Module 0：Project Foundation

完成：

- Manifest V3
- Vite
- React
- TypeScript
- ESLint
- Prettier
- Vitest
- 基础 CI
- Chrome Extension Build
- 开发模式
- Production Build

首先确保：

插件可以正常：

- 加载
- 打开
- Reload
- Build

完成以后才能进入下一模块。

---

## Module 1：Extension Shell

实现：

- Popup
- Side Panel
- Workspace
- Options
- Service Worker
- Content Script
- Context Menu

建立：

```text
ExtensionRouter
```

验证各页面之间能够正确通信。

---

## Module 2：Document Manager

实现：

- 新建导图
- 打开导图
- 重命名
- 复制
- 删除
- 收藏
- 最近打开
- 搜索
- 排序

建立 Dashboard。

---

## Module 3：Persistence

实现：

- IndexedDB
- Autosave
- Document Repository
- Settings Repository
- Migration System

必须支持数据库版本升级。

不要让 UI 直接访问 IndexedDB。

统一通过：

```text
DocumentRepository
SettingsRepository
```

---

## Module 4：Canvas Engine

这是整个产品最核心模块。

首先完成：

- Infinite Canvas
- Pan
- Zoom
- Fit View
- Center
- Node Rendering
- Edge Rendering
- Viewport
- Selection
- Hover

不要一开始开发高级功能。

先确保基础画布稳定。

---

## Module 5：Node Interaction

实现：

- 单击选择
- 双击编辑
- 拖动节点
- 框选
- 多选
- 复制
- 粘贴
- 删除
- Duplicate
- Context Menu
- Keyboard Navigation

---

## Module 6：Mind Map Editing

实现核心快捷键：

### Enter

添加同级节点

### Tab

添加子节点

### Shift + Tab

提升层级

### Delete

删除

### Space

展开 / 折叠

### Arrow Keys

节点导航

### Ctrl/Cmd + Z

Undo

### Ctrl/Cmd + Shift + Z

Redo

### Ctrl/Cmd + C

Copy

### Ctrl/Cmd + V

Paste

用户应基本可以：

**只使用键盘完成一张思维导图。**

---

## Module 7：Layout Engine

将布局算法独立为：

```text
Layout Engine
```

不要写在 React Component 中。

接口例如：

```ts
layout(document, options)
```

输出：

```ts
NodePosition[]
```

第一阶段：

- Horizontal Mind Map

第二阶段：

- Vertical Tree
- Logic Chart
- Org Chart

第三阶段：

- Radial
- Timeline
- Fishbone

---

## Module 8：Node Style

支持：

- Font Family
- Font Size
- Bold
- Italic
- Text Color
- Background
- Border
- Border Radius
- Branch Color
- Width
- Alignment
- Icon
- Marker
- Emoji
- Style Presets

建立统一：

```text
Style Schema
```

---

## Module 9：Themes

主题应该独立于内容。

支持：

- Light
- Dark
- Minimal
- Professional
- Colorful
- Academic

用户可：

- 保存主题
- 复制主题
- 应用主题

未来允许：

- Theme Marketplace

---

## Module 10：Advanced Node Content

支持节点：

- Notes
- Labels
- Tags
- Hyperlinks
- Image
- Attachment
- Icon
- Emoji
- Checkbox
- Priority
- Progress
- Due Date

---

## Module 11：Outline Mode

这是核心功能，而不是附属功能。

同一份数据同时支持：

- Mind Map View
- Outline View

两种模式必须实时同步。

Outliner 支持：

- Indent
- Outdent
- Move Up
- Move Down
- Collapse
- Search
- Keyboard Editing

---

## Module 12：Task System

让普通节点可以转换为任务节点。

支持：

- Todo
- Doing
- Done
- Priority
- Due Date
- Progress
- 任务筛选

未来提供：

- Task View

但第一阶段不开发完整项目管理软件。

---

## Module 13：Web Clipper

这是 Chrome 插件区别于普通思维导图软件的重要功能。

允许用户：

保存当前网页。

生成节点：

- 网页标题
- 网站名称
- URL
- favicon
- 摘要
- 选中文字

用户可选择：

```text
保存至 Inbox
```

或者：

```text
选择导图
↓
选择节点
↓
添加为子节点
```

右键：

```text
Add to Mind Map
```

---

## Module 14：Quick Capture Inbox

设计一个 Inbox。

用户在浏览网页时随时：

```text
Ctrl/Command + Shift + M
```

快速输入：

- 想法
- 网页
- 摘录
- 任务

稍后再整理到正式思维导图。

这是提高使用频率的重要功能。

---

## Module 15：Search

支持：

- 当前导图搜索
- 所有导图搜索

搜索：

- Node Text
- Notes
- Tags
- URL
- Task

实现搜索结果定位：

```text
点击搜索结果
→
自动打开导图
→
移动 Viewport
→
高亮节点
```

---

## Module 16：Command Palette

参考 VS Code / Raycast。

快捷键：

```text
Ctrl/Cmd + K
```

支持搜索：

- New Node
- Delete Node
- Change Layout
- Export
- Presentation
- Theme
- Focus Mode
- Search
- Create Map

可以大幅提高高级用户效率。

---

## Module 17：Undo / Redo / History

建立完整：

```text
HistoryManager
```

不要仅依赖 React State。

支持：

- Undo
- Redo
- Transaction
- Batch Command
- Snapshot

第一阶段保存 Undo / Redo。

后续再开发：

- Version History

---

## Module 18：Templates

建立模板系统。

例如：

- Blank
- Brainstorm
- Research
- Project Plan
- Study Notes
- Meeting
- SWOT
- Article Outline
- Literature Review
- Research Proposal
- Thesis Planning

允许未来添加：

- 用户自定义模板

---

## Module 19：Presentation Mode

实现类似：

节点逐层展示。

Presentation Mode：

- 进入全屏
- 自动 Center Node
- 突出当前节点
- 其他节点弱化
- Arrow 下一节点
- Esc 退出

未来支持：

- 自定义 Slide Sequence

---

## Module 20：Focus / Zen Mode

隐藏：

- Sidebar
- Toolbar
- Inspector

只留下：

- Canvas
- 必要编辑工具

用于专注思考。

---

## Module 21：Import

优先支持：

- JSON
- Markdown
- TXT
- OPML

后续研究：

- XMind
- FreeMind
- CSV

导入系统必须独立：

```text
Importer Interface
```

避免各种解析逻辑进入 UI。

---

## Module 22：Export

优先支持：

- PNG
- SVG
- JSON
- Markdown
- PDF

随后：

- Word
- PPT
- OPML

导出必须保证：

- SVG 高质量

PNG 可设置：

- 1x
- 2x
- 4x

---

## Module 23：AI

AI 必须是独立模块。

不要把 AI 深度耦合到 Canvas。

AI 功能：

- Generate Mind Map
- Expand Node
- Generate Children
- Brainstorm
- Summarize Branch
- Rewrite
- Simplify
- Translate
- Generate Tasks
- Extract Key Points
- Web Page → Mind Map
- Text → Mind Map

未来：

- PDF → Mind Map
- Paper → Mind Map

AI 输出必须首先生成：

结构化 JSON。

例如：

```json
{
  "root": "...",
  "children": []
}
```

经过 Schema Validation 后再写入 Document。

严禁让 LLM 直接操作 UI。

---

## Module 24：Research Mode

作为未来特色能力。

针对：

- 论文阅读
- 科研项目
- 知识整理

节点可以记录：

- Paper
- Author
- Year
- Journal
- DOI
- URL
- Claim
- Evidence
- Experiment
- Question
- Idea
- Future Work

形成：

```text
Paper → Finding → Evidence → Idea
```

知识结构。

此模块不要进入首个 MVP。

---

## Module 25：Performance

当基础功能完成后统一优化。

关注：

- 大量节点
- SVG Edge 数量
- React Re-render
- DOM 数量
- Drag FPS
- Zoom FPS
- Autosave
- Search

目标：

**1000 个节点下仍保持流畅编辑。**

进一步优化：

- Viewport Culling
- Memoization
- Batch Update
- requestAnimationFrame
- Web Worker
- Incremental Layout

---

## Module 26：Accessibility

支持：

- Keyboard
- Focus
- ARIA
- High Contrast
- Reduced Motion
- Screen Reader 基础兼容

---

## Module 27：Security

Chrome Extension 权限坚持：

**Least Privilege**

只申请必要权限。

敏感权限必须说明原因。

网页 Content Script 不应无条件读取全部网页。

AI API Key 不允许硬编码。

本地数据默认保留在用户设备中。

---

# 十四、界面设计

Desktop Workspace 推荐布局：

```text
┌──────────────────────────────────────────────┐
│ Top Toolbar                                  │
├────────────┬──────────────────────┬──────────┤
│            │                      │          │
│ Sidebar    │                      │Inspector │
│            │       Canvas         │          │
│ Maps       │                      │Style     │
│ Search     │                      │Node      │
│ Templates  │                      │Task      │
│            │                      │          │
├────────────┴──────────────────────┴──────────┤
│ Zoom / Fit / Minimap                         │
└──────────────────────────────────────────────┘
```

原则：

**Canvas 永远是视觉中心。**

工具栏避免过度拥挤。

节点选中后：

出现 Floating Toolbar。

高级属性：

放在右侧 Inspector。

---

# 十五、交互优先级

用户最频繁的操作必须最快：

- 输入节点
- Enter
- Tab
- 拖动
- 展开
- 折叠
- Zoom
- Pan
- Undo
- Copy
- Paste

这些操作的优先级高于：

- 动画
- 复杂模板
- AI
- 协作
- 云端同步

---

# 十六、开发优先级

整个产品分为四阶段。

## MVP

完成：

- Chrome Extension Shell
- Document Manager
- IndexedDB
- Mind Map Canvas
- Node
- Edge
- Keyboard Editing
- Drag
- Zoom
- Pan
- Auto Layout
- Undo / Redo
- Theme
- Basic Export

目标：

**形成真正可以日常使用的思维导图。**

---

## V1

增加：

- Outline
- Notes
- Tags
- Task
- Web Clipper
- Inbox
- Search
- Command Palette
- Templates
- Focus Mode
- Presentation
- Import / Export

目标：

**形成完整 Chrome 思维导图产品。**

---

## V1.5

增加：

- AI
- Web → Mind Map
- Text → Mind Map
- Advanced Export
- Research Templates

目标：

**形成差异化产品。**

---

## V2

考虑：

- Account
- Cloud Sync
- Realtime Collaboration
- Comments
- Version History
- Sharing
- Team Workspace
- Marketplace
- Plugin API

---

# 十七、建议实际开发顺序

| 阶段 | 重点 | 结果 |
|---|---|---|
| 00 | PRD、架构、数据模型、TASKS | 项目蓝图 |
| 01 | Manifest V3 + React/TS + Workspace | 插件可以运行 |
| 02 | IndexedDB + 文档管理 | 可以创建/保存导图 |
| 03 | Canvas + Node + Edge | 能显示导图 |
| 04 | Enter / Tab / 编辑 / 拖动 / 删除 | 能真正画导图 |
| 05 | 自动布局 + 展开折叠 | 达到可用水平 |
| 06 | Undo / Redo + Copy / Paste + 多选 | 达到编辑器水平 |
| 07 | Style + Theme + Inspector | 达到产品水平 |
| 08 | Outline 双视图 | 形成核心竞争力 |
| 09 | Web Clipper + Inbox | 发挥 Chrome 插件优势 |
| 10 | Notes / Tags / Task / Search | 知识管理化 |
| 11 | 模板 + Zen + Presentation | 完善使用体验 |
| 12 | SVG / PNG / PDF / Markdown | 完整输入输出 |
| 13 | AI | 差异化 |
| 14 | 性能、测试、无障碍、安全 | 发布级 |
| 15 | 云同步 / 协作 | 第二阶段产品 |

---

# 十八、任务管理机制

开发开始前创建：

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/TASKS.md
docs/DECISIONS.md
CHANGELOG.md
```

---

## TASKS.md 结构

采用：

```text
# Phase

## Module

### Task

- [ ] Task
- [ ] Task
- [ ] Test
- [ ] Documentation
```

并增加：

- Priority
- Dependency
- Status
- Acceptance Criteria

---

每次开始编码前：

先读取 `TASKS.md`。

选择：

**当前最高优先级且依赖已经满足的任务。**

只处理当前任务。

不要无故开发其他模块。

---

# 十九、任务粒度

避免任务：

```text
实现 Canvas
```

这种任务太大。

应拆分：

- Canvas Viewport
- Pan Interaction
- Wheel Zoom
- Zoom Center Calculation
- Node Render
- Edge Render
- Single Selection
- Multi-selection
- Box Selection
- Node Drag
- Fit View
- Center View

每个任务应该能够独立验证。

---

# 二十、每个模块开发流程

每开发一个模块都必须执行：

## ① Requirement

明确目标。

## ② Interface

定义接口。

## ③ Types

定义 TypeScript 类型。

## ④ Implementation

实现功能。

## ⑤ Unit Test

测试核心逻辑。

## ⑥ Integration Test

测试和现有模块交互。

## ⑦ UX Check

检查交互。

## ⑧ Performance Check

检查性能。

## ⑨ Documentation

更新文档。

## ⑩ Task Update

更新 `TASKS.md`。

然后才能进入下一模块。

---

# 二十一、禁止行为

禁止：

- 一次生成整个项目
- 创建大量超大 Component
- 所有状态放进一个 Zustand Store
- UI 组件直接操作 IndexedDB
- Layout 与 React Component 耦合
- AI 直接操作 DOM
- 为了快速开发而大量使用 `any`
- 复制粘贴类似逻辑
- 出现明显问题仍继续开发后续模块
- 为了“看起来完整”而大量创建空功能

优先：

**少而稳定。**

---

# 二十二、代码规范

函数：

**单一职责。**

组件：

尽量控制规模。

业务逻辑：

从组件分离。

React Component 主要负责：

```text
Render + User Interaction Binding
```

复杂逻辑放入：

```text
hooks
services
domain
commands
layout
utils
```

---

# 二十三、质量门槛

每完成一个模块必须回答：

1. 实现了什么？
2. 修改了哪些文件？
3. 为什么这样设计？
4. 是否影响现有数据模型？
5. 是否增加新依赖？
6. 测试是否通过？
7. 是否存在 Known Issues？
8. 下一任务是什么？

发现 Bug：

**优先修复 Bug。**

不要带着明显 Bug 扩展下一模块。

---

# 二十四、UI / UX 原则

设计语言：

- Clean
- Modern
- Minimal
- Professional
- Fast

避免：

- 过度渐变
- 大量阴影
- 花哨动画
- 大量弹窗
- 复杂多层菜单

强调：

- Content First
- Canvas First
- Keyboard First
- Contextual UI

---

# 二十五、长期架构要求

从第一天就为未来预留：

- Cloud Sync
- Collaboration
- AI
- Plugin System
- Version History

但：

**不要提前实现。**

架构可扩展 ≠ 提前增加复杂度。

---

# 二十六、第一轮工作要求

现在不要直接开发大量代码。

首先完成：

## STEP 1

完整分析产品需求。

## STEP 2

总结竞品值得借鉴的设计。

## STEP 3

给出产品 Information Architecture。

## STEP 4

给出整体技术架构。

## STEP 5

给出数据模型。

## STEP 6

给出项目目录。

## STEP 7

将整个项目拆成：

```text
Phase
→ Module
→ Epic
→ Task
→ Subtask
```

## STEP 8

分析任务依赖关系。

## STEP 9

建立开发优先级。

## STEP 10

生成 `TASKS.md`。

## STEP 11

明确 MVP 范围。

## STEP 12

建立项目基础代码骨架。

完成上述工作以后，再逐项进入开发。

---

# 二十七、执行规则

规划完成后，不需要反复询问用户“是否继续”。

如果没有关键性阻塞：

直接按照 `TASKS.md`：

```text
Task 001
→
实现
→
测试
→
记录
→
Task 002
→
实现
→
测试
→
记录
```

持续推进。

每完成一个重要 Module：

输出一次阶段总结。

如果发现原规划存在问题：

先更新：

```text
ARCHITECTURE.md
DECISIONS.md
TASKS.md
```

再修改代码。

不要偷偷改变架构。

---

# 二十八、最终产品目标

最终产品应做到：

```text
打开浏览器
→
看到值得保存的内容
→
右键加入 Mind Map
→
Side Panel 快速整理
→
Full Workspace 深度编辑
→
Mind Map / Outline 自由切换
→
节点转化为 Task
→
AI 扩展思路
→
Presentation 展示
→
PDF / SVG / Markdown 导出
```

形成真正适合浏览器环境的：

**Thinking Workspace + Mind Mapping + Knowledge Capture Tool**

---

# 二十九、当前立即执行要求

现在开始执行第一阶段：

**只进行详细产品规划、软件架构设计和任务拆解，然后建立项目骨架。**

在完成基础架构与 `TASKS.md` 前：

**不要进入高级功能开发。**

---

# 三十、关键产品决策

第一版不要优先开发：

- AI
- 实时协作
- 云同步
- Marketplace

真正决定软件基础体验的是：

1. Canvas
2. 节点编辑
3. 键盘操作
4. 自动布局
5. Undo / Redo
6. Outline

这些基础系统稳定以后，再加入：

- Web Clipper
- Inbox
- AI
- Research Mode
- Collaboration

---

# 三十一、推荐三级入口设计

## Popup

定位：

**快速入口**

用于：

- 新建
- 快速记录
- 保存网页
- 最近导图

---

## Side Panel

定位：

**浏览器上下文工作区**

用于：

- 阅读网页
- 摘录
- 保存选中文字
- 加入节点
- Inbox
- 当前导图快速整理

---

## Full Workspace

定位：

**深度思考工作区**

用于：

- Mind Map
- Outline
- Task
- Template
- Search
- Presentation
- Import / Export
- AI
- Settings

---

# 三十二、最终开发原则

始终坚持：

> **先定义数据，再定义行为；先定义模块，再实现功能；先保证稳定，再扩展能力。**

每次开发只推进一个清晰、可测试、可回滚的任务。

不要追求“一次做完”。

追求：

**架构清晰、模块独立、行为稳定、持续演进。**
