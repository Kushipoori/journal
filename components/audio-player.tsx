import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { PauseIcon, PlayIcon, XIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const RATES = [1, 1.5, 2, 0.75];

type AudioPlayerProps = {
  uri: string;
  durationMs?: number | null;
  label?: string;
  icon?: React.ComponentProps<typeof Icon>['as'];
  onRemove?: () => void;
  className?: string;
};

export function AudioPlayer({
  uri,
  durationMs,
  label,
  icon,
  onRemove,
  className,
}: AudioPlayerProps) {
  const player = useAudioPlayer(uri, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [rateIndex, setRateIndex] = React.useState(0);
  const [trackWidth, setTrackWidth] = React.useState(0);

  const duration = status.duration > 0 ? status.duration : (durationMs ?? 0) / 1000;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (duration > 0 && status.currentTime >= duration - 0.15) {
      player.seekTo(0);
    }
    player.play();
  };

  const cycleRate = () => {
    const next = (rateIndex + 1) % RATES.length;
    setRateIndex(next);
    player.setPlaybackRate(RATES[next]);
  };

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-xl border border-border bg-card p-3',
        className
      )}>
      <Button
        size="icon"
        className="h-11 w-11 rounded-full"
        onPress={togglePlayback}
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}>
        <Icon
          as={status.playing ? PauseIcon : PlayIcon}
          className="size-5 text-primary-foreground"
        />
      </Button>
      <View className="flex-1 gap-1.5">
        {label ? (
          <View className="flex-row items-center gap-1.5">
            {icon ? <Icon as={icon} className="size-3.5 text-muted-foreground" /> : null}
            <Text className="text-xs font-medium text-muted-foreground" numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
        <Pressable
          hitSlop={8}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          onPress={(event) => {
            if (!trackWidth || !duration) return;
            player.seekTo((event.nativeEvent.locationX / trackWidth) * duration);
          }}
          className="h-2 justify-center">
          <View className="h-1.5 overflow-hidden rounded-full bg-primary/20">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </Pressable>
        <View className="flex-row justify-between">
          <Text className="text-xs tabular-nums text-muted-foreground">
            {formatDuration(status.currentTime * 1000)}
          </Text>
          <Text className="text-xs tabular-nums text-muted-foreground">
            {formatDuration(duration * 1000)}
          </Text>
        </View>
      </View>
      <Button
        variant="ghost"
        size="sm"
        className="px-2"
        onPress={cycleRate}
        accessibilityLabel="Playback speed">
        <Text className="text-xs tabular-nums">{RATES[rateIndex]}×</Text>
      </Button>
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onPress={onRemove}
          accessibilityLabel="Remove clip">
          <Icon as={XIcon} className="size-4 text-muted-foreground" />
        </Button>
      ) : null}
    </View>
  );
}
