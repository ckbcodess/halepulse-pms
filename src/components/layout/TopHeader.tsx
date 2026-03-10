'use client';
import { ThemeToggle } from '@/components/theme-toggle';
import { Bell, Menu } from 'lucide-react';

interface TopHeaderProps {
  user: {
    email:    string;
    role:     string;
    tenantId: string | null;
  };
  onMenuToggle?: () => void;
}

export default function TopHeader({ user, onMenuToggle }: TopHeaderProps) {
  const firstName = user.email.split('@')[0];

  return (
    <header className="h-[72px] lg:h-[100px] bg-white dark:bg-[#0a0a0c] flex items-end justify-between px-4 sm:px-6 lg:px-8 pb-4 lg:pb-6 flex-shrink-0 z-10 transition-colors border-b border-slate-100 dark:border-slate-800/50">
      <div className="flex items-end gap-3">
        {/* Hamburger — visible on mobile only */}
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-1 mb-0.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} className="text-slate-600 dark:text-slate-300" />
        </button>

        <div className="flex flex-col animate-in fade-in duration-500">
          <h2 className="text-xl lg:text-[26px] font-medium text-slate-900 dark:text-white tracking-tight leading-none mb-1 lg:mb-1.5">
            Hey, {firstName}
          </h2>
          <p className="text-xs lg:text-sm font-medium text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 mb-0.5">
        <ThemeToggle />
        <button className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <Bell size={18} className="text-slate-500 dark:text-slate-400" />
        </button>
      </div>
    </header>
  );
}
