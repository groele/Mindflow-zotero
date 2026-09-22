# 🔒 MindFlow 隐私权政策 (Privacy Policy)

**生效日期**：2026 年 9 月 22 日  
**适用范围**：MindFlow Chrome 扩展程序及相关软件服务

MindFlow 团队（以下简称“我们”）高度重视用户的个人隐私与数据安全。本隐私权政策严格遵循 **Google Chrome Web Store 开发者计划政策** 与 **欧盟通用数据保护条例 (GDPR)** 原则，阐述我们在您使用 MindFlow 时的数据处理实践。

---

## 1. 核心准则：100% 离线优先与零追踪 (Zero-Telemetry)
- **本地化存储**：您的所有思维导图、结构大纲、收集箱灵感笔记、标签及版本快照数据 **仅存储在您本地计算机的 Chrome 浏览器本地沙箱 (`chrome.storage.local`) 中**。
- **无数据回传**：我们不在扩展中植入任何统计打点、第三方跟踪探针（如 Google Analytics、Mixpanel 等）或广告营销 SDK。
- **无远程托管**：MindFlow 不维护任何中心化用户数据库，无需注册账号即可完整使用全部作图与导出功能。

---

## 2. 权限使用说明及合规解释

MindFlow 仅申请提供核心功能所必需的最少权限：

| 权限声明 (Permission) | 使用目的与合规解释 |
| :--- | :--- |
| `storage` | 用于在用户本地浏览器安全存储导图工程、离线快照、主题配置与偏好设置。 |
| `sidePanel` | 用于在 Chrome 浏览器侧边栏渲染伴读大纲与极简导图画布，实现边看网页边做笔记。 |
| `contextMenus` | 用于在网页右键菜单中提供「📌 摘录到思维导图」功能，方便用户捕获灵感。 |
| `tabs` / `activeTab` | 仅在用户主动点击「提取网页卡片」时，获取当前活动标签页的 Title 和 URL 生成导图节点，不读取网页历史。 |
| `host_permissions` | 仅用于用户**主动配置** WebDAV 云同步时，直接向用户指定的 WebDAV 服务器（如坚果云、Nextcloud、群晖 NAS）发起备份上传与拉取，绝不与任何第三方服务器发生通信。 |

---

## 3. WebDAV 凭据与商业 License 授权安全
- **WebDAV 认证安全**：您的 WebDAV 服务器地址、用户名及应用密码经过本地安全编码后存储于本地 Chrome Storage，**点对点直连您的私有网盘**，绝无任何中间服务器中转。
- **License 校验离线化**：MindFlow Pro 激活码基于高强度非对称算法在本地设备离线校验，无需联网激活，充分保护企业与个人数据主权。

---

## 4. 数据控制与导出权利
- 您对在 MindFlow 中创建的所有知识资产拥有完整的所有权与控制权。
- 您可以随时随地通过「导出」功能将数据导出为高清 PNG、矢量 SVG、Markdown 大纲或 JSON 全量备份。
- 您可以在「设置 > 恢复出厂设置」或卸载扩展程序时，随时彻底清除本地存储的所有相关数据。

---

## 5. 联系与支持
如果您对本隐私政策有任何疑问、意见或建议，请通过 GitHub 仓库 Issues 与我们联系：  
👉 [https://github.com/groele/mindflow/issues](https://github.com/groele/mindflow/issues)
