import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface IdentificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onIdentify: (name: string, email: string) => void;
}

export default function IdentificationDialog({ 
  isOpen, 
  onClose, 
  eventId, 
  onIdentify 
}: IdentificationDialogProps) {
  const [name, setName] = useState('');
  const { toast } = useToast();

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
    
    // メールアドレスの代わりに空文字列を渡す
    onIdentify(name, '');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800">参加者確認</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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
