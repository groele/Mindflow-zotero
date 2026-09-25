# MindFlow for Zotero

[![Zotero 插件版本](https://img.shields.io/badge/Zotero%20插件-v1.1.0-2563eb)](https://github.com/groele/Mindflow-zotero/releases/tag/v1.1.0)
[![兼容版本](https://img.shields.io/badge/Zotero-10.0.x-c2410c)](zotero/manifest.json)
[![许可证](https://img.shields.io/badge/License-MIT-15803d)](LICENSE)

**在 Zotero 10 中把文献、PDF 批注和阅读笔记整理成可编辑思维导图。** MindFlow 在文献列表和 PDF 阅读场景提供入口；导图可归档为文献下的 `.mindflow` 附件，并可写回结构化大纲笔记。

> **版本说明：**本仓库同时保留 Chrome 扩展源码（版本 3.2.0）。本 README 和 GitHub `v1.1.0` 标签针对 **Zotero 插件**；下载 Zotero 安装包时请选择 `mindflow-zotero-1.1.0.xpi`，不要选择 Chrome ZIP。

## 下载与安装

1. 从 [v1.1.0 发布页](https://github.com/groele/Mindflow-zotero/releases/tag/v1.1.0)的 Assets 下载 `mindflow-zotero-1.1.0.xpi`。
2. 在 **Zotero 10** 打开 **工具 → 插件**，将 XPI 拖入插件窗口并按提示安装。Zotero 的[官方插件安装说明](https://www.zotero.org/support/plugins)也介绍了这一入口。
3. 如 Zotero 提示重启，请重启。安装后可从工具菜单、主工具栏或文献右键菜单打开 MindFlow。
4. 在 **编辑 → 设置 → MindFlow** 调整导入规则、窗口模式、编辑默认值和备份配置。

清单声明的兼容范围为 **Zotero 10.0.x**；本项目当前未声明支持 Zotero 7、8、9 或未来的 Zotero 10.1。

## 三种常用工作流

### 从一篇文献开始

1. 在 Zotero 文献列表选中一条常规文献，右键选择 MindFlow 的创建或打开入口。
2. 新导图以文献为中心，按设置导入题录、摘要、标签、文献笔记和 PDF 批注。
3. 阅读时可从文献节点定位 Zotero 条目，或从批注节点返回原 PDF 标注位置。
4. 导图编辑会先保存到本机工作区；关联文献且允许写入时，插件会尝试将导图归档为该文献的 `.mindflow` 子附件。工具栏也提供手动归档入口。

### 管理同一文献的多份导图

文献右键菜单会列出它已有的 `.mindflow` 附件，供选择打开；也可以为同一文献新建另一份导图。双击已有导图附件时，插件会尝试在 MindFlow 中打开。若 Zotero 已有附件记录、但文件尚未下载到本机，插件会提示先下载附件，避免把打开失败误判为需要新建导图。

### 按分类整理专题

在 Zotero 左侧分类上使用 MindFlow 入口，可将分类中的文献生成为专题导图；也可选择多篇文献创建一张主题导图。导入的内容保留与原条目的关联，适合继续整理研究方向和证据链。

## Zotero 协同能力

| 能力 | 当前行为 |
| --- | --- |
| 文献导入 | 读取标题、作者、年份、刊物、DOI 等信息；摘要和标签可在设置中关闭。 |
| PDF 批注 | 按设置导入 Zotero 阅读器中的标注内容、评论及页码；批注节点可返回原 PDF 位置。 |
| 文献笔记 | 导入笔记全文；导图节点和侧栏可查看较长内容。 |
| 原文跳转 | 从导图定位 Zotero 条目或打开关联 PDF；群组库链接保留所属库信息。 |
| 导图附件 | 将 `.mindflow` 文件保存为文献子附件；同一文献可保留多份导图。 |
| 大纲笔记 | 可将导图写为关联文献的子笔记；再次保存同一导图时尝试更新对应笔记。 |
| 权限反馈 | 群组库只读或禁止附件写入时，说明未归档的原因。 |
| 工作方式 | 可选 Zotero 主窗口选项卡或独立窗口。 |

独立笔记和没有文献父条目的附件不会被当作一篇“文献”来生成空白导图。

## Zotero 10 中的 MindFlow 设置

设置面板与导图工作台使用同一份插件配置。修改后会保存到本机 Zotero 首选项；已打开的工作台会接收更新。面板按实际使用场景分组：

| 分组 | 可设置内容 |
| --- | --- |
| 文献与 PDF 阅读协同 | 选项卡或独立窗口、欢迎页、摘要、批注与笔记、标签导入、归档时更新大纲子笔记、保存笔记后定位。 |
| 工作台界面与工具栏 | 工具栏及侧栏位置、画布背景、缩放步进，以及撤销、插入、布局、主题、大纲、收集箱、模板、专注、导出和缩放按钮的显示。 |
| 新建导图与节点编辑 | 10 款默认主题、默认布局、连线、任务优先级、彩虹分支、音效、添加子节点时自动展开父节点。 |
| 本地保存与历史快照 | 可选的额外保存文件夹、自动快照开关、间隔和每份导图的保留上限。 |
| WebDAV 备份 | HTTPS 服务器、目录、账户、应用密码以及保存时自动上传工作区备份。 |

“恢复 MindFlow 默认设置”只重置插件配置，不删除导图、文献附件或历史快照。工作区导出、导入、WebDAV 连通性检查和版本恢复属于一次性操作，请在导图工作台的备份工具中执行。

## 保存与同步：三个位置的区别

1. **本机工作区**：编辑中的导图、快照和设置保存在本机 Zotero 配置环境。工作区状态本身不是 Zotero 数据同步服务中的独立对象。
2. **Zotero 文献子附件和笔记**：关联文献的 `.mindflow` 附件与大纲子笔记由 Zotero 管理。子笔记属于数据同步；附件文件能否跨设备到达，取决于 Zotero 文件同步配置、所属文献库及权限。**Zotero WebDAV 仅用于个人库附件；群组库附件需要 Zotero Storage。** 详见 [Zotero 同步说明](https://www.zotero.org/support/sync)。
3. **MindFlow 可选备份**：额外保存文件夹会在本机写出一份 `.mindflow` 文件；MindFlow 面板中的 WebDAV 则用于上传工作区备份。两者都不代替 Zotero 的数据同步或附件同步。

建议首次换设备时确认 Zotero 已下载所需的 `.mindflow` 附件，再从文献右键菜单打开。重要导图也可定期导出工作区备份。WebDAV 账号配置保存在本机插件设置中；请使用 HTTPS 和服务商提供的应用密码。

## 导图编辑与导出

- 三种布局：左右平衡思维导图、向右逻辑图、向下组织图；支持主题、连线和画布纹理调整。
- 节点支持长文本备注、标签、任务、链接、图片、折叠/展开、跨导图关联和分支移动。
- 可使用大纲、搜索与替换、模板、收集箱、专注模式和演示模式。
- 支持导出单篇导图 JSON、Markdown、OPML、PNG、SVG、交互 HTML；PDF 通过打印对话框生成。
- 工作区备份 JSON 包含多篇导图及相关本机数据；Markdown、OPML 是文字大纲格式，不包含节点图片。

### 常用快捷键

| 快捷键 | 操作 |
| --- | --- |
| `Tab` / `Enter` | 添加子节点 / 同级节点 |
| `Space` 或双击节点 | 编辑节点文字 |
| `Ctrl/Cmd+S` | 保存当前导图并等待关联文献的归档结果 |
| `Ctrl/Cmd+F` / `Ctrl/Cmd+K` | 搜索 / 命令面板 |
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` | 撤销 / 重做 |
| `Ctrl/Cmd+1` / `Ctrl/Cmd+0` | 适应画布 / 100% 缩放 |
| `F11` | 切换沉浸式全屏 |

输入框获得焦点时，文字输入优先。完整列表可在工作台的快捷键帮助中查看。

## 从源码构建

需要 Node.js、npm 和 PowerShell 7。当前打包脚本会对 TypeScript 和 Zotero 端脚本执行构建时检查，输出到 `dist-zip/`：

```powershell
git clone https://github.com/groele/Mindflow-zotero.git
cd Mindflow-zotero
npm ci
npm run build:zotero
```

安装文件为 `dist-zip/mindflow-zotero-1.1.0.xpi`；已解压的构建目录在 `dist-zotero/`。这两个目录是生成物，不提交到 Git。Chrome 扩展另用 `npm run build` 构建到 `dist/`，其版本仍为 3.2.0。

| 路径 | 用途 |
| --- | --- |
| `zotero/manifest.json`、`zotero/bootstrap.js` | Zotero 插件清单和生命周期入口 |
| `zotero/chrome/content/scripts/index.js` | Zotero 菜单、窗口、阅读器和附件归档逻辑 |
| `zotero/chrome/content/preferences.xhtml`、`zotero/chrome/content/scripts/preferences.js` | 原生设置面板 |
| `src/services/zotero/zoteroBridge.ts` | 导图工作台与 Zotero 数据、跳转和归档的桥接 |
| `src/pages/app/App.tsx` | 导图工作台与保存流程 |
| `scripts/build-zotero.mjs`、`scripts/build-zotero.ps1` | 构建和 XPI 打包 |

## 使用边界与问题反馈

- 当前发布范围以清单中的 Zotero 10.0.x 为准。构建和静态检查不能替代在真实 Zotero 桌面中安装并操作的验证。
- 只读群组库不能写入附件或笔记；文件尚未下载的云端附件需先在 Zotero 中下载。
- MindFlow 的工作区 WebDAV 备份与 Zotero 的附件 WebDAV 是两套独立设置；插件不提供多人实时共同编辑。
- 发现问题时请在 [Issues](https://github.com/groele/Mindflow-zotero/issues) 提供 Zotero 版本、MindFlow 版本、操作步骤、预期与实际结果，以及可分享的错误日志；请移除文献内容和密码。

更多实现细节见 [Zotero 开发与使用指南](docs/ZOTERO_GUIDE.md)；版本变化见 [CHANGELOG](CHANGELOG.md)。项目以 [MIT License](LICENSE) 发布。
