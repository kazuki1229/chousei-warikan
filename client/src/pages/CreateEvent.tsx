import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function CreateEvent() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [creatorEmail, setCreatorEmail] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  
  // Time options
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:00');
  
  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const response = await apiRequest('POST', '/api/events', eventData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "予定を作成しました",
        description: "参加者に共有するためのリンクが生成されました",
      });
      navigate(`/event/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "予定の作成に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !creatorName || !creatorEmail || selectedDates.length === 0) {
      toast({
        title: "入力エラー",
        description: "タイトル、お名前、メールアドレス、日程を入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // Format dates for submission
    const dateOptions = selectedDates.map(date => ({
      date: format(date, 'yyyy-MM-dd'),
      startTime,
      endTime
    }));
    
    createEventMutation.mutate({
      title,
      description,
      creatorName,
      creatorEmail,
      dateOptions
    });
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">新しい予定を作成</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
            <CardDescription>予定の基本情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input 
                id="title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 新年会" 
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">詳細 (任意)</Label>
              <Textarea 
                id="description" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 新年会の打ち合わせを行います。場所は後日連絡します。" 
                className="min-h-[100px]"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creatorName">お名前</Label>
                <Input 
                  id="creatorName" 
                  value={creatorName} 
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="例: 田中 健太" 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creatorEmail">メールアドレス</Label>
                <Input 
                  id="creatorEmail" 
                  type="email"
                  value={creatorEmail} 
                  onChange={(e) => setCreatorEmail(e.target.value)}
                  placeholder="例: tanaka@example.com" 
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>日程選択</CardTitle>
            <CardDescription>候補日を選択してください（複数選択可能）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-white rounded-md p-2 border">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={setSelectedDates as any}
                locale={ja}
                className="mx-auto"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時間</Label>
                <Input 
                  id="startTime" 
                  type="time"
                  value={startTime} 
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">終了時間</Label>
                <Input 
                  id="endTime" 
                  type="time"
                  value={endTime} 
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-md">
              <h3 className="font-medium mb-2 text-sm">選択された日程：</h3>
              {selectedDates.length > 0 ? (
                <ul className="space-y-1">
                  {selectedDates.map((date, index) => (
                    <li key={index} className="text-sm">
                      {format(date, 'yyyy年MM月dd日(EEE)', { locale: ja })} {startTime} - {endTime}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">日程が選択されていません</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-4 border-t pt-4">
            <Button variant="outline" type="button" onClick={() => navigate('/')}>キャンセル</Button>
            <Button 
              type="submit" 
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? (
                <>作成中...</>
              ) : (
                <>予定を作成</>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
