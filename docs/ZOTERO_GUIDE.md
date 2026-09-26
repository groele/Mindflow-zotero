# MindFlow for Zotero 10：使用与开发指南

本指南对应 Zotero 插件 v1.6.9。面向用户的完整功能与安装说明先看[项目 README](../README.md)。插件清单目前限定 Zotero 10.0.x。

## 安装和升级

从 [GitHub Releases](https://github.com/groele/Mindflow-zotero/releases) 下载 mindflow-zotero-1.6.9.xpi；若尚未发布，可使用本地 `dist-zip` 的同名构建包。在 Zotero 中打开“工具 → 插件”，将 XPI 拖入插件窗口安装；若提示则重启。升级前建议导出重要导图的工作区备份，并确认文献下的 .mindflow 附件已同步。

插件 ID 为 mindflow@groele.org。版本由 zotero/manifest.json 声明；zotero/update.json 指向同版本的 GitHub Release XPI。

## 入口与数据流

1. Zotero 文献、分类或 PDF 阅读器触发原生入口。
2. zotero/chrome/content/scripts/index.js 读取条目、打开附件，并管理导图窗口。
3. src/services/zotero/zoteroBridge.ts 将 Zotero 文献与批注转换为导图节点，处理定位、PDF 打开和归档请求。
4. src/pages/app/App.tsx 负责工作台编辑、本机保存和归档状态。
5. 关联文献的导图可保存为 .mindflow 子附件，并可更新结构化大纲子笔记。

zotero/bootstrap.js 管理插件启动、资源注册和关闭清理。导图正文通过 Zotero 宿主写到数据目录的 `mindflow/workspace/mindflow_doc_<导图 ID>.json`，写入后读取校验；旧首选项中的导图可读取并在下次保存时迁移。设置和快照仍使用本机首选项。文献库跨设备同步的对象是条目下的附件和笔记，而非本机工作区文件。

每次覆盖工作区文件时，程序先写临时文件再替换，并保留上一版 `.json.bak`。如文献下没有 `.mindflow` 附件，先在工作台查看该导图的保存状态；本地文件存在不代表附件已归档。可以在 Zotero 设置中定位数据目录，在 `mindflow/workspace` 找到源 JSON；不要直接改写这些运行中的文件。若工作台仍能打开导图，返回 Zotero 仅选中目标文献，再用工作台 Zotero 菜单中的“存为文献条目附件 (.mindflow)”重试。若工作台无法打开，可先复制对应 `.json` 或 `.json.bak` 到其他位置（后者改名为 `.json`），再使用工作台“导入外部文件”恢复为新导图。

## 文献导入

入口接受常规文献条目及其子附件、子笔记；子项先解析到父文献。独立笔记或没有常规文献父项的附件不会被伪装成文献。单篇、多篇和分类入口会保留原文献链接。

在“编辑 → 设置 → MindFlow”可调整摘要、标签、PDF 批注和文献笔记的导入。批注和笔记正文保留在节点内容中；批注链接可尝试返回原 PDF 页与标注。Zotero 内置阅读器的标注存于 Zotero 数据库，详见[官方说明](https://www.zotero.org/support/kb/annotations_in_database)。

同一文献可保存多份导图；右键菜单会列出已有的 .mindflow 附件。插件使用 Zotero 条目详情侧栏扩展接口，选中文献时还可在 MindFlow 导图区直接打开已有导图或新建；条目附件变化后会刷新列表。若只有云端附件记录、本机尚未下载文件，先通过 Zotero 下载；插件不会因读取失败自动创建另一份。

分类导图及多篇文献专题导图没有唯一的父文献，不会挂到第一篇文献下。新建后会归档到个人库的 `MindFlow｜独立导图` 集合中，以 `MindFlow 独立导图` 容器条目下的 `.mindflow` 子附件保存。未选中文献时创建的空白及模板导图也归档到这里；只选中一篇文献时，新导图作为该文献的子附件。打开已有独立导图后继续保存，会更新原位置；若归档失败，本机工作区仍保留导图并显示失败原因。

如果旧版本将导图留在独立导图位置，可先打开该导图，再在 Zotero 文献列表选中目标文献，返回工作区的 Zotero 菜单点击“存为文献条目附件 (.mindflow)”。确认目标文献下出现新的 `.mindflow` 子附件后，再自行整理独立位置的旧附件；插件不会自动删除旧副本。

## 附件、笔记与权限

归档时，宿主脚本将导图 JSON 作为 .mindflow 子附件导入 Zotero。它会尝试按导图 ID 找到并更新已有附件；若更新不可用，可能创建新附件。归档完成前还会检查父子关系、Zotero 附件文件及本次内容。可选的大纲子笔记按导图 ID 关联并更新。

“归档导图附件时更新结构化大纲子笔记”只控制笔记。文献附件能否写入取决于所属库权限；只读群组库或禁止上传附件的群组库会返回失败原因。本机工作区保存成功，不等于 Zotero 附件或跨设备同步已经成功。

Zotero 的数据同步、附件文件同步与 MindFlow 的工作区 WebDAV 备份是三个不同过程。Zotero 官方[同步文档](https://www.zotero.org/support/sync)说明：WebDAV 可用于个人库文件，群组库附件需要 Zotero Storage。MindFlow 的 WebDAV 面板只上传工作区备份。

## AI 论文解析

在单篇文献右键菜单或工作台 Zotero 菜单启动。宿主脚本先在本机准备题录、摘要、笔记、批注和 PDF 文字，并在工作台展示资料范围；只有用户点击“开始分析”后才调用模型。PDF 文字使用 Zotero 的 PDFWorker 提取，页数上限可设为 50、120 或 200 页，默认 120 页。超过约 144,000 字符时从不同位置采样。快速模式一次发送跨区间节选；深入模式分段分析较长 PDF 再整合。模型返回的短引文须在对应输入来源中匹配，才能标为“原文支持”；其余内容标为推断或待核验。

AI 密钥使用单独的本机 Zotero 首选项，不进入工作区备份。连接测试只发送短文本；论文资料须经过范围预览和“开始分析”操作才发送。请求禁用 Zotero 浏览会话 Cookie 和请求体调试输出，支持取消当前 HTTP 请求；默认不对模型失败请求自动重试。生成结果先保存在本机草稿，用户在画布审阅编辑并明确归档后才成为文献子附件；归档失败时保留本机草稿。完整使用说明见 [AI 研究导图](AI_RESEARCH_MAP.md)。

## 设置面板

zotero/chrome/content/preferences.xhtml 是 Zotero 注册的设置页；对应的 zotero/chrome/content/scripts/preferences.js 生成字段并保存配置。工作台 SettingsService 与原生面板共享 mindflow.mindflow_app_settings 首选项。宿主逻辑仍使用的旧 extensions.mindflow.* 键也会同步更新，例如窗口模式。

面板包含文献导入、AI 论文研究导图、工作台与工具栏、导图编辑、本地快照、WebDAV 六组配置。已打开的工作台会接收设置变更。工作区导出和恢复、WebDAV 连接测试是一次性操作，仍在工作台中执行。

## 构建和发布

需要 Node.js、npm 和 PowerShell 7。在项目根目录运行：

    npm ci
    npm run build:zotero

构建脚本检查 TypeScript，生成 Zotero 用 IIFE 前端资源，检查宿主脚本语法，然后打包 dist-zip/mindflow-zotero-1.6.9.xpi。版本号取自 zotero/manifest.json。dist-zotero 和 dist-zip 是生成目录，不进入源码提交。

本仓库另有 Chrome 扩展构建，版本为 3.2.1。Zotero 的 v1.6.9 与 Chrome 的 v3.2.1 属于两条版本线。发布时核对 Zotero 清单、更新清单、XPI 文件名、标签和 Release 资产的版本一致。

## 排查顺序

1. 确认 Zotero 版本在清单范围内，插件已启用，并重启过 Zotero。
2. 若入口不出现，确认选中的是常规文献或有父文献的子附件，而非独立笔记。
3. 若导图打不开，确认 .mindflow 附件文件已下载到本机。
4. 若归档失败，查看工作台保存状态，以及文献库和附件写入权限。
5. 若设置未立即更新工作台，切回导图窗口或标签页；仍有问题时重新打开并查看 Zotero 错误日志。

提交问题请附复现步骤与版本信息，避免上传私人文献、笔记或 WebDAV 密码。
