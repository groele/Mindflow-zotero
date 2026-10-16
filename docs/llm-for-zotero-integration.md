# llm-for-zotero 文章总结与思维导图集成

MindFlow 直接调用 `Zotero.LLMForZotero.api.agent.runTurn(request, onEvent, { signal })`，由 llm-for-zotero 完成模型认证、协议适配及请求。集成依据上游 3.9.11 的实际源码和已安装 XPI；MindFlow 不打包或复制上游模型请求实现。

- 上游仓库：https://github.com/yilewang/llm-for-zotero
- 公开调用接口：https://github.com/yilewang/llm-for-zotero/blob/main/src/agent/index.ts
- 模型配置格式：https://github.com/yilewang/llm-for-zotero/blob/main/src/utils/modelProviders.ts
- 推理参数格式：https://github.com/yilewang/llm-for-zotero/blob/main/src/shared/llm.ts

## 使用

1. 安装并启用 llm-for-zotero 3.9.11 或以上版本，在其设置中配置模型并测试连接。
2. 在 MindFlow 选择一篇文献，点击“AI 解析论文并生成导图”。
3. 选择仅摘要、仅引言、仅结论、摘要＋引言＋结论或全文；默认仅摘要。预览完成后选择分析框架、内容模板、模型、推理强度和快速/深入分析，再开始。
4. 检查可编辑草稿和原文片段，审阅后再归档至该文献。

模型菜单读取 llm-for-zotero 的 `modelProviderGroups`；初始优先选中其 `lastUsedModelEntryId` 对应的可用模型，若不可用则显示第一个可用模型供开始前确认。旧配置只有 `apiBase/apiKey/model` 时采用主模型。模型和推理选择仅影响本次调用，不写回上游默认模型，也不另设 MindFlow 供应商/API/密钥配置。

推理强度优先继承模型 `profileOverride.reasoning.options` 中启用的 ID 与名称，支持上游自定义选项。未显式配置能力列表时提供默认及通用强度请求；上游公开接口没有完整的每模型强度列表，因此通用选项不保证均被模型实际采用。MindFlow 只传递上游定义的 `reasoning: { provider, level }` 与原能力配置，参数映射由 llm-for-zotero 完成；显式禁用推理时关闭菜单。

## 分析框架、风格与读取范围

统一定义见 `chrome/content/research-templates.json`：实验研究、理论与计算、机理辨析、综述与对比四类框架。用户可选择不同内容模板、模型和推理强度；模板控制分段总结、结构验证和导图转换，并尽可能保留所选主题与布局。生成结果作为草稿供用户检查和编辑。

仅摘要优先使用条目摘要，已有摘要时跳过 PDF；字段为空时从 PDF 前 5 页范围内定位明确的摘要标记与结束边界，只发送摘要段，正文不纳入。摘要缺失、重复或没有可靠边界时显示“选择／补充摘要”：从本地前页文字中选取，或粘贴后确认；确认后的摘要可以勾选。未匹配本地原文的粘贴文字标为待核验，不能升级为论文证据。即使存在划线、评论，摘要恢复入口仍可用；也保留范围切换按钮，不用整页或全文替代。读取范围选择器固定在对话框上方，滚动后仍可操作。其他章节模式在本地提取 PDF 文字后按中英文标题定位，只发送选中部分。当前不宣称 PDFWorker 只读取了指定章节的文件字节。笔记、划线与评论默认不发送。读取范围独立于快速/深入分析。

## 数据与调用边界

- 准备阶段只读取本地资料，不调用模型。
- 预览和准备结果不携带上游 API 密钥。密钥仅在发起调用时读取并传给上游 API；不写入 MindFlow 设置、导图或 iframe 消息。
- 每次模型请求使用独立会话编号，不传用户聊天历史、当前条目对象或文献范围。摘要、PDF、笔记、划线和评论依照用户选择进入正文载荷。
- 提示词要求直接输出结构化 JSON。若上游报告额外工具调用或确认请求，立即中止并抛出异常，阻止扩大资料范围或自动创建 Zotero 笔记。
- llm-for-zotero 自身管理调用记录及运行事件；它可能在本地保存输入和结果。
- 模型、推理、模板、分析深度和资料选择各有独立缓存标识；读取范围变化重新准备资料。模型配置变化时须重新预览。
- 模板控制分段总结、结构验证和导图转换。匹配实际输入中的原文引文；模型来源字段缺失或无效时，仅允许长引文在已发送资料中的唯一逐字匹配恢复来源，并在备注注明。不能覆盖明确冲突的来源或 ID，不能把文字匹配当成解释正确的证明。
- 导图记录 `llmIntegration` 服务、公开 API、已完成调用数和运行 ID，以及模板版本、模型、请求强度与读取范围。AI 草稿先保存本机，不自动归档；生成后按实际布局适应画布。
- 取消和超时传递至上游 `AbortSignal`，并停止本次后续导图创建；服务可能已处理或计费已发送的请求。

## 当前支持范围

支持经公开 Agent API 调用的 API 模型及该接口可处理的 Copilot/Codex Direct 认证。WebChat、Codex App Server、Claude Code 对话系统暂不接入，菜单保留对应模型但标为暂不支持；若当前对话系统为 Claude Code，则提示切换。没有上游插件、接口未就绪或版本过旧时给出明确提示，不回退到 MindFlow 自建 HTTP 请求。

## 验证

运行 `node --test scripts/test-host.mjs`、`npm --prefix source test`、`node scripts/build-local.mjs` 验证宿主和前端。

`scripts/start-native-llm-test.ps1` 使用隔离 Zotero 数据目录，复制本机已安装的原版 llm-for-zotero XPI，并通过本机确定性模型端点验证真实上游 API、模型及推理参数、前端选择和导图保存。测试不读取或使用用户真实服务密钥，确定性响应不代表真实模型的总结质量或远端服务可用性。

本版的回归范围和结果以 [11.1.0 发布记录](release-v11.1.0.md)为准。上游接口与外部模型的可用性、费用及生成质量仍取决于用户选择的服务和输入资料。
