import { LevelMeter } from '@/components/level-meter';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { getVoiceLanguage, VOICE_LANGUAGES } from '@/lib/speech/languages';
import { getSpeechSupport, type SpeechSupport } from '@/lib/speech/recognition';
import { useVoiceCapture } from '@/lib/speech/use-voice-capture';
import type { VoiceCapture } from '@/lib/voice/pipeline';
import { cn } from '@/lib/utils';
import { MicIcon, SquareIcon, Trash2Icon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, ScrollView, View } from 'react-native';

type VoiceCapturePanelProps = {
  onCaptured: (capture: VoiceCapture, info: { endedBySystem: boolean }) => void;
  onBusyChange?: (busy: boolean) => void;
  /** Called when this phone can't transcribe-and-record, so the parent can offer the plain recorder. */
  onUnsupported?: () => void;
  autoStart?: boolean;
};

export function VoiceCapturePanel({
  onCaptured,
  onBusyChange,
  onUnsupported,
  autoStart,
}: VoiceCapturePanelProps) {
  const { settings, updateSetting } = useSettings();
  const [support, setSupport] = React.useState<SpeechSupport | null>(null);
  const capture = useVoiceCapture(onCaptured);
  const autoStarted = React.useRef(false);
  const language = getVoiceLanguage(settings.voiceLanguage);
  const busy = capture.status !== 'idle';

  React.useEffect(() => {
    getSpeechSupport().then(setSupport);
  }, []);

  React.useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const unsupported = !!support && (!support.recognition || !support.recording);

  React.useEffect(() => {
    if (unsupported) onUnsupported?.();
  }, [unsupported, onUnsupported]);

  const startCapture = capture.start;
  const start = React.useCallback(() => {
    if (!support) return;
    startCapture(language, support, settings.preferOffline);
  }, [startCapture, language, settings.preferOffline, support]);

  React.useEffect(() => {
    if (autoStart && support && !unsupported && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
  }, [autoStart, start, support, unsupported]);

  if (unsupported) {
    return (
      <View className="gap-2 rounded-2xl border border-border bg-card p-4">
        <Text className="font-medium">Speech-to-text isn't available on this phone</Text>
        <Text variant="muted">
          {Platform.OS === 'android'
            ? 'Keeping the original audio while transcribing needs Android 13 or newer with the Google app installed. You can still record audio clips.'
            : 'Speech recognition is turned off or unavailable. You can still record audio clips.'}
        </Text>
      </View>
    );
  }

  const mixedNote =
    language.mixWith && support && !canSwitchLanguages(support, language.locale, language.mixWith)
      ? `Switching between languages mid-sentence needs Android 14+ with both language packs downloaded (Settings → Voice). Listening in ${getVoiceLanguage(language.locale).label} for now.`
      : null;

  return (
    <View className="gap-4 rounded-2xl border border-border bg-card p-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2">
        {VOICE_LANGUAGES.map((option) => {
          const selected = option.id === language.id;
          return (
            <Button
              key={option.id}
              size="sm"
              variant={selected ? 'default' : 'outline'}
              disabled={busy}
              onPress={() => updateSetting('voiceLanguage', option.id)}
              className="h-auto rounded-full px-3 py-1.5">
              <Text className="text-xs">
                {option.label}
                {option.native ? ` · ${option.native}` : ''}
              </Text>
            </Button>
          );
        })}
      </ScrollView>

      <ScrollView className="max-h-56 min-h-24" contentContainerClassName="py-1">
        {capture.segments.length === 0 && !capture.interim ? (
          <Text variant="muted" className="leading-6">
            {busy
              ? 'Listening… talk the way you think. Pauses are fine.'
              : 'Tap the mic and ramble. Your words are tidied into a readable entry, and the original audio is kept with it.'}
          </Text>
        ) : (
          <Text className="leading-7">
            {capture.segments.map((segment) => segment.text).join(' ')}
            {capture.interim ? (
              <Text className="text-muted-foreground"> {capture.interim}</Text>
            ) : null}
          </Text>
        )}
      </ScrollView>

      {mixedNote ? <Text className="text-xs text-muted-foreground">{mixedNote}</Text> : null}
      {capture.error ? <Text className="text-sm text-destructive">{capture.error}</Text> : null}

      <LevelMeter levels={capture.meter} active={capture.status === 'listening'} />

      <View className="flex-row items-center justify-between">
        <Text className="w-20 text-sm tabular-nums text-muted-foreground">
          {busy ? formatDuration(capture.elapsedMs) : ''}
        </Text>
        {busy ? (
          <Button
            onPress={capture.stop}
            disabled={capture.status === 'stopping'}
            className="h-16 w-16 rounded-full"
            accessibilityLabel="Stop recording">
            <Icon as={SquareIcon} fill="currentColor" className="size-6 text-primary-foreground" />
          </Button>
        ) : (
          <Button
            onPress={start}
            disabled={!support}
            className="h-16 w-16 rounded-full"
            accessibilityLabel="Start speaking">
            <Icon as={MicIcon} className="size-7 text-primary-foreground" />
          </Button>
        )}
        <View className="w-20 items-end">
          {busy ? (
            <Button
              variant="ghost"
              size="icon"
              onPress={capture.cancel}
              disabled={capture.status === 'stopping'}
              accessibilityLabel="Discard recording">
              <Icon as={Trash2Icon} className="size-5 text-muted-foreground" />
            </Button>
          ) : null}
        </View>
      </View>
      <Text className={cn('text-center text-xs text-muted-foreground', !busy && 'opacity-0')}>
        Stop to add it to your entry · bin to discard
      </Text>
    </View>
  );
}

function canSwitchLanguages(support: SpeechSupport, primary: string, secondary: string) {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 34 || !support.onDeviceService)
    return false;
  const installed = support.installedLocales.map((locale) =>
    locale.toLowerCase().replace('_', '-')
  );
  return installed.includes(primary.toLowerCase()) && installed.includes(secondary.toLowerCase());
}
