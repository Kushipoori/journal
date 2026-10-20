import type { Energy, VoiceMetrics } from '@/lib/types';
import { classifyEnergy, computeVoiceMetrics } from '@/lib/voice/energy';
import { countWords, rawTranscript, tidyTranscript, type TimedSegment } from '@/lib/voice/tidy';

export type VoiceCapture = {
  /** Temp file written by the recognizer; null if the platform couldn't save audio. */
  audioUri: string | null;
  segments: TimedSegment[];
  /** Input level samples every ~100 ms, -2..10. */
  levels: number[];
  durationMs: number;
  /** Locale(s) used, e.g. "en-IN" or "hi-IN+en-IN". */
  language: string;
};

export type ProcessedVoice = {
  /** Text to place in the entry body. */
  text: string;
  /** Untouched transcript, stored on the voice clip. */
  transcript: string;
  metrics: VoiceMetrics | null;
  energy: Energy | null;
};

/**
 * The one seam between "what was said" and "what goes in the journal".
 * Today it is rule-based and on-device. An AI processor (rewrite a ramble into a clean entry,
 * transliterate Hinglish, read mood from tone) implements the same interface and replaces
 * `voiceProcessor` below, without touching the screens.
 */
export interface VoiceProcessor {
  process(
    capture: VoiceCapture,
    context: { tidy: boolean; baseline: number[] }
  ): Promise<ProcessedVoice>;
}

const onDeviceProcessor: VoiceProcessor = {
  async process(capture, { tidy, baseline }) {
    const transcript = rawTranscript(capture.segments);
    const text = tidy ? tidyTranscript(capture.segments) : transcript;
    const metrics = computeVoiceMetrics(capture.levels, countWords(transcript), capture.durationMs);
    const energy = metrics ? classifyEnergy(metrics.score, baseline) : null;
    return { text, transcript, metrics, energy };
  },
};

export const voiceProcessor: VoiceProcessor = onDeviceProcessor;
