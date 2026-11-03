import { createVault } from './src/app.mjs';

const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const app = await createVault({
  dataDir: process.env.DATA_DIR || './data',
  auditKey: process.env.AUDIT_KEY,
  seedPassword: process.env.DEMO_PASSWORD || (production ? undefined : 'Learn-TrustVault-2026!'),
  production,
  origin: process.env.APP_ORIGIN || (production ? undefined : `http://localhost:${port}`),
});
app.server.listen(port, '0.0.0.0', () => console.log(`TrustVault listening on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => app.server.close(() => { app.close(); process.exit(0); }));
}
