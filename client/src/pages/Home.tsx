import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
      <div className="mb-8 pb-4 border-b">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">イベント調整さん</h1>
            <p className="text-slate-500 mt-1">日程調整と割り勘が簡単に管理できます</p>
          </div>
          <Button 
            className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90"
            onClick={() => navigate('/create')}
          >
            <PlusCircle className="h-4 w-4" />
            新しい予定を作成
          </Button>
        </div>
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
              <div 
                key={event.id} 
                onClick={() => navigate(`/event/${event.id}`)}
                className="cursor-pointer"
              >
                <Card className="hover:shadow-md transition-shadow h-full border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500" />
                          <CardDescription className="line-clamp-1">
                            参加中
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-primary flex justify-end">続きを表示</div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* すべてのイベント */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium text-slate-800">すべてのイベント</h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/create')}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          新しいイベント
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

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
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        作成者: {event.creatorName}
                      </CardDescription>
                    </div>
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${event.selectedDate ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-slate-700">
                        <CalendarClock className="h-4 w-4 mr-2 text-primary/70" />
                        <span className="font-medium">
                          {event.selectedDate 
                            ? `確定: ${formatDate(new Date(event.selectedDate))}` 
                            : '日程調整中'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-sm text-slate-500">
                        参加者: {event.participantsCount || 0}人
                      </div>
                      <div className="text-xs text-primary">詳細を表示</div>
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/create')}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                予定を作成する
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
