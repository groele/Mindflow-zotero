# MindFlow for Zotero 11.1.2

This patch repairs the MindFlow quick-action section in Zotero's item pane. It now follows the lifecycle used by Todolist-Zotero: the empty-paper state keeps a useful section summary, dynamically rendered controls use XHTML elements, and the section is expanded after Zotero restores its saved collapsed preference. This addresses the case where Zotero showed the MindFlow heading but hid the actions.

## Validation

- Host tests: 79/79 passed.
- Frontend data-chain tests: 43/43 passed; frontend logic tests: 30/30 passed.
- Isolated native Zotero 10.0.6 regression: 43/43 passed, starting with the MindFlow section preference saved as collapsed. The test confirmed the controls become visible without manually expanding the section.
- TypeScript typecheck, production build, script syntax checks, XPI payload verification, and `git diff --check` passed.
- Native testing used a temporary Zotero profile and data directory. This does not establish compatibility with Zotero 11, macOS/Linux, or every library configuration.

## Package

- Asset: `mindflow-zotero-11.1.2.xpi`
- Size: 277,239 bytes
- SHA-256: `a953fe0a3a2b9b85ca7399792a21cfcc94fab08c7db31c27906e51dcdd97512e`
- Package verification: [package-verification-v11.1.2.json](package-verification-v11.1.2.json)

Install the XPI from the [11.1.2 GitHub Release](https://github.com/groele/Zotero-MindFlow/releases/tag/v11.1.2), or let Zotero check the updated add-on metadata.
