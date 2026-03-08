'use client';
import { ThemeToggle } from '@/components/theme-toggle';
import { Bell } from 'lucide-react';

interface TopHeaderProps {
  user: {
    email:    string;
    role:     string;
    tenantId: string | null;
  };
}

export default function TopHeader({ user }: TopHeaderProps) {
  const firstName = user.email.split('@')[0];

  return (
    <header className="h-[100px] bg-white dark:bg-[#0a0a0c] flex items-end justify-between px-8 pb-6 flex-shrink-0 z-10 transition-colors border-b border-slate-100 dark:border-slate-800/50">
      <div className="flex flex-col animate-in fade-in duration-500">
        <h2 className="text-[26px] font-medium text-slate-900 dark:text-white tracking-tight leading-none mb-1.5">
          Hey, {firstName}
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <Bell size={18} className="text-slate-500 dark:text-slate-400" />
        </button>
      </div>
    </header>
  );
}
