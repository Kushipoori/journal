import { AudioPlayer } from '@/components/audio-player';
import { entryPreview } from '@/components/entry-card';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Memory } from '@/lib/entries';
import { formatFullDate } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import { Image } from 'expo-image';
import { HistoryIcon, MicIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

/** "Hear your past self": leads with the actual voice clip when there is one. */
export function MemoryCard({ memory, onOpen }: { memory: Memory; onOpen: () => void }) {
  const { entry, label } = memory;
  const voice = entry.attachments.find(
    (attachment) => attachment.kind === 'voice' || attachment.kind === 'audio'
  );
  const photo = entry.attachments.find((attachment) => attachment.kind === 'image');
  const preview = entryPreview(entry);

  return (
    <Card className="gap-3 border-primary/30 bg-primary/5 py-4">
      <Pressable onPress={onOpen} className="gap-2 px-4 active:opacity-80">
        <View className="flex-row items-center gap-1.5">
          <Icon as={HistoryIcon} className="size-4 text-primary" />
          <Text className="text-sm font-semibold text-primary">{label}</Text>
          <Text className="text-xs text-muted-foreground">· {formatFullDate(entry.createdAt)}</Text>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-1">
            {entry.title ? <Text className="font-semibold">{entry.title}</Text> : null}
            {preview ? (
              <Text className="text-sm leading-5 text-foreground/80" numberOfLines={3}>
                {preview}
              </Text>
            ) : null}
          </View>
          {photo ? (
            <Image
              source={{ uri: mediaUri(photo.fileName) }}
              contentFit="cover"
              style={{ width: 56, height: 56, borderRadius: 10 }}
            />
          ) : null}
        </View>
      </Pressable>
      {voice ? (
        <View className="px-4">
          <AudioPlayer
            uri={mediaUri(voice.fileName)}
            durationMs={voice.durationMs}
            label={voice.kind === 'voice' ? 'Hear your past self' : 'Audio from that day'}
            icon={MicIcon}
          />
        </View>
      ) : null}
    </Card>
  );
}
