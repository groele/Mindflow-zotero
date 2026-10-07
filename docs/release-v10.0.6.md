# MindFlow for Zotero 10.0.6

## 修复范围 / Fixes

- 修复同一 `.mindflow` 附件发生嵌入 ID 冲突后，关闭并重新打开时重复生成冲突副本的问题。
- 为 WebDAV 请求增加完整超时、响应体大小上限和流式读取保护，并保留调用方主动取消信号。
- 防止 WebDAV 队列上传使用已被后续修改的凭据、目标路径或备份数据。
- 修复工作区恢复和导出期间的并发状态，避免旧编辑器内容覆盖已恢复内容。
- 增加原生 Zotero 导出、恢复、附件重开和 WebDAV 边界回归测试。

## 验证 / Validation

- Frontend data-chain: 33/33
- Logic: 25/25
- Host: 46/46
- Native Zotero: 40/40
- TypeScript typecheck and production build passed

向后兼容；无需迁移。安装包由当前 `manifest.json` 版本生成，并在发布前重新计算校验值。
