import type { Edge } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { CircleArrowUp } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { config } from '@/lib/config';

/** What an installed app older than the minimum version shows instead of the app. */
export default function UpdatePage({ edges }: { edges?: Edge[] }) {
  const version = Constants.expoConfig?.version;
  return (
    <Screen edges={edges} scroll={false} className="px-6 pb-10 pt-0">
      <Empty className="p-0">
        <EmptyHeader>
          <EmptyMedia className="size-16 rounded-2xl">
            <Icon as={CircleArrowUp} className="size-[30px]" />
          </EmptyMedia>
          <EmptyTitle className="text-2xl font-semibold">Update required</EmptyTitle>
          <EmptyDescription>This version is no longer supported. Open the link you installed the app from to get the latest version.</EmptyDescription>
        </EmptyHeader>
      </Empty>
      {version ? (
        <Text className="text-muted-foreground text-center text-xs">
          Version {version}{config.versionCode > 0 ? ` (${config.versionCode})` : ''}
        </Text>
      ) : null}
    </Screen>
  );
}
