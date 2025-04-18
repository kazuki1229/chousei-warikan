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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

type DateOption = {
  date: Date;
  useDefaultTime: boolean;
  startTime?: string;
  endTime?: string;
};

export default function CreateEvent() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  
  // デフォルト時間設定
  const [defaultStartTime, setDefaultStartTime] = useState('19:00');
  const [defaultEndTime, setDefaultEndTime] = useState('21:00');
  
  // 日付選択時に自動的にDateOptions配列を更新
  const handleSelectDates = (dates: Date[] | undefined) => {
    if (!dates) return;
    
    setSelectedDates(dates);
    
    // 既存の日程オプションを保持しつつ、新しい日程を追加
    const updatedDateOptions = dates.map(date => {
      // 既存のオプションを探す
      const existingOption = dateOptions.find(
        option => format(option.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      
      // 既存のオプションがあればそれを返し、なければデフォルト設定で新規作成
      return existingOption || {
        date,
        useDefaultTime: true,
        startTime: undefined,
        endTime: undefined
      };
    });
    
    setDateOptions(updatedDateOptions);
  };
  
  // 個別の時間設定を更新
  const updateDateOption = (index: number, field: string, value: any) => {
    const updatedOptions = [...dateOptions];
    updatedOptions[index] = {
      ...updatedOptions[index],
      [field]: value
    };
    setDateOptions(updatedOptions);
  };
  
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
    
    if (!title || !creatorName || selectedDates.length === 0) {
      toast({
        title: "入力エラー",
        description: "タイトル、お名前、日程を入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // フォーマット日程オプション
    const formattedDateOptions = dateOptions.map(option => ({
      date: format(option.date, 'yyyy-MM-dd'),
      startTime: option.useDefaultTime ? undefined : option.startTime,
      endTime: option.useDefaultTime ? undefined : option.endTime,
      useDefaultTime: option.useDefaultTime
    }));
    
    // 作成者を参加者リストに追加（まだリストになければ）
    let allParticipants = [...participants];
    if (!allParticipants.includes(creatorName)) {
      allParticipants.unshift(creatorName);
    }
    
    createEventMutation.mutate({
      title,
      description,
      creatorName,
      defaultStartTime,
      defaultEndTime,
      dateOptions: formattedDateOptions,
      participants: allParticipants
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
              <Label>参加予定者</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={newParticipant} 
                  onChange={(e) => setNewParticipant(e.target.value)}
                  placeholder="参加者名を入力" 
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    if (newParticipant.trim()) {
                      setParticipants([...participants, newParticipant.trim()]);
                      setNewParticipant('');
                    }
                  }}
                >
                  追加
                </Button>
              </div>
              
              {participants.length > 0 && (
                <div className="mt-2 bg-slate-50 p-3 rounded-md">
                  <p className="text-sm text-slate-600 mb-2">参加予定者一覧:</p>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((participant, index) => (
                      <div key={index} className="bg-white px-3 py-1 rounded border flex items-center gap-2">
                        <span>{participant}</span>
                        <button 
                          type="button" 
                          className="text-slate-400 hover:text-red-500"
                          onClick={() => {
                            const newList = [...participants];
                            newList.splice(index, 1);
                            setParticipants(newList);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">※イベント作成時に参加者として登録されます</p>
                </div>
              )}
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
                onSelect={handleSelectDates as any}
                locale={ja}
                className="mx-auto"
              />
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-md">
                <h3 className="font-medium mb-3 text-slate-800">デフォルト時間設定</h3>
                <p className="text-sm text-slate-600 mb-4">すべての日程に適用される基本時間を設定します</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultStartTime">デフォルト開始時間</Label>
                    <Input 
                      id="defaultStartTime" 
                      type="time"
                      value={defaultStartTime} 
                      onChange={(e) => setDefaultStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultEndTime">デフォルト終了時間</Label>
                    <Input 
                      id="defaultEndTime" 
                      type="time"
                      value={defaultEndTime} 
                      onChange={(e) => setDefaultEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              
              {selectedDates.length > 0 && (
                <div className="border rounded-md">
                  <div className="p-4 border-b bg-slate-50">
                    <h3 className="font-medium text-slate-800">選択された日程</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {dateOptions.map((option, index) => (
                      <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex flex-col space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">
                              {format(option.date, 'yyyy年MM月dd日(EEE)', { locale: ja })}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Label htmlFor={`useDefault-${index}`} className="text-sm text-slate-600">
                                デフォルト時間を使用
                              </Label>
                              <Switch 
                                id={`useDefault-${index}`}
                                checked={option.useDefaultTime}
                                onCheckedChange={(checked) => updateDateOption(index, 'useDefaultTime', checked)}
                              />
                            </div>
                          </div>
                          
                          {!option.useDefaultTime && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 pl-5 border-l-2 border-slate-200">
                              <div className="space-y-1">
                                <Label htmlFor={`startTime-${index}`} className="text-sm">個別開始時間</Label>
                                <Input 
                                  id={`startTime-${index}`} 
                                  type="time"
                                  value={option.startTime || defaultStartTime}
                                  onChange={(e) => updateDateOption(index, 'startTime', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`endTime-${index}`} className="text-sm">個別終了時間</Label>
                                <Input 
                                  id={`endTime-${index}`} 
                                  type="time"
                                  value={option.endTime || defaultEndTime}
                                  onChange={(e) => updateDateOption(index, 'endTime', e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="text-slate-500 text-sm pl-2">
                            {option.useDefaultTime ? (
                              <span>時間: {defaultStartTime} - {defaultEndTime} （デフォルト）</span>
                            ) : (
                              <span>時間: {option.startTime || defaultStartTime} - {option.endTime || defaultEndTime}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
