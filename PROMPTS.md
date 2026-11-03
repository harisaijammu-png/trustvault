# AI work log

This log records real work as it occurs. Pending items are not completed fixes. Commit links will be added only after actual commits exist. No history will be backdated.

## 2026-11-03 — Requirements discovery

**Request:** Read the Snovasys challenge and help build, test, and prepare an explainable submission.

**Output:** Inspected the empty workspace and read the complete TrustVault problem and event instructions in the browser. Created REQUIREMENTS.md.

**What went wrong:** The assistant initially attempted the browser identifier `chrome`, which was unavailable to the browser automation interface even though a native Chrome window was running. The public web reader also could not access the challenge URLs.

**Correction:** Used the browser inventory to find the available in-app browser and read both pages there. This is a tooling correction, not a security defect in TrustVault, and must not be presented as one.

**Verification:** Both pages were visibly loaded and their complete requirements inspected. The actual security work and security-specific entries remain pending.

**Correction commit:** Pending initial repository setup.

## 2026-11-03 — Server access review

**Request:** Implement named document grants, server sessions, immediate revocation, and an audit trail in a small JavaScript server.

**Output:** The initial handler authenticated a session before asynchronously reading a request body.

**What was wrong:** An administrator could disable the account while the body was still arriving. The handler would retain the previously authenticated actor and could accept a mutation after session invalidation. Document grants were rechecked, but the account/session state also needed rechecking.

**Correction:** Authenticate again after body parsing and recheck the CSRF token. Added a test that sends a partial PATCH body, disables the owner, then finishes the body; it must return 401.

**Verification:** The paused-body disable test passed in the first security test run.

**Correction commit:** Pending implementation commit.

## 2026-11-03 — Upload size and encoding validation

**Request:** Test malformed uploads, unsafe names, unsupported formats, and the 5 MB size boundary.

**Output:** The AI used a grouped, repeated regular expression over the entire base64 body before decoding it.

**What was wrong:** The 5 MB boundary test returned 500 instead of 400. The validator performed an unnecessarily expensive regex check on a multi-megabyte string. Fifteen checks passed but the upload boundary check failed; this was not a successful test run.

**Correction:** In progress: bound encoded length first and validate decoding using a canonical base64 round-trip, avoiding the nested repetition.

**Correction commit:** Pending fix.
