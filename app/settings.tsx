import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSettings, type ThemePreference } from '@/lib/settings';
import { VOICE_LANGUAGES } from '@/lib/speech/languages';
import {
  downloadLanguagePack,
  getSpeechSupport,
  type SpeechSupport,
} from '@/lib/speech/recognition';
import { cn } from '@/lib/utils';
import Constants from 'expo-constants';
import { CheckIcon, DownloadIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Every distinct locale the language list can ask the recognizer for. */
const LOCALES = Array.from(
  new Set(
    VOICE_LANGUAGES.flatMap(
      (language) => [language.locale, language.mixWith].filter(Boolean) as string[]
    )
  )
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSetting } = useSettings();
  const [support, setSupport] = React.useState<SpeechSupport | null>(null);
  const [downloadStatus, setDownloadStatus] = React.useState<string | null>(null);

  const refreshSupport = React.useCallback(() => {
    getSpeechSupport().then(setSupport);
  }, []);

  React.useEffect(refreshSupport, [refreshSupport]);

  const download = async (locale: string) => {
    setDownloadStatus(null);
    try {
      const result = await downloadLanguagePack(locale);
      setDownloadStatus(
        result.status === 'download_success'
          ? `${locale} downloaded.`
          : result.status === 'download_scheduled'
            ? `${locale} will download soon (it may wait for Wi-Fi).`
            : `Follow the system dialog to download ${locale}.`
      );
      refreshSupport();
    } catch (error) {
      setDownloadStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const installed = new Set(
    support?.installedLocales.map((locale) => locale.toLowerCase().replace('_', '-')) ?? []
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 px-4 pt-2"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <Card>
        <CardHeader>
          <CardTitle>Voice language</CardTitle>
          <CardDescription>
            Used when you tap Speak. You can also switch it on the recording panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-1">
          {VOICE_LANGUAGES.map((language) => {
            const selected = settings.voiceLanguage === language.id;
            return (
              <Pressable
                key={language.id}
                onPress={() => updateSetting('voiceLanguage', language.id)}
                className={cn(
                  'flex-row items-center justify-between rounded-lg px-3 py-2.5',
                  selected && 'bg-accent'
                )}>
                <View>
                  <Text className="font-medium">{language.label}</Text>
                  {language.native ? <Text variant="muted">{language.native}</Text> : null}
                </View>
                {selected ? <Icon as={CheckIcon} className="size-5 text-primary" /> : null}
              </Pressable>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcription</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <SettingSwitch
            title="Tidy what I say"
            description="Removes ums and repeated words, adds capitals and full stops, and starts new paragraphs where you paused. The exact transcript is always kept with the recording."
            checked={settings.tidyTranscripts}
            onChange={(value) => updateSetting('tidyTranscripts', value)}
          />
          <Separator />
          <SettingSwitch
            title="Prefer offline recognition"
            description={
              Platform.OS === 'ios'
                ? 'Keeps audio on the phone and removes the one-minute limit of online recognition. Not every language is available offline.'
                : 'Uses the downloaded language pack when there is one, so your voice never leaves the phone.'
            }
            checked={settings.preferOffline}
            onChange={(value) => updateSetting('preferOffline', value)}
          />
        </CardContent>
      </Card>

      {Platform.OS === 'android' ? (
        <Card>
          <CardHeader>
            <CardTitle>Speech engine</CardTitle>
            <CardDescription>
              Downloaded languages work offline. Hinglish and other mixed modes need both languages
              downloaded and Android 14 or newer.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="flex-row flex-wrap gap-1.5">
              <StatusBadge ok={!!support?.recognition} label="Speech recognition" />
              <StatusBadge ok={!!support?.recording} label="Keeps original audio" />
              <StatusBadge ok={!!support?.onDeviceService} label="On-device engine" />
            </View>
            {support?.onDeviceService ? (
              <View className="gap-1">
                {LOCALES.map((locale) => {
                  const isInstalled = installed.has(locale.toLowerCase());
                  return (
                    <View key={locale} className="flex-row items-center justify-between py-1">
                      <Text>{locale}</Text>
                      {isInstalled ? (
                        <Text variant="muted">Downloaded</Text>
                      ) : (
                        <Button variant="outline" size="sm" onPress={() => download(locale)}>
                          <Icon as={DownloadIcon} className="size-4" />
                          <Text>Download</Text>
                        </Button>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : support ? (
              <Text variant="muted">
                Google's on-device speech engine isn't on this phone, so recognition uses the
                internet. Voice entries still work.
              </Text>
            ) : null}
            {downloadStatus ? (
              <Text className="text-sm text-muted-foreground">{downloadStatus}</Text>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value={settings.theme}
            onValueChange={(value) => value && updateSetting('theme', value as ThemePreference)}>
            {THEMES.map((theme, index) => (
              <ToggleGroupItem
                key={theme.value}
                value={theme.value}
                isFirst={index === 0}
                isLast={index === THEMES.length - 1}
                className="flex-1">
                <Text>{theme.label}</Text>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Entries, recordings, photos and videos are stored only on this phone. There is no
            account and nothing is uploaded. Speech recognition may use Google's or Apple's servers
            unless offline recognition is on.
          </CardDescription>
        </CardHeader>
      </Card>
      <Text variant="muted" className="text-center">
        Journal {Constants.expoConfig?.version ?? ''}
      </Text>
    </ScrollView>
  );
}

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-start gap-4">
      <View className="flex-1 gap-1">
        <Text className="font-medium">{title}</Text>
        <Text variant="muted">{description}</Text>
      </View>
      <Switch checked={checked} onCheckedChange={onChange} />
    </View>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? 'secondary' : 'outline'}>
      <Text className={ok ? undefined : 'text-muted-foreground line-through'}>{label}</Text>
    </Badge>
  );
}
