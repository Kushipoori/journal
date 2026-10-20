import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'journal.db';

// Append-only. Each item runs once, in order, and bumps PRAGMA user_version.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE entries (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    mood TEXT,
    energy TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_entries_created ON entries (created_at DESC);

  CREATE TABLE attachments (
    id TEXT PRIMARY KEY NOT NULL,
    entry_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('voice', 'audio', 'image', 'video')),
    file_name TEXT NOT NULL,
    mime_type TEXT,
    duration_ms INTEGER,
    width INTEGER,
    height INTEGER,
    transcript TEXT,
    language TEXT,
    metrics TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_attachments_entry ON attachments (entry_id, position);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
