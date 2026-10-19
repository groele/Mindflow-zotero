# MindFlow for Zotero 11.1.0

MindFlow 11.1.0 adds convenient actions to the Zotero item pane and improves the AI paper-reading workflow. The add-on remains compatible with Zotero 10.0.x and keeps the add-on ID `mindflow@groele.org` and existing `.mindflow` document format.

## Changes

- Add selected-item context and quick actions in the MindFlow item pane: create or open a map, start AI paper analysis, open the workspace, import a map, open an available PDF, and refresh the panel.
- Support standalone map creation when no literature item is selected, and route selected papers/PDFs to the matching workspace.
- Reuse the existing workspace and file picker for imports, including cold-start timing when the editor has not mounted yet.
- Integrate AI analysis with the installed `llm-for-zotero` public Agent API, including selectable source ranges, templates, model, and reasoning strength. AI output remains a draft for review before archive.
- Retain the prior 11.0.0 document validation, storage recovery, task controls, and expandable MindFlow pane.

## Validation

- Host tests: 78/78 passed.
- Frontend data-chain tests: 43/43 passed.
- Frontend logic tests: 30/30 passed.
- Isolated native Zotero 10.0.6 regression: 43/43 passed, including sidebar routing, layout, warm import, and cold import.
- TypeScript typecheck, production build, script syntax checks, XPI payload verification, and `git diff --check` passed.
- The native test used a temporary Zotero profile and data directory. It does not establish compatibility with Zotero 11, macOS/Linux, every library permission setup, third-party AI availability, or the scientific correctness of generated content.

## Package

- Asset: `mindflow-zotero-11.1.0.xpi`
- Size: 276,677 bytes
- SHA-256: `3f91749f4dec3f14d79a30a867793606f014d6e87e3d96b4a7318ebab04c1899`
- Package verification: [package-verification-v11.1.0.json](package-verification-v11.1.0.json)

For installation, use the XPI attached to the [11.1.0 GitHub Release](https://github.com/groele/Zotero-MindFlow/releases/tag/v11.1.0). GitHub's source archive is not an installable add-on package.
