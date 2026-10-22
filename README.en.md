# Zotero MindFlow


**Zotero Flow Series · Knowledge**

*让研究的每一步衔接起来。 / Connect each step of research.*

Organize papers, annotations, and ideas into editable maps.

[简体中文](README.md) · [English](README.en.md)

[![Release](https://img.shields.io/badge/version-12.5.2-245ac7?style=flat-square)](https://github.com/groele/Zotero-MindFlow/releases/tag/v12.5.2) · [Download XPI](https://github.com/groele/Zotero-MindFlow/releases/download/v12.5.2/zotero-mindflow-12.5.2.xpi) · [Report an issue](https://github.com/groele/Zotero-MindFlow/issues)

[Overview](#overview) · [Installation and updates](#installation) · [Quick start](#quick-start) · [Key features](#features) · [Settings](#settings) · [Data, sync, and services](#data) · [Compatibility and validation](#compatibility) · [Troubleshooting](#troubleshooting) · [Development and documentation](#development) · [The Flow series](#series) · [Origin and license](#license)

<a id="overview"></a>

## Overview

For paper reading and knowledge organization: arrange literature, nodes, and tasks using a canvas and outline in Zotero, with optional AI-generated reading drafts.

Install this add-on independently and combine it with other Flow products as needed.

<a id="installation"></a>

## Installation and updates

1. Download [zotero-mindflow-12.5.2.xpi](https://github.com/groele/Zotero-MindFlow/releases/download/v12.5.2/zotero-mindflow-12.5.2.xpi) (add-on version **12.5.2**), not the Source code ZIP.
2. In Zotero, open **Tools → Plugins/Add-ons**, then choose **Install Add-on From File** from the gear menu.
3. Select the XPI, complete installation, and restart if requested.

Use the add-on manager to check for later updates. Automatic checking/installation depends on Zotero, per-add-on update settings, and compatibility. Back up important data before upgrades or migration.

Update feed: [zotero/update.json](https://github.com/groele/Zotero-MindFlow/blob/main/zotero/update.json) · Add-on ID: `mindflow@groele.org`.

<a id="quick-start"></a>

## Quick start

1. Select a paper and open or create a map using the toolbar, Tools menu, or item pane.
2. Check the active paper and map before importing abstracts, notes, or annotations.
3. Edit and save; archive when a Zotero attachment is needed, then inspect the result.

<a id="features"></a>

## Key features

| Feature | Scope |
|---|---|
| Canvas and outline | Edit nodes, hierarchy, relationships, images, notes, and tasks. |
| Literature materials | Bring in metadata, abstracts, notes, and PDF annotations with literature associations. |
| Archiving and recovery | Use local workspace saving, map attachment archiving, and history snapshots with separate status. |
| Optional AI | Use a model configured in llm-for-zotero to generate editable reading drafts. |

<a id="settings"></a>

## Settings

Open the add-on preference page in **Zotero → Settings → Zotero MindFlow**.

Configure window mode, welcome page, material imports, outline notes, and workspace entry points. With multiple attachments or windows, check the library, attachment, and active map.

<a id="data"></a>

## Data, sync, and services

- The local workspace is under mindflow/workspace in Zotero’s data directory. Local save success does not establish .mindflow attachment archiving.
- Attachment synchronization depends on Zotero file sync; WebDAV workspace backup is not a complete Zotero database/PDF backup.
- AI submits selected material to the configured model service; verify generated output against the paper.

<a id="compatibility"></a>

## Compatibility and validation

| Item | Scope |
|---|---|
| Current add-on version | 12.5.2 |
| Declared Zotero range | `10.0` through `10.0.*` |
| Evidence boundary | The current manifest limits support to Zotero 10.0.x. The 12.3.4 settings pane was checked in Windows Zotero 10.0.6, including sequential navigation and MetaFlow card palette comparison; live AI, WebDAV, and cross-device workflows were not rerun. |

Add-on and Zotero versions are separate. Manifest compatibility does not establish testing on every host, operating system, or service. Version 12.5.2 passed type checks, production build, frontend regressions and browser recovery checks. Native Zotero installation was not rerun; 13 existing host-regression failures remain, as documented in the release notes.

<a id="troubleshooting"></a>

## Troubleshooting

If no attachment appears after saving, inspect local-save and attachment-archive status separately. For an incorrect map, record item/attachment selection, the map chooser, and window switching.

For an issue, include add-on/Zotero versions, OS, steps, expected/actual results, and sanitized errors.

<a id="development"></a>

## Development and documentation

Normal installation needs no development environment. Existing developer entry points follow; use an isolated profile for native tests.

```powershell
npm ci --prefix source
node scripts/build-local.mjs
node --test scripts/test-host.mjs
python scripts/package-xpi.py
```

- [审查文档索引 / Audit documentation](docs/README.md)
- [版本说明 / Release notes](docs/release-v12.5.2.md)
- [产品简介 / Product profile](docs/brand/PRODUCT.md)
- [品牌规范 / Brand guide](docs/brand/BRAND.md)
- [README 模板 / README template](docs/brand/README-TEMPLATE.md)
- [后续提升清单 / Improvement priorities](docs/brand/IMPROVEMENTS.md)
- [Previous detailed guide · README.md](docs/reference/README.md)

Previous detailed guides retain feature detail, shortcuts, historical evidence, and full attribution. Their versions and test results belong to the recorded stage.

<a id="series"></a>

## The Flow series

| Product | Role |
|---|---|
| [Zotero RefFlow](https://github.com/groele/Zotero-RefFlow) | Discovery · Discover references, citing works, and related research. |
| [Zotero MetaFlow](https://github.com/groele/Zotero-MetaFlow) | Metadata · Validate, normalize, and enrich reference metadata. |
| [Zotero ViewFlow](https://github.com/groele/Zotero-ViewFlow) | Preview · Preview and copy formatted references in Zotero’s item pane. |
| [Zotero MindFlow](https://github.com/groele/Zotero-MindFlow) | Knowledge · Organize papers, annotations, and ideas into editable maps. |
| [Zotero TaskFlow](https://github.com/groele/Zotero-TaskFlow) | Tasks · Turn literature reading into trackable tasks and plans. |
| [Zotero CiteFlow](https://github.com/groele/Zotero-CiteFlow) | Citation · Track Word citations and connect them to Zotero items. |
| [Zotero PaperFlow](https://github.com/groele/Zotero-PaperFlow) | Publication · Manage manuscripts, submission rounds, and review responses. |

Each add-on installs and updates separately. A shared brand does not imply a shared database or automatic integration of every workflow.

<a id="license"></a>

## Origin and license

Project code is distributed under MIT; papers, images, dependencies, and model services retain their own rights and terms.

License: [MIT](LICENSE).

This series is independently maintained and is not an official Zotero product. Zotero and third-party names, trademarks, and materials belong to their respective rights holders.

[Release/tag policy](docs/release-tag-policy.md)
