# Proposed TrustVault design — review before implementation

Status: design only; no application behavior is implemented yet.

## Permission model

- A document owner can create documents and manage only documents they own.
- A viewer can read a document only with a named read or edit grant.
- An edit grant permits replacing file content and editing descriptive metadata, but never changing ownership, deleting the document, or granting other users access.
- An administrator can inspect global audit activity and manage account availability. The administrator role does not itself grant document content access. A document owner must explicitly grant that administrator access if required.
- A role must never substitute for a per-document authorization decision. The creator has implicit owner access; all other access requires a current grant.
- No public links, anonymous sharing, folder inheritance, or automatic AI permission changes in the initial scope.

## File access and revocation

Store files outside any public web directory. Resolve opaque document identifiers through the database, never as filesystem paths supplied by a client. Stream bytes through an authenticated server endpoint after checking the current document record and grants. Do not issue reusable public storage URLs or signed download URLs. Set private/no-store response headers and prevent intermediary caching.

Define immediate revocation honestly: subsequent server requests fail after the revoke transaction commits, including requests using an already-issued login session. A server cannot erase bytes already downloaded, undo a screenshot, or retract bytes already sent in an in-flight response. Avoid claiming otherwise.

Perform the authorization check and the relevant database change together to avoid check/use races. A file response should use the authorized version, rather than resolving a mutable pathname after the check.

## Sessions and inputs

Use opaque, server-stored sessions, strong password hashing, secure cookie settings in deployment, session expiry, and server-enforced account state. Require CSRF defenses for state-changing operations. Rate-limit authentication and apply upload/request limits before processing unbounded input. Do not put session tokens in URLs or browser local storage.

Validate upload length, supported file types and signatures, and filenames. Treat all uploaded content as hostile. Prefer attachment downloads with `nosniff`; never serve uploaded HTML or SVG as same-origin executable pages. Do not claim that signature validation is antivirus scanning.

## Audit evidence

Record actor, action, target, outcome, timestamp, and a request identifier. Include denied authenticated document requests. Never include passwords, session secrets, or document bytes in logs. Successful sensitive changes and their audit event must be atomic; a failed audit write must not silently allow an unrecorded operation.

An append-only table and chained HMAC records can reveal modification to existing events when the verification key remains protected. They do not make a database administrator powerless: deleting a suffix or restoring an older database requires an independently retained checkpoint to detect. Document this limit and provide a checkpoint export mechanism before describing the audit as tamper-evident. Application roles receive no audit update/delete route.

## Initial tests

Use at least two owners, a viewer, and an administrator. Exercise every document route with absent grants, read grants, edit grants, revoked grants, and a disabled account. Check denied metadata/search as well as denied bytes. Verify editors cannot grant access or delete, administrators cannot automatically read files, and crafted input cannot change ownership/roles. Mutation testing should prove that removing a central access check causes test failures.

## Deliberate initial exclusions

External anonymous sharing, OCR, AI suggestions inside the product, public previews, document retention policies, distributed storage, and rich document editing. Implementing fewer features leaves time to verify the access boundary.
