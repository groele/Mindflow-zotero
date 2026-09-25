# MindFlow for Zotero 插件开发与使用指南

MindFlow for Zotero 是将 MindFlow 现代思维导图与科研伴读扩展移植并深度适配到 **Zotero 7+**（支持 `strict_max_version: 10.0.*`）的原生客户端插件。

它让学者、研究生与科研人员能够在 Zotero 桌面端中，将文献题录、核心摘要、阅读高亮批注和笔记一键整理为结构清晰、色彩优雅的学术思维导图，并支持双向跳转与一键回存为 Zotero 笔记。

---

## 一、Zotero 7 插件架构解析

### 1. 架构变迁与现代化生态
- **引擎升级**：Zotero 7 基于 Firefox 115 ESR，彻底移除了旧版 XUL Overlays，转向 **Bootstrap 扩展模式**（通过 `bootstrap.js` 进行生命周期管理）+ **ESM (ECMAScript Modules)**。
- **清单声明 (`manifest.json`)**：采用类似 WebExtension 的 JSON 清单，通过 `applications.zotero` 声明插件 ID、最低和最高支持版本（如 `6.999` 到 `10.0.*`）。
- **生命周期机制 (`bootstrap.js`)**：
  - `startup()`：在 Zotero 初始化完毕后，通过 `amIAddonManagerStartup.registerChrome` 注册 `chrome://mindflow/content/` 路径映射与本地化语言包，并加载运行脚本。
  - `shutdown()`：在插件禁用、卸载或应用退出时，必须清理所有注入到 Zotero 界面上的 DOM 节点（菜单、按钮、分隔线），销毁 `chromeHandle` 并释放事件监听器，避免内存泄漏。

### 2. 界面注入与 API 交互 (`zotero/chrome/content/scripts/index.js`)
- **顶栏“工具”菜单 (`menu_ToolsPopup`)**：注入 `MindFlow 思维导图` 菜单项。
- **文献列表右键菜单 (`zotero-itemmenu`)**：注入 `在 MindFlow 中生成思维导图` 与 `添加到当前 MindFlow 导图`。
- **分类列表右键菜单 (`zotero-collectionmenu`)**：注入 `生成此分类思维导图`。
- **主工具栏 (`zotero-toolbar`)**：添加 MindFlow 图标快捷入口。
- **双向数据桥梁 (`src/services/zotero/zoteroBridge.ts`)**：
  - 当通过 `Services.ww.openWindow` 打开 MindFlow 导图工作区时，将 `Zotero` 实例与上下文参数通过 `window.arguments[0]` 传入。
  - 导图内可直接调用 `Zotero.getActiveZoteroPane().getSelectedItems()` 提取文献、作者、年份、刊物、DOI、摘要及 PDF 划线高亮。
  - 支持将导图大纲结构一键保存为 Zotero 富文本笔记（`new Zotero.Item('note')`）。

---

## 二、目录结构

```text
Mindmapext/
├── zotero/                               # Zotero 插件源码模板与清单
│   ├── manifest.json                     # Zotero 插件元数据与版本声明
│   ├── bootstrap.js                      # Zotero 7 启动与关闭生命周期控制
│   ├── prefs.js                          # 插件默认偏好设置
│   ├── chrome.manifest                   # Chrome 协议后备映射
│   ├── locale/                           # 多语言 Fluent 资源
│   │   ├── zh-CN/mindflow.ftl
│   │   └── en-US/mindflow.ftl
│   └── chrome/content/
│       ├── icons/                        # 16px、48px、128px 图标
│       └── scripts/
│           └── index.js                  # Zotero 原生 UI 注入与窗口管理脚本
├── src/
│   └── services/zotero/
│       └── zoteroBridge.ts               # React Web App 与 Zotero 核心通信桥
├── scripts/
│   ├── build-zotero.mjs                  # Node.js 构建编排脚本
│   └── build-zotero.ps1                  # PowerShell 高性能 POSIX 规范 XPI 打包脚本
├── dist-zotero/                          # 构建生成的已解压 Zotero 插件目录（可用于软链开发）
└── dist-zip/
    └── mindflow-zotero-1.0.0.xpi         # 最终可供一键安装的 Zotero 插件安装包
```

---

## 三、快速构建与打包

已在 `package.json` 中配置了一键打包脚本：

```bash
npm run build:zotero
```

### 构建步骤详解：
1. **编译前端应用**：执行 `tsc && vite build`，将 React 19 + TypeScript + TailwindCSS 编译为高性能静态资源；
2. **装配插件目录**：自动在 `dist-zotero/` 组织 `bootstrap.js`、`manifest.json`、`locale/`、`icons/` 及 `chrome/content/` 静态网页；
3. **语法安全校验**：自动运行 `node --check` 验证启动脚本语法正确性；
4. **生成标准 XPI 包**：自动处理 POSIX 正斜杠目录路径，生成 `dist-zip/mindflow-zotero-1.0.0.xpi` 并输出 SHA-256 校验和。

---

## 四、在 Zotero 7 中安装与体验

### 方式 1：直接通过 XPI 文件安装（最简方式）
1. 启动 **Zotero 7**；
2. 点击顶部菜单栏的 **“工具 (Tools)” → “附加组件 (Plugins / Add-ons)”**；
3. 点击附加组件管理器右上角的 **齿轮设置图标**；
4. 选择 **“Install Add-on From File...” (从本地文件安装附加组件)**；
5. 选择本项目下的 `dist-zip/mindflow-zotero-1.0.0.xpi`；
6. 确认安装后重启 Zotero 即可。

