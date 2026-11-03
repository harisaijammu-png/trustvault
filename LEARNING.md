# Learn TrustVault by explaining and changing it

This is your preparation worksheet, not a script to memorize. Do not claim understanding until you can answer and perform the exercises without AI writing the answer for you. The hiring rules allow AI but require you to walk through and modify your code live.

## Start with these ideas

1. **Browser:** runs `public/app.js`, shows forms, sends requests. A person can bypass every screen and send the request themselves.
2. **Server:** runs `src/app.mjs`; it must decide whether that request is allowed. A hidden button never protects data.
3. **Database:** stores accounts, sessions, documents, named grants and evidence. PostgreSQL is used in free cloud hosting; SQLite is the simple local option.
4. **Authentication:** “Which account is this?” A password gets checked once at sign-in. The browser then carries a random session cookie.
5. **Authorization:** “May this account perform this action on this exact document now?” This must happen on every document request.
6. **Transaction:** related database changes succeed together or are undone together. A document must not change without its matching audit event.

## Lesson 1 — Follow one download

Open `src/app.mjs`. Find `session`, `authorize`, and the `sub === 'content'` GET handler. Explain this path:

Browser request → session cookie lookup → active account/expiry check → document owner or named grant lookup → audit append → attachment bytes.

Explain these lines in your own words:

```js
const owner = doc.owner_id === actor.id;
const allowed = owner || (capability === 'read' && !!grant)
  || (capability === 'edit' && grant === 'edit');
if (!allowed) fail(404, 'Document unavailable');
```

`===` compares exact values. `||` means “or”. `&&` means “and”. `!!grant` turns a present grant into true. `throw` exits the current operation and enters error handling. `await` waits for asynchronous work before continuing. A capability of `owner` succeeds only through the `owner` part because the other two conditions don't match.

**Your exercise:** Draw the route on paper and answer: why can an administrator see audit records yet not download an ungranted file? Why does a read grant let a viewer download but not delete?

## Lesson 2 — Prove it with two accounts

Use two separate browser sessions. Alice uploads a fictional TXT file. Bob must not see it. Grant Bob read access; Bob can download. Revoke it; the same Bob session must fail on the next request. Check the activity view.

**Your explanation:** The cookie identifies Bob. It does not contain permanent document rights. The server asks the database for the current grant each time. Already-downloaded copies cannot be recalled.

**Your exercise:** Find all routes that use `authorize`. Explain which capability each requests. Then locate the separate visibility predicate in the document search query.

## Lesson 3 — Read a negative test

In `test/security.test.mjs`, find “other owner, viewer and administrator cannot reach ungranted document routes”. Read each request and expected status. A 404 here is expected security behavior, not an app crash.

Run `npm test`, then `npm run test:mutations`. Explain why the mutation command should print `CAUGHT` when a protection is removed in a temporary copy.

**Your change exercise:** Add a test proving a read grantee cannot replace a PNG file. Write the expectation yourself, run it, and explain why the server's central authorization rule handles the case. Do not weaken assertions to make a failure disappear.

## Lesson 4 — Audit evidence

Find `audit`, `transaction`, and `verifyAudit`. An event is JSON text. Each HMAC depends on the previous hash and current event. A secret key is needed to create a matching HMAC. This is different from encryption: the event text is readable.

**Your exercise:** Explain why changing an old event is detected. Then explain why removing the newest valid events may not be detected without an independently saved checkpoint. Explain why a database owner with the key is outside this trust boundary. Explain why PostgreSQL sequence numbers may skip after a rollback without evidence having been deleted.

## Lesson 5 — Safely change behavior

Choose a small real improvement, make the change, update relevant tests/docs, and commit it with the current time. Suggested exercise: reduce maximum upload size from 5 MB to 2 MB. Find every place that must agree: request/encoded bounds, validation, schema check, UI copy, tests, API/README. Think about existing files before changing a database constraint.

Then practise changing a policy: should edit grantees be allowed to change category? Modify your own local branch, update the correct negative test, explain how read versus edit works, and restore the chosen final policy. Do not submit an unreviewed experiment.

## Interview questions to answer without reading

- Where is the download authorization decision? What fails if it is removed?
- Where is search visibility enforced, and why isn't `authorize` alone enough?
- What can owners, viewers, editors, and administrators do?
- Why not use a public file URL or a long-lived signed link?
- What does “immediate revocation” mean, and what can it never undo?
- What happens if audit insertion fails halfway through an upload?
- Why authenticate after body arrival? What can change while `await` is waiting?
- What protects passwords? What protects cookies? What is CSRF?
- What does the audit chain detect, and what does it not detect?
- Why store file bytes in PostgreSQL? What tradeoffs come with buffering files?
- Why does free Render need an external database? Where do secrets live?
- Which features and live checks remain unfinished? Be specific.

## Suggested preparation sequence

First session: JavaScript variables, functions, objects, conditions, async/await, and one download. Next: two-account access/revocation demo. Next: run and explain security tests. Next: audit/transactions and your own small change. Finally: rehearse the five-minute demo and answer the questions above aloud. Use the remaining challenge time for real incremental work and learning; never manufacture earlier commits.
