# 🏗️ MindFlow 技术架构设计文档

## 1. 分层架构规范

整个系统严格遵守单向依赖分层设计：

```text
UI Layer (Components, Canvas, Sidebars, Modals, Popups)
   ↓
Interaction Layer (Keyboard Dispatcher, Drag-and-Drop, Mouse Gestures)
   ↓
Domain Layer (Tree Operations, Layout Engine, Task Engine, Importer/Exporter)
   ↓
Command / History Layer (Undo/Redo Command Stack, Batch Actions)
   ↓
Persistence Layer (Storage Service, Inbox Storage, Chrome Local Storage / IndexedDB)
   ↓
Chrome Integration Layer (Manifest V3 Service Worker, Side Panel API, Context Menus)
```

## 2. 核心模块与职责划分

| 模块 | 职责 | 依赖限制 |
| :--- | :--- | :--- |
| `src/core/model/` | 纯 TypeScript 数据模型与树操作函数 | 零依赖外部 UI，纯纯度函数 |
| `src/core/layout/` | 纯几何数学布局引擎（节点尺寸测算、空间位置定位、贝塞尔曲线生成） | 仅依赖 `types.ts`，禁止引用 React |
| `src/core/history/`| 历史记录管理栈（支持 Undo/Redo/事务合并） | 依赖 `treeOps.ts` |
| `src/services/` | 数据持久化（Chrome Storage / LocalStorage 适配）、格式序列化 | 与底层存储打交道，向 UI 暴露 Promise 接口 |
| `src/components/` | React 纯展示与交互绑定组件 | 通过 props 与回调驱动，禁止直接写数据库 |
| `src/extension/` | Chrome Service Worker 后台任务，处理菜单右键通信 | 跨上下文消息传递 |

## 3. 渲染方案权衡
- **HTML Node + SVG Edge 混合渲染**：
  - **SVG Edge**：用于呈现高精度、平滑自适应的三次贝塞尔分支曲线，缩放无锯齿，硬件加速性能高。
  - **HTML Node**：利用原生 DOM 渲染卡片、富文本输入、IME 中文输入法无感组合、CSS 现代特效（Glassmorphism、Drop-shadow）。避免纯 Canvas 导致的输入法错位、字体模糊与复选框难复用问题。
