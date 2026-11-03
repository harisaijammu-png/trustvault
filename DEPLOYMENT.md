# Free deployment: private GitHub + Render + Neon

Status: configuration and local database-engine tests prepared; cloud account setup and live checks are not yet completed.

## 1. Repository

Create an **empty private** repository named `trustvault` in `harisaijammu-png`. Do not add an initial README/license on GitHub; this workspace already has history. Set its remote and push the current `codex/trustvault` branch. In Render explicitly select that branch. Keep committing real work as it happens. Never backdate or manufacture a week's history.

The challenge asks for a public repository but prohibits making it public before the deadline. Ask the placement cell when to change visibility and how judges should access it; do not resolve this contradiction by guessing.

## 2. Free PostgreSQL

Create a Neon **Free** project and database using the provider's dashboard. Keep it isolated from all personal/real data. Copy its PostgreSQL connection string directly into Render's secret DATABASE_URL setting. Do not paste the connection string into this repository, README, screenshots, or submission form. The app enforces TLS certificate validation for hosted PostgreSQL.

Reference: [Neon Free plan](https://neon.com/pricing), [connection guide](https://neon.com/docs/connect/connect-from-any-app). Free limits may change; check the dashboard before creating resources. Select the free plan without enabling paid usage.

## 3. Render web service

Connect the private GitHub repository to Render. Choose a **Node web service**, not a static site. Select the Free instance. Settings:

| Setting | Value |
| --- | --- |
| Branch | `codex/trustvault` |
| Build | `npm ci --include=dev && npm run check && npm test` |
| Start | `npm start` |
| Health path | `/health` |
| NODE_ENV | `production` |
| APP_ORIGIN | Exact Render HTTPS origin, e.g. `https://your-actual-service.onrender.com` (no trailing slash) |
| DATABASE_URL | Neon PostgreSQL connection string |
| AUDIT_KEY | Random secret, at least 32 characters; preserve across deploys |
| DEMO_PASSWORD | New dedicated demo-only password, at least 12 characters; publish only this demo password for judges |

Generate AUDIT_KEY locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, or use Render Blueprint's generated secret. Save it securely outside Git. Losing/changing the key prevents the existing audit chain from verifying and the service intentionally refuses startup. Do not use the challenge login password for any application setting.

The included `render.yaml` configures the same free service and prompts for manual secrets. Using a Blueprint is optional. You may need to save the service, learn its actual hostname, then set APP_ORIGIN and redeploy. Until all required settings are present, startup intentionally fails.

Production requires DATABASE_URL so the app cannot accidentally put the vault in Render's temporary filesystem. The database schema and fictional seed accounts are created automatically on first startup. Existing data is not reseeded. Changing DEMO_PASSWORD after the first startup does not reset accounts. Local development accounts/data are not copied to the cloud.

Run one instance. Do not connect additional replicas or other apps to the same schema. Do not run the test suite with production DATABASE_URL; tests use isolated temporary/embedded databases.

## 4. Live verification — candidate checklist

1. Open the actual URL in a private browser; sign in as each role using the chosen demo password.
2. Upload a fictional TXT file as Alice. In another browser session as Bob, verify the file is absent and direct metadata/download requests are denied.
3. Grant the viewer read access. Confirm download works, editing does not. Revoke; retry the same URL with the same viewer session and confirm it fails.
4. Grant edit access; replace content, demonstrate stale-version rejection, and show editors cannot share/delete.
5. Sign in as administrator; verify activity and checkpoint; confirm admin cannot read an ungranted file. Export and retain a checkpoint outside Render/Neon.
6. Disable an account with an existing session; confirm it is refused, including after re-enable until it signs in again.
7. Redeploy/restart the service and confirm documents and audit records remain. Verify again and compare the earlier checkpoint appropriately (new records mean count/head advance; old prefix should still be present).
8. Test on another physical device. Free hosting can sleep: allow the first request to wake the service. Check current Render/Neon quotas and retain the environment for judging.
9. Record the real URL, demo credentials and live check date in README. Record the video from the actual deployed version. Do not tick the final submission box while these checks are pending.

Render filesystem reference: [persistent disks and ephemeral storage](https://render.com/docs/disks). This design needs no paid disk because the hosted database holds the bytes.

## Backups and recovery

For local SQLite, `npm run backup` creates a consistent database copy and checkpoint in ignored `backups/`. Preserve the development `data/audit.key` separately. To restore, stop the app, move the current `data` directory to a safe backup location, create a new `data` directory, copy the snapshot to `data/trustvault.db` and restore the original audit key. Restart, verify, and compare against an independently retained checkpoint. Never overwrite a live SQLite database or ignore its WAL file.

For production PostgreSQL use the provider's export/restore facilities or `pg_dump` against the dedicated database and store exports securely outside the host. Do not use the SQLite backup script for PostgreSQL. Free restore/retention windows may be limited; a checkpoint is evidence, not a document backup. Preserve AUDIT_KEY outside the database backup. Test recovery on a separate database before relying on it. Cloud recovery remains unverified until performed.
