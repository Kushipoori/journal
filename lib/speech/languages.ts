export type VoiceLanguage = {
  id: string;
  label: string;
  /** Name in its own script, shown under the label. */
  native?: string;
  /** Locale the recognizer is started with. */
  locale: string;
  /**
   * Second language for code-mixed speech. On Android 14+ with Google's on-device recognizer and
   * both language packs downloaded, the recognizer switches between the two mid-sentence.
   * Elsewhere we fall back to `locale` alone.
   */
  mixWith?: string;
};

export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { id: 'en-IN', label: 'English', native: 'India', locale: 'en-IN' },
  {
    id: 'hinglish',
    label: 'Hinglish',
    native: 'हिन्दी + English',
    locale: 'hi-IN',
    mixWith: 'en-IN',
  },
  { id: 'hi-IN', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
  {
    id: 'kanglish',
    label: 'Kannada + English',
    native: 'ಕನ್ನಡ + English',
    locale: 'kn-IN',
    mixWith: 'en-IN',
  },
  { id: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ', locale: 'kn-IN' },
  {
    id: 'tanglish',
    label: 'Tamil + English',
    native: 'தமிழ் + English',
    locale: 'ta-IN',
    mixWith: 'en-IN',
  },
  { id: 'ta-IN', label: 'Tamil', native: 'தமிழ்', locale: 'ta-IN' },
  { id: 'te-IN', label: 'Telugu', native: 'తెలుగు', locale: 'te-IN' },
  { id: 'mr-IN', label: 'Marathi', native: 'मराठी', locale: 'mr-IN' },
  { id: 'bn-IN', label: 'Bengali', native: 'বাংলা', locale: 'bn-IN' },
  { id: 'ml-IN', label: 'Malayalam', native: 'മലയാളം', locale: 'ml-IN' },
  { id: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી', locale: 'gu-IN' },
  { id: 'pa-IN', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', locale: 'pa-IN' },
  { id: 'en-US', label: 'English', native: 'US', locale: 'en-US' },
];

export function getVoiceLanguage(id: string) {
  return VOICE_LANGUAGES.find((language) => language.id === id) ?? VOICE_LANGUAGES[0];
}

export function languageLabel(locale: string | null) {
  if (!locale) return null;
  const [primary, secondary] = locale.split('+');
  const name = (code: string) =>
    VOICE_LANGUAGES.find((language) => language.locale === code && !language.mixWith)?.label ??
    code;
  return secondary ? `${name(primary)} + ${name(secondary)}` : name(primary);
}
