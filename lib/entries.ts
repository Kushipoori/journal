import { deleteMedia } from '@/lib/media';
import type {
  Attachment,
  AttachmentKind,
  Energy,
  Entry,
  EntryWithAttachments,
  Mood,
  VoiceMetrics,
} from '@/lib/types';
import type { SQLiteDatabase } from 'expo-sqlite';

type EntryRow = {
  id: string;
  title: string;
  body: string;
  mood: string | null;
  energy: string | null;
  created_at: number;
  updated_at: number;
};

type AttachmentRow = {
  id: string;
  entry_id: string;
  kind: string;
  file_name: string;
  mime_type: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  transcript: string | null;
  language: string | null;
  metrics: string | null;
  position: number;
  created_at: number;
};

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    mood: row.mood as Mood | null,
    energy: row.energy as Energy | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseMetrics(json: string | null): VoiceMetrics | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as VoiceMetrics;
  } catch {
    return null;
  }
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    entryId: row.entry_id,
    kind: row.kind as AttachmentKind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    durationMs: row.duration_ms,
    width: row.width,
    height: row.height,
    transcript: row.transcript,
    language: row.language,
    metrics: parseMetrics(row.metrics),
    position: row.position,
    createdAt: row.created_at,
  };
}

async function withAttachments(
  db: SQLiteDatabase,
  rows: EntryRow[]
): Promise<EntryWithAttachments[]> {
  if (rows.length === 0) return [];
  const attachmentRows = await db.getAllAsync<AttachmentRow>(
    `SELECT * FROM attachments
     WHERE entry_id IN (SELECT value FROM json_each($ids))
     ORDER BY position`,
    { $ids: JSON.stringify(rows.map((row) => row.id)) }
  );
  const byEntry = new Map<string, Attachment[]>();
  for (const row of attachmentRows) {
    const list = byEntry.get(row.entry_id) ?? [];
    list.push(toAttachment(row));
    byEntry.set(row.entry_id, list);
  }
  return rows.map((row) => ({ ...toEntry(row), attachments: byEntry.get(row.id) ?? [] }));
}

export async function listEntries(db: SQLiteDatabase, search = '') {
  const query = search.trim();
  const rows = query
    ? await db.getAllAsync<EntryRow>(
        `SELECT DISTINCT e.* FROM entries e
         LEFT JOIN attachments a ON a.entry_id = e.id
         WHERE e.title LIKE $q OR e.body LIKE $q OR a.transcript LIKE $q
         ORDER BY e.created_at DESC`,
        { $q: `%${query}%` }
      )
    : await db.getAllAsync<EntryRow>('SELECT * FROM entries ORDER BY created_at DESC');
  return withAttachments(db, rows);
}

export async function getEntry(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE id = ?', id);
  if (!row) return null;
  const [entry] = await withAttachments(db, [row]);
  return entry;
}

/**
 * Upserts the entry and makes its attachment rows match `entry.attachments` exactly.
 * Files of attachments that were dropped are deleted after the transaction commits.
 */
export async function saveEntry(db: SQLiteDatabase, entry: EntryWithAttachments) {
  const removedFiles: string[] = [];
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO entries (id, title, body, mood, energy, created_at, updated_at)
       VALUES ($id, $title, $body, $mood, $energy, $createdAt, $updatedAt)
       ON CONFLICT (id) DO UPDATE SET
         title = excluded.title, body = excluded.body, mood = excluded.mood,
         energy = excluded.energy, created_at = excluded.created_at, updated_at = excluded.updated_at`,
      {
        $id: entry.id,
        $title: entry.title,
        $body: entry.body,
        $mood: entry.mood,
        $energy: entry.energy,
        $createdAt: entry.createdAt,
        $updatedAt: entry.updatedAt,
      }
    );

    const keep = new Set(entry.attachments.map((attachment) => attachment.id));
    const existing = await db.getAllAsync<{ id: string; file_name: string }>(
      'SELECT id, file_name FROM attachments WHERE entry_id = ?',
      entry.id
    );
    for (const row of existing) {
      if (keep.has(row.id)) continue;
      await db.runAsync('DELETE FROM attachments WHERE id = ?', row.id);
      removedFiles.push(row.file_name);
    }

    for (const [position, attachment] of entry.attachments.entries()) {
      await db.runAsync(
        `INSERT INTO attachments (id, entry_id, kind, file_name, mime_type, duration_ms, width, height,
                                  transcript, language, metrics, position, created_at)
         VALUES ($id, $entryId, $kind, $fileName, $mimeType, $durationMs, $width, $height,
                 $transcript, $language, $metrics, $position, $createdAt)
         ON CONFLICT (id) DO UPDATE SET position = excluded.position, transcript = excluded.transcript`,
        {
          $id: attachment.id,
          $entryId: entry.id,
          $kind: attachment.kind,
          $fileName: attachment.fileName,
          $mimeType: attachment.mimeType,
          $durationMs: attachment.durationMs,
          $width: attachment.width,
          $height: attachment.height,
          $transcript: attachment.transcript,
          $language: attachment.language,
          $metrics: attachment.metrics ? JSON.stringify(attachment.metrics) : null,
          $position: position,
          $createdAt: attachment.createdAt,
        }
      );
    }
  });
  removedFiles.forEach(deleteMedia);
}

export async function deleteEntry(db: SQLiteDatabase, id: string) {
  const files = await db.getAllAsync<{ file_name: string }>(
    'SELECT file_name FROM attachments WHERE entry_id = ?',
    id
  );
  await db.runAsync('DELETE FROM entries WHERE id = ?', id);
  files.forEach((row) => deleteMedia(row.file_name));
}

export type Memory = { label: string; entry: EntryWithAttachments };

function dayRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()] as const;
}

/** "On this day": the same calendar day in earlier years, then a month ago and a week ago. */
export async function getMemories(db: SQLiteDatabase, now = new Date()): Promise<Memory[]> {
  const lookbacks: { label: string; date: Date }[] = [];
  for (let years = 1; years <= 10; years++) {
    const date = new Date(now);
    date.setFullYear(now.getFullYear() - years);
    lookbacks.push({ label: years === 1 ? 'A year ago today' : `${years} years ago today`, date });
  }
  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);
  lookbacks.push({ label: 'A month ago', date: monthAgo });
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  lookbacks.push({ label: 'A week ago', date: weekAgo });

  const memories: Memory[] = [];
  for (const { label, date } of lookbacks) {
    const [start, end] = dayRange(date);
    const rows = await db.getAllAsync<EntryRow>(
      'SELECT * FROM entries WHERE created_at >= ? AND created_at < ? ORDER BY created_at',
      start,
      end
    );
    for (const entry of await withAttachments(db, rows)) {
      memories.push({ label, entry });
    }
  }
  return memories;
}

/** Recent voice-energy scores, so a new recording is judged against how *you* usually sound. */
export async function getEnergyBaseline(db: SQLiteDatabase, limit = 30) {
  const rows = await db.getAllAsync<{ metrics: string }>(
    `SELECT metrics FROM attachments
     WHERE kind = 'voice' AND metrics IS NOT NULL
     ORDER BY created_at DESC LIMIT ?`,
    limit
  );
  return rows
    .map((row) => parseMetrics(row.metrics)?.score)
    .filter((score): score is number => typeof score === 'number');
}
