import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Film, X } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBytes } from '@/lib/media';
import { MAX_PHOTOS_PER_REQUEST, MAX_VIDEOS_PER_REQUEST } from '@/lib/media';

/** A chosen file, held on the device until the request is sent. */
export interface PendingPhoto {
  id: string;
  kind: 'photo' | 'video';
  uri: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
}

/**
 * Photos and a short video, added to a job from the phone.
 *
 * The phone is where someone is standing in front of the problem, so the camera
 * is offered first and the photo library second. Nothing is uploaded until the
 * request is sent; the files are held here with a preview, so a photo can be
 * taken back before it goes anywhere.
 */
export function MediaPicker({
  media,
  onChange,
  disabled,
  disabledNote,
}: {
  media: PendingPhoto[];
  onChange: (next: PendingPhoto[]) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  const photos = media.filter(item => item.kind === 'photo').length;
  const videos = media.filter(item => item.kind === 'video').length;

  function addResults(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets) return;
    const accepted: PendingPhoto[] = [];
    let working = media;
    for (const asset of result.assets) {
      const isVideo = (asset.type ?? '') === 'video' || (asset.mimeType ?? '').startsWith('video/');
      if (isVideo && working.filter(m => m.kind === 'video').length >= MAX_VIDEOS_PER_REQUEST) {
        setError('One video per job is enough. Remove the clip you added to send a different one.');
        continue;
      }
      if (!isVideo && working.filter(m => m.kind === 'photo').length >= MAX_PHOTOS_PER_REQUEST) {
        setError('That is ' + MAX_PHOTOS_PER_REQUEST + ' photos already — plenty for one job.');
        continue;
      }
      const item: PendingPhoto = {
        id: (isVideo ? 'video-' : 'photo-') + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        kind: isVideo ? 'video' : 'photo',
        uri: asset.uri,
        fileName: asset.fileName ?? (isVideo ? 'clip.mp4' : 'photo.jpg'),
        mimeType: asset.mimeType ?? null,
        size: asset.fileSize ?? null,
      };
      accepted.push(item);
      working = [...working, item];
    }
    if (accepted.length > 0) {
      setError(null);
      onChange(working);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('FixIt needs camera access to take a photo. You can allow it in your phone settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: 30,
    });
    addResults(result);
  }

  async function fromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('FixIt needs access to your photos to attach one. You can allow it in your phone settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_PHOTOS_PER_REQUEST - photos),
    });
    addResults(result);
  }

  function remove(item: PendingPhoto) {
    onChange(media.filter(m => m.id !== item.id));
    setError(null);
  }

  return (
    <View className="gap-2.5">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-foreground/70 text-xs font-bold">
          Photos or a short video <Text className="text-muted-foreground font-normal">(recommended)</Text>
        </Text>
        <Text className="text-muted-foreground text-[11.5px]">
          {photos}/{MAX_PHOTOS_PER_REQUEST} photos{videos > 0 ? ' · 1 video' : ''}
        </Text>
      </View>

      {disabled ? (
        <Text className="border-border bg-muted/40 text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-[12.5px]">
          {disabledNote ?? 'Photos need a signed-in account.'}
        </Text>
      ) : (
        <View className="flex-row gap-2.5">
          <Button
            variant="outline"
            className="h-12 flex-1"
            accessibilityLabel="Take a photo"
            onPress={() => void takePhoto()}>
            <Icon as={Camera} className="text-primary size-4" />
            <Text>Take a photo</Text>
          </Button>
          <Button
            variant="outline"
            className="h-12 flex-1"
            accessibilityLabel="Choose from my photos"
            onPress={() => void fromLibrary()}>
            <Icon as={Film} className="text-primary size-4" />
            <Text>Choose</Text>
          </Button>
        </View>
      )}

      {media.length > 0 ? (
        <View className="flex-row flex-wrap gap-2.5">
          {media.map(item => (
            <View key={item.id} className="border-border bg-muted relative overflow-hidden rounded-lg border">
              {item.kind === 'photo' ? (
                <Image source={{ uri: item.uri }} alt={item.fileName} className="h-24 w-24" resizeMode="cover" />
              ) : (
                <View className="h-24 w-24 items-center justify-center">
                  <Icon as={Film} className="text-foreground/40 size-6" />
                  <Text className="text-foreground/60 text-[11px] font-bold">Video</Text>
                </View>
              )}
              <View className="bg-foreground/70 absolute bottom-0 left-0 right-0 px-1.5 py-0.5">
                <Text className="text-background text-[11px] font-bold" numberOfLines={1}>
                  {formatBytes(item.size ?? 0)}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={'Remove ' + item.fileName}
                onPress={() => remove(item)}
                className="bg-foreground/70 absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full">
                <Icon as={X} className="text-background size-3.5" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text className="text-destructive text-[12.5px]">{error}</Text> : null}
      <Text className="text-muted-foreground text-[11.5px]">
        A photo of the problem leads to a more accurate quote and saves a wasted visit. Only the
        professionals who can see your job can open what you send.
      </Text>
    </View>
  );
}
