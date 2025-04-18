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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calculator, 
  Plus, 
  Trash2, 
  ArrowLeftRight,
  ArrowRight,
  AlertCircle,
  Loader2,
  Users,
  UserPlus,
  Wallet
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Event, Expense, Settlement, Attendance } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';

export default function ExpenseSplitting() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 新しい支出データの状態
  const [newExpense, setNewExpense] = useState({
    payerName: '',
    description: '',
    amount: '',
    participants: [] as string[] // 割り勘対象者の配列
  });
  
  // 新規参加者の追加モード
  const [isAddingNewPayer, setIsAddingNewPayer] = useState(false);
  // 参加者選択モード
  const [isSelectingParticipants, setIsSelectingParticipants] = useState(false);
  // 全員選択状態
  const [selectAllParticipants, setSelectAllParticipants] = useState(true);
  // 参加者一覧（重複排除済み）
  const [uniqueParticipants, setUniqueParticipants] = useState<string[]>([]);

  // イベント情報を取得
  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: [`/api/events/${id}`],
  });
  
  // イベント参加者リストを取得
  const { data: attendances, isLoading: attendancesLoading } = useQuery<Attendance[]>({
    queryKey: [`/api/events/${id}/attendances`],
    enabled: !!event,
  });
  
  // 経費情報を取得
  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: [`/api/events/${id}/expenses`],
    enabled: !!event,
  });
  
  // 精算情報を取得
  const { data: settlements, isLoading: settlementsLoading } = useQuery<Settlement[]>({
    queryKey: [`/api/events/${id}/settlements`],
    enabled: !!event && !!expenses && expenses.length > 0,
  });
  
  // イベント作成者を含む全参加者リストを作成
  useEffect(() => {
    if (event && attendances) {
      // 1. イベント作成者を追加
      const participants: string[] = [event.creatorName];
      
      // 2. 参加者を追加
      attendances.forEach(attendance => {
        if (!participants.includes(attendance.name)) {
          participants.push(attendance.name);
        }
      });
      
      // 3. 支払いをした人も追加
      if (expenses) {
        expenses.forEach(expense => {
          if (!participants.includes(expense.payerName)) {
            participants.push(expense.payerName);
          }
        });
      }
      
      setUniqueParticipants(participants);
    }
  }, [event, attendances, expenses]);
  
  const addExpenseMutation = useMutation({
    mutationFn: async (data: typeof newExpense) => {
      const response = await apiRequest('POST', `/api/events/${id}/expenses`, {
        ...data,
        amount: parseFloat(data.amount)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/expenses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/settlements`] });
      setNewExpense({ payerName: '', description: '', amount: '', participants: [] });
      setIsSelectingParticipants(false);
      setIsAddingNewPayer(false);
      toast({
        title: "支払いを記録しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "支払いの記録に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await apiRequest('DELETE', `/api/events/${id}/expenses/${expenseId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/expenses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/settlements`] });
      toast({
        title: "支払いを削除しました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "支払いの削除に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newExpense.payerName || !newExpense.description || !newExpense.amount) {
      toast({
        title: "入力エラー",
        description: "支払者、項目、金額をすべて入力してください",
        variant: "destructive"
      });
      return;
    }
    
    if (isNaN(parseFloat(newExpense.amount)) || parseFloat(newExpense.amount) <= 0) {
      toast({
        title: "金額エラー",
        description: "有効な金額を入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // participants が空の場合、全参加者を割り勘対象とする
    const expenseToSubmit = { ...newExpense };
    if (!expenseToSubmit.participants || expenseToSubmit.participants.length === 0) {
      expenseToSubmit.participants = [...uniqueParticipants];
    }
    
    addExpenseMutation.mutate(expenseToSubmit);
  };
  
  const isLoading = eventLoading || expensesLoading || settlementsLoading;
  
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
  
  if (!event.selectedDate) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">{event.title}</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>日程が確定していません</CardTitle>
            <CardDescription>
              精算機能は日程確定後に利用可能です
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <p className="text-slate-600 mb-4">
                イベントの日程が確定されると、費用の精算機能が利用できるようになります。
              </p>
              <Button onClick={() => navigate(`/event/${id}`)}>
                イベントに戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Calculate totals
  const totalExpenses = expenses?.reduce((sum, expense) => {
    // amount が string または number の場合があるので数値に変換
    const expenseAmount = typeof expense.amount === 'string' 
      ? parseFloat(expense.amount) 
      : Number(expense.amount);
    return sum + expenseAmount;
  }, 0) || 0;
  
  // イベントの全参加者数（イベント作成者+参加者）
  const participantCount = uniqueParticipants.length;
  
  // 一人当たりの金額
  const perPersonAmount = participantCount > 0 ? totalExpenses / participantCount : 0;
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        {event.title} - 費用精算
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">記録された支払額</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-slate-500 mt-1">すべての支払いの合計金額</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">参加人数</CardTitle>
              {isAddingNewPayer ? (
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsAddingNewPayer(false)}
                >
                  キャンセル
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingNewPayer(true)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  新規追加
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isAddingNewPayer ? (
              <div className="space-y-3">
                <Input
                  value={newExpense.payerName}
                  onChange={(e) => setNewExpense({...newExpense, payerName: e.target.value})}
                  placeholder="新しい参加者の名前"
                  className="w-full"
                />
                <Button 
                  type="button" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    if (newExpense.payerName.trim()) {
                      // 既存の参加者と重複していないか確認
                      if (!uniqueParticipants.includes(newExpense.payerName.trim())) {
                        const newParticipantName = newExpense.payerName.trim();
                        // 新しい参加者を追加
                        setUniqueParticipants([...uniqueParticipants, newParticipantName]);
                        // 入力フィールドをクリア
                        setNewExpense({...newExpense, payerName: ''});
                        // 新規追加モードを終了
                        setIsAddingNewPayer(false);
                        // 通知
                        toast({
                          title: "参加者を追加しました",
                          description: `${newParticipantName}さんが参加者リストに追加されました`,
                        });
                      } else {
                        toast({
                          title: "参加者が重複しています",
                          description: "この名前の参加者は既に登録されています",
                          variant: "destructive"
                        });
                      }
                    } else {
                      toast({
                        title: "名前を入力してください",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  追加する
                </Button>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold">{participantCount}人</p>
                <p className="text-xs text-slate-500 mt-1">このイベントの全参加メンバー</p>
                {participantCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {uniqueParticipants.map(name => (
                      <span key={name} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">支払い記録</CardTitle>
            <CardDescription>
              支払いを記録して精算計算を行います
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payerName">支払者</Label>
                
                <Select
                  value={newExpense.payerName}
                  onValueChange={(value) => setNewExpense({...newExpense, payerName: value})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="支払者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueParticipants.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">項目</Label>
                <Input
                  id="description"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  placeholder="例: 会議室予約"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount">金額</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">¥</span>
                  <Input
                    id="amount"
                    className="pl-8"
                    value={newExpense.amount}
                    onChange={(e) => {
                      // 数字以外を削除し、整数値のみ許可
                      const numericValue = e.target.value.replace(/[^0-9]/g, '');
                      setNewExpense({...newExpense, amount: numericValue});
                    }}
                    placeholder="10000"
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>割り勘対象者</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setIsSelectingParticipants(!isSelectingParticipants)}
                    className="h-7 text-xs"
                  >
                    {isSelectingParticipants ? '完了' : '対象者を選択'}
                  </Button>
                </div>
                
                {isSelectingParticipants ? (
                  <div className="border rounded-md p-3 space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="select-all" 
                        checked={selectAllParticipants}
                        onCheckedChange={(checked) => {
                          setSelectAllParticipants(!!checked);
                          if (checked) {
                            // 全員選択
                            setNewExpense({...newExpense, participants: [...uniqueParticipants]});
                          } else {
                            // 全員選択解除
                            setNewExpense({...newExpense, participants: []});
                          }
                        }}
                      />
                      <label 
                        htmlFor="select-all" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        全員を選択
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {uniqueParticipants.map((name) => (
                        <div key={name} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`participant-${name}`} 
                            checked={newExpense.participants.includes(name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // 参加者を追加
                                setNewExpense({
                                  ...newExpense, 
                                  participants: [...newExpense.participants, name]
                                });
                              } else {
                                // 参加者を削除
                                setNewExpense({
                                  ...newExpense, 
                                  participants: newExpense.participants.filter(p => p !== name)
                                });
                                setSelectAllParticipants(false);
                              }
                            }}
                          />
                          <label 
                            htmlFor={`participant-${name}`} 
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-md p-3">
                    {newExpense.participants.length > 0 ? (
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-primary/70" />
                        <p className="text-sm">
                          {newExpense.participants.length}人が選択されています
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">全員で割り勘します</p>
                    )}
                  </div>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={addExpenseMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {addExpenseMutation.isPending ? '追加中...' : '支払いを追加'}
              </Button>
            </form>
            
            {expenses && expenses.length > 0 ? (
              <div className="space-y-2 mt-4">
                <h3 className="font-medium text-sm text-slate-700">記録された支払い</h3>
                <div className="space-y-2">
                  {expenses.map((expense) => {
                    // amount を数値に変換
                    const expenseAmount = typeof expense.amount === 'string' 
                      ? parseFloat(expense.amount) 
                      : Number(expense.amount);
                      
                    return (
                      <div 
                        key={expense.id} 
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div>
                          <p className="font-medium">{expense.payerName}</p>
                          <p className="text-sm text-slate-500">{expense.description}</p>
                          {expense.participants && expense.participants.length > 0 && (
                            <div className="flex items-center mt-1">
                              <Users className="h-3 w-3 mr-1 text-slate-400" />
                              <p className="text-xs text-slate-400">
                                {expense.participants.length}人で分割
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(expenseAmount)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteExpenseMutation.mutate(expense.id)}
                            disabled={deleteExpenseMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center p-4 text-slate-500">
                <p>まだ支払いが記録されていません</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">精算レコメンド</CardTitle>
            <CardDescription>
              最も効率的な精算方法を表示します
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settlements && settlements.length > 0 ? (
              <div className="space-y-4">
                <div className="p-3 rounded-md border-l-4 border-blue-500 bg-blue-50">
                  <p className="text-sm text-blue-700 font-medium">
                    この精算方法で、すべての支払いが最小限の取引で相殺されます。
                  </p>
                </div>
                
                {settlements.map((settlement, index) => (
                  <div 
                    key={index} 
                    className="p-4 rounded-md border border-green-200 bg-green-50 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{settlement.from}</div>
                      <div className="flex items-center">
                        <ArrowRight className="h-5 w-5 text-green-600 mx-2" />
                      </div>
                      <div className="font-medium">{settlement.to}</div>
                    </div>
                    <div className="mt-2 text-center">
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(settlement.amount)}
                      </span>
                      <span className="ml-1 text-green-700">支払う</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : expenses && expenses.length > 1 ? (
              <div className="text-center p-6">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 mb-4">
                  <p className="text-amber-700">
                    参加者間の貸し借りがすべて相殺されているため、精算は不要です。
                  </p>
                </div>
              </div>
            ) : expenses && expenses.length === 1 ? (
              <div className="text-center p-6">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 mb-4">
                  <p className="text-amber-700">
                    複数の支払いが記録されると、精算方法が表示されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-slate-500">
                <Calculator className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p>支払いを記録すると、精算方法が表示されます</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/event/${id}`)}
            >
              イベントに戻る
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
