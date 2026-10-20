# Journal

A voice-first personal journal for Android and iOS. You speak, it writes the entry and keeps the
original audio. You can also attach photos, videos and audio clips. Everything stays on the phone.

Built with Expo (SDK 57), Expo Router, SQLite, NativeWind, and
[React Native Reusables](https://reactnativereusables.com), the shadcn/ui port for React Native.
UI primitives live in `components/ui` and are added with
`npx @react-native-reusables/cli@latest add <component>`.

## What works today (no AI)

| Feature | How |
| --- | --- |
| **Ramble-to-entry** | Continuous speech-to-text with the phone's own recognizer. The audio is saved at the same time. A rule-based tidy pass removes "um/uh" and stutters, adds capitals and full stops, and starts a new paragraph where you paused. The exact transcript stays on the clip ("Show exactly what you said"). |
| **Hinglish and regional languages** | English (India), Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Malayalam, Gujarati and Punjabi, plus mixed modes (Hinglish, Kannada + English, Tamil + English). On Android 14+ with Google's on-device engine and both language packs downloaded, mixed modes switch languages mid-sentence. Elsewhere they fall back to the first language. Language packs can be downloaded from Settings. |
| **Hear your past self** | The timeline opens with an "On this day" card: the same date in past years, then a month ago and a week ago. It plays the voice clip from that day, not just the text. |
| **Energy from your voice** | Loudness, pace (words/min) and how much your voice varies combine into a Low / Steady / High energy badge. After 5 voice entries it compares you with your own recent average. This is a heuristic, not emotion detection. The raw metrics are stored on every clip so a real model can be added later. You also pick a mood yourself, and those picks will be useful labels for training that model. |
| **Photos and videos** | Pick from the gallery (several at once) or shoot with the camera. Videos show thumbnails and play full screen. |
| **Audio clips** | Plain recording with pause/resume, no transcription: music, rain, a moment. |
| **Search** | Searches titles, entry text and voice transcripts. |
| **Autosave** | New recordings and media are saved the moment you add them, and typing is saved after a short pause, so closing the app doesn't lose anything. |

## Run it on your phone

`expo-speech-recognition` is a native module, so **Expo Go won't work**. You need your own build
of the app. There are two ways to get one.

### Option A: cloud build (no Android Studio needed)

```bash
npm install -g eas-cli
eas login                 # free Expo account
eas init                  # links the project (one time)

npm run build:apk         # standalone APK to keep on your phone
# or, for live development:
npm run build:dev         # dev-client APK; install it, then:
npm run dev               # scan the QR code with the dev build
```

Open the link EAS prints on your phone to install the APK.

### Option B: local build

Install Android Studio (with JDK 17 and an SDK), connect your phone with USB debugging on, then:

```bash
npm run android           # expo run:android: builds, installs and starts Metro
```

### Phone requirements

- **Android 13+** to transcribe and keep the audio at the same time. On older phones the Speak
  panel is replaced by the plain audio recorder.
- **Android 14+** with the *Android System Intelligence* / Google on-device speech engine for
  mid-sentence language switching (Hinglish etc.).
- **iOS:** online recognition stops after about a minute. Turn on *Prefer offline recognition* in
  Settings for long rambles. iOS needs an EAS build (`eas build -p ios`) and an Apple developer account.

## Project layout

```
app/                    Screens (Expo Router)
  index.tsx             Timeline, search, On-this-day card, Write/Speak buttons
  compose.tsx           New/edit entry: voice, audio, photos, video, mood; autosave
  entry/[id].tsx        Read an entry, play clips, view media
  on-this-day.tsx       All memories for today
  settings.tsx          Language, offline packs, tidy toggle, theme
components/
  ui/                   shadcn-style primitives (React Native Reusables)
  voice-capture-panel   Live transcript + level meter + language chips
  audio-recorder-panel  Plain audio recording
  audio-player, media-grid, media-viewer, entry-card, memory-card, mood
lib/
  db.ts                 SQLite schema + migrations (PRAGMA user_version)
  entries.ts            Queries: list/search, save, delete, memories, energy baseline
  media.ts              Files under <documents>/media (stored by name, not absolute path)
  speech/               Recognizer options, language list, useVoiceCapture hook
  voice/pipeline.ts     ← the seam where AI plugs in (see below)
  voice/tidy.ts         Rule-based transcript clean-up
  voice/energy.ts       Voice energy heuristic
```

## Adding AI later

All voice post-processing goes through one interface in `lib/voice/pipeline.ts`:

```ts
export interface VoiceProcessor {
  process(capture: VoiceCapture, context): Promise<{ text; transcript; metrics; energy }>;
}
```

`capture` already contains the audio file, timed transcript segments and loudness samples, so an AI
version can:

1. **Rewrite a ramble into a clean entry** by sending the transcript to an LLM (Claude) instead of `tidyTranscript`.
2. **Do better Hinglish and Indic transcription** by re-transcribing the saved audio with Whisper, Sarvam or
   IndicConformer, e.g. to get Hinglish in Roman script, which phone recognizers don't do.
3. **Read mood from tone** with a speech-emotion model on the audio, trained against your own mood picks.

Swap `voiceProcessor` for the new implementation and the screens don't change. For a commercial
version you'd add accounts, encrypted cloud backup and an app lock (biometrics) next.

## Data

The SQLite database (`journal.db`) and the `media/` folder live in the app's documents directory.
Uninstalling the app deletes them. Back up before reinstalling until cloud backup or export exists.
