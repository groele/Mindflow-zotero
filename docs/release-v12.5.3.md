# Zotero MindFlow 12.5.3

Released: 2026-10-24

## Improved

- Clarify which research sources are selected before an AI analysis begins.
- Expose analysis progress with a determinate or indeterminate state instead of leaving the progress indicator ambiguous.
- Announce AI workflow state changes to assistive technology and expose busy and description relationships for the analysis controls.
- Harden reading-scope and quick-action handling in the item pane.

## Install

Install `zotero-mindflow-12.5.3.xpi` through Zotero's add-on manager. Do not install the GitHub source archive. The add-on ID, document formats, and Zotero 10.0.x compatibility declaration are unchanged.

## Verification and limits

- TypeScript, production build, JavaScript syntax checks, frontend regression tests, and host regression tests were run for this release.
- The XPI archive was checked for integrity, manifest version, and source payload equality. The final SHA-256 is recorded in `docs/package-verification.json` and the GitHub Release assets.
- Native Zotero installation acceptance was not rerun in this release. Real AI service, WebDAV, and cross-device workflows were not revalidated.
- Existing host-regression failures remain documented separately; this release does not claim full native functional acceptance.
