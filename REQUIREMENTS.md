# TrustVault — challenge checklist

Source: https://hackathon.snovasys.com/project/695 and https://hackathon.snovasys.com/event/2/instruction, read 2026-11-03.
Original invitation deadline: 2026-11-07, 18:00 Asia/Kolkata. The candidate supplied portal screenshots on 7 November showing 2026-11-09, 18:00 for the RISE event. Confirm the changed deadline with the placement cell.

## Required application behavior

- Authentication with administrator, document owner, and viewer roles; document each role.
- Upload, organize, search, and manage documents.
- Named per-document read/edit grants; owners grant and revoke access.
- Enforce authorization on the server for metadata, content, downloads, updates, and deletion.
- Revocation invalidates previous access immediately for subsequent requests.
- Audit successful uploads, downloads, changes, deletions, grants/revocations, and refused attempts.
- Protect audit evidence against undetected modification; document the trust boundary.
- Search by name, owner, category, and date without leaking unauthorized documents.
- Validate uploads.
- Administrative activity and permission-change view.
- Automated cross-user isolation tests, including negative tests that fail when an authorization check is removed.

## Deliverables

- Git repository with real incremental commits. Keep private before the deadline.
- Resolve contradictory public-repository timing with the placement cell.
- Live deployment, seed data, and README credentials for each demo role.
- THREATS.md with mitigations, accepted risks, and matching tests.
- PROMPTS.md updated as work happens: at least five dated, truthful entries, including at least two security/audit entries. Link actual correction commits. Do not invent mistakes or backdate work.
- Database schema, setup scripts, clean-clone deployment instructions.
- API documentation with permissions for every endpoint.
- Five-minute demo video recorded by the candidate.
- Short write-up describing working scope, deliberate exclusions, permissions, AI corrections, and unfinished work.
- Candidate completes profile and personally submits the final evaluation form.

## Evaluation

Security 35; threat thinking 15; functionality 15; AI use 15; engineering 10; documentation/deployment/demo 10.

## Verification gates

1. Test each role and each document operation, including guessed IDs and alternate methods.
2. Test unauthorized search/metadata/content access and immediate revocation with an existing session.
3. Test invalid/malicious uploads, cookie/session behavior, and audit integrity.
4. Remove an authorization check temporarily and confirm the security tests fail; restore the check.
5. Test a clean setup and the deployed URL in a private browser. Candidate also verifies on another device.
6. Only claim features verified in the submitted version. Record all remaining limitations.
