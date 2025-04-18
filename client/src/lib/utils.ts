import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { ja } from 'date-fns/locale';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy年MM月dd日(EEE)', { locale: ja });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', { 
    style: 'currency', 
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(amount);
}
