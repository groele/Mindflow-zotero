# MindFlow for Zotero — V10

MindFlow 为 Zotero 10 提供思维导图工作台、文献关联、`.mindflow` 子附件归档和结构化大纲。支持画布与大纲编辑、历史快照、文献批注导入，以及可选的 AI 研读和 WebDAV 备份。

当前插件版本为 **10.0.0**，支持 Zotero **10.0.x**。插件版本与 Zotero 版本分别管理。

## 安装

1. 从 [V10 Release](https://github.com/groele/Mindflow-zotero/releases/tag/v10.0.0) 下载 [`mindflow-zotero-10.0.0.xpi`](https://github.com/groele/Mindflow-zotero/releases/download/v10.0.0/mindflow-zotero-10.0.0.xpi)。
2. 在 Zotero 中打开“工具 → 插件”，点击齿轮，选择“从文件安装插件”。
3. 选择 XPI，安装后重启 Zotero。

升级前建议备份现有 Zotero 数据目录与导图。V10 使用原插件 ID `mindflow@groele.org`，可覆盖升级。自动更新元数据位于 [`zotero/update.json`](zotero/update.json)。

## V10 修复

- 严格区分文献库、文献条目、导图附件与工作区文档，修复选中 A 却打开 B、相同内部 ID 导致串图、同一文献多份导图误复用等问题。
- 前端切换后同步宿主的实际文档 ID 和附件来源，保护快速切换、标签与独立窗口、撤销关闭和会话恢复。
- 宿主统一处理保存、删除和归档；比较预期版本，阻止旧窗口覆盖新内容或复活已删除文档。冲突编辑保留为独立副本。
- 立即关闭、未提交节点文字和正常应用退出时捕获最新编辑；进程重启恢复实际持久内容。
- 校验文档结构、来源、快照归属和附件父条目；损坏记录隔离，匹配的有效备份可恢复；并发快照保留双方版本。
- 移除品牌图标旁的文字，保留图标提示和可访问名称；修复紧凑窗口工具栏重叠。
- 关于页、欢迎页、备份导出、插件清单和更新元数据统一为 `10.0.0`。

详细问题清单、数据链路和验证边界见 [文档索引](docs/README.md) 与 [V10 发布记录](docs/release-v10.md)。历史已错误关联的附件仍需人工核对归属。

## 构建与测试

前端源码在 `source/src`，Zotero 原生宿主在 `chrome/content/scripts`。使用 Node.js 22.12 或更新版本、Python 3 和 PowerShell 7；依赖按 lockfile 安装。

```powershell
npm ci --prefix source
node scripts/build-local.mjs
node --test scripts/test-host.mjs
& source/node_modules/.bin/vite-node.cmd source/tests/test-zotero.ts
python scripts/package-xpi.py
```

真实桌面测试需要 Windows 与 Zotero 10，默认路径为 `C:\Program Files\Zotero\zotero.exe`：

```powershell
pwsh -NoProfile -File scripts/start-native-test.ps1
# 等测试实例自行退出，检查 tests/current-native-test.json 所指目录中的结果后：
pwsh -NoProfile -File scripts/restart-native-test.ps1
```

测试从最终 XPI 提取生产代码，只在隔离测试配置中追加测试脚本加载。测试使用自己的配置、论文、附件和数据目录；测试脚本不会进入交付 XPI。原生测试数据位于 `tests/native-test-*`。

V10 验证：36 项宿主测试、24 项前端测试、23 项真实 Zotero 流程测试、3 项真实进程重启测试，共 **86 项通过**；另通过类型检查、生产构建、脚本语法与 XPI 内容核对。逐项证据见 [`docs/validation-summary.json`](docs/validation-summary.json)。

真实群组库权限与云端附件同步、外部 AI/WebDAV 账户、长期压力和断电恢复尚需实际环境验收。全工作区恢复按文档提交，不构成所有文件共同提交的事务。

## 数据与许可

本地工作区保存在 Zotero 数据目录的 `mindflow/workspace`；归档 `.mindflow` 是文献的子附件，与 PDF 平级。本地保存、附件归档和云端同步具有各自的结果状态。AI 与 WebDAV 需要用户自行配置服务。

采用 [MIT License](LICENSE)。
