# 📖 MindFlow 产品需求文档 (PRD)

## 1. 产品定位与设计理念
MindFlow 是面向现代 Chrome 浏览器工作流的轻量级知识思维画布：
- **浏览器内容随手捕获 (Capture)**：利用 Chrome 扩展特权，无需切换窗口，随心划词、摘录网页。
- **收集箱缓冲与结构化整理 (Organize)**：Inbox 收集箱随时暂存，稍后一键梳理入图。
- **深度思考与多维连接 (Think & Connect)**：左右平衡思维导图、向右单向逻辑图、向下组织架构图。
- **任务化推进 (Act)**：节点无缝转化为 Todo / Doing / Done 任务并追踪进度。
- **高效展示与多格式输出 (Present & Export)**：Zen 专注模式、大纲双向联动、PNG/SVG/Markdown/JSON 导出。

## 2. 核心使用场景
1. **学术科研与文献综述**：使用 Chrome Side Panel 贴合论文 PDF 或学术网页，实时提炼观点与论据。
2. **深度阅读与网课伴读**：在阅读知乎、技术博客或看 B 站网课时做结构化笔记。
3. **日常知识管理与 Inbox 收集**：随时 `Ctrl+Shift+M` 或右键摘录闪念，定期整理到知识树。
4. **敏捷项目拆解与待办清单**：通过 Task 节点跟踪项目进展。

## 3. 信息架构 (Information Architecture)
```
Chrome 浏览器生态
├── Popup（快捷入口）
│   ├── 新建导图 / 模板选择
│   ├── 闪念即时速记
│   ├── 一键抓取当前网页卡片
│   └── 最近导图列表
├── Side Panel（侧边栏伴读）
│   ├── 极简导图画布
│   ├── 快捷大纲视图
│   └── Inbox 收集箱浮动抽屉
└── Full Workspace（全屏沉浸创作 Tab）
    ├── Top Toolbar（布局/主题/导出/大纲/搜索/Zen模式）
    ├── Infinite Canvas（平移/缩放/拖拽重排/节点复选框）
    ├── Floating Command Palette (Ctrl+K 命令面板)
    ├── Right Inspector（样式、图标、标签、任务属性）
    ├── Doc Manager Drawer（多文档库管理）
    └── Minimap（雷达导航）
```
