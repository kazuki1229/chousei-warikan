import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  CalendarRange, 
  Users, 
  Home as HomeIcon, 
  PlusCircle, 
  CalendarClock, 
  Calculator 
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar Navigation */}
      <nav className="bg-white shadow-md md:w-64 md:min-h-screen flex-shrink-0 border-r border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-primary flex items-center">
            <CalendarRange className="mr-2 h-5 w-5" />
            イベント調整さん
          </h1>
        </div>
        
        <div className="p-4">
          <Link href="/create">
            <a className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg flex items-center justify-center mb-6">
              <PlusCircle className="mr-1 h-4 w-4" />
              新しい予定を作成
            </a>
          </Link>
          
          <div className="space-y-1">
            <Link href="/">
              <a className={`flex items-center px-3 py-2 rounded-md ${location === '/' ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'}`}>
                <HomeIcon className="mr-3 h-4 w-4" />
                <span>ホーム</span>
              </a>
            </Link>
            <Link href="/create">
              <a className={`flex items-center px-3 py-2 rounded-md ${location === '/create' ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'}`}>
                <CalendarClock className="mr-3 h-4 w-4" />
                <span>予定を作成</span>
              </a>
            </Link>
            <Link href="/">
              <a className="flex items-center px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100">
                <Users className="mr-3 h-4 w-4" />
                <span>参加予定一覧</span>
              </a>
            </Link>
            <Link href="/">
              <a className="flex items-center px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100">
                <Calculator className="mr-3 h-4 w-4" />
                <span>精算履歴</span>
              </a>
            </Link>
          </div>
        </div>
      </nav>
      
      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
