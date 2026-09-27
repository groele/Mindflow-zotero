# MindFlow for Zotero 10 v4.0.0 (架构彻底纯化：以 Zotero 10 为绝对核心的大版本飞跃)

MindFlow **v4.0.0** 是 MindFlow 发展历程中最具里程碑意义的重大重构版本。彻底终结了“浏览器扩展 + 插件”双核摇摆的混合架构历史，彻底卸下向下兼容与多环境兼顾的历史包袱，**全面以 Zotero 10 为绝对核心，进行全链路重构、性能飞跃与体验进化**。

---

## 🌟 v4.0.0 核心重构与升级亮点

### 1. 🚀 纯粹的现代 Zotero 10 原生架构 (Zero Legacy Overhead)
- **全面剥离 Chrome 扩展残留**：彻底剔除 Chrome MV3 Manifests、Service Worker 背景进程、Popup 与 SidePanel 多入口，移除 `@types/chrome` 依赖，杜绝一切非必要的跨环境兼容胶水代码；
- **全速现代 Gecko 运行环境**：严格限制 `strict_min_version: 10.0`，全面利用现代 ES2022+ 语法特性，剥离冗余的向下兼容垫片（Polyfills）；
- **极简独立 IIFE 打包**：打包为自包含 Gecko IIFE 离线独立包，XPI 安装包仅 ~230KB，无外部 CDN 依赖，在高校离线局域网与科研专网中即装即用。

### 2. 🛡️ 纯原生工作区与磁盘原子灾备系统
- **直接对接 Zotero 数据目录**：工作区导图统一直接持久化于本地物理磁盘 `mindflow/workspace/`，通过“临时文件原子写入 $\to$ 重命名原子落盘 $\to$ 回读自检校验 $\to$ 镜像备份”四重机制，彻底杜绝数据损坏风险；
- **文献直接子附件与结构化富文本笔记双轨归档**：按 `Ctrl+S` 时，自动在目标文献下保存 `.mindflow` 专属子附件（与 PDF 平级），并同步生成剔除冗余摘要的排版大纲富文本 Note 笔记，完美支持移动端与 Web 端漫游。

### 3. 🤖 AI 学术科研研读大模型引擎 v4.0
- **最新一代推理大模型深度适配**：原生兼容 DeepSeek V3 / R1 (`deepseek-reasoner`)、OpenAI o1 / o3-mini、Claude 3.5 Sonnet、阿里通义千问 Qwen 2.5 等；
- **免温控探活与自愈降级**：探活严格剥离推理模型不支持的 `temperature`，自动适配 `max_completion_tokens`，杜绝 400 参数冲突；
- **原生 Fetch 双引擎穿透高校网关**：默认开启 `redirect: 'follow'`，完美穿透高校内网反向代理（如中南大学 `api.chat.csu.edu.cn` 等）与校园 WebVPN，认证信息永不丢失。

### 4. 🎯 PDF 毫秒级双向穿梭与学术全景视野
- **高亮批注精准回溯**：点击导图节点上的文献或批注链接，一键唤起 Zotero 10 原生 PDF 阅读器并高亮跳转至对应页码；
- **ItemPane 详情区分区集成**：文献右侧详情面板原生渲染“MindFlow 导图”专属分区，即刻查看并管理该文献关联的全部导图。

---

## 📦 安装与升级指南

1. 从 GitHub Release 下载 `mindflow-zotero-4.0.0.xpi`；
2. 打开 Zotero 10 客户端，点击菜单栏 `工具 (Tools)` → `附加组件 (Add-ons)`；
3. 点击右上角齿轮图标 ⚙️，选择 `Install Add-on From File...`；
4. 选中已下载的 `mindflow-zotero-4.0.0.xpi` 并确认安装；
5. 重启 Zotero 即可开启全新 v4.0.0 科研导图之旅！
