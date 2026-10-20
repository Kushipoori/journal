import '@/global.css';

import { DATABASE_NAME, migrateDb } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { NAV_THEME } from '@/lib/theme';
import { PortalHost } from '@rn-primitives/portal';
import { setAudioModeAsync } from 'expo-audio';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as React from 'react';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  React.useEffect(() => {
    // Let journal audio play even when the phone is on silent.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDb}>
      <SettingsProvider>
        <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShadowVisible: false }}>
            <Stack.Screen name="index" options={{ title: 'Journal' }} />
            <Stack.Screen name="compose" options={{ title: '' }} />
            <Stack.Screen name="entry/[id]" options={{ title: '' }} />
            <Stack.Screen name="on-this-day" options={{ title: 'On this day' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
          <PortalHost />
        </ThemeProvider>
      </SettingsProvider>
    </SQLiteProvider>
  );
}
