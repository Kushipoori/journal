import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { mediaUri } from '@/lib/media';
import type { Attachment } from '@/lib/types';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { XIcon } from 'lucide-react-native';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MediaViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={!!attachment}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View className="flex-1 bg-black">
        {attachment?.kind === 'video' ? (
          <FullVideo uri={mediaUri(attachment.fileName)} />
        ) : attachment ? (
          <Image
            source={{ uri: mediaUri(attachment.fileName) }}
            contentFit="contain"
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          onPress={onClose}
          className="absolute right-4 rounded-full bg-black/50"
          style={{ top: insets.top + 8 }}
          accessibilityLabel="Close">
          <Icon as={XIcon} className="size-5 text-white" />
        </Button>
      </View>
    </Modal>
  );
}

function FullVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => instance.play());
  return <VideoView player={player} nativeControls contentFit="contain" style={{ flex: 1 }} />;
}
