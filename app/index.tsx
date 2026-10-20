import { EntryCard } from '@/components/entry-card';
import { MemoryCard } from '@/components/memory-card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getMemories, listEntries, type Memory } from '@/lib/entries';
import { dayKey, formatDayHeading } from '@/lib/format';
import type { EntryWithAttachments } from '@/lib/types';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MicIcon, PenLineIcon, SearchIcon, SettingsIcon } from 'lucide-react-native';
import * as React from 'react';
import { SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = { key: string; title: string; data: EntryWithAttachments[] };

function groupByDay(entries: EntryWithAttachments[]) {
  const sections: Section[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.createdAt);
    const last = sections[sections.length - 1];
    if (last?.key === key) last.data.push(entry);
    else sections.push({ key, title: formatDayHeading(entry.createdAt), data: [entry] });
  }
  return sections;
}

export default function TimelineScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = React.useState<EntryWithAttachments[] | null>(null);
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [search, setSearch] = React.useState('');

  const load = React.useCallback(async () => {
    const [list, past] = await Promise.all([
      listEntries(db, search),
      search ? [] : getMemories(db),
    ]);
    setEntries(list);
    setMemories(past);
  }, [db, search]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  const sections = React.useMemo(() => groupByDay(entries ?? []), [entries]);
  const featured =
    memories.find((memory) => memory.entry.attachments.some((a) => a.kind === 'voice')) ??
    memories[0];

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onPress={() => router.push('/settings')}
              accessibilityLabel="Settings">
              <Icon as={SettingsIcon} className="size-5" />
            </Button>
          ),
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.id}
        stickySectionHeadersEnabled={false}
        // NativeWind doesn't map className props on SectionList, so plain styles here.
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 120,
        }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-4 pb-2 pt-1">
            <View className="flex-row items-center gap-2 rounded-lg border border-input bg-card px-3">
              <Icon as={SearchIcon} className="size-4 text-muted-foreground" />
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Search entries and transcripts"
                className="flex-1 border-0 bg-transparent px-0 shadow-none"
                returnKeyType="search"
              />
            </View>
            {featured ? (
              <View className="gap-2">
                <MemoryCard
                  memory={featured}
                  onOpen={() => router.push(`/entry/${featured.entry.id}`)}
                />
                {memories.length > 1 ? (
                  <Button
                    variant="link"
                    className="self-start px-0"
                    onPress={() => router.push('/on-this-day')}>
                    <Text>See all {memories.length} memories</Text>
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text className="pt-3 text-sm font-semibold text-muted-foreground">{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <EntryCard entry={item} onPress={() => router.push(`/entry/${item.id}`)} />
        )}
        ListEmptyComponent={
          entries === null ? null : (
            <View className="items-center gap-2 px-6 pt-16">
              <Text variant="large">
                {search ? 'Nothing matches that' : 'Your journal is empty'}
              </Text>
              <Text variant="muted" className="text-center">
                {search
                  ? 'Try another word. Search looks through what you wrote and what you said.'
                  : 'Tap Speak and talk for a minute about your day, or add a photo or video.'}
              </Text>
            </View>
          )
        }
      />
      <View
        className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-border bg-background/95 px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          variant="outline"
          className="h-14 flex-1 rounded-2xl"
          onPress={() => router.push('/compose')}>
          <Icon as={PenLineIcon} className="size-5" />
          <Text className="text-base">Write</Text>
        </Button>
        <Button
          className="h-14 flex-[1.4] rounded-2xl"
          onPress={() => router.push({ pathname: '/compose', params: { start: 'voice' } })}>
          <Icon as={MicIcon} className="size-5 text-primary-foreground" />
          <Text className="text-base">Speak</Text>
        </Button>
      </View>
    </View>
  );
}
