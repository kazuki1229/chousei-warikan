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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  ArrowLeftRight, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Event, Expense, Settlement } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';

export default function ExpenseSplitting() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newExpense, setNewExpense] = useState({
    payerName: '',
    description: '',
    amount: ''
  });
  
  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: [`/api/events/${id}`],
  });
  
  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: [`/api/events/${id}/expenses`],
    enabled: !!event,
  });
  
  const { data: settlements, isLoading: settlementsLoading } = useQuery<Settlement[]>({
    queryKey: [`/api/events/${id}/settlements`],
    enabled: !!event && !!expenses && expenses.length > 0,
  });
  
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
      setNewExpense({ payerName: '', description: '', amount: '' });
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
    
    addExpenseMutation.mutate(newExpense);
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
  const totalExpenses = expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
  const participantCount = expenses?.reduce((participants, expense) => {
    if (!participants.includes(expense.payerName)) {
      participants.push(expense.payerName);
    }
    return participants;
  }, [] as string[]).length || 0;
  
  const perPersonAmount = participantCount > 0 ? totalExpenses / participantCount : 0;
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        {event.title} - 費用精算
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">総支払額</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">参加人数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{participantCount}人</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">一人あたり</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(perPersonAmount)}</p>
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
                <Input
                  id="payerName"
                  value={newExpense.payerName}
                  onChange={(e) => setNewExpense({...newExpense, payerName: e.target.value})}
                  placeholder="例: 田中 健太"
                  required
                />
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
                    onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    placeholder="10000"
                    type="number"
                    min="1"
                    required
                  />
                </div>
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
                  {expenses.map((expense) => (
                    <div 
                      key={expense.id} 
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <p className="font-medium">{expense.payerName}</p>
                        <p className="text-sm text-slate-500">{expense.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(expense.amount)}</span>
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
                  ))}
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
              <div className="space-y-3">
                {settlements.map((settlement, index) => (
                  <div 
                    key={index} 
                    className="p-3 rounded-md border border-green-200 bg-green-50"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm">{settlement.from}</p>
                      <ArrowLeftRight className="h-4 w-4 text-green-600 mx-2" />
                      <p className="text-sm">{settlement.to}</p>
                    </div>
                    <div className="mt-1 font-medium text-right text-green-700">
                      {formatCurrency(settlement.amount)} 支払う
                    </div>
                  </div>
                ))}
              </div>
            ) : expenses && expenses.length > 0 ? (
              <div className="text-center p-6">
                <p className="text-slate-500">
                  複数の参加者による支払いがあると、最適な精算方法が表示されます。
                </p>
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
