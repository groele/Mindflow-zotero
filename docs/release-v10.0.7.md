# MindFlow for Zotero 10.0.7

## 修复 / Fixes

- WebDAV 目标路径现在限制在配置的 HTTPS 服务器目录内，拒绝 `..`、编码路径分隔符以及查询参数。
- 多级备份目录按父目录到子目录的顺序创建；超出 20 MB 的备份在任何远端请求前被拒绝。
- 云端历史版本列表与上传、恢复使用同一操作锁；列表更新后清除已失效的版本选择。
- WebDAV 请求完成后清理主动取消监听器。
- 移除没有运行入口的旧备份、收集箱、提纲、文档管理、许可和任务汇总模块。

## 验证 / Validation

- Frontend data-chain: 33/33
- Logic: 28/28
- Host: 46/46
- Native Zotero regression: 40/40 in an isolated profile
- TypeScript typecheck and production build passed

向后兼容；无需数据迁移。安装包 SHA256 与 [包校验记录](package-verification.json)一致。尚未使用真实 WebDAV 账户验证各服务端行为。
