# TrustVault

Named document sharing with server-enforced read/edit grants, immediate revocation for subsequent requests, and an HMAC-chained audit record. Built for the Snovasys Fresher Hiring Challenge 2026 with AI assistance documented in [PROMPTS.md](PROMPTS.md).

**Current status:** implemented and tested locally. No GitHub remote or live deployment has been configured yet. Live PostgreSQL connectivity, private-window and second-device checks, the candidate's demo video, and final submission remain outstanding. Do not describe these as complete.

## Run locally

Install Node.js **25.8.1** (the version tested here; pinned in `.node-version`). From a clean clone:

```sh
npm ci
npm run check
npm test
npm run test:mutations
npm start
```

Open http://localhost:3000. With no DATABASE_URL, the app creates `data/trustvault.db` and a development audit key. The schema and four fictional demonstration accounts are initialized automatically. No separate database installation is required for local SQLite use. Keep the whole `data` directory private and backed up; never commit it.

| Account | Role | Local development password |
| --- | --- | --- |
| alice@trustvault.demo | Owner | Learn-TrustVault-2026! |
| bob@trustvault.demo | Another owner | Learn-TrustVault-2026! |
| viewer@trustvault.demo | Viewer | Learn-TrustVault-2026! |
| admin@trustvault.demo | Administrator | Learn-TrustVault-2026! |

These are deliberately shared demo accounts, never real staff accounts. Production requires an explicit DEMO_PASSWORD at first startup. **Before submission, put the chosen public demonstration password and actual live URL here.** Never reuse a personal password. Setting DEMO_PASSWORD again does not change an existing database's account passwords.

## What works

- Sign in/out; opaque eight-hour server sessions; disabled accounts cannot continue using old sessions.
- Owners upload TXT/PDF/PNG/JPEG files (1 byte–5 MB), classify by category, search by name/owner/category/UTC creation date, replace content, and delete documents.
- Named read/edit grants; only the document owner can grant/revoke access and delete. Editors can change category and replace content with optimistic version checks.
- Administrators inspect global activity, verify the audit chain, export checkpoints, and disable/re-enable other accounts. Admin status does not confer file access.
- Successful sensitive operations and their audit entries commit together. Denied document requests are recorded. Database triggers reject ordinary audit changes.
- Attachment downloads pass through authorization every time. No public bucket URLs, static upload paths, or reusable signed file links.

## Why this stack

The browser and server use JavaScript so the candidate can learn one language. The interface uses plain HTML/CSS and DOM APIs. The server uses Node's HTTP and crypto modules. SQLite keeps local setup simple; PostgreSQL keeps production files and records independent of Render's temporary filesystem. File bytes are database BLOBs/BYTEA, which lets a content change and its audit record share a transaction. This is designed for a small demonstration, not large-file storage or high traffic.

## Permissions

| Operation | Owner of this document | Named read grantee | Named edit grantee | Administrator without grant |
| --- | --- | --- | --- | --- |
| Metadata, search, download | Yes | Yes | Yes | No |
| Replace file / change category | Yes | No | Yes | No |
| Grant, revoke, list grants, delete | Yes | No | No | No |
| Global audit, verification, account status | Only if administrator role | No | No | Yes |

Account roles and document capabilities are separate. Only owner-role accounts create new documents. Each owner implicitly controls documents they created. No client may set ownership or roles. The authenticated company directory is an intentional feature and contains only demo names, emails, roles, and account availability.

## Audit and revocation limits

Revocation stops **subsequent server requests after the revoke commits**, including requests made with an existing session. It cannot erase a downloaded copy, retract already-sent response bytes, or prevent screenshots. A download event proves the server authorized and delivered a response, not that a human actually read every byte.

HMAC chaining detects altered/reordered/interior-deleted records while AUDIT_KEY stays secret. Triggers block ordinary UPDATE/DELETE (PostgreSQL also blocks TRUNCATE). A database owner can remove triggers. A database owner plus the application key can forge evidence. Detecting deletion of the newest events or restoration of an older valid database requires comparing against a checkpoint retained outside the service. The app does not yet automate independent checkpoint retention. See [THREATS.md](THREATS.md).

## Deploy for free

Use a private GitHub repository, a **Render Free web service**, and a **Neon Free PostgreSQL** project. No persistent Render disk is needed: document bytes, sessions, and audit records all live in PostgreSQL. Full instructions and checks are in [DEPLOYMENT.md](DEPLOYMENT.md); environment names are in `.env.example` and a Render Blueprint is in `render.yaml`.

Run **one application instance** against a database. Request decisions are serialized in-process; database mutation transactions also take a PostgreSQL advisory lock to keep audit appends in order. This is not a horizontally scaled architecture.

## Verification

`npm test` runs the cross-user security suite on SQLite and an integration flow on the embedded PGlite PostgreSQL engine (21 reported test results in the latest local run). PGlite exercises the PostgreSQL schema, SQL syntax, byte storage, named grants, search, revocation, audit triggers, and transaction/sequence behavior. It does **not** verify the live Neon network/TLS connection or Render deployment. Those must still be checked after configuration.

`npm run test:mutations` changes temporary source copies and verifies that tests fail when document authorization, search filtering, session checks after request body arrival, or HMAC verification are removed. It does not modify the real source. Expected simulated audit-storage failures appear in test output; the corresponding test verifies that document changes roll back and downloads are refused.

## Project map

| File | Purpose |
| --- | --- |
| `server.mjs` | Reads deployment settings and starts HTTP server |
| `src/app.mjs` | Authentication, permissions, validation, API and audit logic |
| `src/database.mjs` | SQLite/PostgreSQL adapters and parameterized queries |
| `src/schema.sql`, `src/schema.postgres.sql` | Database tables, constraints and audit triggers |
| `public/` | Browser interface |
| `test/` | Negative access tests and PostgreSQL integration |
| `THREATS.md`, `API.md` | Security decisions and endpoint permissions |
| `LEARNING.md` | Candidate exercises and interview preparation |
| `DEMO.md`, `WRITEUP.md` | Demo plan and candidate write-up worksheet |

## Intentional omissions and remaining work

No self-registration, password reset UI, user provisioning UI, folder inheritance, anonymous/external links, online previews, antivirus service, historical version recovery, trash, MFA, OCR, or AI inside the product. Four seeded users are sufficient to demonstrate named-person permissions. Versions are counters and replacements; old bytes are not retained. Categories organize files without inherited access. Production uploads are capped at 40 documents per owner, 100 total, and 5 MB per document; audit/session storage still needs operational monitoring. Free tiers can sleep, pause or exhaust their quotas.

The candidate must personally learn and modify the authorization code, record a truthful video, complete the profile, clarify repository visibility timing with the placement cell, and submit the form. No claim of being production-certified or error-free is made.
