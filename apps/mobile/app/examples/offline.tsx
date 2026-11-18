import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** A screen that cannot load without a connection: say so, keep what is saved, offer a retry. */
export default function OfflinePage({ edges }: { edges?: Edge[] }) {
  return (
    <Screen edges={edges} title="Insights" className="gap-4">
      <Alert icon={WifiOff}>
        <AlertTitle>You’re offline</AlertTitle>
        <AlertDescription>Showing what was saved on this phone.</AlertDescription>
      </Alert>
      <Empty className="mt-16 flex-none">
        <EmptyHeader>
          <EmptyMedia className="rounded-xl">
            <Icon as={CloudOff} className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Couldn’t load your report</EmptyTitle>
          <EmptyDescription>Check your connection and try again. Your data is safe.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className="h-11 px-6" onPress={() => router.replace('/')}>
            <Icon as={RefreshCw} className="size-4" />
            <Text className="text-base">Try again</Text>
          </Button>
        </EmptyContent>
      </Empty>
    </Screen>
  );
}
