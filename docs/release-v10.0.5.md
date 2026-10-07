# MindFlow for Zotero 10.0.5

Release date: 2026-10-07. Compatible with Zotero 10.0.x; native regression environment: Windows and Zotero 10.0.5.

## Fixed

- Keep revision checks active when restoring deleted documents, preventing backups from overwriting concurrently created maps.
- Validate snapshot records and duplicate IDs before rendering or writing; preserve corrupt records and report errors.
- Retarget self-links in automatic-save, switch-save, and close-recovery conflict copies.
- Save pending drafts before snapshot rollback, block editor input during restoration, and refresh recovery history and selection.
- Guard repeated backup actions, reject oversized files before reading, and apply configured snapshot retention.
- Report partially completed workspace restoration with the saved document count and failure stage.
- Return the committed revision when creating the first workspace document.

## Validation

Host tests: 46/46. Frontend data-chain tests: 33/33. Editor logic: 18/18. Native Zotero: 38/38. Process restart: 3/3. TypeScript, production build, syntax checks, and XPI payload verification passed.

Detailed evidence: [workflow audit](深度逻辑审查与修复-20261007.md). AI and real WebDAV endpoints were not exercised. Multi-file workspace restoration is not atomic; pre-replacement snapshots and partial progress reporting support recovery.

## Installation

Download [mindflow-zotero-10.0.5.xpi](https://github.com/groele/Mindflow-zotero/releases/download/v10.0.5/mindflow-zotero-10.0.5.xpi) and install it from Zotero's add-on manager. Back up important maps before upgrading.
