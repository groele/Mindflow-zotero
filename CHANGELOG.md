# 📜 MindFlow 版本更新日志 (CHANGELOG.md)

All notable changes to this project will be documented in this file.

## [2.2.0] - 2026-09-22

### ⚙️ 系统设置中心 (Settings Center & Preferences)
- **多级设置直达入口**：在顶部/底部工具栏、左侧微型图标轨、`Ctrl+K` 命令面板以及全局键盘快捷键 `Ctrl+,` 均支持一键弹出设置中心。
- **5 大分类设置面板**：覆盖界面定制、WebDAV 云同步、备份策略、编辑偏好与系统关于。

### 🎛️ 工具栏与界面深度自由定制 (Interface & Toolbar Customization)
- **工具栏位置定制**：支持工具栏置顶（Top，默认）或置底（Bottom），自适应不同窗口高度与阅读习惯。
- **工具栏按钮自由显隐**：支持独立开关 10 项按钮（撤销重做、插入子节点、插入同级节点、删除节点、布局切换、主题切换、导出、收集箱、专注模式、缩放控件），避免小屏/Side Panel 拥挤。
- **画布背景纹理切换**：支持点阵 (Dots)、方格网格 (Grid)、纯净无格 (Blank) 三种纹理实时换肤。

### ☁️ WebDAV 云同步与异地容灾 (WebDAV Cloud Sync)
- **主流网盘一键预设**：内置坚果云（Jianguoyun）、Nextcloud、群晖 NAS 等服务商预设指引。
- **点对点直连无中转**：遵循 Manifest V3 跨域网络规范，密码与密钥仅存放于用户本地 Storage。
- **连通性即时检测**：一键发起 WebDAV `PROPFIND` / `OPTIONS` 检测，反馈详细 HTTP 状态码与中文排错建议。
- **双向数据同步**：支持一键将全量工作区打包为 JSON 远程备份，或从 WebDAV 拉取异地备份安全还原。
- **自动云同步**：支持编辑保存导图时静默同步备份至 WebDAV。

### 🧩 编辑行为与默认偏好 (Default Preferences)
- **默认主题与布局定制**：新建导图时自动应用用户指定的主题与布局。
- **自动展开父分支**：添加子节点时，若父节点处于折叠状态则智能自动展开。
- **任务默认优先级**：可设置新建 Task 时的默认优先级（P1/P2/P3/P4）。

---

## [2.1.0] - 2026-09-22

### 🛡️ 数据安全与备份增强 (Data Security & Backup)
- **版本快照历史 (Snapshots)**：新增每个思维导图滚动维护最多 20 个历史快照记录，记录节点数与时间戳，支持随时一键无损回滚。
- **工作区全量备份/还原 (Full Workspace Backup)**：一键将所有导图文件、收集箱碎片及版本快照打包导出为 `.mindflow-workspace-backup.json`，并支持标准化全量导入还原。
- **存储配额监控 (Storage Quota)**：动态计算 `chrome.storage.local` 已用空间与上限容量，提供可视化进度条，防止极端情况下本地写入溢出。

### 🎨 10 款专业主题扩充 (10 Theme Systems)
- **经典商务蓝 (`classic-blue`)**：清爽高效的现代办公风格。
- **极夜星云深色 (`dark-nebula`)**：OLED 护眼深黑，高对比度荧光点缀。
- **马卡龙糖果粉 (`macaron`)**：柔和柔美多色调，适合创意灵感整理。
- **森林秘境护眼绿 (`forest-green`)**：低饱和度柔和护眼绿意。
- **极简水墨黑白 (`minimal-ink`)**：高对比度纯粹水墨风，专注内容排版。
- **暖阳琥珀 (`warm-amber`)**：温暖温馨的橙黄基调，适合读书与日常随笔。
- **赛博朋克霓虹 (`cyberpunk-neon`)**：紫黑底色配高亮荧光青与粉红。
- **北欧冰霜蓝 (`nordic-frost`)**：冷冽清透的北欧极简极光质感。
- **学术纸感 (`academic-paper`)**：复古米黄纸质感，适合论文框架与文献研读。
- **薰衣草梦境 (`lavender-dream`)**：典雅紫罗兰质感，适合女性与艺术设计。

### 🧭 左右端人机工程学模块重构 (Ergonomic Layout)
- **左侧宏观工作台 (`LeftWorkbench`)**：
  - 采用 44px 极简图标导航轨 + 280px 平滑展开抽屉，不挤占画布空间。
  - 深度整合：① 文档库管理（创建/搜索/删除）；② 结构大纲（双击直接在树上行内编辑文本）；③ 灵感收集箱（划词入库与一键入图）；④ 数据安全与快照面板。
- **右侧微观检视器 (`PropertySidebar`)**：
  - 作为选定节点的属性面板，仅在节点激活时展示样式、任务属性、标签、超链与备注。
- **停靠位置自由对调 (`dockPosition`)**：
  - 支持一键将宏观工作台停靠在屏幕左端或右端（自动保存至 `mindflow_dock_pos`），特别适配 Chrome 侧边栏（Side Panel）模式。

---

## [1.1.0] - 2026-09-22
### Added
- **规范文档体系**：建立 `docs/PRODUCT.md`、`ARCHITECTURE.md`、`DATA_MODEL.md`、`TASKS.md`、`DECISIONS.md`。
- **Task 任务化管理**：节点支持一键转为 Task（Todo/Doing/Done），支持原生复选框流转与完成划线特效。
- **浏览器专属 Inbox 收集箱**：划词与网页一键入箱，支持收集箱条目一键生成导图节点。
- **Command Palette 命令面板**：支持 `Ctrl/Cmd + K` 呼出，支持全文快速定位节点与执行操作。
- **模板库系统**：内置头脑风暴、SWOT 分析、读书笔记、敏捷规划、文献综述等多套专业模板。
- **Zen 专注模式**：一键隐藏所有界面干扰，提供极致全屏沉浸创作体验。

---

## [1.0.0] - 2026-09-22
### Added
- 基础 Manifest V3 扩展骨架，三级入口（Popup、Side Panel、Full Tab）。
- 左右平衡思维导图、向右单向逻辑图、向下组织架构图三大布局。
- 全键盘盲操快捷键（Tab/Enter/Delete/方向键）与 Undo/Redo 历史栈。
- PNG/SVG/Markdown/JSON 导入导出与双向大纲视图。
