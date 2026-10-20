import type { VoiceLanguage } from '@/lib/speech/languages';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';

/** Google's on-device recognizer (Android System Intelligence). Needed for offline use and language switching. */
export const ON_DEVICE_SERVICE = 'com.google.android.as';

export type SpeechSupport = {
  /** A recognizer exists on this device at all. */
  recognition: boolean;
  /** The recognizer can save the audio it hears. Android 13+ and iOS. Without this we can't keep the original clip. */
  recording: boolean;
  /** Google's on-device recognizer is installed (Android). */
  onDeviceService: boolean;
  /** Language packs downloaded for offline/on-device use. */
  installedLocales: string[];
};

export async function getSpeechSupport(): Promise<SpeechSupport> {
  if (Platform.OS === 'web') {
    return { recognition: false, recording: false, onDeviceService: false, installedLocales: [] };
  }
  const recognition = ExpoSpeechRecognitionModule.isRecognitionAvailable();
  const recording = ExpoSpeechRecognitionModule.supportsRecording();
  let onDeviceService = false;
  let installedLocales: string[] = [];
  if (Platform.OS === 'android') {
    onDeviceService =
      ExpoSpeechRecognitionModule.getSpeechRecognitionServices().includes(ON_DEVICE_SERVICE);
    if (onDeviceService) {
      try {
        const locales = await ExpoSpeechRecognitionModule.getSupportedLocales({
          androidRecognitionServicePackage: ON_DEVICE_SERVICE,
        });
        installedLocales = locales.installedLocales;
      } catch {
        installedLocales = [];
      }
    }
  } else {
    onDeviceService = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  }
  return { recognition, recording, onDeviceService, installedLocales };
}

function hasLocale(installed: string[], locale: string) {
  const normalized = locale.toLowerCase();
  return installed.some((item) => item.toLowerCase().replace('_', '-') === normalized);
}

/**
 * Builds recognizer options for a long, continuous "ramble" that also saves the audio.
 * Returns the locale string we store with the clip ("hi-IN+en-IN" when language switching is on).
 */
export function buildRecognitionOptions(
  language: VoiceLanguage,
  support: SpeechSupport,
  { preferOffline }: { preferOffline: boolean }
): { options: ExpoSpeechRecognitionOptions; storedLanguage: string } {
  const options: ExpoSpeechRecognitionOptions = {
    lang: language.locale,
    interimResults: true,
    continuous: true,
    addsPunctuation: true,
    maxAlternatives: 1,
    recordingOptions: { persist: true },
    volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
    iosTaskHint: 'dictation',
  };
  let storedLanguage = language.locale;

  if (Platform.OS === 'android') {
    const primaryInstalled = hasLocale(support.installedLocales, language.locale);
    const canSwitch =
      !!language.mixWith &&
      Number(Platform.Version) >= 34 &&
      support.onDeviceService &&
      primaryInstalled &&
      hasLocale(support.installedLocales, language.mixWith);

    if (canSwitch && language.mixWith) {
      options.androidRecognitionServicePackage = ON_DEVICE_SERVICE;
      options.androidIntentOptions = {
        EXTRA_LANGUAGE_MODEL: 'free_form',
        EXTRA_ENABLE_LANGUAGE_SWITCH: 'balanced',
        EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: [language.locale, language.mixWith],
      };
      storedLanguage = `${language.locale}+${language.mixWith}`;
    } else {
      options.androidIntentOptions = { EXTRA_LANGUAGE_MODEL: 'free_form' };
      if (preferOffline && support.onDeviceService && primaryInstalled) {
        options.androidRecognitionServicePackage = ON_DEVICE_SERVICE;
        options.requiresOnDeviceRecognition = true;
      }
    }
  } else if (Platform.OS === 'ios' && preferOffline && support.onDeviceService) {
    // Server-side recognition on iOS stops after about a minute; on-device has no such cap.
    options.requiresOnDeviceRecognition = true;
  }

  return { options, storedLanguage };
}

export async function downloadLanguagePack(locale: string) {
  return ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale });
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone permission is off. Turn it on in system settings to speak entries.',
  'language-not-supported':
    "This language isn't available on your phone's speech engine yet. Download it from Settings, or pick another language.",
  network:
    'Speech recognition needs the internet for this language. Connect, or download the language for offline use.',
  'service-not-allowed':
    'Your phone has no speech recognition service. Install or enable the Google app, or use the plain audio recorder.',
  busy: 'The speech engine is busy. Try again in a moment.',
  'audio-capture': "Couldn't access the microphone. Another app may be using it.",
  interrupted: 'Recording was interrupted (a call or alarm). Your audio so far is saved.',
};

export function describeSpeechError(code: string, fallback: string) {
  return ERROR_MESSAGES[code] ?? fallback ?? 'Something went wrong with speech recognition.';
}
