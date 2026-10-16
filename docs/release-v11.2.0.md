# MindFlow for Zotero 11.2.0

MindFlow 11.2.0 adds reusable research presets for AI-generated mind maps. A preset can combine a user-defined prompt, an analysis template, and a presentation template. Users can create, edit, select, and set a default preset; presets remain in Zotero preferences and are passed through the existing `llm-for-zotero` integration. The feature does not add another model provider or API-key store.

## Changes

- Save, edit, select, set as default, and delete research presets.
- Choose a research prompt and content template independently from presentation settings.
- Preserve the active map's appearance by default; an explicitly selected presentation preset controls the layout and theme for a new draft.
- Validate preset data and keep malformed stored values from breaking the settings panel.
- Improve AI analysis settings, prompt handling, source attribution, and generated draft workflows.
- Include the full plugin workflow audit and prioritized follow-up recommendations in [the audit report](插件全流程审查与优化建议-20261016.md).

## Compatibility and verification

- Supported host range remains Zotero 10.0.x.
- Model configuration and requests continue to use the installed `llm-for-zotero` plugin.
- Host tests: 80/80 passed. Frontend data-chain, logic, and preset tests: 80/80 passed. TypeScript check and production build passed.
- The XPI contains 25 verified entries, declares version 11.2.0, and excludes test harness files. Its SHA-256 is recorded in [package verification](package-verification-11.2.0.json).
- Dedicated Zotero preset checks and a restart persistence check passed in the prior isolated run. The historical full native regression has known version drift and unresolved cases; the focused preset workflow is not a substitute for completing that regression.

This release does not claim that every issue in the audit report has been fixed. The report separates observed defects, the changes in this release, and proposed follow-up work.
