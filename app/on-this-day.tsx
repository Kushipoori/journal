import { MemoryCard } from '@/components/memory-card';
import { Text } from '@/components/ui/text';
import { getMemories, type Memory } from '@/lib/entries';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as React from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnThisDayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [memories, setMemories] = React.useState<Memory[] | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      getMemories(db).then(setMemories);
    }, [db])
  );

  return (
    <FlatList
      className="flex-1 bg-background"
      data={memories ?? []}
      keyExtractor={(memory) => `${memory.label}-${memory.entry.id}`}
      contentContainerClassName="gap-3 px-4 pt-2"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        <Text variant="muted" className="pb-1">
          Entries from this date in past years, plus a month and a week ago. Press play to hear
          yourself.
        </Text>
      }
      renderItem={({ item }) => (
        <MemoryCard memory={item} onOpen={() => router.push(`/entry/${item.entry.id}`)} />
      )}
      ListEmptyComponent={
        memories === null ? null : (
          <View className="items-center pt-16">
            <Text variant="muted">Nothing from this day yet. Keep going; it adds up.</Text>
          </View>
        )
      }
    />
  );
}
