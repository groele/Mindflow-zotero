# MindFlow for Zotero v1.2.0

面向 **Zotero 10.0.x**。请从本页 Assets 下载 **mindflow-zotero-1.2.0.xpi**，在 Zotero 的“工具 → 插件”窗口安装或升级。

## 本版改进

- 在 Zotero 文献条目详情侧栏加入 **MindFlow 导图** 区域，查看、打开已有导图，或为当前文献新建导图。附件变化后列表会刷新。
- 补齐侧栏的中英文文案、只读文献库提示和插件停用时的清理。
- 分类和多篇文献专题导图不再自动归档到第一篇文献；手动归档须明确选中唯一目标文献。
- `.mindflow` 附件的双击入口仅作用于文献列表，减少与 Zotero 其他区域的交互冲突。
- 打开附件时先检查基本导图结构，损坏文件会给出错误提示。

## 数据位置

单篇文献导图仍可归档为该文献的 `.mindflow` 子附件和可选大纲子笔记。分类和多篇文献导图先保存在本机工作区；跨设备使用时请导出工作区备份，或选择一篇文献手动归档。Zotero 的附件同步与 MindFlow 的 WebDAV 工作区备份是两套独立机制。

## 兼容与验证

- 插件 ID：`mindflow@groele.org`；兼容范围：Zotero 10.0.x。
- 仓库内 Chrome 扩展仍为 3.2.0，本页 XPI 是 Zotero 插件。
- 已完成 XPI 构建、TypeScript 检查、宿主脚本语法检查和包内容核对。尚未在 Zotero 10 图形界面完成新 XPI 的安装与完整交互验证。

详细使用方法见 [README](https://github.com/groele/Mindflow-zotero/blob/main/README.md)。
