import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Energy, Mood } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ActivityIcon, BatteryLowIcon, ZapIcon } from 'lucide-react-native';
import { View } from 'react-native';

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'awful', emoji: '😣', label: 'Awful' },
  { value: 'low', emoji: '😔', label: 'Low' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'great', emoji: '😄', label: 'Great' },
];

export function moodOf(value: Mood | null) {
  return MOODS.find((mood) => mood.value === value) ?? null;
}

export function MoodPicker({
  value,
  onChange,
}: {
  value: Mood | null;
  onChange: (mood: Mood | null) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value ?? undefined}
      onValueChange={(next) => onChange((next as Mood | undefined) ?? null)}
      className="w-full">
      {MOODS.map((mood, index) => (
        <ToggleGroupItem
          key={mood.value}
          value={mood.value}
          isFirst={index === 0}
          isLast={index === MOODS.length - 1}
          className="h-14 flex-1 flex-col gap-0.5 px-0"
          accessibilityLabel={mood.label}>
          <Text className="text-xl leading-7">{mood.emoji}</Text>
          <Text
            className={cn(
              'text-[10px]',
              value === mood.value ? 'text-foreground' : 'text-muted-foreground'
            )}>
            {mood.label}
          </Text>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const ENERGY = {
  low: { label: 'Low energy', icon: BatteryLowIcon },
  steady: { label: 'Steady', icon: ActivityIcon },
  high: { label: 'High energy', icon: ZapIcon },
} as const;

export function EnergyBadge({ energy, className }: { energy: Energy | null; className?: string }) {
  if (!energy) return null;
  const { label, icon } = ENERGY[energy];
  return (
    <Badge variant="secondary" className={cn('flex-row gap-1', className)}>
      <Icon as={icon} className="size-3 text-secondary-foreground" />
      <Text>{label}</Text>
    </Badge>
  );
}

export function MoodBadge({ mood, className }: { mood: Mood | null; className?: string }) {
  const found = moodOf(mood);
  if (!found) return null;
  return (
    <Badge variant="outline" className={cn('flex-row gap-1', className)}>
      <Text>{found.emoji}</Text>
      <Text>{found.label}</Text>
    </Badge>
  );
}

export function MetaRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap items-center gap-1.5">{children}</View>;
}
