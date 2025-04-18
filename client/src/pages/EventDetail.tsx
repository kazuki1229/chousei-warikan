import { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import IdentificationDialog from '@/components/IdentificationDialog';
import { Event, Attendance } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { formatDate } from '@/lib/utils';

export default function EventDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isIdentificationOpen, setIsIdentificationOpen] = useState(false);
  
  const { data: event, isLoading } = useQuery<Event>({
    queryKey: [`/api/events/${id}`],
  });
  
  const { data: attendances } = useQuery<Attendance[]>({
    queryKey: [`/api/events/${id}/attendances`],
    enabled: !!event,
  });
  
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
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{event.title}</h1>
          <p className="text-slate-500">作成者: {event.creatorName}</p>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button variant="outline" onClick={copyUrlToClipboard} className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            共有
          </Button>
          <Button onClick={() => setIsIdentificationOpen(true)} className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            出欠を入力
          </Button>
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
              <CardHeader>
                <CardTitle className="text-lg">確定した日程</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100 text-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">日程確定</span>
                  </div>
                  
                  <p className="text-lg font-medium">
                    {formatDate(new Date(event.selectedDate))}
                  </p>
                  
                  <p className="mt-1">
                    {event.startTime} - {event.endTime}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">候補日程</CardTitle>
                <CardDescription>最適な日程を選択してください</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.dateOptions.map((option) => {
                  const availability = calculateAvailability(option.id);
                  
                  return (
                    <div 
                      key={option.id} 
                      className="p-4 border rounded-lg hover:bg-slate-50 transition-colors"
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
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-medium text-green-700">{availability.available}</span>
                              <span className="text-xs text-slate-500">◯</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-medium text-amber-700">{availability.maybe}</span>
                              <span className="text-xs text-slate-500">△</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-medium text-red-700">{availability.unavailable}</span>
                              <span className="text-xs text-slate-500">×</span>
                            </div>
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
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/event/${id}/attendance`)}
                >
                  出欠を入力する
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">参加者一覧</CardTitle>
              <CardDescription>
                現在の参加者: {attendances?.length || 0}人
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendances && attendances.length > 0 ? (
                <div className="space-y-3">
                  {attendances.map((attendance) => (
                    <div 
                      key={attendance.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{attendance.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <p>まだ参加者がいません</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
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
            <CardHeader>
              <CardTitle className="text-lg">
                {event.selectedDate ? "費用精算" : "開催日が確定すると精算機能が使えます"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {event.selectedDate ? (
                <div className="space-y-4">
                  <Button onClick={() => navigate(`/event/${id}/expenses`)}>
                    <Calculator className="mr-2 h-4 w-4" />
                    精算ページへ
                  </Button>
                </div>
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <p>日程が確定するまで精算機能は使用できません</p>
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
