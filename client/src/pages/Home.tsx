import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, CalendarClock, Loader2 } from 'lucide-react';
import { Event } from '@shared/schema';
import { formatDate } from '@/lib/utils';

export default function Home() {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-slate-800 mb-4 md:mb-0">イベント調整さん</h1>
        <Link href="/create">
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            新しい予定を作成
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-primary">新しい予定</CardTitle>
            <CardDescription>簡単に日程調整と割り勘を管理</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-24 flex items-center justify-center">
              <Link href="/create">
                <Button variant="outline" className="border-primary/30 hover:bg-primary/10">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  予定を作成する
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="h-40 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
            </CardContent>
          </Card>
        ) : events && events.length > 0 ? (
          events.map((event) => (
            <Link key={event.id} href={`/event/${event.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <CardDescription>
                    作成者: {event.creatorName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-slate-500 flex items-center">
                      <CalendarClock className="h-4 w-4 mr-2 text-primary/70" />
                      {event.selectedDate 
                        ? `確定日: ${formatDate(new Date(event.selectedDate))}` 
                        : '日程調整中'}
                    </div>
                    <div className="text-sm text-slate-500">
                      参加者: {event.participantsCount || 0}人
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <CardContent className="h-40 flex flex-col items-center justify-center text-center p-6">
              <p className="text-slate-500 mb-4">予定がまだありません</p>
              <Link href="/create">
                <Button variant="outline" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  予定を作成する
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
