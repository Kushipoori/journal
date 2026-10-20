import { decibelsToLevel, LevelMeter } from '@/components/level-meter';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/format';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { CircleIcon, PauseIcon, PlayIcon, SquareIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type AudioRecorderPanelProps = {
  onRecorded: (recording: { uri: string; durationMs: number }) => void;
  onBusyChange?: (busy: boolean) => void;
};

/** Plain audio recording (no transcription): music, surroundings, or a note you'd rather not have written down. */
export function AudioRecorderPanel({ onRecorded, onBusyChange }: AudioRecorderPanelProps) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);
  const [active, setActive] = React.useState(false);
  const [meter, setMeter] = React.useState<number[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    onBusyChange?.(active);
  }, [active, onBusyChange]);

  React.useEffect(() => {
    if (state.isRecording)
      setMeter((previous) => [...previous.slice(-35), decibelsToLevel(state.metering)]);
  }, [state.isRecording, state.durationMillis, state.metering]);

  const start = async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is off. Turn it on in system settings to record audio.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMeter([]);
      setActive(true);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError));
    }
  };

  const togglePause = () => {
    if (state.isRecording) recorder.pause();
    else recorder.record();
  };

  const stop = async () => {
    const durationMs = state.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setActive(false);
    if (recorder.uri) onRecorded({ uri: recorder.uri, durationMs });
  };

  return (
    <View className="gap-4 rounded-2xl border border-border bg-card p-4">
      <Text variant="muted">
        {active
          ? state.isRecording
            ? 'Recording audio…'
            : 'Paused'
          : 'Record sound without turning it into text: music, rain, a moment you want to hear again.'}
      </Text>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      <LevelMeter levels={meter} active={state.isRecording} />
      <View className="flex-row items-center justify-between">
        <Text className="w-20 text-sm tabular-nums text-muted-foreground">
          {active ? formatDuration(state.durationMillis) : ''}
        </Text>
        {active ? (
          <Button
            onPress={stop}
            className="h-16 w-16 rounded-full"
            accessibilityLabel="Stop and add">
            <Icon as={SquareIcon} fill="currentColor" className="size-6 text-primary-foreground" />
          </Button>
        ) : (
          <Button
            onPress={start}
            className="h-16 w-16 rounded-full"
            accessibilityLabel="Start recording">
            <Icon as={CircleIcon} fill="currentColor" className="size-7 text-primary-foreground" />
          </Button>
        )}
        <View className="w-20 items-end">
          {active ? (
            <Button
              variant="ghost"
              size="icon"
              onPress={togglePause}
              accessibilityLabel={state.isRecording ? 'Pause' : 'Resume'}>
              <Icon
                as={state.isRecording ? PauseIcon : PlayIcon}
                className="size-5 text-muted-foreground"
              />
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}
