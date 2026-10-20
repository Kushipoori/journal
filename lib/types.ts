export type AttachmentKind =
  /** Spoken entry: audio recorded while it was transcribed. Keeps the original audio. */
  | 'voice'
  /** Plain audio recording, no transcript (music, ambience, a voice note you don't want written down). */
  | 'audio'
  | 'image'
  | 'video';

export type Mood = 'awful' | 'low' | 'okay' | 'good' | 'great';

/** Rough read of how you sounded, from loudness and pace. Not AI; see lib/voice/energy.ts. */
export type Energy = 'low' | 'steady' | 'high';

export type VoiceMetrics = {
  durationMs: number;
  /** Share of the recording where the input level suggests you were speaking (0–1). */
  speakingRatio: number;
  /** Mean input level while speaking, on the recognizer's -2..10 scale. */
  avgLevel: number;
  /** Standard deviation of the level while speaking: flat vs. animated delivery. */
  variability: number;
  wordsPerMinute: number;
  /** Combined 0–1 energy score. */
  score: number;
};

export type Attachment = {
  id: string;
  entryId: string;
  kind: AttachmentKind;
  /** File name inside the app's media directory. Never an absolute path: iOS moves the app container on update. */
  fileName: string;
  mimeType: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  /** Raw, untouched transcript for voice clips. */
  transcript: string | null;
  /** BCP-47 locale (or mixed pair like "hi-IN+en-IN") the clip was transcribed with. */
  language: string | null;
  metrics: VoiceMetrics | null;
  position: number;
  createdAt: number;
};

export type Entry = {
  id: string;
  title: string;
  body: string;
  mood: Mood | null;
  energy: Energy | null;
  createdAt: number;
  updatedAt: number;
};

export type EntryWithAttachments = Entry & { attachments: Attachment[] };
