# Zotero MindFlow 12.5.2

Released: 2026-10-21

Fix emergency backups after a canvas rendering error: export the complete current document instead of rebuilding a document from its root tree.

## Fixed

- Preserve the document ID, revision, metadata, theme, layout and latest relationships in the emergency JSON backup.
- Capture pending node text outside the canvas error boundary so it remains recoverable after the input is unmounted. Exclude cancelled drafts and drafts from another document.
- Restore captured text when reloading the canvas and allow undoing the recovered edit.
- Replace the unverified data-safety assurance with accurate save-status guidance. Show download errors and allow retry; confirm that a requested download has actually been saved.

## Install

Install `zotero-mindflow-12.5.2.xpi` through Zotero's add-on manager. Do not install the GitHub source archive. Existing document formats and the add-on ID are unchanged. The manifest continues to target Zotero 10.0.x.

## Verification and limits

- TypeScript, production build and JavaScript syntax checks passed.
- Frontend regressions passed: 45 data-chain tests, 30 logic tests, 7 research-preset tests and 3 emergency-backup check groups.
- The actual browser App was exercised with an isolated canvas fault: pending Chinese text survived input unmounting, the downloaded JSON preserved document fields, import restored content and relationships, reload recovered the draft, undo restored the prior text, and failed downloads could be retried.
- The XPI archive, resource payload and SHA-256 are recorded in the attached verification files. Fault-injection instrumentation is excluded from the installer.
- Native Zotero installation acceptance was not rerun. Real AI, WebDAV and cross-device workflows were not revalidated.
- The 13 existing host-regression failures (7 reading-scope/abstract/section cases and 6 item-pane cases) remain outside this patch. This release is not a full functional acceptance result.

PNG resource limits, graphical relationship exports, date validation and AI reading-scope fallback are not changed by this release.
