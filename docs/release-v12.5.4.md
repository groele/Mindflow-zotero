# Zotero MindFlow 12.5.4

Released: 2026-10-24

- Align the main and mirrored manifests, source package, lockfile, settings badge, installer link and documentation versions.
- Fix the stale update hashes left in the 12.5.3 preparation. Both update feeds now use the verified 12.5.4 installer SHA-256.
- Build reproducible XPI archives with stable timestamps and permissions. Verify every runtime file byte, archive entry, add-on identity, compatibility range and update URL before accepting a release.
- Provide explicit hash synchronization and verification-only commands, with regression checks for stale hashes, changed resources, missing mirrors and repeatable builds.
- Include the reading-scope, quick-action and accessible AI feedback fixes from the unreleased 12.5.3 source. The 13 old simulated host failures are resolved; all 81 host tests pass.

## Verification

Frontend regressions, TypeScript, production build, JavaScript syntax, 81 simulated host tests and seven release-package tests passed. In an isolated Windows Zotero 10.0.6 profile, 43 native checks and three fresh-process restart checks passed. The native harness now validates the current Fluent tooltip and sidebar controls instead of obsolete strings and selectors; no failed product assertion was removed. Live AI providers, WebDAV and cross-device workflows are outside this verification. The add-on ID and declared Zotero 10.0.x compatibility are unchanged.

Install the Release XPI through Zotero's add-on manager. The existing 12.5.3 tag remains immutable; 12.5.4 supersedes its incomplete release preparation.
