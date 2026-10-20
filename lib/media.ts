import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

let mediaDirectory: Directory | null = null;

/** All journal media lives in <documents>/media so it is backed up with the app and never evicted. */
function mediaDir() {
  if (!mediaDirectory) {
    mediaDirectory = new Directory(Paths.document, 'media');
    mediaDirectory.create({ intermediates: true, idempotent: true });
  }
  return mediaDirectory;
}

export function mediaUri(fileName: string) {
  return new File(mediaDir(), fileName).uri;
}

function extensionOf(uri: string, fallback: string) {
  const match = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri);
  return match ? match[1].toLowerCase() : fallback;
}

const AUDIO_MIME: Record<string, string> = {
  wav: 'audio/wav',
  caf: 'audio/x-caf',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  '3gp': 'audio/3gpp',
};

export function audioMimeType(fileName: string) {
  return AUDIO_MIME[extensionOf(fileName, '')] ?? null;
}

/**
 * Brings a file the app just produced or picked into the media directory and returns its stored name.
 * `move` is for our own temp files (recordings, camera captures); picked files are copied so the
 * source app keeps its copy.
 */
export async function importMedia(
  sourceUri: string,
  { fallbackExt, move }: { fallbackExt: string; move: boolean }
) {
  const fileName = `${randomUUID()}.${extensionOf(sourceUri, fallbackExt)}`;
  const source = new File(sourceUri);
  const destination = new File(mediaDir(), fileName);
  if (move) {
    await source.move(destination);
  } else {
    await source.copy(destination);
  }
  return fileName;
}

export function deleteMedia(fileName: string) {
  try {
    const file = new File(mediaDir(), fileName);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Could not delete media file', fileName, error);
  }
}
