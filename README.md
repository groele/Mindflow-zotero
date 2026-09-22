# 🚀 MindFlow - 现代 Chrome 浏览器思维导图与伴读笔记

[![GitHub release](https://img.shields.io/badge/release-v2.5.0-blue.svg)](https://github.com/groele/mindflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Chrome MV3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Free & Open Source](https://img.shields.io/badge/Status-100%25%20Free%20%26%20Open%20Source-brightgreen.svg)](https://github.com/groele/mindflow)

> 借鉴主流标杆（XMind、MindNode、ProcessOn），深度融合 Chrome 浏览器生态打造的轻量级、极速、高颜值思维导图扩展程序。100% 全功能永久免费开放、节点悬浮气泡微工具栏、跨分支自由关联线、全局查找与替换、分支多层级收折、矢量 PDF 纯净打印。

---

## ✨ 核心特性

### 1. 深度对标主流思维导图体验
- **全键盘盲操与丝滑导航**：
  - `Tab`：插入子主题
  - `Enter`：插入同级主题
  - `Shift + Enter`：在前方插入同级主题
  - `Delete / Backspace`：删除当前选中的主题分支
  - `Space 空格 / 双击`：就地内联文字编辑，完美兼容中文 IME 输入法
  - `↑ ↓ ← →`：在节点之间自由穿梭导航焦点
  - `Ctrl + Z / Ctrl + Y`：无限历史撤销与重做
  - `/`：快速折叠与展开分支
  - `Ctrl + K`：呼出全局命令面板（Command Palette），瞬时检索与跳转
  - `Ctrl + ,`：秒级唤起全局系统设置中心
- **三大经典布局引擎**：
  - **思维导图**：左右智能平衡自适应分布（对标 XMind / MindNode）
  - **逻辑图**：向右单向展开（适合清晰阅读流程与读书笔记）
  - **组织架构图**：自顶向下层级展开（适合汇报与系统拆解）
- **10 大精心调校的专业级主题**：
  - 经典商务蓝、极夜星云（OLED 深色模式）、马卡龙糖果粉、森林秘境（柔和护眼绿）、极简水墨黑白、暖阳琥珀、赛博朋克霓虹、北欧冰霜蓝、学术纸感（论文框架）、薰衣草梦境
- **多维节点属性与 Task 任务流转**：
  - 一键将节点转为 Todo / Doing / Done 任务，原生勾选打勾动画与划线动效
  - 节点形状自适应（圆角矩形、胶囊、纯矩形、下划线）
  - 优先级与图标徽章（P1/P2/P3/P4、⭐、🚩、✅、❓）
  - 标签系统（Tags）、超链接跳转、富文本长备注

---

### 2. 🎛️ 系统设置中心与界面深度自定义 (v2.2.0)
- **工具栏位置定制**：支持工具栏 **置顶 (Top)** 与 **置底 (Bottom)** 自由切换。
- **左右工作台互换停靠**：宏观工作台支持自由停靠在画布左侧或右侧，适配 Chrome 侧边栏（Side Panel）在右侧的交互动线。
- **工具栏按钮个性化显隐**：支持对 10 个功能按钮（撤销重做、加子节点、加同级节点、删除节点、布局、主题、导出、收集箱、专注模式、缩放控件）按需显隐，打造极致专注界面。
- **画布背景纹理切换**：支持 **点阵 (Dots)**、**工程网格 (Grid)** 与 **极简纯白 (Blank)** 自由切换。
- **编辑偏好设置**：可配置新建导图的默认主题、默认布局、折叠分支添加子节点时自动展开父级、默认 Task 优先级等。

---

### 3. ☁️ 现代 WebDAV 云同步与异地容灾 (v2.2.0)
- **主流网盘一键预设**：内置坚果云（Jianguoyun）、Nextcloud / ownCloud、群晖 Synology NAS 及自定义 WebDAV 模板。
- **连通性即时检测**：基于 `PROPFIND` / `OPTIONS` 协议头验证网络与账号密码有效性，给出精准排错建议。
- **多端数据漫游**：支持手动或自动上传全量备份至 WebDAV，在其他设备上一键从云端拉取恢复，打破本地隔离。
- **安全与隐私保障**：100% 离线优先，凭证加密存放于用户本机，不经过任何第三方服务器中转。

---

### 4. 🛡️ 数据安全与版本快照历史
- **滚动版本快照 (Snapshots)**：单文档自动/手动生成历史快照（最多保留 50 份），支持随时一键无损回滚。
- **全量工作区离线备份/还原**：一键将所有导图文件、收集箱碎片及版本快照打包导出为 `.mindflow-workspace-backup.json`。
- **本地存储配额监控 (Storage Quota)**：动态计算 `chrome.storage.local` 已用空间与配额百分比。

---

### 5. 🌐 Chrome 浏览器特权与伴读模式
- **Side Panel 侧边栏伴读模式**：
  - 完美接入 Chrome `sidePanel` API。在浏览网页、阅读文献、观看网课视频时，导图停靠在浏览器侧边，边读边记。
- **一键提取网页卡片**：
  - 一键将当前 Tab 的标题与 URL 转化为导图节点。
- **划词右键收藏**：
  - 在任意网页选中文本，右键点击「📌 摘录到思维导图」，后台 Service Worker 自动将摘录内容注入灵感收集箱。

---

### 6. 多格式导入与导出
- **高清 PNG 导出**：支持高 DPI 视网膜清晰度导出。
- **矢量 SVG 导出**：无损放大，可直接用于设计工具与打印。
- **Markdown 互通**：导出为结构化 Markdown，亦可将 Markdown 大纲直接导入为导图。
- **JSON 工程备份**：完整的工程文件导入导出，方便多设备迁移。

---

## 🛠️ 项目架构与模块化设计

```
Mindmapext/
├── dist/                          # 构建产物（直接加载至 Chrome）
├── public/                        # 静态资源与 Manifest V3 扩展配置
│   ├── manifest.json              # Chrome MV3 清单文件
│   └── icons/                     # 扩展多尺寸图标
├── src/
│   ├── core/                      # [核心引擎 - 纯 TypeScript，与 UI 解耦]
│   │   ├── model/                 # 节点数据模型、树增删改移、系统设置模型
│   │   ├── layout/                # 布局算法（左右平衡、逻辑图、组织结构）
│   │   ├── history/               # Undo / Redo 命令模式历史记录栈
│   │   ├── theme/                 # 10 款专业主题调色板
│   │   └── sampleData.ts          # 默认引导导图数据
│   ├── components/                # [UI 组件模块]
│   │   ├── canvas/                # 无限视口平移、平滑缩放、贝塞尔曲线连接、背景网格
│   │   ├── node/                  # 节点渲染、Task 复选框、内联输入法编辑、折叠微件
│   │   ├── toolbar/               # 可定制顶部/底部工具栏
│   │   ├── sidebar/               # 左侧宏观工作台 + 右侧微观节点检视器
│   │   ├── minimap/               # 雷达小地图导航
│   │   ├── outline/               # 交互式大纲视图（支持行内直接修改）
│   │   ├── command/               # Ctrl+K 全局命令面板
│   │   └── modal/                 # 全局系统设置中心、模板库、全键盘快捷键指南
│   ├── services/                  # [服务模块]
│   │   ├── storage/               # Chrome Storage、快照管理、设置持久化
│   │   ├── sync/                  # WebDAV 云端备份与同步服务
│   │   └── io/                    # PNG、SVG、Markdown、JSON 导入导出器
│   ├── extension/                 # [Chrome 扩展后台]
│   │   └── background/            # Manifest V3 Service Worker、右键菜单、扩展通信
│   ├── pages/                     # [页面入口]
│   │   ├── app/                   # 全屏沉浸创作页面
│   │   └── popup/                 # 插件栏图标弹出层
│   ├── index.html                 # 全屏 Tab 独立入口
│   ├── sidepanel.html             # Chrome 侧边栏入口
│   ├── popup.html                 # 扩展弹出层入口
│   └── styles/                    # Tailwind CSS 全局样式
```

---

## 📦 如何在 Chrome 浏览器中加载与体验

1. 打开 Google Chrome 浏览器。
2. 在地址栏输入 `chrome://extensions/` 并回车。
3. 开启右上角的 **「开发者模式」（Developer mode）**。
4. 点击左上角的 **「加载已解压的扩展程序」（Load unpacked）**。
5. 选择本项目下的 **`dist`** 文件夹。
6. 加载成功后：
   - 点击浏览器右上角拼图图标，将 **MindFlow** 固定在工具栏；
   - 点击插件图标即可呼出快捷弹窗、进入全屏沉浸创作或开启侧边伴读模式！

---

## 💻 本地开发与指令

```bash
# 1. 安装依赖
npm install

# 2. 运行自动化单元测试 (16/16 全部通过)
npm test

# 3. 启动本地热更新服务器
npm run dev

# 4. 打包构建生产环境 Chrome 扩展程序（产物输出至 dist/）
npm run build
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。
