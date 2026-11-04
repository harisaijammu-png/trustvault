# Verification record

## 2026-11-04 deployment diagnosis

- Render logs confirm the 3 November version built successfully with all 21 tests passing on Linux/Node 25.8.1.
- Startup failed because the configured DATABASE_URL was an incomplete suffix. The candidate subsequently corrected the private environment and confirmed live startup; see the manual results below.
- Hardened invalid-URL errors to avoid echoing potentially sensitive input; added malformed-configuration coverage.
- Updated local suite: 22 results passed after allowing connections to the tests' temporary loopback servers. Syntax checks passed.

## 2026-11-04 live manual checks

Source: candidate-operated browser sessions, pasted audit rows and screenshots in the working chat; these were not agent-run automated tests. Live URL: https://trustvault-3wp4.onrender.com/.

- GitHub upload completed; the repository was verified private before upload.
- Live sign-in initially rejected requests because APP_ORIGIN still used a provisional hostname. After setting the actual assigned origin, Alice signed in successfully.
- Alice uploaded alice-test.txt; Bob's search without a grant returned no matching documents.
- Alice granted Bob read access; Bob downloaded the file. Alice revoked the grant; the file disappeared from Bob's list. A later direct content request using Bob's authenticated browser was refused with Document unavailable.
- Audit screenshot shows bob / request.refused / denied / status 404 at 12:49:38 local time, targeting document 2a71b1a4-e161-4a39-9f62-b25a51d54b32. This confirms refusal after revocation; a same-session click at the exact revoke moment was not separately demonstrated.
- Alice then granted edit access; Bob replaced the file and Alice confirmed the changed contents. Audit screenshot records bob / document.replace / allowed at 12:57:01, version 2, followed by Alice's version-2 download.
- Admin audit verification screenshot: valid=true, count=51, checkedAt=2026-11-04T07:35:20.663Z, head=72f3bf5433b6162a371def695e5c9ae91ab8f18073628a6d5002d2b64cba625f. Export was triggered; candidate must still confirm independent retention of the downloaded file. This checkpoint describes that time only, not the current growing log.
- Candidate disabled Bob and demonstrated a refused sign-in, then re-enabled him and confirmed sign-in worked. Invalidation of an already-open Bob session has not yet been established by the live evidence.
- After restarting the Render service, candidate downloaded the version-2 file with updated content; candidate reports earlier activity also remained.
- Candidate reports successful use on a physical mobile device, including viewing activity records.

These checks support the observed scenarios only. They do not establish that every route, device, role or adversarial case has been tested live.

## 2026-11-03 baseline

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

- Live refusal of ungranted administrator metadata/download access.
- Live invalidation of an already-open session on account disable, including continued refusal after re-enable until a new login.
- Live viewer-role and edit-grantee sharing/deletion refusal beyond hidden controls; automated route tests already cover these locally.
- Separate live review of HTTPS, cookie flags, caching/security headers and invalid upload cases.
- Confirm independently retained checkpoint file; PostgreSQL backup/export and recovery drill.
- Put actual live demo credentials in README before submission, without publishing hosting/database secrets.
- Candidate code-change exercise, explanation practice, five-minute video, personal write-up, profile and final submission.
- Clarify public-repository timing with the placement cell.

Passing tests and these manual checks do not prove absence of all vulnerabilities.
