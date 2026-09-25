# MindFlow for Zotero v1.3.0

面向 **Zotero 10.0.x**。请从本页 Assets 下载 **mindflow-zotero-1.3.0.xpi**，在 Zotero 的“工具 → 插件”窗口安装或升级。

## 新功能：AI 论文研究导图

- 在文献列表选择一篇论文后，右键点击 **AI 解析论文并生成研究导图**；MindFlow 工作台 Zotero 菜单也提供同一入口。
- 研究导图按问题、目标、体系、方法、关键证据、解决的问题、意义与局限展开，并区分原文支持、推断和待解决问题。
- 插件先读取本机可用的题录、摘要、笔记、批注和 PDF 文字节选，再调用用户自行配置的兼容 Chat Completions 服务。API 密钥不写入导图或工作区备份。
- AI 结果保存为独立导图；若文献库允许附件写入，会尝试归档为该文献下的 `.mindflow` 附件。

## 使用前须知

在 **编辑 → 设置 → MindFlow → AI 论文研究导图** 配置接口地址、模型和密钥。点击生成时，论文资料会发送到所配置的服务；请自行确认其隐私和费用规则。PDF 最多取前 50 页，超长文字会截断，扫描件或未下载的附件可能无法提供全文。原文短引文匹配不等于科学结论已获验证，生成内容应与论文核对。

本版完成源码类型检查、宿主脚本语法检查与 XPI 构建；尚未在 Zotero 10 桌面端使用真实模型账户完成端到端验证。详情见 [README](https://github.com/groele/Mindflow-zotero/blob/main/README.md) 和 [AI 使用说明](https://github.com/groele/Mindflow-zotero/blob/main/docs/AI_RESEARCH_MAP.md)。
