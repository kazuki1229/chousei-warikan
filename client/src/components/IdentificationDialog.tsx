import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface IdentificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onIdentify: (name: string) => void;
}

export default function IdentificationDialog({ 
  isOpen, 
  onClose, 
  eventId, 
  onIdentify 
}: IdentificationDialogProps) {
  const [name, setName] = useState('');
  const [attendances, setAttendances] = useState<{id: string, name: string}[]>([]);
  const { toast } = useToast();
  
  // イベントの参加者リストを取得
  const { data: attendanceList } = useQuery<any[]>({
    queryKey: [`/api/events/${eventId}/attendances`],
    enabled: isOpen && !!eventId
  });
  
  // 参加者リストが更新されたら状態を更新
  useEffect(() => {
    if (attendanceList) {
      setAttendances(attendanceList.map(item => ({ 
        id: item.id, 
        name: item.name 
      })));
    }
  }, [attendanceList]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast({
        title: "入力エラー",
        description: "お名前を入力してください",
        variant: "destructive"
      });
      return;
    }
    
    onIdentify(name);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800">参加者確認</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {attendances.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-700">登録済み参加者から選択</Label>
              <div className="flex flex-wrap gap-2">
                {attendances.map((attendance) => (
                  <Button 
                    key={attendance.id} 
                    type="button"
                    variant="outline"
                    className="hover:bg-primary/10"
                    onClick={() => {
                      setName(attendance.name);
                      // すぐに送信
                      onIdentify(attendance.name);
                      onClose();
                    }}
                  >
                    {attendance.name}
                  </Button>
                ))}
              </div>
              <div className="flex items-center my-3">
                <div className="flex-grow border-t border-slate-200"></div>
                <div className="px-2 text-slate-500 text-sm">または新しい名前で参加</div>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-slate-700">お名前</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 田中 健太"
              className="w-full"
              required
            />
          </div>
          
          <div className="pt-2 flex justify-end">
            <Button type="submit" className="px-4 py-2">
              確認
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
