import type { VoiceLanguage } from '@/lib/speech/languages';
import {
  buildRecognitionOptions,
  describeSpeechError,
  type SpeechSupport,
} from '@/lib/speech/recognition';
import type { VoiceCapture } from '@/lib/voice/pipeline';
import type { TimedSegment } from '@/lib/voice/tidy';
import { File } from 'expo-file-system';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as React from 'react';

export type CaptureStatus = 'idle' | 'starting' | 'listening' | 'stopping';

type Session = {
  startedAt: number;
  segments: TimedSegment[];
  interim: string;
  levels: number[];
  audioUri: string | null;
  language: string;
  stoppedByUser: boolean;
  cancelled: boolean;
};

const METER_SAMPLES = 36;

function discardFile(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Temp file in the cache dir; the OS will clear it eventually.
  }
}

/**
 * Continuous speech-to-text that also keeps the audio. Final utterances arrive one by one;
 * `interim` is the words still being recognised. When the session ends, `onComplete` gets
 * everything (unless it was cancelled).
 */
export function useVoiceCapture(
  onComplete: (capture: VoiceCapture, info: { endedBySystem: boolean }) => void
) {
  const [status, setStatus] = React.useState<CaptureStatus>('idle');
  const [segments, setSegments] = React.useState<TimedSegment[]>([]);
  const [interim, setInterim] = React.useState('');
  const [meter, setMeter] = React.useState<number[]>([]);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const session = React.useRef<Session | null>(null);
  const onCompleteRef = React.useRef(onComplete);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  React.useEffect(() => {
    if (status !== 'listening') return;
    const timer = setInterval(() => {
      if (session.current) setElapsedMs(Date.now() - session.current.startedAt);
    }, 250);
    return () => clearInterval(timer);
  }, [status]);

  // Never leave the mic running if the screen goes away mid-recording.
  React.useEffect(() => {
    return () => {
      if (session.current) {
        session.current.cancelled = true;
        ExpoSpeechRecognitionModule.abort();
      }
    };
  }, []);

  useSpeechRecognitionEvent('start', () => {
    if (!session.current) return;
    session.current.startedAt = Date.now();
    setStatus('listening');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const current = session.current;
    if (!current) return;
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (event.isFinal) {
      if (text) current.segments.push({ text, atMs: Date.now() - current.startedAt });
      current.interim = '';
      setSegments([...current.segments]);
      setInterim('');
    } else {
      current.interim = text;
      setInterim(text);
    }
  });

  useSpeechRecognitionEvent('volumechange', ({ value }) => {
    const current = session.current;
    if (!current) return;
    current.levels.push(value);
    setMeter((previous) => [...previous.slice(1 - METER_SAMPLES), value]);
  });

  useSpeechRecognitionEvent('audiostart', ({ uri }) => {
    if (session.current && uri) session.current.audioUri = uri;
  });

  useSpeechRecognitionEvent('audioend', ({ uri }) => {
    if (session.current && uri) session.current.audioUri = uri;
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') return;
    const current = session.current;
    const heardSomething = !!current && (current.segments.length > 0 || !!current.interim);
    if ((event.error === 'no-speech' || event.error === 'speech-timeout') && heardSomething) return;
    setError(
      event.error === 'no-speech' || event.error === 'speech-timeout'
        ? "Didn't catch any speech. Try again a little closer to the phone."
        : describeSpeechError(event.error, event.message)
    );
  });

  useSpeechRecognitionEvent('end', () => {
    const finished = session.current;
    session.current = null;
    setStatus('idle');
    setInterim('');
    if (!finished) return;
    if (finished.cancelled) {
      discardFile(finished.audioUri);
      return;
    }
    if (finished.interim) {
      finished.segments.push({ text: finished.interim, atMs: Date.now() - finished.startedAt });
    }
    const durationMs = Date.now() - finished.startedAt;
    // Nothing recognised: keep the audio only if it's long enough to plausibly matter
    // (e.g. recognition failed on the network but you did talk).
    if (finished.segments.length === 0 && (!finished.audioUri || durationMs < 3000)) {
      discardFile(finished.audioUri);
      return;
    }
    onCompleteRef.current(
      {
        audioUri: finished.audioUri,
        segments: finished.segments,
        levels: finished.levels,
        durationMs,
        language: finished.language,
      },
      { endedBySystem: !finished.stoppedByUser }
    );
  });

  const start = React.useCallback(
    async (language: VoiceLanguage, support: SpeechSupport, preferOffline: boolean) => {
      if (session.current) return;
      setError(null);
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError(describeSpeechError('not-allowed', ''));
        return;
      }
      const { options, storedLanguage } = buildRecognitionOptions(language, support, {
        preferOffline,
      });
      session.current = {
        startedAt: Date.now(),
        segments: [],
        interim: '',
        levels: [],
        audioUri: null,
        language: storedLanguage,
        stoppedByUser: false,
        cancelled: false,
      };
      setSegments([]);
      setInterim('');
      setMeter([]);
      setElapsedMs(0);
      setStatus('starting');
      try {
        ExpoSpeechRecognitionModule.start(options);
      } catch (startError) {
        session.current = null;
        setStatus('idle');
        setError(startError instanceof Error ? startError.message : String(startError));
      }
    },
    []
  );

  const stop = React.useCallback(() => {
    if (!session.current) return;
    session.current.stoppedByUser = true;
    setStatus('stopping');
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const cancel = React.useCallback(() => {
    if (!session.current) return;
    session.current.cancelled = true;
    setStatus('stopping');
    ExpoSpeechRecognitionModule.abort();
  }, []);

  return { status, segments, interim, meter, elapsedMs, error, start, stop, cancel };
}
