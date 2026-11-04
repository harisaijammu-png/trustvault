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
- Independent audit checkpoint retention and production backup recovery exercise.
- Candidate's own code-change exercise, five-minute video and final form answers.

Update this list as tasks are actually verified. Do not remove a limitation merely because configuration exists.
