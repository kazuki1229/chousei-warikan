import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
// モバイル最適化のためのUIコンポーネント
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
  // 新規参加者名（入力用）
  const [newParticipantName, setNewParticipantName] = useState('');

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
  
  // 精算情報を取得する際に最新の参加者リストも自動的に更新される
  const { data: settlements, isLoading: settlementsLoading, refetch: refetchSettlements } = useQuery<Settlement[]>({
    queryKey: [`/api/events/${id}/settlements`],
    enabled: !!event && !!expenses && expenses.length > 0,
    refetchInterval: 2000, // 2秒ごとに自動更新 (新しい参加者が追加された場合に最新の計算を取得)
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
      // 選択された参加者が空の場合かつ全員選択が有効な場合は、全員割り勘フラグを暗黙的に設定
      // 今回は空配列を送信することで、サーバー側で「全員割り勘」と認識させる
      const participants = selectAllParticipants ? [] : data.participants;
      
      // APIの実行時にログを出力
      console.log("支出API実行:", {
        ...data,
        participants,
        amount: parseFloat(data.amount),
        isAllParticipants: selectAllParticipants
      });
      
      const response = await apiRequest('POST', `/api/events/${id}/expenses`, {
        ...data,
        participants,
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
    
    // 元の支出データをそのまま利用する（自動的に全員割り勘になるように修正済み）
    addExpenseMutation.mutate(newExpense);
  };
  
  // settlements APIがイベント参加者リストも取得・更新するので、それに対する処理も追加
  useEffect(() => {
    if (settlements && settlements.length > 0) {
      // settlementからユニークな参加者を抽出
      const participantsFromSettlements = new Set<string>();
      
      settlements.forEach(s => {
        if (s.from) participantsFromSettlements.add(s.from);
        if (s.to) participantsFromSettlements.add(s.to);
      });
      
      // 既存の参加者リストと結合
      if (participantsFromSettlements.size > 0) {
        setUniqueParticipants(prev => {
          const allParticipants = Array.from(
            new Set([...prev, ...Array.from(participantsFromSettlements)])
          );
          console.log("精算からの参加者リスト更新:", allParticipants);
          return allParticipants;
        });
      }
    }
  }, [settlements]);
  
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
        
        <div className="mobile-card">
          <div className="card-header-mobile">
            <h3 className="text-lg font-medium">日程が確定していません</h3>
            <p className="text-sm text-slate-500">
              精算機能は日程確定後に利用可能です
            </p>
          </div>
          <div className="card-content-mobile">
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
              <p className="text-slate-600 mb-4">
                イベントの日程が確定されると、費用の精算機能が利用できるようになります。
              </p>
              <Button onClick={() => navigate(`/event/${id}`)}>
                イベントに戻る
              </Button>
            </div>
          </div>
        </div>
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
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/event/${id}`)}
          className="text-slate-500 hover:text-slate-700 px-2 -ml-2"
        >
          ← 戻る
        </Button>
        <h1 className="text-xl font-bold text-slate-800">
          {event.title} <span className="text-slate-500 font-normal">- 費用精算</span>
        </h1>
      </div>
      
      <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0 mb-6">
        {/* 支払総額カード */}
        <div className="mobile-card">
          <div className="card-header-mobile">
            <h3 className="font-medium text-base">記録された支払額</h3>
          </div>
          <div className="card-content-mobile">
            <p className="text-xl font-bold">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-slate-500 mt-1">すべての支払いの合計金額</p>
          </div>
        </div>
        
        {/* 参加者カード */}
        <div className="mobile-card">
          <div className="card-header-mobile">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-base">参加人数</h3>
              {isAddingNewPayer ? (
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs px-2"
                  onClick={() => setIsAddingNewPayer(false)}
                >
                  キャンセル
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2"
                  onClick={() => setIsAddingNewPayer(true)}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  追加
                </Button>
              )}
            </div>
          </div>
          <div className="card-content-mobile">
            {isAddingNewPayer ? (
              <div className="space-y-3">
                <Input
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  placeholder="新しい参加者の名前"
                  className="w-full text-sm"
                  autoFocus
                />
                <Button 
                  type="button" 
                  size="sm" 
                  className="w-full h-8 text-xs"
                  onClick={() => {
                    if (newParticipantName.trim()) {
                      // 既存の参加者と重複していないか確認
                      if (!uniqueParticipants.includes(newParticipantName.trim())) {
                        const trimmedName = newParticipantName.trim();
                        // APIを呼び出して参加者を追加
                        apiRequest('POST', `/api/events/${id}/participants`, {
                          name: trimmedName
                        })
                        .then(response => {
                          if (!response.ok) {
                            // エラー処理
                            return response.json().then(err => {
                              throw new Error(err.message || "参加者の追加に失敗しました");
                            });
                          }
                          return response.json();
                        })
                        .then(data => {
                          // 成功した場合の処理
                          // 新しい参加者をローカルの状態に追加
                          setUniqueParticipants(prev => {
                            // 明示的に新しい配列を作成して状態更新を強制
                            const newParticipants = [...prev, trimmedName];
                            console.log("参加者リスト更新:", newParticipants);
                            return newParticipants;
                          });
                          
                          // 入力フィールドをクリア
                          setNewParticipantName('');
                          // 新規追加モードを終了
                          setIsAddingNewPayer(false);
                          
                          // 精算データと参加者リストを更新
                          queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/expenses`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/attendances`] });
                          
                          // 参加者追加後に数秒待ってから精算情報を再取得（参加者更新を反映させるため）
                          setTimeout(() => {
                            queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/settlements`] });
                            // 明示的に再取得
                            refetchSettlements();
                          }, 500);
                          
                          // 通知
                          toast({
                            title: "参加者を追加しました",
                            description: `${trimmedName}さんが参加者リストに追加されました`,
                          });
                        })
                        .catch(error => {
                          // エラー処理
                          toast({
                            title: "エラーが発生しました",
                            description: error.message,
                            variant: "destructive"
                          });
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
                <p className="text-xl font-bold">{participantCount}人</p>
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
          </div>
        </div>
      </div>
      
      <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
        {/* 支払い記録セクション */}
        <div className="mobile-card form-mobile">
          <div className="card-header-mobile">
            <h3 className="font-medium text-base">支払い記録</h3>
            <p className="text-xs text-slate-500 mt-1">
              支払いを記録して精算計算を行います
            </p>
          </div>
          <div className="card-content-mobile">
            <form onSubmit={handleAddExpense} className="space-y-3">
              {/* 支払者フィールド */}
              <div className="space-y-1.5">
                <Label htmlFor="payerName" className="text-sm">支払者</Label>
                
                <Select
                  value={newExpense.payerName}
                  onValueChange={(value) => setNewExpense({...newExpense, payerName: value})}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
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
              
              {/* 項目フィールド */}
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm">項目</Label>
                <Input
                  id="description"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  placeholder="例: 会議室予約"
                  className="h-9 text-sm"
                  required
                />
              </div>
              
              {/* 金額フィールド */}
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-sm">金額</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">¥</span>
                  <Input
                    id="amount"
                    className="pl-8 h-9 text-sm"
                    value={newExpense.amount}
                    onChange={(e) => {
                      // 数字以外を削除し、整数値のみ許可
                      const numericValue = e.target.value.replace(/[^0-9]/g, '');
                      setNewExpense({...newExpense, amount: numericValue});
                    }}
                    placeholder="   数字を入力"
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>
              
              {/* 割り勘対象者セレクション */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">割り勘対象者</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setIsSelectingParticipants(!isSelectingParticipants)}
                    className="h-6 text-xs px-1.5"
                  >
                    {isSelectingParticipants ? '完了' : '選択'}
                  </Button>
                </div>
                
                {isSelectingParticipants ? (
                  <div className="border rounded-md p-2 space-y-2">
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
                        className="text-xs font-medium leading-none"
                      >
                        全員を選択
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5">
                      {uniqueParticipants.map((name) => (
                        <div key={name} className="flex items-center space-x-1.5">
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
                            className="text-xs leading-none"
                          >
                            {name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-md p-2">
                    {newExpense.participants.length > 0 ? (
                      <div className="flex items-center">
                        <Users className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
                        <p className="text-xs">
                          {newExpense.participants.length}人が選択されています
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">全員で割り勘します</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* 追加ボタン */}
              <Button 
                type="submit" 
                className="w-full h-9 text-sm mt-2" 
                disabled={addExpenseMutation.isPending}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
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
          </div>
        </div>
        
        {/* 精算レコメンドカード */}
        <div className="mobile-card">
          <div className="card-header-mobile">
            <h3 className="font-medium text-base">精算レコメンド</h3>
            <p className="text-xs text-slate-500 mt-1">
              最も効率的な精算方法を表示します
            </p>
          </div>
          <div className="card-content-mobile">
            {settlements && settlements.length > 0 ? (
              <div className="space-y-3">
                <div className="p-2 rounded-md border-l-4 border-blue-500 bg-blue-50">
                  <p className="text-xs text-blue-700">
                    この精算方法で、最小限の取引で相殺されます。
                  </p>
                </div>
                
                {settlements.map((settlement, index) => (
                  <div 
                    key={index} 
                    className="p-3 rounded-md border border-green-200 bg-green-50"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{settlement.from}</div>
                      <div className="flex items-center">
                        <ArrowRight className="h-4 w-4 text-green-600 mx-1" />
                      </div>
                      <div className="font-medium">{settlement.to}</div>
                    </div>
                    <div className="mt-1.5 text-center">
                      <span className="text-base font-bold text-green-700">
                        {formatCurrency(settlement.amount)}
                      </span>
                      <span className="ml-1 text-xs text-green-700">支払う</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : expenses && expenses.length > 1 ? (
              <div className="text-center p-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">
                    参加者間の貸し借りがすべて相殺されているため、精算は不要です。
                  </p>
                </div>
              </div>
            ) : expenses && expenses.length === 1 ? (
              <div className="text-center p-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">
                    複数の支払いが記録されると、精算方法が表示されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 text-slate-500">
                <Calculator className="h-8 w-8 mx-auto mb-3 text-slate-400" />
                <p className="text-sm">支払いを記録すると、精算方法が表示されます</p>
              </div>
            )}
            
            <div className="flex justify-end mt-4">
              <Button 
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => navigate(`/event/${id}`)}
              >
                イベントに戻る
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
