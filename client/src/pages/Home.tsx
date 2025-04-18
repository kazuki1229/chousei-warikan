import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, CalendarClock, Loader2, History, Star } from 'lucide-react';
import { Event } from '@shared/schema';
import { formatDate } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function Home() {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });
  const [, navigate] = useLocation();
  
  // ローカルストレージから参加済みイベントの履歴を取得
  const [recentEvents, setRecentEvents] = useState<{id: string, title: string}[]>([]);
  
  useEffect(() => {
    // ローカルストレージからユーザーが参加した最近のイベントを取得
    try {
      const storedEvents = localStorage.getItem('recentEvents');
      if (storedEvents) {
        setRecentEvents(JSON.parse(storedEvents));
      }
    } catch (error) {
      console.error('Failed to load recent events from localStorage:', error);
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-slate-800 mb-4 md:mb-0">イベント調整さん</h1>
        <Button 
          className="flex items-center gap-2"
          onClick={() => navigate('/create')}
        >
          <PlusCircle className="h-4 w-4" />
          新しい予定を作成
        </Button>
      </div>

      {/* 最近参加したイベント */}
      {recentEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center">
            <History className="h-5 w-5 mr-2 text-primary/70" />
            参加中のイベント
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentEvents.map((event) => (
              <div key={event.id} onClick={() => navigate(`/event/${event.id}`)}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20">
                  <CardContent className="py-4">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-3 text-amber-500" />
                      <div>
                        <h3 className="font-medium">{event.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">クリックして詳細を表示</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* すべてのイベント */}
      <h2 className="text-xl font-medium text-slate-800 mb-4">すべてのイベント</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-primary">新しい予定</CardTitle>
            <CardDescription>簡単に日程調整と割り勘を管理</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-24 flex items-center justify-center">
              <Button 
                variant="outline" 
                className="border-primary/30 hover:bg-primary/10"
                onClick={() => navigate('/create')}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                予定を作成する
              </Button>
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
            <div 
              key={event.id} 
              onClick={() => navigate(`/event/${event.id}`)}
              className="cursor-pointer"
            >
              <Card className="hover:shadow-md transition-shadow">
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
            </div>
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
