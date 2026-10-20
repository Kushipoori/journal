import { AudioPlayer } from '@/components/audio-player';
import { AudioRecorderPanel } from '@/components/audio-recorder-panel';
import { MediaGrid } from '@/components/media-grid';
import { MediaViewer } from '@/components/media-viewer';
import { EnergyBadge, MoodPicker } from '@/components/mood';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { VoiceCapturePanel } from '@/components/voice-capture-panel';
import { deleteEntry, getEnergyBaseline, getEntry, saveEntry } from '@/lib/entries';
import { formatDuration, formatFullDate, formatTime } from '@/lib/format';
import { audioMimeType, deleteMedia, importMedia, mediaUri } from '@/lib/media';
import { useSettings } from '@/lib/settings';
import { languageLabel } from '@/lib/speech/languages';
import type { Attachment, AttachmentKind, EntryWithAttachments } from '@/lib/types';
import { voiceProcessor, type VoiceCapture } from '@/lib/voice/pipeline';
import { cn } from '@/lib/utils';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useSQLiteContext } from 'expo-sqlite';
import {
  AudioLinesIcon,
  CameraIcon,
  ImagesIcon,
  MicIcon,
  Trash2Icon,
  VideoIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Panel = 'voice' | 'audio' | null;

function newDraft(): EntryWithAttachments {
  const now = Date.now();
  return {
    id: randomUUID(),
    title: '',
    body: '',
    mood: null,
    energy: null,
    createdAt: now,
    updatedAt: now,
    attachments: [],
  };
}

function isBlank(entry: EntryWithAttachments) {
  return !entry.title.trim() && !entry.body.trim() && !entry.mood && entry.attachments.length === 0;
}

function makeAttachment(
  entry: EntryWithAttachments,
  kind: AttachmentKind,
  fileName: string,
  extra: Partial<Attachment> = {}
): Attachment {
  return {
    id: randomUUID(),
    entryId: entry.id,
    kind,
    fileName,
    mimeType: null,
    durationMs: null,
    width: null,
    height: null,
    transcript: null,
    language: null,
    metrics: null,
    position: entry.attachments.length,
    createdAt: Date.now(),
    ...extra,
  };
}

export default function ComposeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ id?: string; start?: string }>();

  const [draft, setDraft] = React.useState<EntryWithAttachments | null>(null);
  const [panel, setPanel] = React.useState<Panel>(
    params.start === 'voice' || params.start === 'audio' ? params.start : null
  );
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [viewing, setViewing] = React.useState<Attachment | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Autosave bookkeeping. Media changes save immediately so a recording is never lost; typing
  // saves after a short pause. Saves run one after another through `saveChain`.
  const latest = React.useRef<EntryWithAttachments | null>(null);
  const hasChanges = React.useRef(false);
  const saveImmediately = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveChain = React.useRef<Promise<void>>(Promise.resolve());
  const persisted = React.useRef(false);
  const savedAttachmentIds = React.useRef(new Set<string>());

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = params.id ? await getEntry(db, params.id) : null;
      if (cancelled) return;
      if (existing) {
        persisted.current = true;
        savedAttachmentIds.current = new Set(
          existing.attachments.map((attachment) => attachment.id)
        );
      }
      setDraft(existing ?? newDraft());
    })();
    return () => {
      cancelled = true;
    };
  }, [db, params.id]);

  const persist = React.useCallback(() => {
    saveChain.current = saveChain.current
      .then(async () => {
        const current = latest.current;
        if (!current || (!persisted.current && isBlank(current))) return;
        await saveEntry(db, { ...current, updatedAt: Date.now() });
        persisted.current = true;
        savedAttachmentIds.current = new Set(
          current.attachments.map((attachment) => attachment.id)
        );
      })
      .catch((error) => {
        console.warn('Autosave failed', error);
        setNotice("Couldn't save just now. Your changes are still here; try Done again.");
      });
    return saveChain.current;
  }, [db]);

  React.useEffect(() => {
    if (!draft || !hasChanges.current) return;
    latest.current = draft;
    clearTimeout(timer.current);
    if (saveImmediately.current) {
      saveImmediately.current = false;
      timer.current = undefined;
      persist();
    } else {
      timer.current = setTimeout(() => {
        timer.current = undefined;
        persist();
      }, 600);
    }
  }, [draft, persist]);

  // Flush a pending text save if the screen closes before the timer fires.
  React.useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        persist();
      }
    },
    [persist]
  );

  const change = React.useCallback(
    (recipe: (entry: EntryWithAttachments) => EntryWithAttachments, immediate = false) => {
      hasChanges.current = true;
      if (immediate) saveImmediately.current = true;
      setDraft((previous) => (previous ? recipe(previous) : previous));
    },
    []
  );

  usePreventRemove(recording || processing, () => {
    setNotice('Finish or discard the recording first.');
  });

  const done = async () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (draft) latest.current = draft;
    await persist();
    router.back();
  };

  const discard = async () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    await saveChain.current;
    if (draft) {
      if (persisted.current) await deleteEntry(db, draft.id);
      draft.attachments
        .filter((attachment) => !savedAttachmentIds.current.has(attachment.id))
        .forEach((attachment) => deleteMedia(attachment.fileName));
    }
    latest.current = null;
    hasChanges.current = false;
    router.back();
  };

  const removeAttachment = (attachment: Attachment) => {
    if (!savedAttachmentIds.current.has(attachment.id)) deleteMedia(attachment.fileName);
    change(
      (entry) => ({
        ...entry,
        attachments: entry.attachments.filter((item) => item.id !== attachment.id),
      }),
      true
    );
  };

  const onVoiceCaptured = React.useCallback(
    async (capture: VoiceCapture, { endedBySystem }: { endedBySystem: boolean }) => {
      setProcessing(true);
      try {
        const baseline = await getEnergyBaseline(db);
        const processed = await voiceProcessor.process(capture, {
          tidy: settings.tidyTranscripts,
          baseline,
        });
        let fileName: string | null = null;
        if (capture.audioUri) {
          try {
            fileName = await importMedia(capture.audioUri, { fallbackExt: 'wav', move: true });
          } catch (error) {
            console.warn('Could not keep the voice recording', error);
          }
        }
        change((entry) => {
          const body = processed.text
            ? entry.body.trim()
              ? `${entry.body.trimEnd()}\n\n${processed.text}`
              : processed.text
            : entry.body;
          const attachments = fileName
            ? [
                ...entry.attachments,
                makeAttachment(entry, 'voice', fileName, {
                  mimeType: audioMimeType(fileName),
                  durationMs: capture.durationMs,
                  transcript: processed.transcript || null,
                  language: capture.language,
                  metrics: processed.metrics,
                }),
              ]
            : entry.attachments;
          return { ...entry, body, attachments, energy: processed.energy ?? entry.energy };
        }, true);
        if (endedBySystem) {
          setNotice(
            'Recording stopped by the phone (long silence or an interruption). Everything so far is saved. Tap the mic to keep going.'
          );
        }
      } finally {
        setProcessing(false);
      }
    },
    [change, db, settings.tidyTranscripts]
  );

  const onAudioRecorded = React.useCallback(
    async ({ uri, durationMs }: { uri: string; durationMs: number }) => {
      const fileName = await importMedia(uri, { fallbackExt: 'm4a', move: true });
      change(
        (entry) => ({
          ...entry,
          attachments: [
            ...entry.attachments,
            makeAttachment(entry, 'audio', fileName, {
              mimeType: audioMimeType(fileName),
              durationMs,
            }),
          ],
        }),
        true
      );
    },
    [change]
  );

  const onVoiceUnsupported = React.useCallback(() => setPanel('audio'), []);

  const addAssets = async (assets: ImagePickerAsset[], move: boolean) => {
    const imported: { asset: ImagePickerAsset; fileName: string }[] = [];
    for (const asset of assets) {
      const isVideo = asset.type === 'video';
      try {
        const fileName = await importMedia(asset.uri, {
          fallbackExt: isVideo ? 'mp4' : 'jpg',
          move,
        });
        imported.push({ asset, fileName });
      } catch (error) {
        console.warn('Could not import media', error);
      }
    }
    if (imported.length === 0) return;
    change(
      (entry) => ({
        ...entry,
        attachments: [
          ...entry.attachments,
          ...imported.map(({ asset, fileName }, index) => ({
            ...makeAttachment(entry, asset.type === 'video' ? 'video' : 'image', fileName, {
              mimeType: asset.mimeType ?? null,
              durationMs: asset.duration ?? null,
              width: asset.width,
              height: asset.height,
            }),
            position: entry.attachments.length + index,
          })),
        ],
      }),
      true
    );
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!result.canceled) await addAssets(result.assets, false);
  };

  const shoot = async (mediaType: 'images' | 'videos') => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setNotice(
        'Camera permission is off. Turn it on in system settings to take photos and videos.'
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: [mediaType],
      quality: 0.9,
      videoMaxDuration: 600,
    });
    if (!result.canceled) await addAssets(result.assets, true);
  };

  if (!draft) return <View className="flex-1 bg-background" />;

  const clips = draft.attachments.filter(
    (attachment) => attachment.kind === 'voice' || attachment.kind === 'audio'
  );
  const visuals = draft.attachments.filter(
    (attachment) => attachment.kind === 'image' || attachment.kind === 'video'
  );
  const busy = recording || processing;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: params.id ? 'Edit entry' : 'New entry',
          headerRight: () => (
            <View className="flex-row items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onPress={() => setConfirmDelete(true)}
                disabled={busy}
                accessibilityLabel="Delete entry">
                <Icon as={Trash2Icon} className="size-5 text-muted-foreground" />
              </Button>
              <Button size="sm" onPress={done} disabled={busy} className="px-4">
                <Text>Done</Text>
              </Button>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-6 pt-2"
          keyboardShouldPersistTaps="handled">
          <Text className="text-xs uppercase tracking-wide text-muted-foreground">
            {formatFullDate(draft.createdAt)} · {formatTime(draft.createdAt)}
          </Text>
          <TextInput
            value={draft.title}
            onChangeText={(title) => change((entry) => ({ ...entry, title }))}
            placeholder="Title (optional)"
            className="text-2xl font-semibold text-foreground placeholder:text-muted-foreground/60"
            returnKeyType="next"
          />
          <TextInput
            value={draft.body}
            onChangeText={(body) => change((entry) => ({ ...entry, body }))}
            placeholder="What's on your mind? Or tap Speak and just talk."
            className="min-h-40 text-base leading-7 text-foreground placeholder:text-muted-foreground/60"
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
          />

          {clips.length > 0 ? (
            <View className="gap-2">
              {clips.map((clip) => (
                <AudioPlayer
                  key={clip.id}
                  uri={mediaUri(clip.fileName)}
                  durationMs={clip.durationMs}
                  icon={clip.kind === 'voice' ? MicIcon : AudioLinesIcon}
                  label={
                    clip.kind === 'voice'
                      ? `Original voice · ${languageLabel(clip.language) ?? ''}`
                      : `Audio · ${formatDuration(clip.durationMs)}`
                  }
                  onRemove={busy ? undefined : () => removeAttachment(clip)}
                />
              ))}
            </View>
          ) : null}

          <MediaGrid
            items={visuals}
            onOpen={setViewing}
            onRemove={busy ? undefined : removeAttachment}
          />

          <Separator />
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium">How are you feeling?</Text>
              <EnergyBadge energy={draft.energy} />
            </View>
            <MoodPicker
              value={draft.mood}
              onChange={(mood) => change((entry) => ({ ...entry, mood }), true)}
            />
            {draft.energy ? (
              <Text className="text-xs text-muted-foreground">
                Energy is estimated from how loud and fast you spoke, compared with your usual. It's
                a hint, not a diagnosis.
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View
          className="gap-3 border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 10 }}>
          {notice ? (
            <Text className="text-sm text-muted-foreground" onPress={() => setNotice(null)}>
              {notice}
            </Text>
          ) : null}
          {processing ? (
            <Text className="text-sm text-muted-foreground">Adding your recording…</Text>
          ) : null}
          {panel === 'voice' ? (
            <VoiceCapturePanel
              onCaptured={onVoiceCaptured}
              onBusyChange={setRecording}
              onUnsupported={onVoiceUnsupported}
              autoStart={params.start === 'voice'}
            />
          ) : null}
          {panel === 'audio' ? (
            <AudioRecorderPanel onRecorded={onAudioRecorded} onBusyChange={setRecording} />
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2">
            <ToolButton
              icon={MicIcon}
              label="Speak"
              active={panel === 'voice'}
              disabled={busy}
              onPress={() => setPanel(panel === 'voice' ? null : 'voice')}
            />
            <ToolButton
              icon={AudioLinesIcon}
              label="Audio"
              active={panel === 'audio'}
              disabled={busy}
              onPress={() => setPanel(panel === 'audio' ? null : 'audio')}
            />
            <ToolButton
              icon={ImagesIcon}
              label="Gallery"
              disabled={busy}
              onPress={pickFromLibrary}
            />
            <ToolButton
              icon={CameraIcon}
              label="Photo"
              disabled={busy}
              onPress={() => shoot('images')}
            />
            <ToolButton
              icon={VideoIcon}
              label="Video"
              disabled={busy}
              onPress={() => shoot('videos')}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <MediaViewer attachment={viewing} onClose={() => setViewing(null)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The text, voice recordings, photos and videos in it will be removed from this phone.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Keep</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={discard} className="bg-destructive">
              <Text className="text-white">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

type ImagePickerAsset = ImagePicker.ImagePickerAsset;

function ToolButton({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'h-auto flex-col gap-1 rounded-xl px-3.5 py-2',
        active && 'border border-border'
      )}>
      <Icon as={icon} className={cn('size-5', active ? 'text-primary' : 'text-foreground')} />
      <Text className="text-xs">{label}</Text>
    </Button>
  );
}
