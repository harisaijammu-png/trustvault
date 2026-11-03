# TrustVault threat model

Scope: a small single-instance demonstration with four seeded company accounts and fictional documents. The server, hosting operator, PostgreSQL owner and secret configuration are trusted infrastructure. Application roles are not database users. A logged-in administrator is **not** automatically a document reader. The browser is untrusted.

## Boundaries and invariants

1. A document's creator is its immutable owner. Other users need a current explicit read/edit grant.
2. Only owners manage grants/deletion. Edit never delegates sharing authority.
3. Every byte download makes a fresh server decision. No public file URL exists.
4. Sensitive mutations and their audit event either both commit or both roll back.
5. Revocation/account disable applies to subsequent requests after commit, including old sessions. Already-delivered information cannot be recalled.

## Attacks and evidence

Test references below are names in `test/security.test.mjs` unless otherwise indicated. These are completed local tests; live-host attacks are still pending.

| Threat | Mitigation / decision | Evidence or remaining verification |
| --- | --- | --- |
| Guess a UUID (IDOR) to fetch somebody else's metadata/file | `authorize` checks actual owner/grant; no admin bypass; 404 for both missing and denied | “other owner, viewer and administrator cannot reach ungranted document routes”; PostgreSQL integration |
| Use replacement, metadata, deletion or grants routes instead of download | Each operation checks its required document capability | Same negative route matrix; edit/read tests |
| Enumerate through search, owner, category or dates | Visibility predicate is part of server query before filters/results | “lists and every search filter keep unauthorized documents out”; mutation removes predicate and is caught |
| Administrator abuses role to read confidential files | Admin can review audit and account state, but must receive a named grant for files | “admin has audit access but no implicit file access; named grant works” |
| A read grantee edits or shares; an editor grants/deletes | Separate read/edit/owner capabilities; grants are not role elevation | Read/edit capability tests |
| Keep a session or old URL after revocation | No file token or signed URL; query live grants at each access; no-store headers | “revocation blocks all subsequent operations using an already-issued session” |
| Disable/re-enable an account while it has valid cookies | Database active check; disable deletes all sessions; re-enable does not restore them | Account-disable test; PostgreSQL integration |
| Pause an upload, then use cached actor after disable | Authenticate after bounded body arrival, under the server's request-decision queue | Paused-body disable test; mutation moves auth before body and is caught |
| Race permission changes/content changes | Single-instance queue serializes handlers after input receipt; mutation/download transactions hold a DB transaction; PostgreSQL advisory lock serializes audit appends | Version conflict and paused-body tests; multi-instance deployment deliberately unsupported |
| Forge owner/role/session fields | Mutation field allowlists, server-chosen owner/UUID, hashed random opaque session tokens | Mass-assignment and forged-session tests |
| Steal cookie through frontend JavaScript | HttpOnly cookie; JS receives only CSRF token in memory, no localStorage bearer credential | Cookie assertions; inspect production Secure flag after deployment |
| CSRF or cross-origin login | Exact Origin on all state changes; session-bound CSRF header on authenticated mutations; SameSite Strict; no CORS | CSRF/foreign-origin tests |
| Reuse logged-out/expired session | Server-side removal/expiry enforcement, eight-hour absolute expiry | “expired sessions and logout are enforced on the server” |
| Brute force / account probing | Scrypt salted password hashes; dummy hash for missing account; generic failure; per-email/socket attempt limits | Sign-in throttling test; shared-proxy availability limitation below |
| SQL injection in filters/names/IDs | Bound query parameters; SQL construction only for fixed adapter substitutions; strict route IDs | Search and PostgreSQL integration; no user SQL interpolation |
| Stored XSS in category/filename/audit detail | Browser uses `textContent`, not HTML interpolation; strict CSP; static external script/styles only | Local browser stored `<img src=x onerror=alert(1)>` as a category; it displayed literally, produced zero image elements, then was restored to Demo; screenshot in `docs/screenshots/` |
| Serve a user upload as executable same-origin content | Only four extension/signature combinations; attachment/no-sniff delivery, no embedded previews or arbitrary static paths | Upload validation and delivery header tests |
| Path traversal / response-header injection | Filename allowlist excludes slashes, control characters and quotes; files are BLOBs, no user-chosen filesystem paths; RFC5987 encoded filename | Traversal validation test; static DB/source path denial |
| Malformed/oversized upload exhausts validator | Body limit, encoded-length limit before decoding, canonical base64 check, decoded 5 MB cap; no nested repeated base64 regex | Upload boundary test; actual initial regex failure recorded in PROMPTS.md |
| Fill database with files | Max 40 documents per owner, 100 total, each <=5 MB; no public provisioning | “document quota is enforced without mutating existing documents”; monitor provider limits |
| Overwrite a newer file with a stale edit | Required integer version compared within mutation transaction; increment on update | Stale-version tests on both engines |
| Read content without an evidence record when audit storage fails | Record download before returning bytes; mutation audit is transactional; fail closed | Injected SQLite audit-storage failure test verifies creation rollback and download refusal |
| Quietly UPDATE/DELETE audit records through app | No update/delete endpoint; DB triggers refuse changes; PostgreSQL also refuses TRUNCATE | Trigger tests on SQLite/PostgreSQL |
| Alter existing events after bypassing a trigger | HMAC-SHA256 over exact event text plus previous hash; verify at startup and admin endpoint | Modified-event restart test; HMAC verification mutation caught |
| PostgreSQL transaction rollback consumes identity sequence | Verify actual linked event chain rather than requiring gapless SQL sequence IDs | PostgreSQL integration rolls back an inserted event and verifies next append |
| Delete newest events or restore an older valid database | Export count/head checkpoint and retain independently; no claim that a chain alone detects truncation | Accepted operational dependency: independent retention is manual; automatic anchoring not implemented |
| Access raw database/backup/secrets via web paths | Only three fixed public assets; data, backups and source are never static routes; secrets excluded from Git | Source/DB URL denial tests; `.gitignore`; production environment review pending |
| Leak via caching, framing, referrer or browser preview | No-store private, DENY framing, CSP frame-ancestors none, no-referrer, nosniff, attachments | Header test; production proxy/header verification pending |
| Publish hosted DB credentials or weaken TLS | DATABASE_URL/AUDIT_KEY only in host secrets; strip URL TLS overrides and verify certificate | Adapter code review; actual Neon TLS test pending |
| Render restart deletes files/evidence | Production requires hosted DATABASE_URL; no production SQLite fallback | “production rejects an accidental ephemeral SQLite deployment”; live redeploy durability check pending |

