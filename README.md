# Zotero MindFlow


**Zotero Flow Series · 知识组织**

*让研究的每一步衔接起来。 / Connect each step of research.*

将文献、批注与思路组织为可编辑导图。

[简体中文](README.md) · [English](README.en.md)

[![当前版本](https://img.shields.io/badge/version-12.5.1-245ac7?style=flat-square)](https://github.com/groele/Zotero-MindFlow/releases/tag/v12.5.1) · [下载 XPI](https://github.com/groele/Zotero-MindFlow/releases/download/v12.5.1/zotero-mindflow-12.5.1.xpi) · [问题反馈](https://github.com/groele/Zotero-MindFlow/issues)

[产品定位](#overview) · [安装与更新](#installation) · [快速开始](#quick-start) · [核心功能](#features) · [设置与使用](#settings) · [数据、同步与外部服务](#data) · [兼容性与验证范围](#compatibility) · [常见问题](#troubleshooting) · [开发与详细文档](#development) · [系列产品](#series) · [项目来源与许可](#license)

<a id="overview"></a>

## 产品定位

面向论文研读和知识整理，在 Zotero 内用画布与大纲组织文献材料、节点和任务，并按需使用 AI 生成研读草稿。

本插件可以独立安装，按需与系列其他插件组合使用。

<a id="installation"></a>

## 安装与更新

1. 下载 [zotero-mindflow-12.5.1.xpi](https://github.com/groele/Zotero-MindFlow/releases/download/v12.5.1/zotero-mindflow-12.5.1.xpi)（插件版本 **12.5.1**），不要安装 Source code ZIP。
2. 在 Zotero 打开 **工具 → 插件／附加组件**，从齿轮菜单选择 **从文件安装插件**。
3. 选择 XPI，完成安装；按提示重启 Zotero。

后续可在插件管理器中检查更新。自动检查／安装取决于 Zotero 与该插件的更新设置和兼容范围。升级或迁移前备份重要数据。

更新清单: [zotero/update.json](https://github.com/groele/Zotero-MindFlow/blob/main/zotero/update.json) · 插件 ID: `mindflow@groele.org`.

<a id="quick-start"></a>

## 快速开始

1. 选择文献，从工具栏、工具菜单或文献侧栏打开或创建导图。
2. 核对当前文献与导图，再导入摘要、笔记或 PDF 批注。
3. 编辑并保存；需要 Zotero 附件时执行归档，再检查保存结果。

<a id="features"></a>

## 核心功能

| 功能 | 使用范围 |
|---|---|
| 画布与大纲 | 编辑节点、层级、关系线、图片、备注和任务。 |
| 文献材料 | 导入元数据、摘要、笔记与 PDF 批注，建立文献关联。 |
| 归档与恢复 | 本地工作区、导图附件归档和历史快照各自提供状态。 |
| 可选 AI | 调用 llm-for-zotero 已配置模型生成可编辑研读草稿。 |

<a id="settings"></a>

## 设置与使用

在 **Zotero → 设置 → Zotero MindFlow** 中查看插件偏好页。

设置打开方式、欢迎页、材料导入、自动大纲笔记和工作台入口；多个附件或窗口时，核对文献库、附件与当前导图。

<a id="data"></a>

## 数据、同步与外部服务

- 本地工作区位于 Zotero 数据目录的 mindflow/workspace；本地保存成功不等于已归档为 .mindflow 附件。
- 附件同步依赖 Zotero 的文件同步；WebDAV 工作区备份不包含完整 Zotero 数据库与所有 PDF。
- AI 会向所选模型服务提交本次材料；输出需要对照原文核验。

<a id="compatibility"></a>

## 兼容性与验证范围

| 项目 | 范围 |
|---|---|
| 当前插件版本 | 12.5.1 |
| 清单声明的 Zotero 范围 | `10.0` 至 `10.0.*` |
| 当前说明 | 当前清单限定 Zotero 10.0.x。12.3.4 设置页已在 Windows Zotero 10.0.6 原生检查（含同窗连续切换与 MetaFlow 卡片配色对照）；本轮未重跑真实 AI、WebDAV 或跨设备协作。 |

插件版本与 Zotero 版本分别管理。清单允许安装，不代表所有版本、操作系统和外部服务均已验证。本次品牌文档更新未重新执行业务功能测试。

<a id="troubleshooting"></a>

## 常见问题

保存后没有附件时，查看“本地保存”和“附件归档”各自状态；打开错图时记录选择的条目、附件、多图选择框与窗口切换顺序。

反馈时提供插件与 Zotero 版本、系统、操作步骤、预期／实际结果和脱敏错误。

<a id="development"></a>

## 开发与详细文档

普通安装无需开发环境。以下为仓库已有开发入口，涉及原生测试时使用独立配置。

```powershell
npm ci --prefix source
node scripts/build-local.mjs
node --test scripts/test-host.mjs
python scripts/package-xpi.py
```

- [审查文档索引 / Audit documentation](docs/README.md)
- [版本说明 / Release notes](docs/releases/v12.5.1.md)
- [产品简介 / Product profile](docs/brand/PRODUCT.md)
- [品牌规范 / Brand guide](docs/brand/BRAND.md)
- [README 模板 / README template](docs/brand/README-TEMPLATE.md)
- [后续提升清单 / Improvement priorities](docs/brand/IMPROVEMENTS.md)
- [原详细指南 · README.md](docs/reference/README.md)

原详细指南保留功能细节、快捷键、历史验证与完整致谢；其中版本和测试结果属于各自记录时间。

<a id="series"></a>

## 系列产品

| 产品 | 定位 |
|---|---|
| [Zotero RefFlow](https://github.com/groele/Zotero-RefFlow) | 文献发现 · 检索参考文献、被引文献与相关研究。 |
| [Zotero MetaFlow](https://github.com/groele/Zotero-MetaFlow) | 元数据整理 · 校验、规范并补全文献元数据。 |
| [Zotero ViewFlow](https://github.com/groele/Zotero-ViewFlow) | 阅读预览 · 在 Zotero 侧栏预览并复制格式化引文。 |
| [Zotero MindFlow](https://github.com/groele/Zotero-MindFlow) | 知识组织 · 将文献、批注与思路组织为可编辑导图。 |
| [Zotero TaskFlow](https://github.com/groele/Zotero-TaskFlow) | 任务推进 · 将文献研读转化为可追踪的任务与计划。 |
| [Zotero CiteFlow](https://github.com/groele/Zotero-CiteFlow) | 写作引用 · 追踪 Word 文档引用，并连接 Zotero 文献操作。 |
| [Zotero PaperFlow](https://github.com/groele/Zotero-PaperFlow) | 投稿审稿 · 管理手稿、投稿轮次与审稿回复。 |

各插件分别安装和更新；同属一个系列不意味着共享数据库或已自动联通所有流程。

<a id="license"></a>

## 项目来源与许可

项目代码按 MIT 许可发布；论文、图片、第三方依赖与外部模型服务遵循各自权利与条款。

许可: [MIT](LICENSE).

本系列独立维护，并非 Zotero 官方产品。Zotero 及第三方名称、商标与材料归各自权利人所有。
