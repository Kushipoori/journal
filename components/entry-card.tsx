import { EnergyBadge, MoodBadge } from '@/components/mood';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import type { AttachmentKind, EntryWithAttachments } from '@/lib/types';
import { Image } from 'expo-image';
import { AudioLinesIcon, ImageIcon, MicIcon, VideoIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

const KIND_ICONS: Record<AttachmentKind, typeof MicIcon> = {
  voice: MicIcon,
  audio: AudioLinesIcon,
  image: ImageIcon,
  video: VideoIcon,
};

export function entryPreview(entry: EntryWithAttachments) {
  return (
    entry.body.trim() ||
    entry.attachments.find((attachment) => attachment.transcript)?.transcript ||
    ''
  );
}

export function EntryCard({
  entry,
  onPress,
}: {
  entry: EntryWithAttachments;
  onPress: () => void;
}) {
  const cover = entry.attachments.find((attachment) => attachment.kind === 'image');
  const preview = entryPreview(entry);
  const counts = entry.attachments.reduce<Partial<Record<AttachmentKind, number>>>(
    (totals, attachment) => {
      totals[attachment.kind] = (totals[attachment.kind] ?? 0) + 1;
      return totals;
    },
    {}
  );

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card className="gap-3 py-4">
        <View className="flex-row gap-3 px-4">
          <View className="flex-1 gap-1">
            <Text className="text-xs text-muted-foreground">{formatTime(entry.createdAt)}</Text>
            {entry.title ? (
              <Text className="text-base font-semibold" numberOfLines={1}>
                {entry.title}
              </Text>
            ) : null}
            {preview ? (
              <Text className="text-sm leading-5 text-foreground/80" numberOfLines={3}>
                {preview}
              </Text>
            ) : (
              <Text variant="muted">No words, just moments</Text>
            )}
          </View>
          {cover ? (
            <Image
              source={{ uri: mediaUri(cover.fileName) }}
              contentFit="cover"
              style={{ width: 64, height: 64, borderRadius: 10 }}
            />
          ) : null}
        </View>
        <View className="flex-row flex-wrap items-center gap-3 px-4">
          {(Object.keys(counts) as AttachmentKind[]).map((kind) => (
            <View key={kind} className="flex-row items-center gap-1">
              <Icon as={KIND_ICONS[kind]} className="size-3.5 text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">{counts[kind]}</Text>
            </View>
          ))}
          <View className="flex-1" />
          <MoodBadge mood={entry.mood} />
          <EnergyBadge energy={entry.energy} />
        </View>
      </Card>
    </Pressable>
  );
}
