import { AudioPlayer } from '@/components/audio-player';
import { MediaGrid } from '@/components/media-grid';
import { MediaViewer } from '@/components/media-viewer';
import { EnergyBadge, MetaRow, MoodBadge } from '@/components/mood';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { deleteEntry, getEntry } from '@/lib/entries';
import { formatDuration, formatFullDate, formatTime } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import { languageLabel } from '@/lib/speech/languages';
import type { Attachment, EntryWithAttachments } from '@/lib/types';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { AudioLinesIcon, MicIcon, PencilIcon, Trash2Icon } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EntryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = React.useState<EntryWithAttachments | null | undefined>(undefined);
  const [viewing, setViewing] = React.useState<Attachment | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      getEntry(db, id).then(setEntry);
    }, [db, id])
  );

  const remove = async () => {
    await deleteEntry(db, id);
    router.back();
  };

  if (entry === undefined) return <View className="flex-1 bg-background" />;
  if (entry === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text variant="muted">This entry no longer exists.</Text>
      </View>
    );
  }

  const clips = entry.attachments.filter(
    (attachment) => attachment.kind === 'voice' || attachment.kind === 'audio'
  );
  const visuals = entry.attachments.filter(
    (attachment) => attachment.kind === 'image' || attachment.kind === 'video'
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View className="flex-row items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onPress={() => setConfirmDelete(true)}
                accessibilityLabel="Delete entry">
                <Icon as={Trash2Icon} className="size-5 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push({ pathname: '/compose', params: { id: entry.id } })}>
                <Icon as={PencilIcon} className="size-4" />
                <Text>Edit</Text>
              </Button>
            </View>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="gap-5 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View className="gap-2">
          <Text className="text-xs uppercase tracking-wide text-muted-foreground">
            {formatFullDate(entry.createdAt)} · {formatTime(entry.createdAt)}
          </Text>
          {entry.title ? <Text variant="h3">{entry.title}</Text> : null}
          <MetaRow>
            <MoodBadge mood={entry.mood} />
            <EnergyBadge energy={entry.energy} />
          </MetaRow>
        </View>

        {entry.body ? (
          <Text className="text-base leading-7" selectable>
            {entry.body}
          </Text>
        ) : null}

        {visuals.length > 0 ? <MediaGrid items={visuals} onOpen={setViewing} /> : null}

        {clips.length > 0 ? (
          <View className="gap-3">
            <Separator />
            {clips.map((clip) => (
              <ClipWithTranscript key={clip.id} clip={clip} />
            ))}
          </View>
        ) : null}
      </ScrollView>

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
            <AlertDialogAction onPress={remove} className="bg-destructive">
              <Text className="text-white">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

function ClipWithTranscript({ clip }: { clip: Attachment }) {
  const [showTranscript, setShowTranscript] = React.useState(false);
  const isVoice = clip.kind === 'voice';
  return (
    <View className="gap-2">
      <AudioPlayer
        uri={mediaUri(clip.fileName)}
        durationMs={clip.durationMs}
        icon={isVoice ? MicIcon : AudioLinesIcon}
        label={
          isVoice
            ? `Original voice · ${languageLabel(clip.language) ?? ''}`
            : `Audio · ${formatDuration(clip.durationMs)}`
        }
      />
      {isVoice && clip.transcript ? (
        <View className="gap-2 px-1">
          <View className="flex-row items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto self-start px-0 py-0"
              onPress={() => setShowTranscript(!showTranscript)}>
              <Text className="text-xs">
                {showTranscript ? 'Hide' : 'Show'} exactly what you said
              </Text>
            </Button>
            {clip.metrics ? (
              <Badge variant="outline">
                <Text>{clip.metrics.wordsPerMinute} words/min</Text>
              </Badge>
            ) : null}
          </View>
          {showTranscript ? (
            <Text className="text-sm leading-6 text-muted-foreground" selectable>
              {clip.transcript}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
