# AI work log

This log records real work as it occurs. Pending items are not completed fixes. Commit links will be added only after actual commits exist. No history will be backdated.

## 2026-11-03 — Requirements discovery

**Request:** Read the Snovasys challenge and help build, test, and prepare an explainable submission.

**Output:** Inspected the empty workspace and read the complete TrustVault problem and event instructions in the browser. Created REQUIREMENTS.md.

**What went wrong:** The assistant initially attempted the browser identifier `chrome`, which was unavailable to the browser automation interface even though a native Chrome window was running. The public web reader also could not access the challenge URLs.

**Correction:** Used the browser inventory to find the available in-app browser and read both pages there. This is a tooling correction, not a security defect in TrustVault, and must not be presented as one.

**Verification:** Both pages were visibly loaded and their complete requirements inspected. The actual security work and security-specific entries remain pending.

**Correction commit:** [65ac38c](https://github.com/harisaijammu-png/trustvault/commit/65ac38c).

## 2026-11-03 — Server access review

**Request:** Implement named document grants, server sessions, immediate revocation, and an audit trail in a small JavaScript server.

**Output:** The initial handler authenticated a session before asynchronously reading a request body.

**What was wrong:** An administrator could disable the account while the body was still arriving. The handler would retain the previously authenticated actor and could accept a mutation after session invalidation. Document grants were rechecked, but the account/session state also needed rechecking.

**Correction:** Authenticate again after body parsing and recheck the CSRF token. Added a test that sends a partial PATCH body, disables the owner, then finishes the body; it must return 401.

**Verification:** The paused-body disable test passed in the first security test run.

**Correction commit:** [af0ea95](https://github.com/harisaijammu-png/trustvault/commit/af0ea95). The PostgreSQL adaptation now authenticates after bounded body receipt under a request-decision queue.

## 2026-11-03 — Upload size and encoding validation

**Request:** Test malformed uploads, unsafe names, unsupported formats, and the 5 MB size boundary.

**Output:** The AI used a grouped, repeated regular expression over the entire base64 body before decoding it.

**What was wrong:** The 5 MB boundary test returned 500 instead of 400. The validator performed an unnecessarily expensive regex check on a multi-megabyte string. Fifteen checks passed but the upload boundary check failed; this was not a successful test run.

**Correction:** Bound encoded length first and validate decoding using a canonical base64 round-trip, avoiding nested repetition. The boundary test now returns 400 and passes.

**Correction commit:** [af0ea95](https://github.com/harisaijammu-png/trustvault/commit/af0ea95).

## 2026-11-03 — Hosting budget and persistent storage

**Request:** Build and deploy a project the candidate can learn using their Render experience.

**Output:** Initial storage was SQLite, requiring a persistent Render disk in deployment.

**What was wrong:** The assistant chose storage before confirming the budget. The candidate requires completely free hosting. Render's temporary filesystem cannot preserve the vault across restarts; persistent disks require paid services.

**Correction:** Added hosted PostgreSQL support, retained SQLite for local development, and made production refuse startup without DATABASE_URL. Prepared free Render + Neon configuration.

**Verification:** SQLite security tests and embedded PostgreSQL integration pass. Actual cloud connection/setup is still pending.

**Correction commit:** [3b69ea1](https://github.com/harisaijammu-png/trustvault/commit/3b69ea1) (local commit; link will resolve after push).

## 2026-11-03 — PostgreSQL audit gaps and grant aliases (security/audit)

**Request:** Preserve permissions and audit guarantees while adapting storage.

**Output:** The initial verifier required gapless SQL audit sequence IDs; the grants query used an unquoted userId alias.

**What was wrong:** PostgreSQL can consume identity values in rolled-back transactions, creating legitimate gaps. PostgreSQL also lowercases unquoted aliases, breaking clients expecting userId for revocation.

**Correction:** Verify the linked HMAC records without a gapless-ID assumption and quote the alias. The PostgreSQL integration test rolls back an audit insertion, appends a new event, verifies the chain, and checks the grant's userId field.

**Verification:** Integration passes. Triggers refuse ordinary changes. Suffix deletion still needs an independently retained checkpoint; no claim is made that chaining alone prevents it.

**Correction commit:** [3b69ea1](https://github.com/harisaijammu-png/trustvault/commit/3b69ea1) (local commit; link will resolve after push).

## 2026-11-03 — Mutation harness cleanup and discovery

**Request:** Prove tests fail when security checks are removed.

**Output:** The first HMAC mutation let a tampered app start unexpectedly, leaving a database handle open. The later generic node --test command also discovered the mutation script itself.

**What was wrong:** Windows cleanup errors obscured the intended assertion failure, and test discovery attempted recursive test runs.

**Correction:** Close unexpectedly successful startup in the rejection test; restrict normal tests to test/*.test.mjs; copy the adapter into mutation fixtures; update the paused-body mutation to simulate cached authentication correctly.

**Verification:** Four intended mutations are CAUGHT through assertion failures; the real source passes. Only temporary copies are modified.

**Correction commit:** [3b69ea1](https://github.com/harisaijammu-png/trustvault/commit/3b69ea1) (local commit; link will resolve after push).

## 2026-11-03 — Production dependencies and TLS URL overrides (security)

**Request:** Review free deployment and connection security before upload.

**Output:** Initial Render configuration used npm ci with NODE_ENV=production; PostgreSQL configuration removed only a short list of TLS URL parameters.

**What was wrong:** Production installation can omit the development dependency required by PostgreSQL tests. A URL's ssl=false can also replace the driver's explicit SSL settings even if sslmode was removed.

**Correction:** Build with npm ci --include=dev. Discard database URL query parameters and configure certificate-verifying TLS explicitly. Tests construct real pg Clients with ssl=false, sslmode=disable/no-verify and certificate override variants.

**Verification:** TLS configuration tests pass; official node-postgres documentation confirms URL options can override ssl. Actual Neon network/TLS validation remains pending setup.

**Correction commit:** [3b69ea1](https://github.com/harisaijammu-png/trustvault/commit/3b69ea1) (local commit; link will resolve after push).

## 2026-11-03 — Browser checks and sharing defaults

**Request:** Verify the interface and make named sharing explicit.

**Output:** The initial sharing select defaulted to the administrator; error notices appeared only behind the document modal. CSS also had an empty import.

**What was wrong:** A default recipient invites accidental sharing; modal users could miss failures; the import served no purpose.

**Correction:** Require explicit person selection, add in-dialog status, remove the import. Browser checks exercised login, details, grant/revoke, activity and category editing. Hostile category HTML was saved, shown literally with zero injected image elements, then restored to Demo.

**Verification:** Local screenshots in docs/screenshots. These are not live or mobile-device checks.

**Correction commit:** [3b69ea1](https://github.com/harisaijammu-png/trustvault/commit/3b69ea1); empty import removal was already included in `af0ea95`.

## 2026-11-04 — Deployment configuration and secret-safe startup errors

**Request:** Diagnose the failed Render deployment using its pasted logs.

**Output:** Render successfully installed dependencies, passed all 21 tests, and built the project. Startup failed because DATABASE_URL contained only the connection string's ending rather than a full PostgreSQL URL.

**What was wrong:** The assistant's earlier screenshot review could not confirm the whole value and the guided setup did not catch the incomplete copy before deployment. Also, the raw Node URL parser exception included its input field. A malformed value containing a password could therefore leak into deployment logs.

**Correction:** Give explicit instructions to replace DATABASE_URL with Neon's complete copied connection string, without psql/quotes. Catch parser exceptions and emit fixed guidance without the supplied value or original error cause. Check required connection components. Added a test covering truncated input, command-wrapped input, wrong scheme and missing credentials.

**Verification:** The first local full-suite attempt was blocked by restricted loopback connections (EACCES). Rerunning with local-server access passed all 22 test results, including the secret-safe configuration test. The user still needs to correct the private Render value and redeploy; no successful live startup is claimed.

**Correction commit:** [1559d74](https://github.com/harisaijammu-png/trustvault/commit/1559d74).

## 2026-11-04 — Correct deployed origin and evidence claims

**Request:** Guide the candidate through live verification and record real day-by-day progress.

**Output:** Initial setup used a provisional APP_ORIGIN before Render assigned the actual hostname. The app then rejected login requests on the assigned domain. Existing documents also still said upload and deployment were pending after they had been completed.

**What was wrong:** The provisional setting needed replacement before login testing. Stale documentation no longer described observed behavior. A successful checkpoint verification also does not prove independent checkpoint retention, and a refused new sign-in does not alone prove an already-open session was invalidated.

**Correction:** Guided the candidate to set APP_ORIGIN to https://trustvault-3wp4.onrender.com. Updated README, verification record and write-up worksheet with candidate-run evidence and specific remaining tests. Keep provisional settings and manual reports distinct from completed live verification.

**Verification:** Candidate screenshots/reports show successful login, upload, direct revoked-download refusal and denied audit record, read/edit flows, replacement version 2, valid audit chain, disabled login refusal/re-enabled login success, restart persistence and physical-mobile activity access. Missing scenarios remain explicitly pending. No fresh automated run was needed for this documentation-only change.

**Correction commit:** Recorded in this documentation commit's history.

## Reused instructions/context

- Challenge email and official pages, summarized in REQUIREMENTS.md.
- DESIGN.md: explicit capabilities, no public file URLs, honest audit/revocation limits.
- Negative test matrix and mutation checks reused after storage/security changes.
- Candidate constraints: language basics, learning support, existing GitHub/Render experience, completely free hosting.
- This log describes AI-generated code and assistant review/tests. It does not claim the candidate independently found every issue. No dates, mistakes, understanding or deployments are invented.
