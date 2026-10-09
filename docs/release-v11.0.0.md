# MindFlow for Zotero — Add-on Version 11.0.0

This is a major add-on version. It does not change the MindFlow document format or remove existing preference migration. The supported Zotero host remains **10.0.x**; this add-on version number does not claim Zotero 11 compatibility.

## Changes

- Keep host and editor validation aligned for document metadata, nodes, tasks, images, internal links, and relationships so malformed data is rejected before it is written.
- Make interrupted deletions respect tombstones during document listing and index recovery. Keep corrupt local records visible in the rebuilt workspace list instead of silently dropping them.
- Report durable browser-storage write failures instead of appearing to save successfully when persistence fails.
- Keep the MindFlow item-pane section available with no selected literature item. Users can expand it and create a standalone blank map; selected papers and PDFs continue to create maps linked to the exact literature item.
- Add direct task status cycling between todo, in progress, and done, preserving the other task fields and existing edit history.
- Refresh item-pane content for the current selection and release its notifier entries when the pane is destroyed.

## Validation

- Host regression: 50/50 passed.
- Frontend data-chain and logic tests: 64/64 passed (35 + 29).
- Isolated native Zotero regression: 40/40 passed.
- TypeScript typecheck, production build, XPI payload verification, and `git diff --check` passed.
- XPI: `mindflow-zotero-11.0.0.xpi`. The generated checksum is recorded in [package-verification.json](package-verification.json).

The native suite ran in an isolated Windows Zotero profile. These checks do not establish compatibility with Zotero 11, macOS/Linux, external AI or WebDAV services, or every user's Zotero library permissions.
