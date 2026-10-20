import { useSQLiteContext } from 'expo-sqlite';
import { useColorScheme } from 'nativewind';
import * as React from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  /** Id from VOICE_LANGUAGES. */
  voiceLanguage: string;
  /** Ask the recognizer to stay on-device (needs the language pack downloaded). */
  preferOffline: boolean;
  /** Tidy spoken text (fillers, repeats, capitals, punctuation) before it lands in the entry. */
  tidyTranscripts: boolean;
  theme: ThemePreference;
};

const DEFAULT_SETTINGS: Settings = {
  voiceLanguage: 'en-IN',
  preferOffline: false,
  tidyTranscripts: true,
  theme: 'system',
};

type SettingsContextValue = {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { setColorScheme } = useColorScheme();
  const [settings, setSettings] = React.useState<Settings | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings').then(
      (rows) => {
        if (cancelled) return;
        const stored: Partial<Settings> = {};
        for (const row of rows) {
          try {
            (stored as Record<string, unknown>)[row.key] = JSON.parse(row.value);
          } catch {
            // Ignore a corrupt value; the default wins.
          }
        }
        const next = { ...DEFAULT_SETTINGS, ...stored };
        setColorScheme(next.theme);
        setSettings(next);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [db, setColorScheme]);

  const updateSetting = React.useCallback<SettingsContextValue['updateSetting']>(
    (key, value) => {
      setSettings((previous) => (previous ? { ...previous, [key]: value } : previous));
      if (key === 'theme') setColorScheme(value as ThemePreference);
      db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        key,
        JSON.stringify(value)
      ).catch((error) => console.warn('Could not save setting', key, error));
    },
    [db, setColorScheme]
  );

  if (!settings) return null;
  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>');
  return context;
}
