import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarClock, 
  Users, 
  Share2, 
  ExternalLink, 
  Calculator,
  Check,
  Loader2,
  BookmarkPlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import IdentificationDialog from '@/components/IdentificationDialog';
import { Event, Attendance, Expense } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { formatDate } from '@/lib/utils';

export default function EventDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isIdentificationOpen, setIsIdentificationOpen] = useState(false);
  const [allParticipants, setAllParticipants] = useState<string[]>([]);
  
  const { data: event, isLoading, refetch: refetchEvent } = useQuery<Event>({
    queryKey: [`/api/events/${id}`],
    refetchInterval: 5000, // 5秒ごとに再取得（参加者変更が反映されるように）
  });
  
  const { data: attendances, refetch: refetchAttendances } = useQuery<Attendance[]>({
    queryKey: [`/api/events/${id}/attendances`],
    enabled: !!event,
    refetchInterval: 5000, // 5秒ごとに再取得
  });
  
  // 費用精算で追加された参加者を取得するためのクエリ
  const { data: expenses, refetch: refetchExpenses } = useQuery<Expense[]>({
    queryKey: [`/api/events/${id}/expenses`],
    enabled: !!event && !!event.selectedDate,
    refetchInterval: 5000, // 5秒ごとに再取得
  });
  
  // 全参加者リストを構築（出席情報+経費情報+イベント作成者から）
  useEffect(() => {
    if (event) {
      const participants: string[] = [];
      
      // イベント作成者を追加
      if (event.creatorName && !participants.includes(event.creatorName)) {
        participants.push(event.creatorName);
      }
      
      // イベントの参加者フィールドを追加（費用精算で追加された人を含む）
      if (event.participants && Array.isArray(event.participants)) {
        event.participants.forEach((name: string) => {
          if (!participants.includes(name)) {
            participants.push(name);
          }
        });
      }
      
      // 出席回答者を追加
      if (attendances) {
        attendances.forEach(attendance => {
          if (!participants.includes(attendance.name)) {
            participants.push(attendance.name);
          }
        });
      }
      
      // 支出記録から支払者を追加
      if (expenses) {
        expenses.forEach(expense => {
          if (!participants.includes(expense.payerName)) {
            participants.push(expense.payerName);
          }
          
          // 支出の参加者も追加
          if (expense.participants && Array.isArray(expense.participants)) {
            expense.participants.forEach((name: string) => {
              if (!participants.includes(name)) {
                participants.push(name);
              }
            });
          }
        });
      }
      
      // 参加者リストを更新
      setAllParticipants(participants);
      console.log("全参加者リスト更新:", participants);
    }
  }, [event, attendances, expenses]);
  
  // イベントが読み込まれたら、ローカルストレージに保存して「参加中のイベント」として追跡
  useEffect(() => {
    if (event) {
      try {
        // 既存の参加中イベントを取得
        const storedEvents = localStorage.getItem('recentEvents');
        let recentEvents: {id: string, title: string}[] = [];
        
        if (storedEvents) {
          recentEvents = JSON.parse(storedEvents);
        }
        
        // 既に存在するかチェック
        const existingIndex = recentEvents.findIndex(e => e.id === id);
        if (existingIndex !== -1) {
          // 既に存在する場合は削除（後で先頭に追加するため）
          recentEvents.splice(existingIndex, 1);
        }
        
        // 先頭に追加
        recentEvents.unshift({
          id: id || '',
          title: event.title
        });
        
        // 最大10件まで保持
        if (recentEvents.length > 10) {
          recentEvents = recentEvents.slice(0, 10);
        }
        
        // 保存
        localStorage.setItem('recentEvents', JSON.stringify(recentEvents));
      } catch (error) {
        console.error('Failed to save recent events to localStorage:', error);
      }
    }
  }, [event, id]);
  
  const finalizeEventMutation = useMutation({
    mutationFn: async (dateOptionId: string) => {
      const response = await apiRequest('POST', `/api/events/${id}/finalize`, { dateOptionId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      toast({
        title: "開催日を確定しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "開催日の確定に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  // 日程確定キャンセルのミューテーション
  const cancelFinalizationMutation = useMutation({
    mutationFn: async () => {
      // クリエイター名を取得（ローカルストレージなどから）
      const creatorName = event?.creatorName || '';
      const response = await apiRequest('POST', `/api/events/${id}/cancel-finalization`, { creatorName });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      toast({
        title: "日程確定をキャンセルしました",
        description: "日程の再調整ができるようになりました"
      });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "日程確定のキャンセルに失敗しました",
        variant: "destructive",
      });
    }
  });
  
  const copyUrlToClipboard = () => {
    const url = `${window.location.origin}/event/${id}/attendance`;
    navigator.clipboard.writeText(url);
    toast({
      title: "リンクをコピーしました",
      description: "参加者に共有してください",
    });
  };
  
  const handleIdentify = (name: string) => {
    navigate(`/event/${id}/attendance`);
  };
  
  const calculateAvailability = (dateOptionId: string) => {
    if (!attendances) return { available: 0, maybe: 0, unavailable: 0 };
    
    const results = attendances.reduce(
      (acc, attendance) => {
        const response = attendance.responses.find(r => r.dateOptionId === dateOptionId);
        if (response) {
          switch(response.status) {
            case 'available':
              acc.available++;
              break;
            case 'maybe':
              acc.maybe++;
              break;
            case 'unavailable':
              acc.unavailable++;
              break;
          }
        }
        return acc;
      },
      { available: 0, maybe: 0, unavailable: 0 }
    );
    
    return results;
  };
  
  if (isLoading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
      </div>
    );
  }
  
  if (!event) {
    return (
      <div className="max-w-4xl mx-auto text-center py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">エラー</h1>
        <p className="text-slate-600 mb-6">イベントが見つかりませんでした</p>
        <Button onClick={() => navigate('/')}>ホームに戻る</Button>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-700 px-2 -ml-2"
          >
            ← 戻る
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">{event.title}</h1>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <p className="text-slate-500">作成者: {event.creatorName}</p>
          
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button variant="outline" onClick={copyUrlToClipboard} className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              共有
            </Button>
            <Button 
              onClick={() => navigate(`/event/${id}/attendance`)} 
              className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              出欠を入力
            </Button>
          </div>
        </div>
      </div>
      
      {event.description && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="whitespace-pre-line">{event.description}</p>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="schedule">
        <TabsList className="mb-4">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            日程
          </TabsTrigger>
          <TabsTrigger value="participants" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            参加者
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            費用精算
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="schedule">
          {event.selectedDate ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">確定した日程</CardTitle>
                    <CardDescription>
                      この日程でイベントが開催されます
                    </CardDescription>
                  </div>
                  {/* 作成者の場合にキャンセルボタンを表示 */}
                  {event.creatorName && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => cancelFinalizationMutation.mutate()}
                      disabled={cancelFinalizationMutation.isPending}
                      className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    >
                      {cancelFinalizationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <BookmarkPlus className="h-4 w-4 mr-2" />
                      )}
                      確定をキャンセル
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-5 bg-green-50 rounded-lg border border-green-100 text-green-800">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl font-medium">
                      {formatDate(new Date(event.selectedDate))}
                    </p>
                    <p className="text-green-700 mt-1">
                      {event.startTime} - {event.endTime}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-center mt-6">
                  <Button 
                    onClick={() => navigate(`/event/${id}/expenses`)}
                    variant="default"
                    className="w-full md:w-auto"
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    費用精算に進む
                  </Button>
                </div>
                
                {event.creatorName && (
                  <div className="mt-4 pt-4 border-t text-sm text-slate-500 flex items-center">
                    <div className="flex-1">
                      <p>
                        イベント作成者は「確定をキャンセル」ボタンをクリックすると、
                        再び候補日から選び直すことができます。既存の参加者の回答状況は保持されます。
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">候補日程</CardTitle>
                    <CardDescription>
                      参加者の出欠に基づいて最適な日程を確定できます
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <Button 
                    onClick={() => navigate(`/event/${id}/attendance`)}
                    className="w-full md:w-auto"
                    variant="outline" 
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    自分の出欠を入力
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {event.dateOptions.map((option) => {
                    const availability = calculateAvailability(option.id);
                    const totalResponses = availability.available + availability.maybe + availability.unavailable;
                    const availablePercent = totalResponses > 0 
                      ? Math.round((availability.available / totalResponses) * 100) 
                      : 0;
                    
                    return (
                      <div 
                        key={option.id} 
                        className="border rounded-lg hover:border-primary/30 transition-colors"
                      >
                        <div className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <div className="flex items-center">
                                <CalendarClock className="h-4 w-4 text-primary mr-2" />
                                <p className="font-medium">
                                  {formatDate(new Date(option.date))}
                                </p>
                              </div>
                              <p className="text-slate-500 text-sm mt-1">
                                {option.startTime} - {option.endTime}
                              </p>
                            </div>
                            
                            {!event.selectedDate && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => finalizeEventMutation.mutate(option.id)}
                                disabled={finalizeEventMutation.isPending}
                              >
                                確定する
                              </Button>
                            )}
                          </div>
                          
                          <div className="mt-3 pt-3 border-t flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                                  <span className="text-sm font-medium">{availability.available}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="inline-block w-3 h-3 rounded-full bg-amber-400"></span>
                                  <span className="text-sm font-medium">{availability.maybe}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="inline-block w-3 h-3 rounded-full bg-red-400"></span>
                                  <span className="text-sm font-medium">{availability.unavailable}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-sm text-slate-500">
                              回答: {totalResponses}/{attendances?.length || 0}人
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <div className="text-slate-500 text-sm flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  回答者数: {attendances?.length || 0}人
                </div>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={copyUrlToClipboard}
                  className="text-slate-500"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  共有
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="participants">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">参加者一覧</CardTitle>
                  <CardDescription>
                    全ての参加者: {allParticipants.length || 0}人
                  </CardDescription>
                </div>
                
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/event/${id}/attendance`)}
                >
                  出欠を入力する
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {allParticipants.length > 0 ? (
                <div className="divide-y">
                  {allParticipants.map((name) => (
                    <div 
                      key={name} 
                      className="flex items-center py-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3">
                        {name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
                    <Users className="h-6 w-6 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">まだ参加者がいません</h3>
                  <p className="text-slate-500 mb-4">友達や同僚に共有して、日程調整を始めましょう</p>
                  <Button 
                    variant="outline" 
                    onClick={copyUrlToClipboard}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    共有リンクをコピー
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="expenses">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">費用精算</CardTitle>
                  <CardDescription>
                    {event.selectedDate 
                      ? "イベントの支払いを簡単に管理できます" 
                      : "開催日が確定すると精算機能が使えます"}
                  </CardDescription>
                </div>
                
                {event.selectedDate && (
                  <Button 
                    onClick={() => navigate(`/event/${id}/expenses`)}
                    size="sm"
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    精算を管理
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {event.selectedDate ? (
                <div className="border rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">精算機能でできること</h3>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                        <span>イベントの支払いを全員で簡単に分担</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                        <span>各参加者の負担額を自動計算</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                        <span>誰が誰にいくら支払うべきかを算出</span>
                      </li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => navigate(`/event/${id}/expenses`)}
                    className="w-full"
                  >
                    精算ページに移動
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 px-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
                    <Calculator className="h-6 w-6 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">まだ利用できません</h3>
                  <p className="text-slate-500">イベントの日程が確定すると、参加者と費用を分担できます</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <IdentificationDialog
        isOpen={isIdentificationOpen}
        onClose={() => setIsIdentificationOpen(false)}
        eventId={id || ''}
        onIdentify={handleIdentify}
      />
    </div>
  );
}
