# Zotero MindFlow 12.5.5

Released: 2026-10-24

- Keep keyboard focus inside the AI analysis dialog when a stage change disables or removes a control. While saving has no enabled controls, the dialog itself holds focus and traps Tab in both directions.
- Restore focus to the original launcher after closing, and include links and explicit tab stops in keyboard navigation.
- Treat nonfinite progress as indeterminate, and clamp finite percentages to the valid range.
- Add a test-only real React fixture exercised inside an isolated Zotero profile. Test assets are excluded from the installer.

TypeScript, production build, the complete frontend suite, 81 simulated host regressions and seven package regressions passed. In an isolated Windows Zotero 10.0.6 profile, all 44 native checks and three fresh-process restart checks passed, including the real React keyboard fixture. Real model services, WebDAV and cross-device workflows are outside this change.
