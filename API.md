# TrustVault API

All routes are same-origin. JSON bodies use `Content-Type: application/json`. Mutating requests require the exact configured `Origin` header; authenticated mutations additionally require `X-CSRF-Token` from the sign-in/session response. Authentication uses the HttpOnly `tv_session` cookie. There is no CORS allowance and no bearer token in a URL. Responses are private/no-store. Only the routes and methods below are supported.

| Method / endpoint | Who | Body / result |
| --- | --- | --- |
| GET `/health` | Anyone | Liveness only; does not query the database |
| POST `/api/login` | Anyone within throttling limits | `{email,password}`; returns public user, CSRF token and cookie |
| GET `/api/session` | Active authenticated user | Current public user and CSRF token |
| POST `/api/logout` | Active authenticated user | `{}`; removes current server session |
| GET `/api/users` | Active authenticated user | Demo company directory; no hashes/tokens |
| PATCH `/api/users/:userId` | Administrator; cannot change self | `{active:boolean}`; invalidates all target sessions |
| GET `/api/documents` | Active authenticated user | Only owned/explicitly granted documents; filters `name`, `owner`, `category`, `from`, `to`; dates YYYY-MM-DD UTC creation dates; max 200 |
| POST `/api/documents` | Owner role | `{name,category,base64}`; server sets owner and identifier; returns metadata |
| GET `/api/documents/:id` | Document owner or named read/edit grantee | Metadata and effective access; inspection audited |
| GET `/api/documents/:id/content` | Document owner or named read/edit grantee | File bytes as attachment; current version audited before delivery |
| PATCH `/api/documents/:id` | Document owner or named edit grantee | `{category,version}`; exact current version required |
| PUT `/api/documents/:id/content` | Document owner or named edit grantee | `{name,category,base64,version}`; replaces bytes and increments version |
| DELETE `/api/documents/:id` | Document owner only | Permanently removes document and grants, keeps audit |
| GET `/api/documents/:id/grants` | Document owner only | Named grants `{userId,permission,name,email}` |
| POST `/api/documents/:id/grants` | Document owner only | `{userId,permission:"read"|"edit"}`; grants or updates existing grant; no self grant |
| DELETE `/api/documents/:id/grants/:userId` | Document owner only | Revokes grant; subsequent requests recheck database |
| GET `/api/audit` | Owner role or administrator | Latest 200 events; admin all, owner their own actions plus events targeting their current documents |
| GET `/api/audit/verify` | Administrator only | Chain validation, count/head checkpoint and limitations |

Unknown fields are rejected on mutation bodies. User IDs are the seeded values `alice`, `bob`, `viewer`, and `admin`; document IDs are opaque UUIDs. No method can change a user's role or a document's owner.

## Errors

- 400 invalid fields, unsupported file, invalid dates or filename.
- 401 missing, expired, invalidated or disabled-account session; failed sign-in uses a generic message.
- 403 wrong role, CSRF failure, or wrong/missing origin.
- 404 both nonexistent and inaccessible document; avoids an existence distinction.
- 405 unsupported method; 409 stale version or document quota reached.
- 413 JSON request too large; 415 unsupported request content type.
- 429 sign-in attempts exceeded; 500/503 generic internal/audit failure with request ID.

Upload limits: 1 byte–5 MB decoded; supported extensions and basic signatures: TXT (strict UTF-8, no binary control characters), PDF (`%PDF-`), PNG signature, JPEG signature. Signature matching does not establish file safety or full structural validity. The request body is capped near 7 MB. Files are always attachments, never same-origin HTML previews.

## Audit events

`system.seed`, `auth.login`, `auth.logout`, `user.status`, `document.upload`, `document.inspect`, `document.download`, `document.metadata`, `document.replace`, `document.delete`, `permission.grant`, `permission.revoke`, `request.refused`.

Each event has UTC timestamp, actor identifier (or null), action, target, outcome, request UUID and bounded contextual detail. It is stored with the previous hash and an HMAC-SHA256 hash. Public listing/search is not recorded as a successful download. Invalid document-route requests and permission/CSRF failures are recorded as denied. File delivery audit means authorized server delivery, not verified human reading.
