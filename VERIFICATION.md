# Verification record — 2026-11-03

## Completed locally

- Node.js v25.8.1 on Windows.
- Syntax checks for server, application and browser script passed.
- SQLite cross-user route matrix, named read/edit permissions, immediate revocation, CSRF/origin, upload validation and size boundary, stale versions, account disable/re-enable, paused-body authentication, session expiry/logout, audit append failure rollback/download refusal, stored-event tamper rejection, login throttling and per-owner quota.
- Embedded PostgreSQL engine integration: production schema/triggers, actual BYTEA contents, search/filter SQL, named grants, aliases, edit/version behavior, revocation, audit inspection, account disable and valid audit chaining after rolled-back identity allocation.
- Four temporary-source security mutations caught. Real source unchanged by mutation runner.
- Latest full test run: 21 reported results, all passing, zero failures. TLS URL override configuration test also passed. Four mutation checks passed afterwards.
- SQLite backup script executed successfully and created an ignored snapshot plus checkpoint. Full restore has not yet been rehearsed.
- Browser: owner sign-in, document details, named viewer read grant, revoke, activity records, category editing and session continuity after local server restart.
- Browser: hostile category `<img src=x onerror=alert(1)>` was displayed literally, and DOM inspection found no injected image elements. Restored category to Demo afterwards.
- Screenshots: `docs/screenshots/vault-narrow.png`, `sharing.png`, `xss-literal-text.png`. The sharing screenshot records a test grant that was subsequently revoked.

- Fresh export of committed source: npm ci --include=dev installed locked dependencies successfully; syntax checks and all 21 test results passed with zero vulnerabilities reported by npm audit. This was a clean source export, not a cloud deployment.

## Still pending

- Private GitHub repository and remote configured; push pending device authorization. The initially empty repository was public, corrected to private before any code upload. No source was exposed.
- Live Render/Neon connection including driver TLS behavior against a real server.
- Live HTTPS cookies, headers, startup/restart durability and deployed security flows.
- Private-window / another physical device checks.
- Local narrow layout inspected at the browser's natural 510px width; a real phone and additional mobile widths still need checking.
- PostgreSQL backup/export and recovery drill; independently retained audit checkpoints.
- Candidate walkthrough/code exercise, actual video, profile and final submission.

This record is local evidence only. Passing tests do not prove absence of all vulnerabilities.
