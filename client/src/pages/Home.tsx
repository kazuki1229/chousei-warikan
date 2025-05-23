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
import { PlusCircle, CalendarClock, Loader2, History, Star, Trash2 } from 'lucide-react';
import { Event } from '@shared/schema';
import { formatDate } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { data: allEvents, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // 自分が作成したイベントIDリスト
  const [myEventIds, setMyEventIds] = useState<string[]>([]);
  
  // ローカルストレージから参加済みイベントの履歴を取得
  const [recentEvents, setRecentEvents] = useState<{id: string, title: string}[]>([]);
  
  // 自分が作成したイベントのみをフィルタリング
  const myEvents = useMemo(() => {
    if (!allEvents || !myEventIds.length) return [];
    return allEvents.filter(event => myEventIds.includes(event.id));
  }, [allEvents, myEventIds]);
  
  // イベント履歴から項目を削除する関数
  const removeFromHistory = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // イベントの伝播を停止（カードのクリックイベントを発火させない）
    
    try {
      // 現在の履歴を取得
      const storedEvents = localStorage.getItem('recentEvents');
      if (storedEvents) {
        // 該当IDのイベントを除外した新しい配列を作成
        const events = JSON.parse(storedEvents);
        const updatedEvents = events.filter((e: {id: string}) => e.id !== eventId);
        
        // 更新した配列を保存
        localStorage.setItem('recentEvents', JSON.stringify(updatedEvents));
        setRecentEvents(updatedEvents);
        
        toast({
          title: "履歴から削除しました",
          description: "イベントが参加中リストから削除されました",
        });
      }
    } catch (error) {
      console.error('Failed to remove event from history:', error);
      toast({
        title: "エラーが発生しました",
        description: "削除処理に失敗しました",
        variant: "destructive"
      });
    }
  };
  
  // 自分が作成したイベントを削除する関数
  const removeMyEvent = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // イベントの伝播を停止（カードのクリックイベントを発火させない）
    
    try {
      // 現在の自作イベントリストを取得
      const updatedEventIds = myEventIds.filter(id => id !== eventId);
      
      // 更新した配列を保存
      localStorage.setItem('myCreatedEvents', JSON.stringify(updatedEventIds));
      setMyEventIds(updatedEventIds);
      
      toast({
        title: "マイイベントから削除しました",
        description: "イベントがマイイベントリストから削除されました",
      });
    } catch (error) {
      console.error('Failed to remove event from my events:', error);
      toast({
        title: "エラーが発生しました",
        description: "削除処理に失敗しました",
        variant: "destructive"
      });
    }
  };
  
  useEffect(() => {
    // ローカルストレージからユーザーが参加した最近のイベントを取得
    try {
      const storedEvents = localStorage.getItem('recentEvents');
      if (storedEvents) {
        setRecentEvents(JSON.parse(storedEvents));
      }
      
      // 自分が作成したイベントのIDリストを取得
      const storedMyEvents = localStorage.getItem('myCreatedEvents');
      if (storedMyEvents) {
        setMyEventIds(JSON.parse(storedMyEvents));
      }
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
    }
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800 mb-1">マイイベント</h1>
      </div>

      {/* 最近参加したイベント */}
      {recentEvents.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-medium text-slate-800 mb-3 flex items-center">
            <History className="h-4 w-4 mr-1.5 text-primary/70" />
            参加中のイベント
          </h2>
          <div className="space-y-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
            {recentEvents.map((event) => (
              <div 
                key={event.id} 
                onClick={() => navigate(`/event/${event.id}`)}
                className="cursor-pointer"
              >
                <div className="mobile-card sm:hover:shadow-md transition-shadow h-full">
                  <div className="card-header-mobile">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-base line-clamp-1">{event.title}</h3>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500" />
                          <p className="text-xs text-slate-500 line-clamp-1">
                            参加中
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => removeFromHistory(event.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="card-content-mobile">
                    <div className="text-xs text-primary flex justify-end">詳細</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 自分のイベント */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-medium text-slate-800">自分が作成したイベント</h2>
      </div>
      <div className="space-y-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
        {isLoading ? (
          <div className="mobile-card">
            <div className="card-content-mobile h-40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
            </div>
          </div>
        ) : myEvents && myEvents.length > 0 ? (
          myEvents.map((event) => (
            <div 
              key={event.id} 
              onClick={() => navigate(`/event/${event.id}`)}
              className="cursor-pointer"
            >
              <div className="mobile-card sm:hover:shadow-md transition-shadow h-full">
                <div className="card-header-mobile">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 mr-2">
                      <h3 className="font-medium text-base line-clamp-1">{event.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        作成者: {event.creatorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${event.selectedDate ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                      <button 
                        onClick={(e) => removeMyEvent(event.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="card-content-mobile">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div className="flex items-center text-xs text-slate-700">
                        <CalendarClock className="h-3.5 w-3.5 mr-1 text-primary/70" />
                        <span className="font-medium">
                          {event.selectedDate 
                            ? `確定: ${formatDate(new Date(event.selectedDate))}` 
                            : '日程調整中'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <div className="text-slate-500">
                        参加者: {event.participantsCount || 0}人
                      </div>
                      <div className="text-primary">詳細</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="mobile-card">
            <div className="card-content-mobile h-32 flex flex-col items-center justify-center text-center p-4">
              <p className="text-sm text-slate-500 mb-3">予定がまだありません</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/create')}
                className="h-8 text-xs px-3"
              >
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                予定を作成する
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
