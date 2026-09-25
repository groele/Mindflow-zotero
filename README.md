# MindFlow

[![版本](https://img.shields.io/badge/版本-1.0.0-blue.svg)](https://github.com/groele/Mindflow-zotero/releases/latest)
[![许可证](https://img.shields.io/badge/许可证-MIT-green.svg)](LICENSE)
[![Zotero 7+ 插件](https://img.shields.io/badge/Zotero-7%2B%20Addon-red.svg)](docs/ZOTERO_GUIDE.md)
[![Chrome 扩展](https://img.shields.io/badge/Chrome-Manifest%20V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

MindFlow 是一款面向 **Zotero 7+ 客户端** 与 Chrome 浏览器的现代思维导图与科研伴读笔记插件。它把文献研读、学术脑图、大纲结构、高亮批注与笔记存回放在同一个工作区，默认将数据安全保存在本地；所有功能永久免费，无需注册或激活。

[下载 Zotero 插件 (.xpi)](https://github.com/groele/Mindflow-zotero/releases/latest) · [Zotero 插件开发与使用指南](docs/ZOTERO_GUIDE.md) · [查看变更记录](CHANGELOG.md) · [报告问题](https://github.com/groele/Mindflow-zotero/issues)

## 功能概览

### Zotero 7+ 学术伴读与文献脑图

- **原生主窗口选项卡（Native Tab）**：深度融入 Zotero 7 标签栏，与文库、PDF 标签并列协同；支持按 `Ctrl+Alt+M` 快捷唤出。
- **独立浮窗自由切换**：可在设置中自由选择“内嵌选项卡”或“独立大窗口”，在多屏、大屏科研环境中随心布局。
- **系统级首选项面板**：在 Zotero 原生“设置 (Preferences)”中注册专属配置面板，全局定制解析规则、默认布局与主题。
- **一键文献成图**：选中单篇或多篇文献，一键解析题录、年份、作者、刊物、核心摘要及 PDF 划线批注。
- **分类文件夹生成**：在文库分类文件夹右键一键生成专题领域完整知识树。
- **双向穿梭与 PDF 直达**：导图节点专属 🎓 徽标直达文库条目；右键可秒开 Zotero 7 原生 PDF 阅读器。
- **文献条目子附件归档（.mindflow）**：导图可直接作为对应论文条目的子附件保存，落地于本地 Zotero storage 目录，并随文献享受 Zotero 原生 WebDAV / 官方云多端漫游同步；在文库树中右键点击 `.mindflow` 附件即可直接秒开导图。
- **自定义本地物理路径备份**：支持在 Zotero 设置中指定本地磁盘文件夹，保存导图时实时同步生成实体文件，本地数据绝对安全。
- **一键回存大纲笔记**：导图大纲富文本一键回存为 Zotero 本地文献库笔记。

### 导图编辑

- 三种布局：左右平衡思维导图、向右逻辑图、自上而下组织架构图。
- 10 款配色主题（含学术纸感、莫兰迪、赛博朋克等）；可调整画布纹理、分支连线样式和工具栏布局。
- 节点支持标签、颜色、形状、图标、任务、超链接、跨导图链接和纯文本备注。
- 节点可折叠、重排、批量选择和批量设置；支持跨分支关联线。
- 图片可与文字同处一个节点，也可作为纯图片节点。支持导入、替换、删除和调整显示宽度。
- 可使用大纲、搜索与替换、标签聚焦、任务总览、模板、专注模式和演示模式整理或展示内容。

### 图片操作

为节点添加图片，可以：

1. 选中节点，点击节点上方浮动工具栏的图片图标；
2. 打开节点属性面板，选择“导入图片”；
3. 将单张图片拖到画布上的目标节点；
4. 复制截图后选中目标节点，按 Ctrl/Cmd+V。

支持 PNG、JPEG 和 WebP。导入时会在本机压缩后嵌入导图；单个原始文件不超过 15 MB，解码像素数不超过 2400 万。图片宽度可在节点属性面板调整。

### Chrome 浏览器集成

- 在全屏标签页中编辑，也可打开 Chrome 侧边栏边读网页边做笔记。
- 从当前网页创建链接卡片；通过网页右键菜单收集页面或所选文字。
- 可将选中文字直接添加到当前导图，或先放入收集箱稍后整理。

## 快速开始

### 从 GitHub Releases 下载安装（推荐）

1. 前往 [GitHub Releases 最新发布页](https://github.com/groele/Mindflow-zotero/releases/latest)；
2. 下载 `mindflow-zotero-1.0.0.xpi`；
3. 在 Zotero 7 中，点击顶部菜单 **“工具 (Tools)” → “附加组件 (Add-ons)”**；
4. 点击附加组件窗口右上角的 ⚙️ 齿轮图标，选择 **“Install Add-on From File...”**；
5. 选择下载的 `.xpi` 文件并确认安装，重启 Zotero 即可！

### 从源码构建

需要安装 Node.js 和 npm。

~~~bash
git clone https://github.com/groele/Mindflow-zotero.git
cd Mindflow-zotero
npm install

# 构建 Zotero 7+ 插件安装包 (产物输出到 dist-zip/mindflow-zotero-1.0.0.xpi)
npm run build:zotero

# 构建 Chrome 浏览器扩展 (产物输出到 dist/)
npm run build
~~~

- **Chrome 扩展安装**：构建完成后，在 `chrome://extensions/` 中开启“开发者模式”，点击“加载已解压的扩展程序”，选择 `dist/` 文件夹。
- **Zotero 插件安装**：构建完成后，在 Zotero 7 中点击“工具 → 附加组件 → Install Add-on From File”，选择 `dist-zip/mindflow-zotero-1.0.0.xpi` 安装。详见 [Zotero 插件指南](docs/ZOTERO_GUIDE.md)。

本地开发可运行 `npm run dev`。本地开发服务器主要用于界面开发；侧边栏、网页右键菜单与 Zotero 原生菜单等能力应在对应平台中加载后使用。

## 常用快捷键

快捷键在画布处于操作状态时生效；正在输入文字时，输入框优先处理按键。Mac 用户可将 Ctrl 理解为 Command。

| 快捷键 | 操作 |
| --- | --- |
| Tab | 添加子节点 |
| Enter / Shift+Enter | 添加同级节点 / 在前方添加同级节点 |
| Space 或双击节点 | 编辑节点文字 |
| Delete / Backspace | 删除选中节点或分支 |
| 方向键 | 在节点间移动选择 |
| Ctrl/Cmd+C、Ctrl/Cmd+V | 复制并粘贴节点分支；也可粘贴剪贴板中的图片 |
| Ctrl/Cmd+D | 创建选中节点的副本 |
| Ctrl/Cmd+Z、Ctrl/Cmd+Y | 撤销、重做；历史栈最多保留 50 步 |
| Ctrl/Cmd+Shift+Z | 重做 |
| Ctrl/Cmd+F | 搜索导图 |
| Ctrl/Cmd+H | 在搜索面板中切换到替换 |
| Ctrl/Cmd+K | 打开命令面板 |
| Ctrl/Cmd+, | 打开设置 |
| Ctrl/Cmd+S | 保存导图并同步至文献条目附件与本地备份 |
| Ctrl/Cmd+1 / Ctrl/Cmd+0 | 适应画布 / 恢复 100% 缩放 |
| F11 | 切换全屏沉浸研读模式 |
| F5 或 Alt/Cmd+P | 打开演示模式 |
| ? | 查看快捷键 |

其他操作：按住 Shift 拖动鼠标可框选节点；拖动节点可调整其父子关系；将图片拖到节点可为节点添加图片。可从节点菜单、工具栏和快捷键帮助查看具体操作。

## 导入与导出

| 格式 | 导入 | 导出 | 说明 |
| --- | :---: | :---: | --- |
| JSON 导图 | ✓ | ✓ | 保存单篇导图的完整结构和可编辑属性；含节点图片 |
| Markdown | ✓ | ✓ | 适合文字大纲交换；不包含节点图片 |
| OPML | ✓ | ✓ | 适合大纲工具之间交换；不包含节点图片 |
| PNG | — | ✓ | 位图图片，节点图片会一并绘制 |
| SVG | — | ✓ | 矢量图形，适合放大与排版 |
| HTML | — | ✓ | 可离线打开的交互式导图，包含节点图片 |
| PDF | — | ✓ | 调用浏览器打印对话框，可另存为 PDF |
| 工作区备份 JSON | ✓ | ✓ | 在“设置 → 备份”中导入或导出所有导图、收集箱和快照 |

Markdown 与 OPML 是文字大纲格式，导出含图片的导图时会提示图片不会写入该格式。若需完整迁移，请使用单篇 JSON 或工作区备份。工作区备份可能包含多篇导图和历史数据，请妥善保管。

## 保存、备份与隐私

- 编辑内容会自动保存到当前浏览器的扩展本地存储。卸载扩展、清理浏览器数据或设备故障可能导致本地数据丢失，建议定期导出工作区备份。
- 自动快照默认开启，默认间隔为 10 分钟；每篇导图默认保留 20 份，可在设置中调整为 10–50 份。
- 本地工作区备份包含导图、收集箱内容和快照。恢复前会显示导入预览；覆盖导图前会尝试创建恢复快照。
- WebDAV 是可选的备份目的地。用户配置后，MindFlow 通过 HTTPS 直接向指定服务器上传或下载备份；自动备份默认关闭。它不提供多人实时协同编辑。
- 导图默认不上传到 MindFlow 的服务器。WebDAV 地址、用户名和密码保存在 Chrome 扩展存储中；Chrome 不提供应用层加密，请使用 HTTPS 和服务商的应用专用密码。凭据不会写入导出备份。
- 扩展不包含遥测或广告跟踪代码。详细说明见[隐私政策](PRIVACY.md)。

本地 Chrome 存储有配额限制，可在“设置 → 备份”查看使用量。大量图片和快照会占用更多空间。

## 开发与项目文档

~~~bash
npm install       # 安装依赖
npm run dev       # 启动本地开发服务器
npm run build     # 类型检查并生成 Chrome 扩展到 dist/
npm test          # 运行核心逻辑测试
node scripts/package-extension.js  # 将 dist/ 打包为商店 ZIP
~~~

项目结构、数据模型与设计决策见：

- [产品说明](docs/PRODUCT.md)
- [技术架构](docs/ARCHITECTURE.md)
- [数据模型](docs/DATA_MODEL.md)
- [设计决策](docs/DECISIONS.md)
- [优化路线图](docs/IMPROVEMENT-ROADMAP.md)
- [Chrome Web Store 上架资料](docs/STORE_LISTING.md)
- [变更记录](CHANGELOG.md)

## 许可证与支持

MindFlow 基于 [MIT License](LICENSE) 发布。欢迎通过 [GitHub Issues](https://github.com/groele/mindflow/issues) 报告问题或提出建议。
