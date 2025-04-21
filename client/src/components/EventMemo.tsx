import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Edit, Save, Clock, User, AlertCircle, LockIcon, UnlockIcon, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Attendance } from '../../../shared/schema';

// リンクの検出用正規表現
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// メモ内のURLを自動でリンクに変換する関数
function autoLinkUrls(text: string): React.ReactNode[] {
  // テキストが空の場合は空配列を返す
  if (!text) return [];

  // URLで分割してリンクとテキストの配列を作成
  const parts = text.split(URL_REGEX);
  const matches = text.match(URL_REGEX) || [];
  
  // 結果を格納する配列
  const result: React.ReactNode[] = [];
  
  // 分割した部分とマッチしたURLを交互に配列に追加
  let matchIndex = 0;
  
  parts.forEach((part, index) => {
    // テキスト部分を追加
    if (part) {
      result.push(<span key={`text-${index}`}>{part}</span>);
    }
    
    // その後にURLがあれば追加
    if (matchIndex < matches.length) {
      const url = matches[matchIndex++];
      result.push(
        <a 
          key={`link-${index}`} 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {url}
        </a>
      );
    }
  });
  
  return result;
}

// メモ最終更新情報コンポーネント
function LastEditInfo({ lastEditedBy, lastEditedAt }: { lastEditedBy: string | null | undefined, lastEditedAt: string | null | undefined }) {
  if (!lastEditedBy || !lastEditedAt) return null;
  
  const date = new Date(lastEditedAt);
  const formattedDate = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
  
  return (
    <div className="flex items-center text-sm text-slate-500 gap-1">
      <Clock className="h-3.5 w-3.5" />
      <span>{formattedDate}</span>
      <span className="mx-1">•</span>
      <User className="h-3.5 w-3.5" />
      <span>{lastEditedBy}</span>
    </div>
  );
}

interface EventMemoProps {
  eventId: string;
}

