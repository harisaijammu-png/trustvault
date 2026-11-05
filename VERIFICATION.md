# Verification record

## 2026-11-05 follow-up and independent backup

- Candidate screenshot confirms an administrator's ungranted direct download was refused and recorded as admin / request.refused / denied (404).
- Candidate initially disabled Alice instead of Bob; the account screenshot identified that setup error. After disabling Bob, the candidate reports an already-open download was refused. After enabling Bob without a new login, the candidate again reports no download; signing in again restored access. These are candidate-run checks, not new agent-run tests.
- Candidate reports saving an exported audit checkpoint outside the service.
- Temporary Neon branch recovery-test-nov5 was created; its SQL count result showed 3 documents, 101 audit records and 4 users. Neon's historical-data preview failed twice with a connection-aborted error. No successful provider restore is claimed.
- Verified PostgreSQL 18.6 client tools. On 5 November at 11:59 IST, pg_dump completed against the production direct endpoint and created a private, Git-ignored custom-format archive: backups/trustvault-production-2026-11-05-115921.dump (19,172 bytes).
- pg_restore --list successfully read the archive and identified 5 public table-data entries. SHA256: C1E262D4620D723CF3672AF29669BBBDD51A85B1A2B6ACC136D89D6E51F565AF. The archive checksum was rechecked before the completed restore described below.
- The database password was exposed in the working chat. No password is recorded here or in Git. Candidate subsequently reports resetting the production role password and updating Render; the restore used current connection details read privately from the authorized Neon panel. Other copies using the exposed role credential must also be addressed. Audit keys are unchanged.

## 2026-11-05 completed PostgreSQL restore drill

- Candidate created trustvault_restore_test as a separate database on the production branch. The live app continues to use neondb; no Render database setting was changed for this drill.
- Before writing, an agent-run psql query confirmed current_database()=trustvault_restore_test and zero public tables. The target hostname and database name were explicitly allowlisted.
- The original custom archive checksum matched. pg_restore ran with --single-transaction, --exit-on-error, --no-owner and --no-acl, without --clean or any production-database target. It exited successfully.
- Post-restore query: 3 documents, 4 users, 1 grant, 101 audit records, 0 file-size/content-length mismatches, 0 broken previous-hash links, and sample document version 2.
- Restored audit links were checked structurally. A full HMAC re-verification/application startup against this restored database has not been performed because the audit key was not loaded into this drill. No such verification is claimed.
- Current connection credentials were kept out of tool results and Git. A short-lived Git-ignored connection handoff file was consumed and deleted before commands ran. Working credential variables were cleared after completion. The backup itself remains private and Git-ignored.
- This is a successful logical export and separate-database restore exercise, not a provider point-in-time restore, cross-region disaster-recovery test or complete application failover. The test database shares the production compute and therefore is not a substitute for the independently saved archive.

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

- Ungranted administrator download refusal is candidate-verified; live metadata refusal still needs separate evidence.
- Existing-session disable/re-enable behavior is now candidate-reported as verified above; further automated live coverage remains optional follow-up.
- Live viewer-role and edit-grantee sharing/deletion refusal beyond hidden controls; automated route tests already cover these locally.
- Separate live review of HTTPS, cookie flags, caching/security headers and invalid upload cases.
- Candidate reports independently saving a checkpoint. Complete application startup/HMAC verification against the restored database and an independent checkpoint comparison remain separate follow-ups; the logical backup/restore drill passed.
- Put actual live demo credentials in README before submission, without publishing hosting/database secrets.
- Candidate code-change exercise, explanation practice, five-minute video, personal write-up, profile and final submission.
- Clarify public-repository timing with the placement cell.

Passing tests and these manual checks do not prove absence of all vulnerabilities.
