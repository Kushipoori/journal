import { cn } from '@/lib/utils';
import { View } from 'react-native';

type LevelMeterProps = {
  /** Recent input levels on the -2..10 scale, newest last. */
  levels: number[];
  active: boolean;
  bars?: number;
  className?: string;
};

export function LevelMeter({ levels, active, bars = 36, className }: LevelMeterProps) {
  const recent = levels.slice(-bars);
  const padded = [...Array(Math.max(0, bars - recent.length)).fill(-2), ...recent] as number[];
  return (
    <View className={cn('h-12 flex-row items-center justify-center gap-[3px]', className)}>
      {padded.map((level, index) => (
        <View
          key={index}
          className={cn('w-1 rounded-full', active ? 'bg-primary' : 'bg-muted-foreground/30')}
          style={{ height: 4 + (Math.min(Math.max(level + 2, 0), 12) / 12) * 40 }}
        />
      ))}
    </View>
  );
}

/** expo-audio reports metering in dBFS (about -60 quiet to 0 loud); map it onto the recognizer's scale. */
export function decibelsToLevel(decibels: number | undefined) {
  if (decibels === undefined) return -2;
  return (Math.min(Math.max(decibels + 60, 0), 60) / 60) * 12 - 2;
}
