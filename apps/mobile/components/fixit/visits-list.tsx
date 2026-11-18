import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { listMyAppointments } from '@/lib/fixit';
import { cn } from '@/lib/utils';

function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Upcoming and past visits a professional booked, soonest first. */
export function VisitsList() {
  const visits = useQuery({ queryKey: ['my-appointments'], queryFn: listMyAppointments });

  if (visits.isPending) {
    return <Skeleton className="h-24 w-full rounded-2xl" />;
  }
  if (visits.isError) {
    return (
      <Card className="py-5">
        <CardContent className="gap-3 px-5">
          <Text className="text-muted-foreground text-sm">We could not load your visits right now.</Text>
          <Button variant="outline" onPress={() => void visits.refetch()}><Text>Try again</Text></Button>
        </CardContent>
      </Card>
    );
  }
  if (visits.data.length === 0) {
    return (
      <Card className="border-dashed py-5">
        <CardContent className="px-5">
          <Text className="text-muted-foreground text-sm leading-5">
            No visits scheduled yet. When a professional books a time to come out, it appears here.
          </Text>
        </CardContent>
      </Card>
    );
  }

  const upcoming = visits.data.filter(visit => visit.status === 'scheduled');
  const past = visits.data.filter(visit => visit.status !== 'scheduled');

  return (
    <View className="gap-3">
      {[...upcoming, ...past].map(visit => {
        const active = visit.status === 'scheduled';
        return (
          <Card key={visit.id} className="py-4">
            <CardContent className="flex-row items-start gap-3.5 px-4">
              <View className={cn('size-11 items-center justify-center rounded-xl', active ? 'bg-[#E9F1FB]' : 'bg-muted')}>
                <Icon as={CalendarDays} className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-[15px] font-semibold">{visit.title}</Text>
                <Text className="text-muted-foreground text-[12.5px]">
                  {when(visit.scheduled_for) + ' · ' + visit.city}
                </Text>
                {visit.notes ? (
                  <Text className="text-muted-foreground text-[12.5px] leading-5">{visit.notes}</Text>
                ) : null}
              </View>
              <Badge variant={active ? 'default' : visit.status === 'completed' ? 'secondary' : 'outline'}>
                <Text className="text-[11px]">{STATUS[visit.status] ?? visit.status}</Text>
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </View>
  );
}
