import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Each adapter has the same small asynchronous interface. The request lock in
// app.mjs keeps this single-instance demonstration's decisions sequential.
export async function openDatabase(dataDir, databaseUrl) {
  if (!databaseUrl) {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(resolve(dataDir, 'trustvault.db'));
    db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    return {
      kind: 'sqlite',
      get: async (sql, ...args) => db.prepare(sql).get(...args),
      all: async (sql, ...args) => db.prepare(sql).all(...args),
      run: async (sql, ...args) => db.prepare(sql).run(...args),
      begin: async () => db.exec('BEGIN IMMEDIATE'),
      commit: async () => db.exec('COMMIT'),
      rollback: async () => db.exec('ROLLBACK'),
      close: async () => db.close(),
    };
  }
  const { Client } = await import('pg');
  const db = new Client(postgresConnectionOptions(databaseUrl));
  db.on('error', () => { console.error('Database connection lost; exiting so the host can restart the service.'); process.exit(1); });
  await db.connect();
  await db.query(readFileSync(new URL('./schema.postgres.sql', import.meta.url), 'utf8'));
  return postgresAdapter(db);
}

export function postgresConnectionOptions(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL URL');
  // A URL's ssl=false/sslmode options can override pg's explicit SSL object.
  // This app needs no URL tuning parameters; discard all of them.
  url.search = '';
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true }, enableChannelBinding: true, connectionTimeoutMillis: 20000, statement_timeout: 20000 };
}

export function postgresAdapter(db) {
  const convert = sql => {
    let index = 0;
    return sql.replaceAll('json_extract(a.event,\'$.actorId\')', "(a.event::jsonb->>'actorId')")
      .replaceAll('json_extract(a.event,\'$.target\')', "(a.event::jsonb->>'target')")
      .replaceAll('instr(lower(d.name),lower(?))>0', 'strpos(lower(d.name),lower(?))>0')
      .replaceAll('instr(lower(u.name),lower(?))>0', 'strpos(lower(u.name),lower(?))>0')
      .replaceAll('instr(lower(d.category),lower(?))>0', 'strpos(lower(d.category),lower(?))>0')
      .replace(/\?/g, () => `$${++index}`);
  };
  const query = async (sql, args) => (await db.query(convert(sql), args)).rows;
  return {
    kind: 'postgres',
    get: async (sql, ...args) => (await query(sql, args))[0],
    all: async (sql, ...args) => query(sql, args),
    run: async (sql, ...args) => db.query(convert(sql), args),
    // The transaction-scoped lock also serializes mutations across accidental
    // overlapping deploy processes, preserving the single audit chain.
    begin: async () => { await db.query('BEGIN'); await db.query('SELECT pg_advisory_xact_lock(7953152026)'); },
    commit: async () => db.query('COMMIT'),
    rollback: async () => db.query('ROLLBACK'),
    close: async () => db.end(),
  };
}