### 方式 2：开发者代理文件软链接调试（实时调试）
在 Zotero 的 Profiles 目录下创建开发指针文件，无需每次重新打包 XPI：
1. 打开 Zotero 数据目录下的 `profile/extensions/` 文件夹（通常在 `%APPDATA%\Zotero\Zotero\Profiles\<profile>\extensions\`）；
2. 新建一个无后缀的文本文件，文件名为插件 ID：`mindflow@groele.org`；
3. 文本内容填写解压后的绝对路径：
   ```text
   D:\Dev Studio\Mindmapext\dist-zotero
   ```
4. 每次运行 `npm run build:zotero` 更新后，在 Zotero 中按 `Ctrl+R` 或重启即可生效。

---

1. **原生主窗口选项卡（Native Tab 集成，非独立弹出窗口）**：
   - 深度集成到 Zotero 7 原生多标签页体系 (`Zotero_Tabs`)；
   - 点击主工具栏图标或菜单时，直接在 Zotero 主窗口中开辟 `[MindFlow 思维导图]` 标签页，并带有珊瑚粉专属图标徽标；
   - 支持智能标签页复用（单例激活，避免重复开辟）；
   - 支持全局快捷键 `Ctrl+Alt+M` (macOS 下为 `Cmd+Alt+M`) 随手唤出或切换至导图标签页。

2. **一键生成文献导图（多篇批量 + 动态计数）**：
   - 在 Zotero 中选中任意 1 篇或多篇论文；
   - 鼠标右键点击选中条目，菜单动态显示 **“在 MindFlow 中生成文献导图 (X 篇文献)”**；
   - 自动解析论文标题、年份、作者、发表刊物、DOI、核心摘要、标签及 PDF 阅读高亮批注！

3. **文献分类文件夹一键生成全库知识树**：
   - 在左侧分类文件夹（Collection）右键，选择 **“生成【分类名称】思维导图”**；
   - 自动以分类名称作为中心主题，将该分类下的全部文献系统化构建为知识脉络。

4. **双向无缝联动（文库精准定位 + 原生 PDF 阅读器直达）**：
   - 导图中文献节点右上角带有专属 🎓 学术标识，点击直接在 Zotero 文库中高亮定位对应文献；
   - 右键文献节点可选择 **“在 Zotero 文库中定位”** 或 **“打开 PDF 阅读器”**，瞬间直达 Zotero 7 内置 PDF 阅读批注界面；
   - 在右侧属性面板中，选中文献节点时提供快捷操作卡片（“文库定位” 与 “阅读 PDF”）。

5. **内嵌选项卡 vs 独立窗口自由切换（双端实时可设）**：
   - **内嵌选项卡（Native Tab，默认）**：直接嵌入在 Zotero 主界面顶部标签栏，与文库、PDF 标签并列切换，体验紧凑一体化；
   - **独立桌面窗口（Standalone Window）**：开辟独立浮动窗口，适合双屏/多显示器对照研读；
   - **随时切换**：在 MindFlow 工作区右上角“设置”弹窗中的【Zotero 伴读联动】标签，或在 Zotero 原生首选项中一键切换。

6. **Zotero 原生首选项面板（Preferences Pane 集成）**：
   - 深度集成到 Zotero 7 原生偏好设置体系（`Zotero.PreferencePanes.register`）；
   - 在 Zotero 菜单中点击 **“编辑” → “设置”**（或快捷键 `Ctrl+,`），即可在左侧导航看到专属 **MindFlow** 配置面板；
   - 可针对窗口展现模式、文献摘要提取、PDF 划线高亮批注提取、标签提取、默认导图布局与主题风格进行全局持久化配置。

7. **一键导出为 Zotero 永久笔记**：
   - 梳理完学术脉络后，点击顶部工具栏 **“Zotero → 存为 Zotero 大纲笔记”**；
   - 导图大纲将以格式优雅的富文本永久保存进您的 Zotero 文献库中。

8. **文献条目子附件归档与多端云同步（.mindflow 格式）**：
   - 点击顶部工具栏 **“Zotero → 存为文献条目附件 (.mindflow)”** 或使用快捷键 `Ctrl+S`；
   - 思维导图将作为对应文献条目的子附件直接保存在 Zotero 本地数据目录（`storage/<key>/<文献名>.mindflow`）；
   - **多端漫游**：自动享受 Zotero 原生 WebDAV / 官方云同步，跨设备无缝漫游；
   - **双击/右键直达**：在 Zotero 文献树中右键点击 `.mindflow` 附件，可直接选择 **“在 MindFlow 中打开此思维导图”**！

9. **自定义本地物理路径备份（双重安全防护）**：
   - 在 Zotero 首选项（MindFlow 插件设置页）中，可配置 **自定义本地保存路径**；
   - 支持调用操作系统原生文件夹选择器一键指定目录（如 `D:\Research\MindMaps\`）；
   - 保存时同步在外部磁盘中生成 `.mindflow` 实体文件，本地安全绝对掌控。

10. **独立窗口完整视窗控制与全屏沉浸**：
   - 独立窗口已完整支持操作系统标准控件：**最小化（`—`）**、**最大化/还原（`🗖`）** 与 **关闭（`✕`）**；
   - 支持 `F11` 沉浸式全屏研读切换与顶部全屏按钮；
   - 窗口标题与 Zotero 标签标题随当前思维导图名称实时动态同步。