## Accepted risks and limitations

- Shared public demo credentials let a judge act as that named demo user. They identify an account, not a verified real person. Never store real confidential documents in this deployment. An administrator with these demo credentials can disable other demo accounts; this is intended administrative power, not a file-read grant.
- The hosting/database owner can read database bytes. Application-level authorization is not end-to-end encryption. File encryption is delegated to the infrastructure; no claim is made about user-held keys.
- Full server compromise exposes both the audit HMAC key and documents. A database-only attacker may drop triggers; the secret key still protects existing event integrity, but suffix rollback needs external checkpoints. There is no remote immutable ledger.
- Checkpoint retention, backup export, disaster recovery, free-tier quota checks, and uptime monitoring are manual. These are required operational follow-ups, not completed features.
- File signatures are a basic allowlist, **not antivirus or a full PDF/image parser**. A valid-looking malicious PDF may still attack a viewer's local software after download. No archive formats or active web previews are supported.
- Download evidence records authorization/server delivery, not human reading or full receipt. Network failure may occur after the event commits. Owners and grantees can copy already-downloaded files; revocation cannot reverse that.
- Files are buffered in memory, API decisions serialized, and audits verified by a full scan. Concurrency/body caps reduce individual request size, but there is no global upload memory admission queue, distributed throttling, or robust DDoS defense. A public attacker can cause availability pressure and unbounded denied-event growth. This is a demonstration-scale tradeoff; host-level rate limits/monitoring would be required for production.
- Login limits use the actual socket peer rather than trusting spoofable forwarding headers. On a shared Render proxy this can temporarily throttle unrelated users together. Limits reset on restart. Account-only/global throttling needs refinement before production use.
- The directory intentionally exposes demo names/emails/roles to authenticated users. Search shows file metadata only when granted. Audit detail is visible to the admin and scoped owners; it may disclose actor IDs and permission changes by design.
- Only the current file version is retained. Deletion is permanent at the application level; backups/provider retention may retain historical data. No erasure or retention compliance promise is made.
- One server instance is supported. PostgreSQL mutation locking protects append order but is not a substitute for a complete distributed authorization/session design. Do not scale replicas.
- No MFA, self-registration, provisioning, reset flow, antivirus, folder permissions, external links, malware sandbox, or automated secret rotation. DEMO_PASSWORD seeds only the first database; it is not a reset mechanism.
- HTTP is allowed only for local development. Deployment requires configured HTTPS origin and Secure cookies. Actual host security headers/TLS/cookies remain to be checked live.

## Mutation evidence

Run `npm run test:mutations`. It makes isolated temporary copies, removes one protection, and requires an assertion failure in the relevant negative test. Current targets: central document access check, search visibility predicate, session check after body arrival, audit HMAC validation. Four caught mutations demonstrate that the tests are checking refusals, not merely successful happy paths. Keep this evidence truthful when code changes.
