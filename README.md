# MindFlow for Zotero 10

<div align="center">

<img src="chrome/content/icons/mindflow.svg" alt="MindFlow Logo" width="108" height="108" />

# MindFlow for Zotero 10
### 专为现代 Zotero 10 打造的高颜值全功能学术思维导图与文献研读伴读插件

[![Zotero 插件版本](https://img.shields.io/badge/Zotero%20Plugin-v5.0.0-2563eb?style=flat-square&logo=zotero)](https://github.com/groele/Mindflow-zotero)
[![兼容版本](https://img.shields.io/badge/Zotero-10.0.x-c2410c?style=flat-square)](manifest.json)
[![架构模式](https://img.shields.io/badge/Runtime-Gecko%20IIFE-06b6d4?style=flat-square)](bootstrap.js)
[![开源协议](https://img.shields.io/badge/License-MIT-15803d?style=flat-square)](LICENSE)

[快速安装](#-安装与快速上手) • [v5.0 核心特性](#-v500-核心升级特性) • [学术研读工作流](#-典型学术研读工作流) • [全键盘快捷键](#-全键盘高效快捷键) • [存储与灾备](#-存储与同步安全架构)

</div>

---

## 📖 项目简介

**MindFlow for Zotero 10** 是一款专为 **Zotero 10** 生态深度定制的现代知识管理与可视化文献研读工具。

在传统学术阅读中，文献题录、PDF 高亮批注与长篇读书笔记往往分散在各个面板中，难以形成宏观的知识脉络与逻辑体系。**MindFlow** 将文献元数据（作者、年份、DOI）、论文核心摘要、PDF 关键划线与批注笔记自动化汇聚为直观清晰、自由推演的层级思维导图：
- 导图源文件直接作为目标文献条目的**直接子附件**（`.mindflow` 文件，与 PDF 平级保存）；
- 每次归档同步生成排版纯净的**结构化大纲富文本子笔记**（Note）；
- 支持点击批注节点一秒穿梭回溯原 PDF 页面高亮位置；
- 内置深度融合科研大模型接入引擎，全方位赋能学术精读、文献综述与知识沉淀。

---

## 🚀 v5.0.0 核心升级特性

### 1. 🎨 Zotero 10 原生工具栏精细化打磨
- **纯图标原生体验 (Icon-Only Styling)**：严格遵循 Zotero 10 现代原生设计语言，去除多余文本残留，与主界面工具栏浑然一体；
- **自适应高分屏与紧凑模式**：优化亚像素渲染与 SVG 矢量距离场，自适应 16×16 至 32×32 工具栏极小视图与高分屏。

### 2. 🤖 AI 学术科研研读大模型引擎 V5.0
- **最新推理大模型深度适配**：深度适配 DeepSeek V3 / R1 (`deepseek-reasoner`)、OpenAI o1 / o3-mini、Claude 3.5 Sonnet、阿里通义千问 Qwen 2.5、智谱 GLM-4 等；
- **免温控探活与自愈降级**：探活协议自适应剥离推理模型不支持的 `temperature`，自动协商 `max_completion_tokens`，彻底杜绝 400 参数冲突；
- **原生 Fetch 双引擎穿透高校网关**：原生支持 `redirect: 'follow'` 与凭证保持，无阻穿透高校内网反向代理（如中南大学等）与校园 WebVPN。

### 3. ⚡ 纯粹现代 Gecko 运行时与极简自包含包
- **严格锁定 Zotero 10**：要求 `strict_min_version: 10.0`，完全运行于现代 ES2022+ 与 Gecko 内核；
- **独立离线 IIFE 架构**：全代码编译为自包含离线包，XPI 安装包仅 ~237KB，零外部 CDN 或远程脚本依赖，离线密级科研环境即装即用。

### 4. 🛡️ 磁盘级物理原子落盘与文献双轨归档
- **四重防损坏工作区引擎**：“临时文件原子写入 $\to$ 重命名原子替换 $\to$ 回读自检校验 $\to$ 镜像备份”，杜绝断电或崩溃导致的数据损坏；
- **文献专属子附件与结构化笔记双轨归档**：一键保存为文献专属 `.mindflow` 子附件（与 PDF 平级），并同步输出去除重复摘要的高质量富文本 Note 笔记，完美支持跨设备漫游。

---

## 📥 安装与快速上手

### 环境准备
- 适用于 **Zotero 10.0.x**（Windows / macOS / Linux）。

### 安装步骤
1. 前往 GitHub [Releases](https://github.com/groele/Mindflow-zotero/releases) 下载最新发行版安装包：
   ```text
   mindflow-zotero-5.0.0.xpi
   ```
2. 打开 Zotero 10，点击顶部菜单栏 **工具 → 附加组件 (Tools → Add-ons)**；
3. 点击附加组件管理器右上角的 **齿轮设置图标**，选择 **从文件安装附加组件 (Install Add-on From File...)**；
4. 选中已下载的 `mindflow-zotero-5.0.0.xpi` 并确认安装；
5. **重启 Zotero** 即可享受全新体验。

### 入口调用
- **主工具栏**：点击主界面顶部工具栏的 MapGraph 星轨图标；
- **右键菜单**：在文献列表中右键任意条目 $\to$ 选择 **MindFlow → 为所选文献生成/打开思维导图**；
- **详情侧栏**：点击右侧条目详情面板中的 **MindFlow 导图** 分区；
- **全局快捷键**：按下 `Ctrl+Alt+M` (macOS 为 `Cmd+Alt+M`)。

---

## ⌨️ 全键盘高效快捷键

| 快捷键 | 功能说明 | 快捷键 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `Tab` | 插入子级节点 | `Enter` | 插入同级节点 |
| `Space` / 双击 | 快速进入节点编辑状态 | `Delete` / `Backspace` | 删除当前选中节点 |
| `Ctrl/Cmd + S` | 立即保存并归档到文献 | `Ctrl/Cmd + Z` / `Y` | 撤销 / 重做 |
| `Ctrl/Cmd + F` | 全局节点搜索与批量替换 | `Ctrl/Cmd + K` | 呼出全局快速命令面板 |
| `Ctrl/Cmd + 1` | 视口居中并适应全部节点 | `Ctrl/Cmd + 0` | 重置缩放比例至 100% |
| `F11` | 沉浸式全屏学术专注模式 | `Ctrl/Cmd + Alt + M` | Zotero 主界面调起 MindFlow |

---

## 🔒 存储与同步安全架构

| 存储层级 | 存储载体与路径 | 作用与机制 | 跨设备漫游方式 |
| :--- | :--- | :--- | :--- |
| **第一层：本地工作区** | `[ZoteroData]/mindflow/workspace/` | 临时文件原子写入、写后校验、自动保留 `.bak` 镜像 | 本机极速缓存与防崩灾备 |
| **第二层：文献子附件** | 文献条目下的 `.mindflow` 文件 (与 PDF 平级) | 真正的文献级知识资产，与文献强绑定 | 随 Zotero 官方文件同步（Zotero Storage 或 WebDAV）自动漫游 |
| **第三层：结构化笔记** | 文献条目下的 HTML 富文本子笔记 | 去重后的文字提纲，可全文检索 | 随 Zotero 条目数据同步自动漫游 |

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
