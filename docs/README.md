# 审查与验证文档 / Audits and validation

[返回双语 README / Bilingual README](../README.md)

## 版本与证据 / Versions and evidence

| 阶段 / Stage | 状态 / Status | 说明 / Description |
| --- | --- | --- |
| 10.0.0 / V10 | 公开发布 / Public release | 已发布安装包与更新通道 / Published XPI and update feed |
| 10.0.1 | 本地验证，未发布 Release / Locally validated, no Release | 工具栏图标尺寸补丁 / Toolbar sizing patch |
| 5.0.1、5.0.2 | 历史审查 / Historical audits | 修复已纳入 V10 / Fixes incorporated into V10 |

## 中文索引

- [V10 发布记录](release-v10.md)：公开 10.0.0 的安装、修复范围与验证边界。
- [首轮审查与修复清单](审查与修复清单.md)：5.0.1 阶段的 42 项问题与改进。
- [全流程逻辑复审](全流程逻辑复审-5.0.2.md)：5.0.2 阶段新增的 28 项问题、身份链路与流程矩阵。
- [V10 验证汇总](validation-summary.json) 与 [安装包校验](package-verification.json)：公开 10.0.0 包的验证数据。
- [宿主结果](host-test-results.txt)、[前端结果](frontend-test-results.txt)、[真实桌面结果](native-regression-results.json)、[真实进程重启结果](native-restart-results.json)：V10 分层验证。
- [10.0.1 工具栏图标修复](toolbar-icon-fix-10.0.1.md)：本地补丁、[尺寸测量](toolbar-icon-metrics-10.0.1.json)与[真实截图](toolbar-icon-preview-10.0.1.png)。
- [10.0.1 验证汇总](toolbar-icon-validation-10.0.1.json)、[安装包校验](toolbar-icon-package-10.0.1.json)、[真实桌面结果](toolbar-icon-native-regression-results-10.0.1.json)、[重启结果](toolbar-icon-native-restart-results-10.0.1.json)：本地补丁证据。
- [5.0.1 原生基线](baseline-5.0.1-native-results.json)：立即关闭保存的历史失败证据。

历史审查中的版本、校验值和未发布说明属于对应阶段。当前公开安装资产以 [GitHub Releases](https://github.com/groele/Mindflow-zotero/releases) 为准；本地验证报告不表示已发布。

## English index

- [V10 release report](release-v10.md): installation, fixes, and validation boundaries for public 10.0.0.
- [Initial audit and repair checklist](审查与修复清单.md): 42 issues and improvements from the 5.0.1 stage.
- [Full workflow re-audit](全流程逻辑复审-5.0.2.md): 28 additional issues, identity chain, and workflow matrix from 5.0.2.
- [V10 validation summary](validation-summary.json) and [package verification](package-verification.json): public 10.0.0 package evidence.
- [Host tests](host-test-results.txt), [frontend tests](frontend-test-results.txt), [native workflows](native-regression-results.json), and [process restart](native-restart-results.json): V10 validation by layer.
- [10.0.1 toolbar fix](toolbar-icon-fix-10.0.1.md): local patch, [native measurements](toolbar-icon-metrics-10.0.1.json), and [screenshot](toolbar-icon-preview-10.0.1.png).
- [10.0.1 validation summary](toolbar-icon-validation-10.0.1.json), [package verification](toolbar-icon-package-10.0.1.json), [native workflows](toolbar-icon-native-regression-results-10.0.1.json), and [restart results](toolbar-icon-native-restart-results-10.0.1.json): local patch evidence.
- [5.0.1 native baseline](baseline-5.0.1-native-results.json): historical failure evidence for immediate-close saving.

Detailed audit reports are currently in Chinese. Historical versions, hashes, and unpublished status refer to their respective stages. Use [GitHub Releases](https://github.com/groele/Mindflow-zotero/releases) to identify public installation assets; a local validation report does not imply publication.
