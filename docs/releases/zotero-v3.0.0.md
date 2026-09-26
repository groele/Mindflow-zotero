# MindFlow for Zotero 10 v3.0.0 (V3.0 跨越式重大升级)

MindFlow **v3.0.0** 是 MindFlow 发展史上的里程碑跨越式大版本！本版本重点重构并深度融合了现代科研大模型接入架构（全面吸纳 `llm-for-zotero` 优秀网络与模型接入策略），并带来了桌面级的右键多维交互体验，彻底解决了高校网络/复杂代理下的大模型联机与菜单交互问题。

---

## 🌟 V3.0.0 核心更新亮点

### 1. 深度融合的大模型接入架构（Dual-Engine AI Transport Architecture）
- **原生宿主级双引擎通信**：
  - 学习并整合 `llm-for-zotero` 的网络传输架构，使用宿主级现代原生 `fetch` 结合 `AbortController` 替代传统 XPCOM 传输；
  - 开启 `redirect: 'follow'` 并支持带凭证透明重定向，完美兼容高校校内 AI 平台（如中南大学 `https://api.chat.csu.edu.cn/v1`）、企业网关及反向代理；
  - 针对校园网内网域名进行智能识别，网络超时或断连时自动输出高校 WebVPN / EasyConnect 连接诊断建议。
- **零冲突探活载荷与推理模型自适应**：
  - 探活测试请求全面剥离 `temperature` 参数，彻底杜绝 `o1`、`o3`、`deepseek-reasoner` 等模型报 `HTTP 400 Unsupported parameter: 'temperature'`；
  - 支持 `max_tokens` 与 `max_completion_tokens` 参数自愈降级，遭遇参数冲突时自动重试；
  - 智能 404 路由回退，自动在 `/v1/chat/completions` 与 `/chat/completions` 之间探测可用端点。
- **内嵌式即时诊断卡片（Inline Diagnostic Card）**：
  - 设置面板中点击 `[测试 AI 连接]` 时，即时抓取当前输入框文本并同步写库，无需额外失焦或保存；
  - 按钮下方实时渲染内嵌诊断卡片，呈现旋转加载动效、毫秒级响应耗时（`latencyMs`）、HTTP 状态徽章、最终请求完整路径与模型文本返回预览。

### 2. 桌面级右键交互系统升级（Desktop-Grade Context Menu System）
- **彻底修复节点右键菜单被秒关 Bug**：
  - 针对 Zotero Gecko 内核下的鼠标事件序列进行了深度重构，在 `ContextMenu` 中隔离 `e.button === 2` 右键事件并延后单帧挂载关闭监听，彻底解决右键点击弹不出菜单的问题。
- **全新画布空白区域右键菜单（CanvasContextMenu）**：
  - 在画布任意空白区域单机右键，即可快速呼出画布导航面板：
    - 🔍 **居中对齐全部主题** (`Space`)
    - 🔄 **100% 原始缩放** (`Ctrl+0`)
    - 📐 **自适应全图视野**
    - ➕ **快速添加中心分支**
    - 📋 **粘贴分支到中心**
    - 🎨 **点阵 / 网格 / 空白背景一键切换**
    - 🌓 **深色 / 浅色模式极速切换**

### 3. 学术科研流纯化与细节打磨
- 彻底移除任务待办（Todo）状态模块，界面纯粹聚焦学术文献研读与思维大纲组织；
- 完善 PDF 阅读器调用逻辑，支持 `Zotero.Reader.open` 附件 ID 兼容传入与定位；
- 工具栏各功能图标采用 16px 视觉光学平衡标准与透明底板，高分屏下更加精致利落。

---

## 📦 安装与升级指南

1. 从 GitHub Release 下载 `mindflow-zotero-3.0.0.xpi`；
2. 打开 Zotero 10 客户端，点击菜单栏 `工具 (Tools)` → `附加组件 (Add-ons)`；
3. 点击右上角齿轮图标 ⚙️，选择 `Install Add-on From File...`；
4. 选中已下载的 `mindflow-zotero-3.0.0.xpi` 并确认安装；
5. 重启 Zotero 即可开启全新 V3.0.0 科研导图之旅！