export default function EventMemo({ eventId }: EventMemoProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [memo, setMemo] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockInfo, setLockInfo] = useState<any>(null);
  
  // エディタの自動フォーカス用
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // ユーザー名の初期値を設定
  useEffect(() => {
    // イベント参加時の名前またはRecentEventsから参加者名を取得する
    const storedName = localStorage.getItem('userName');
    const recentEvents = localStorage.getItem('recentEvents');
    
    // イベント出席時に使用した名前があればそれを使用
    if (storedName) {
      console.log("ローカルストレージから名前を取得:", storedName);
      setUserName(storedName);
    } 
    // なければイベント作成者名を使用
    else if (recentEvents) {
      try {
        const events = JSON.parse(recentEvents);
        const event = events.find((e: any) => e.id === eventId);
        if (event && event.participantName) {
          console.log("最近のイベントから名前を取得:", event.participantName);
          setUserName(event.participantName);
        }
      } catch (error) {
        console.error('Failed to parse recent events:', error);
      }
    }
    
    // デフォルト名を設定（上記で名前が設定されていない場合）
    setTimeout(() => {
      if (!userName) {
        console.log("デフォルト名を設定: 匿名");
        setUserName("匿名");
      }
    }, 500);
  }, [eventId]);
  
  // メモデータの型を定義
  interface MemoData {
    memo: string;
    lastEditedBy: string | null;
    lastEditedAt: string | null;
    editLock: {
      lockedBy: string;
      lockedAt: string;
      lockExpiration: string;
    } | null;
  }

  // メモ取得クエリ
  const { 
    data: memoData,
    isLoading,
    refetch: refetchMemo 
  } = useQuery<MemoData>({
    queryKey: [`/api/events/${eventId}/memo`],
    refetchInterval: isEditing ? false : 10000, // 編集中でなければ10秒ごとに更新
  });
  
  // メモ内容の更新
  useEffect(() => {
    if (memoData) {
      if (!isEditing) {
        // 編集中でなければメモを更新
        setMemo(memoData.memo || '');
      }
      
      // ロック情報の更新
      setLockInfo(memoData.editLock);
      setIsLocked(!!memoData.editLock);
    }
  }, [memoData, isEditing]);
  
  // 編集ロック取得ミューテーション
  const acquireLockMutation = useMutation({
    mutationFn: async () => {
      // ユーザー名が空の場合は「匿名」を設定
      const effectiveUserName = userName.trim() || '匿名';
      
      // ユーザー名をローカルストレージに保存
      localStorage.setItem('userName', effectiveUserName);
      setUserName(effectiveUserName);
      
      const response = await apiRequest('POST', `/api/events/${eventId}/memo/lock`, { 
        userName: effectiveUserName
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setIsEditing(true);
        setIsLocked(true);
        // フォーカスを設定
        setTimeout(() => textareaRef.current?.focus(), 100);
        toast({
          title: "編集モードを開始しました",
          description: "変更が完了したら保存ボタンをクリックしてください",
        });
      } else {
        // ロック取得に失敗した場合
        toast({
          title: "編集できません",
          description: data.message || "他のユーザーが編集中です",
          variant: "destructive",
        });
        // 最新のロック情報を反映
        if (data.lockInfo) {
          setLockInfo(data.lockInfo);
        }
        // メモデータを再取得
        refetchMemo();
      }
    },
    onError: (error: any) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "編集権限の取得に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  // 編集ロック解放ミューテーション
  const releaseLockMutation = useMutation({
    mutationFn: async () => {
      // ユーザー名が空の場合は自動的に「匿名」を使用
      const effectiveUserName = userName.trim() || '匿名';
      
      const response = await apiRequest('POST', `/api/events/${eventId}/memo/unlock`, { 
        userName: effectiveUserName
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setIsEditing(false);
        setIsLocked(false);
        // メモデータを再取得
        refetchMemo();
        toast({
          title: "編集モードを終了しました",
        });
      } else {
        toast({
          title: "ロックの解放に失敗しました",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "エラーが発生しました",
        description: error.message || "ロック解放に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  // メモ保存ミューテーション
  const saveMemoMutation = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      // ユーザー名が空の場合は「匿名」を使用
      const effectiveUserName = userName.trim() || '匿名';
      
      const response = await apiRequest('POST', `/api/events/${eventId}/memo`, { 
        memo: memo.trim(), 
        editorName: effectiveUserName
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsSaving(false);
      // 編集モードを終了し、ロックを解放
      releaseLockMutation.mutate();
      // キャッシュを更新
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/memo`] });
      
      toast({
        title: "メモを保存しました",
      });
    },
    onError: (error: any) => {
      setIsSaving(false);
      toast({
        title: "メモの保存に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // 編集開始処理
  const handleStartEditing = () => {
    // ユーザー名が空の場合は匿名とする
    if (!userName) {
      console.log("編集開始時に匿名に設定");
      setUserName("匿名");
      // 少し待ってからロックを取得（名前が更新されるのを待つ）
      setTimeout(() => {
        acquireLockMutation.mutate();
      }, 100);
    } else {
      acquireLockMutation.mutate();
    }
  };
  
  // 編集キャンセル処理
  const handleCancelEditing = () => {
    if (isEditing) {
      // ロックを解放
      releaseLockMutation.mutate();
      // メモの内容を元に戻す
      setMemo(memoData?.memo || '');
    }
  };
  
  // 保存処理
  const handleSave = () => {
    // 名前がなければ匿名を設定
    if (!userName.trim()) {
      setUserName('匿名');
      // 名前を設定してから少し待ってから保存
      setTimeout(() => {
        saveMemoMutation.mutate();
      }, 100);
    } else {
      saveMemoMutation.mutate();
    }
  };
  
  // ロックタイマーの表示用
  const formatLockTimeRemaining = useCallback(() => {
    if (!lockInfo || !lockInfo.lockExpiration) return null;
    
    const expirationTime = new Date(lockInfo.lockExpiration).getTime();
    const now = new Date().getTime();
    const diff = Math.max(0, expirationTime - now);
    
    // 残り分数と秒数を計算
    const minutes = Math.floor(diff / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    
    return `${minutes}分${seconds}秒`;
  }, [lockInfo]);
  
  // 参加者データを取得してユーザー名リストを構築
  const { data: attendances } = useQuery<Attendance[]>({
    queryKey: [`/api/events/${eventId}/attendances`]
  });
  
  // 参加者データが取得できたらユーザー名を設定
  useEffect(() => {
    if (attendances && attendances.length > 0 && !userName) {
      // 最新の出席者名を使用 (まだuserNameが設定されていない場合)
      const firstAttendance = attendances[0];
      console.log("出席者データから名前を取得:", firstAttendance.name);
      setUserName(firstAttendance.name);
    }
  }, [attendances, userName]);
  
  // ロックタイマーの更新
  const [lockTimeRemaining, setLockTimeRemaining] = useState<string | null>(null);
  
  useEffect(() => {
    if (isLocked) {
      const timer = setInterval(() => {
        const timeRemaining = formatLockTimeRemaining();
        setLockTimeRemaining(timeRemaining);
        
        // ロック期限が切れた場合（0秒になった場合）
        if (timeRemaining === '0分0秒') {
          clearInterval(timer);
          // 自分がロックを持っている場合
          if (lockInfo?.lockedBy === userName) {
            setIsEditing(false);
            setIsLocked(false);
            toast({
              title: "編集時間が終了しました",
              description: "変更内容は保存されません",
              variant: "destructive",
            });
          }
          // メモデータを再取得
          refetchMemo();
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [isLocked, lockInfo, formatLockTimeRemaining, userName, refetchMemo]);
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 flex justify-center items-center" style={{ minHeight: '300px' }}>
          <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">イベントメモ</CardTitle>
            <CardDescription>
              参加者間で情報を共有するためのメモです
            </CardDescription>
          </div>
          
          {!isEditing ? (
            <Button
              variant="outline"
              onClick={handleStartEditing}
              disabled={isLocked && lockInfo?.lockedBy !== userName}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              編集する
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleCancelEditing}
                disabled={isSaving}
                className="flex items-center gap-2 text-slate-500"
              >
                <RotateCcw className="h-4 w-4" />
                キャンセル
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                保存
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {isLocked && lockInfo?.lockedBy !== userName && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p>
                <span className="font-medium">{lockInfo?.lockedBy}</span>さんが現在編集中です
                {lockTimeRemaining && <span>（残り時間: {lockTimeRemaining}）</span>}
              </p>
            </div>
          </div>
        )}
        
        {isEditing ? (
          <div className="space-y-4">            
            <div>
              <div className="mb-1">
                <label htmlFor="memo" className="block text-sm font-medium text-gray-700">
                  メモ内容（1000文字以内）
                </label>
              </div>
              <Textarea
                ref={textareaRef}
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="イベントに関するメモを入力してください"
                className="min-h-[200px] w-full"
                maxLength={1000}
              />
              <div className="mt-1 text-right text-xs text-slate-500">
                {memo.length}/1000文字
              </div>
            </div>
            
            {isLocked && lockInfo?.lockedBy === userName && lockTimeRemaining && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <LockIcon className="h-4 w-4" />
                <span>編集時間: 残り {lockTimeRemaining}</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            {memo ? (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 whitespace-pre-wrap break-words min-h-[200px]">
                {autoLinkUrls(memo)}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 min-h-[200px] flex justify-center items-center text-slate-400">
                まだメモはありません
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {!isEditing && (
        <CardFooter className="flex justify-between border-t pt-4">
          <LastEditInfo 
            lastEditedBy={memoData?.lastEditedBy || null} 
            lastEditedAt={memoData?.lastEditedAt || null} 
          />
          
          {isLocked && lockInfo?.lockedBy === userName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => releaseLockMutation.mutate()}
              className="flex items-center gap-1 text-slate-500"
            >
              <UnlockIcon className="h-3.5 w-3.5" />
              編集ロックを解除
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}