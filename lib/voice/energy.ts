import type { Energy, VoiceMetrics } from '@/lib/types';

// A deliberately simple, explainable read of vocal energy from loudness, pace and how much the
// voice moves around. It is not emotion detection; that's a job for a trained model later, and the
// raw metrics are stored on each clip so such a model can be added without losing history.

/** Recognizer volume (-2..10) above which we treat the frame as speech. */
const SPEAKING_LEVEL = 1;

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function normalize(value: number, low: number, high: number) {
  return Math.min(1, Math.max(0, (value - low) / (high - low)));
}

export function computeVoiceMetrics(
  levels: number[],
  wordCount: number,
  durationMs: number
): VoiceMetrics | null {
  if (durationMs < 5000 || levels.length < 20) return null;
  const speaking = levels.filter((level) => level > SPEAKING_LEVEL);
  const speakingRatio = speaking.length / levels.length;
  const avgLevel = mean(speaking);
  const variability = standardDeviation(speaking);
  const wordsPerMinute = wordCount / (durationMs / 60000);

  const score =
    0.4 * normalize(avgLevel, 2, 8) +
    0.35 * normalize(wordsPerMinute, 60, 170) +
    0.25 * normalize(variability, 0.5, 2.5);

  return {
    durationMs,
    speakingRatio: round(speakingRatio),
    avgLevel: round(avgLevel),
    variability: round(variability),
    wordsPerMinute: Math.round(wordsPerMinute),
    score: round(score),
  };
}

/**
 * Microphones and speaking distance vary a lot, so once there is enough history the score is
 * compared to your own recent average instead of fixed thresholds.
 */
export function classifyEnergy(score: number, baseline: number[]): Energy {
  if (baseline.length >= 5) {
    const average = mean(baseline);
    const spread = Math.max(standardDeviation(baseline), 0.06);
    const z = (score - average) / spread;
    if (z <= -0.8) return 'low';
    if (z >= 0.8) return 'high';
    return 'steady';
  }
  if (score < 0.35) return 'low';
  if (score > 0.65) return 'high';
  return 'steady';
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
