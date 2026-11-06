# Five-minute candidate demo plan

Record only after live deployment and checks. Show actual working behavior. Do not present this plan as a completed video. Use fictional documents and hide all hosting/database secrets and challenge credentials.

| Time | Show | Explain in your own words |
| --- | --- | --- |
| 0:00–0:30 | Live URL, your name, login as Alice | Problem and chosen small scope; AI assistance disclosed |
| 0:30–1:15 | Upload TXT, category/name/date search | File constraints, immutable owner, database bytes outside public static files |
| 1:15–2:15 | Separate Bob/viewer session, grant read then edit | Before grant denied; read downloads but cannot edit/share/delete; edit can replace |
| 2:15–2:55 | Revoke; retry using same viewer session and URL | Fresh server decision every request; downloaded copies are outside revocation's reach |
| 2:55–3:35 | Admin activity and verification/checkpoint | Allowed/denied actions, no automatic admin file access, HMAC limits/external checkpoint |
| 3:35–4:20 | Central authorization code, negative test and mutation output | Point to real code and explain what breaks when the check is removed |
| 4:20–5:00 | PROMPTS.md correction, tests, unfinished list | Real AI mistakes caught; free hosting, accepted risks, things deliberately not built |

Before recording, independently perform these actions yourself. Keep the video under five minutes and make the URL accessible to judges. Do not include another candidate or share your private repository with one.

## November 6 recording rehearsal

- Sign in as Alice and Vikram in separate browser sessions before recording. Use the fictional `alice-test.txt`.
- Show Alice grant Read access, then switch to Vikram and download the file. Return to Alice, revoke the grant, and refresh Vikram's vault.
- Open Alice's Activity tab and point out the download and revocation entries. Explain in your own words that the server checks access on each request.
- Play back the saved video to check that the voice and on-screen text are clear.
