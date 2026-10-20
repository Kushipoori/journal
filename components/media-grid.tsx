import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import type { Attachment } from '@/lib/types';
import { Image } from 'expo-image';
import { useVideoPlayer, type VideoThumbnail } from 'expo-video';
import { PlayIcon, XIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type MediaGridProps = {
  items: Attachment[];
  onOpen: (attachment: Attachment) => void;
  onRemove?: (attachment: Attachment) => void;
};

export function MediaGrid({ items, onOpen, onRemove }: MediaGridProps) {
  if (items.length === 0) return null;
  return (
    <View className="-m-1 flex-row flex-wrap">
      {items.map((item) => (
        <View key={item.id} className="aspect-square w-1/3 p-1">
          <Pressable
            onPress={() => onOpen(item)}
            className="flex-1 overflow-hidden rounded-lg bg-muted"
            accessibilityLabel={item.kind === 'video' ? 'Open video' : 'Open photo'}>
            {item.kind === 'video' ? (
              <VideoTile uri={mediaUri(item.fileName)} durationMs={item.durationMs} />
            ) : (
              <Image
                source={{ uri: mediaUri(item.fileName) }}
                contentFit="cover"
                style={{ flex: 1 }}
                transition={150}
              />
            )}
          </Pressable>
          {onRemove ? (
            <Pressable
              onPress={() => onRemove(item)}
              hitSlop={6}
              className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-black/60"
              accessibilityLabel="Remove">
              <Icon as={XIcon} className="size-3.5 text-white" />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function VideoTile({ uri, durationMs }: { uri: string; durationMs: number | null }) {
  const player = useVideoPlayer(uri);
  const [thumbnail, setThumbnail] = React.useState<VideoThumbnail | null>(null);

  React.useEffect(() => {
    let alive = true;
    player
      .generateThumbnailsAsync([0], { maxWidth: 400 })
      .then(([first]) => {
        if (alive && first) setThumbnail(first);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [player]);

  return (
    <View className="flex-1 bg-black">
      {thumbnail ? <Image source={thumbnail} contentFit="cover" style={{ flex: 1 }} /> : null}
      <View className="absolute inset-0 items-center justify-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-black/55">
          <Icon as={PlayIcon} className="size-4 text-white" />
        </View>
      </View>
      {durationMs ? (
        <Text className="absolute bottom-1.5 right-2 text-xs font-medium text-white">
          {formatDuration(durationMs)}
        </Text>
      ) : null}
    </View>
  );
}
