import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  CalendarRange, 
  Users, 
  Home as HomeIcon, 
  PlusCircle, 
  CalendarClock, 
  Menu, 
  X
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  
  const toggleMenu = () => setMenuOpen(!menuOpen);
  
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation Bar - Mobile Friendly */}
      <header className="bg-white shadow-sm border-b border-slate-200 py-3 px-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/">
          <h1 className="text-lg font-bold text-primary flex items-center cursor-pointer hover:opacity-80 transition-opacity">
            <CalendarRange className="mr-2 h-5 w-5" />
            調整ワリカン
          </h1>
        </Link>
        
        <button 
          onClick={toggleMenu}
          className="md:hidden p-1 rounded-full hover:bg-slate-100"
          aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        
        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center space-x-4">
          <NavLink href="/" icon={<HomeIcon size={18} />} label="ホーム" isActive={location === '/'} />
          <NavLink href="/create" icon={<PlusCircle size={18} />} label="イベント作成" isActive={location === '/create'} />
        </div>
      </header>
      
      {/* Mobile Navigation Drawer */}
      <div className={`
        fixed inset-0 bg-black bg-opacity-50 z-20 transition-opacity duration-200 
        md:hidden
        ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `} onClick={toggleMenu}>
        <div 
          className={`
            absolute top-0 right-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-200
            ${menuOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4">
            <div className="space-y-2">
              <MobileNavLink href="/" icon={<HomeIcon className="h-5 w-5" />} label="ホーム" isActive={location === '/'} onClick={toggleMenu} />
              <MobileNavLink href="/create" icon={<CalendarClock className="h-5 w-5" />} label="イベントを作成" isActive={location === '/create'} onClick={toggleMenu} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-5xl mx-auto w-full pb-16">
        {children}
      </main>
      
      {/* Bottom Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 z-10">
        <NavButton href="/" icon={<HomeIcon size={20} />} label="ホーム" isActive={location === '/'} />
        <NavButton href="/create" icon={<PlusCircle size={20} />} label="作成" isActive={location === '/create'} />
      </nav>
    </div>
  );
}

// Desktop Navigation Link
const NavLink = ({ href, icon, label, isActive }: { href: string, icon: React.ReactNode, label: string, isActive: boolean }) => (
  <Link href={href} className={`
      cursor-pointer px-3 py-1.5 rounded-md flex items-center text-sm font-medium
      ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'}
    `}
  >
    <span className="mr-1.5">{icon}</span>
    {label}
  </Link>
);

// Mobile Navigation Link for Side Drawer
const MobileNavLink = ({ href, icon, label, isActive, onClick }: { href: string, icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => (
  <Link href={href}
    className={`
      flex items-center px-3 py-2.5 rounded-md text-sm cursor-pointer
      ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'}
    `}
    onClick={onClick}
  >
    <span className="mr-3">{icon}</span>
    <span>{label}</span>
  </Link>
);

// Bottom Navigation Button for Mobile
const NavButton = ({ href, icon, label, isActive }: { href: string, icon: React.ReactNode, label: string, isActive: boolean }) => (
  <Link href={href}
    className="flex flex-col items-center justify-center w-1/2 cursor-pointer"
  >
    <div className={`p-1 rounded-full ${isActive ? 'text-primary' : 'text-slate-600'}`}>
      {icon}
    </div>
    <span className={`text-xs mt-1 ${isActive ? 'text-primary font-medium' : 'text-slate-600'}`}>
      {label}
    </span>
  </Link>
);
