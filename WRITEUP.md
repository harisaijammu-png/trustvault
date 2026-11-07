# Candidate write-up worksheet — rewrite in your own words

This file is a factual preparation worksheet, **not a completed personal statement**. Verify every item against the deployed version and write your final answers yourself. Do not claim independent authorship of AI output or understanding you have not yet demonstrated.

## Built scope

TrustVault has four fictional accounts across three roles. Owners upload and categorize documents, search within their visible set, assign named read/edit grants, replace files with version checks, and revoke/delete. Administrators review activity and manage account availability without automatically reading documents. Files, grants, sessions and evidence are stored in a hosted PostgreSQL database in deployment, with SQLite available for local learning.

## Permission model to explain

The creator owns the document. Other accounts need a current named grant. Read allows metadata/download. Edit adds category/content changes. Only the owner controls grants and deletion. Role does not automatically widen document access. Server routes enforce these rules, and search has its own database visibility condition.

## AI use and corrections to discuss

Use the actual PROMPTS.md entries: cached session state during body arrival, oversized base64 validation failure, hosting budget/storage redesign, and PostgreSQL/testing adjustments. Read the source and reproduce the tests before stating that you caught/understood any issue. AI generated much of the initial implementation; the candidate's own learning, decisions and subsequent changes must be described honestly.

## Deliberate omissions

No public sharing links, registration/reset UI, online previews, antivirus service, MFA, folder inheritance, historical file recovery or AI auto-sharing. These reduce the scope to a named-person access boundary that can be tested. PDF/image signature checks do not make files malware-free.

## Current unfinished items

- Remaining live security scenarios and host-header/TLS review (deployment, basic browser flows, restart persistence and mobile use are now candidate-verified).
- Clarification of repository visibility timing with the placement cell.
- Candidate reports saving a checkpoint independently. Logical production export and separate-test-database restore passed; full restored-application/HMAC validation and checkpoint comparison remain follow-ups.
- Candidate's own code-change exercise, five-minute video and final form answers.

Update this list as tasks are actually verified. Do not remove a limitation merely because configuration exists.

## Form preparation updated 7 November

Review these factual notes and write the personal answers in your own words.

### 1. Problem solved

Share documents with specific people, allow reading or editing separately, remove future access, and retain a record of allowed and refused actions.

### 2. Working scope

Four fictional accounts demonstrate owner, viewer and administrator roles. Owners upload, search, categorize, replace and delete documents, grant named Read/Edit access and revoke it. Administrators inspect audit records, verify/export checkpoints and disable accounts without automatic document access. Render hosts the app and Neon stores files, sessions and activity. Local tests and live permission checks are recorded in VERIFICATION.md.

### 3. Exact local setup

Install Node.js 25.8.1, then run these commands in order.

```sh
git clone --branch codex/trustvault https://github.com/harisaijammu-png/trustvault.git
cd trustvault
npm ci
npm run check
npm test
npm run test:mutations
npm start
```

Open http://localhost:3000 and use the local demo accounts/password listed in README. The default SQLite setup initializes automatically. A private repository requires authorized GitHub access until visibility is resolved. Hosted production uses PostgreSQL, while the local default uses SQLite.

### 4. AI tools

OpenAI Codex assisted with implementation, debugging, tests, documentation and deployment troubleshooting. AI generated much of the initial implementation. Candidate manual verification and understanding must be described separately.

### 5. AI corrections to explain

PROMPTS.md records actual changes and commit links. Examples include rechecking account/session state after receiving a request body, rejecting malformed/oversized upload encoding, choosing persistent PostgreSQL for free hosting and preserving audit correctness across PostgreSQL transaction behavior. The candidate must explain which issues they personally reproduced or understood. Do not claim that AI-written fixes were independently written by the candidate.

### 6. Unfinished work and limitations

No registration/password-reset UI, historical content recovery, antivirus service, MFA or independent automatic checkpoint retention. A downloaded copy cannot be withdrawn. Free hosting can sleep and quotas are limited. Full application/HMAC verification of the restored database remains pending. Some live adversarial checks remain outside the verified scope. Candidate explanation/code-change practice and complete video review remain pending.
