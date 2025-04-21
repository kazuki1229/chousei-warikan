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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, AlertCircle, Calendar, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import IdentificationDialog from '@/components/IdentificationDialog';
import { Event, DateOption } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { formatDate } from '@/lib/utils';

type AttendanceStatus = 'available' | 'maybe' | 'unavailable';

interface DateResponse {
  dateOptionId: string;
  status: AttendanceStatus;
}

export default function EventAttendance() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isIdentificationOpen, setIsIdentificationOpen] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string>('');
  const [responses, setResponses] = useState<DateResponse[]>([]);
  const [attendances, setAttendances] = useState<{id: string, name: string}[]>([]);
  
  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: [`/api/events/${id}`],
  });
  
  const { data: attendancesList, isLoading: attendancesLoading } = useQuery<any[]>({
    queryKey: [`/api/events/${id}/attendances`],
  });
  
  // 参加者リストが更新されたら状態を更新
  useEffect(() => {
    if (attendancesList) {
      setAttendances(attendancesList.map(item => ({ 
        id: item.id, 
        name: item.name 
      })));
    }
  }, [attendancesList]);
  
  const isLoading = eventLoading || attendancesLoading;
  
  // Set default responses when event data loads
  useEffect(() => {
    if (event?.dateOptions) {
      setResponses(
        event.dateOptions.map(option => ({
          dateOptionId: option.id,
          status: 'unavailable' as AttendanceStatus
        }))
      );
    }
  }, [event?.dateOptions]);
  
  const submitAttendanceMutation = useMutation({
    mutationFn: async (data: { name: string; responses?: DateResponse[] }) => {
      // 確定済み日程の場合（既に決まっている場合）
      if (event?.selectedDate) {
        // ダミーの回答を作成（APIは必ず回答が必要なため）
        const dummyResponse = {
          name: data.name,
          responses: [{
            dateOptionId: event.dateOptions[0].id,
            status: 'available' as AttendanceStatus
          }]
        };
        const response = await apiRequest('POST', `/api/events/${id}/attendances`, dummyResponse);
        return response.json();
      } else {
        // 通常の候補日選択の場合
        const response = await apiRequest('POST', `/api/events/${id}/attendances`, {
          name: data.name,
          responses: data.responses || []
        });
        return response.json();
      }
    },
    onSuccess: (data) => {
      setParticipantId(data.id);
      setParticipantName(data.name);
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/attendances`] });
      
      // Store event info in localStorage for the Home page
      try {
        const storedEvents = localStorage.getItem('recentEvents');
        const recentEvents = storedEvents ? JSON.parse(storedEvents) : [];
        
        // Add or update this event
        const eventIndex = recentEvents.findIndex(
          (e: any) => e.id === id
        );
        
        if (eventIndex === -1) {
          // Add new event to recent list
          recentEvents.push({
            id,
            title: event?.title || "イベント"
          });
        }
        
        // Save back to localStorage with 20 most recent events
        localStorage.setItem('recentEvents', JSON.stringify(
          recentEvents.slice(-20)
        ));
      } catch (error) {
        console.error('Failed to save recent event to localStorage:', error);
      }
      
      const isConfirmedEvent = event?.selectedDate ? true : false;
      
      toast({
        title: isConfirmedEvent ? "参加登録しました" : "回答を送信しました",
        description: isConfirmedEvent 
          ? `${data.name}さん、参加登録ありがとうございます` 
          : "出欠回答ありがとうございます",
      });
      
      // 回答送信後はイベント詳細ページに遷移する
      navigate(`/event/${id}`);
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "回答の送信に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  const handleIdentify = (name: string) => {
    setParticipantName(name);
    
    submitAttendanceMutation.mutate({
      name,
      responses
    });
  };
  
  const updateResponse = (dateOptionId: string, status: AttendanceStatus) => {
    setResponses(prev => 
      prev.map(response => 
        response.dateOptionId === dateOptionId 
          ? { ...response, status } 
          : response
      )
    );
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!participantId) {
      setIsIdentificationOpen(true);
      return;
    }
    
    // If we already have a participant ID, we're updating
    submitAttendanceMutation.mutate({
      name: participantName,
      responses
    });
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
  
  if (event.selectedDate) {
    // If event is already finalized, show the confirmation screen
    const finalizedOption = event.dateOptions.find(
      option => new Date(option.date).toISOString().split('T')[0] === event.selectedDate
    );
    
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">{event.title}</h1>
        
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <Check className="h-4 w-4" />
          <AlertTitle>日程が確定しています</AlertTitle>
          <AlertDescription>
            このイベントの日程は既に確定しています。参加者登録をして精算機能をご利用いただけます。
          </AlertDescription>
        </Alert>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>確定日程</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-slate-50">
              <div className="flex items-start gap-4">
                <Calendar className="h-5 w-5 text-primary mt-1" />
                <div>
                  <p className="font-medium">{formatDate(new Date(event.selectedDate))}</p>
                  <p className="text-slate-500 flex items-center mt-1">
                    <Clock className="h-4 w-4 mr-1" />
                    {finalizedOption?.startTime || event.startTime} - {finalizedOption?.endTime || event.endTime}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {participantId ? (
          // 参加者登録済みの場合
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>参加者登録完了</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-700 font-medium">{participantName}さんとして登録しました</p>
                  <p className="text-slate-600 text-sm mt-1">このイベントの参加者として登録されました</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setParticipantId(null);
                    setParticipantName('');
                  }}
                >
                  別の参加者を選択
                </Button>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/event/${id}`)}
              >
                イベント詳細に戻る
              </Button>
              <Button 
                onClick={() => navigate(`/event/${id}/expenses`)}
              >
                精算ページへ
              </Button>
            </CardFooter>
          </Card>
        ) : (
          // 参加者登録前の場合
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>参加者登録</CardTitle>
              <CardDescription>
                イベントに参加する方として登録してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendances && attendances.length > 0 ? (
                <div>
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">登録済み参加者</h3>
                    <div className="flex flex-wrap gap-2">
                      {attendances.map((attendance) => (
                        <Button 
                          key={attendance.id} 
                          variant="outline"
                          className="hover:bg-primary/10"
                          onClick={() => {
                            setParticipantId(attendance.id);
                            setParticipantName(attendance.name);
                            
                            toast({
                              title: "参加者を選択しました",
                              description: `${attendance.name}さんとして登録します`,
                            });
                          }}
                        >
                          {attendance.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <div className="px-2 text-slate-500 text-sm">または</div>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>
                </div>
              ) : null}
              
              <div>
                <h3 className="font-medium mb-2">新しい参加者として登録</h3>
                <Button 
                  variant="default" 
                  onClick={() => setIsIdentificationOpen(true)}
                >
                  新しい参加者として登録する
                </Button>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/event/${id}`)}
                className="w-full"
              >
                イベント詳細に戻る
              </Button>
            </CardFooter>
          </Card>
        )}
        
        <IdentificationDialog
          isOpen={isIdentificationOpen && !participantId}
          onClose={() => setIsIdentificationOpen(false)}
          eventId={id || ''}
          onIdentify={handleIdentify}
        />
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{event.title}</h1>
      
      {participantId ? (
        <>
          <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
            <Check className="h-4 w-4" />
            <AlertTitle>回答を受け付けました</AlertTitle>
            <AlertDescription>
              {participantName}さん、回答ありがとうございます。以下で回答内容を変更できます。
            </AlertDescription>
          </Alert>
          
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-800">現在の参加者</h3>
                  <p className="text-slate-600 text-sm mt-1">{participantName}さんが選択されています</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setParticipantId(null);
                    setParticipantName('');
                  }}
                >
                  別の参加者を選択
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>出欠回答</AlertTitle>
            <AlertDescription>
              以下の候補日から参加可能な日程を選択してください。
            </AlertDescription>
          </Alert>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>参加者を選択</CardTitle>
              <CardDescription>
                既に登録されている参加者から選択するか、新しい参加者として回答してください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendances && attendances.length > 0 ? (
                <div>
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">登録済み参加者</h3>
                    <div className="flex flex-wrap gap-2">
                      {attendances.map((attendance) => (
                        <Button 
                          key={attendance.id} 
                          variant="outline"
                          className="hover:bg-primary/10"
                          onClick={() => {
                            setParticipantId(attendance.id);
                            setParticipantName(attendance.name);
                            
                            // 既存の回答があればロード
                            const existing = attendancesList?.find(a => a.id === attendance.id);
                            if (existing && existing.responses && existing.responses.length > 0) {
                              // 既存の回答をロード
                              setResponses(
                                existing.responses.map((resp: any) => ({
                                  dateOptionId: resp.dateOptionId,
                                  status: resp.status as AttendanceStatus
                                }))
                              );
                            }
                            
                            toast({
                              title: "参加者を選択しました",
                              description: `${attendance.name}さんとして回答します`,
                            });
                          }}
                        >
                          {attendance.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <div className="px-2 text-slate-500 text-sm">または</div>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>
                </div>
              ) : null}
              
              <div>
                <h3 className="font-medium mb-2">新しい参加者として回答</h3>
                <Button 
                  variant="default" 
                  onClick={() => setIsIdentificationOpen(true)}
                >
                  新しい参加者として回答する
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>日程候補</CardTitle>
            <CardDescription>
              それぞれの日程について、参加可能かどうかを選択してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.dateOptions.map((option: DateOption) => {
              const response = responses.find(r => r.dateOptionId === option.id);
              const status = response?.status || 'unavailable';
              
              return (
                <div 
                  key={option.id} 
                  className="p-4 border rounded-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {formatDate(new Date(option.date))}
                      </p>
                      <p className="text-slate-500 text-sm">
                        {option.startTime} - {option.endTime}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        className={`availability-button ${status === 'available' ? 'active available' : 'bg-slate-100 text-slate-800'}`}
                        onClick={() => updateResponse(option.id, 'available')}
                      >
                        ◯
                      </button>
                      <button
                        type="button"
                        className={`availability-button ${status === 'maybe' ? 'active maybe' : 'bg-slate-100 text-slate-800'}`}
                        onClick={() => updateResponse(option.id, 'maybe')}
                      >
                        △
                      </button>
                      <button
                        type="button"
                        className={`availability-button ${status === 'unavailable' ? 'active unavailable' : 'bg-slate-100 text-slate-800'}`}
                        onClick={() => updateResponse(option.id, 'unavailable')}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              type="button"
              onClick={() => navigate(`/event/${id}`)}
            >
              イベントに戻る
            </Button>
            <Button 
              type="submit"
              disabled={submitAttendanceMutation.isPending}
            >
              {submitAttendanceMutation.isPending ? '送信中...' : '回答を送信'}
            </Button>
          </CardFooter>
        </Card>
      </form>
      
      <IdentificationDialog
        isOpen={isIdentificationOpen && !participantId}
        onClose={() => setIsIdentificationOpen(false)}
        eventId={id || ''}
        onIdentify={handleIdentify}
      />
    </div>
  );
}
