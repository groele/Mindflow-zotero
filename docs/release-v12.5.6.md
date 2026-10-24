# Zotero MindFlow 12.5.6

- Track cancellation for both injected native AI calls and message-channel jobs.
- Cancel active model work and clear session-only prepared material when the plugin shuts down.
- Reject new preparation/analysis after shutdown, including requests returning from asynchronous setup.

Validation: 82 host regressions, frontend suites and TypeScript checking passed. Isolated Zotero acceptance and package verification are recorded separately. No paid/live AI service calls, WebDAV transfers or main-profile installation are claimed.

Native acceptance: the four final production XPIs passed 9 combined checks on initial startup and 9 after restart in isolated Windows Zotero 10.0.6. The production MindFlow host cancelled a controlled upstream model call on shutdown and cleared prepared paper data. The upstream fixture made no network/model-service calls. See `releases/v12.5.6-verification.json`.
