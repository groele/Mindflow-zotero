# MindFlow for Zotero 11.1.1

This patch fixes the MindFlow item pane appearing as a heading with an empty body on first open. Zotero marks a custom section with no static body as empty, which suppresses its expand control and ignores open requests. MindFlow now clears that empty state and opens the quick-action section when mounted, so the controls appear as soon as the MindFlow pane is selected.

## Validation

- Added a host regression asserting first-mount expansion is enabled and idempotent.
- Host tests: 79/79 passed.
- Frontend data-chain tests: 43/43 passed; frontend logic tests: 30/30 passed.
- Isolated native Zotero 10.0.6 regression: 43/43 passed. The sidebar test now selects the MindFlow navigation entry without manually opening the section, then confirms the actions are visible.
- TypeScript typecheck, production build, script syntax checks, XPI payload verification, and `git diff --check` passed.
- The native regression used a temporary Zotero profile and data directory. It does not establish compatibility with Zotero 11, macOS/Linux, or every library configuration.

## Package

- Asset: `mindflow-zotero-11.1.1.xpi`
- Size: 276,899 bytes
- SHA-256: `4bc5fb7f16d1a9de34900a340ad0ae009a21c4b57be85a28cf022e562d96a2ec`
- Package verification: [package-verification-v11.1.1.json](package-verification-v11.1.1.json)

Install the XPI from the [11.1.1 GitHub Release](https://github.com/groele/Zotero-MindFlow/releases/tag/v11.1.1), or let Zotero check the updated add-on metadata.
