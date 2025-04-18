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
  
  const [isIdentificationOpen, setIsIdentificationOpen] = useState(true);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string>('');
  const [responses, setResponses] = useState<DateResponse[]>([]);
  
  const { data: event, isLoading } = useQuery<Event>({
    queryKey: [`/api/events/${id}`],
  });
  
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
    mutationFn: async (data: { name: string; responses: DateResponse[] }) => {
      const response = await apiRequest('POST', `/api/events/${id}/attendances`, data);
      return response.json();
    },
    onSuccess: (data) => {
      setParticipantId(data.id);
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/attendances`] });
      toast({
        title: "回答を送信しました",
        description: "出欠回答ありがとうございます",
      });
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
            このイベントの日程は確定しています。精算機能をご利用いただけます。
          </AlertDescription>
        </Alert>
        
        <Card>
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
            
            <div className="flex justify-between">
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{event.title}</h1>
      
      {participantId ? (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <Check className="h-4 w-4" />
          <AlertTitle>回答を受け付けました</AlertTitle>
          <AlertDescription>
            {participantName}さん、回答ありがとうございます。以下で回答内容を変更できます。
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>出欠回答</AlertTitle>
          <AlertDescription>
            以下の候補日から参加可能な日程を選択してください。
          </AlertDescription>
        </Alert>
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
        eventId={id}
        onIdentify={handleIdentify}
      />
    </div>
  );
}
