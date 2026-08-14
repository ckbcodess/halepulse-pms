'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, ArrowUp, Loader2, RefreshCw } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from '@/components/ui/message-scroller';
import { useAiPanelStore } from '@/lib/ai/panelStore';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Human-friendly label for the current page, injected as context for the model.
function pageLabel(pathname: string): string {
  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/pos': 'Point of Sale',
    '/inventory': 'Stock',
    '/sales': 'Sales',
    '/customers': 'Customers',
    '/purchases': 'Expenses',
    '/reports': 'Reports',
    '/team': 'Team',
    '/settings': 'Settings',
  };
  if (map[pathname]) return map[pathname];
  const hit = Object.keys(map).find((p) => p !== '/' && pathname.startsWith(p));
  return hit ? map[hit] : 'HalePulse';
}

const SUGGESTIONS = [
  'What can you help me with?',
  'Give me tips to reduce medicine expiry losses',
  'How do I record a stock transfer?',
];

let idSeq = 0;
const nextId = () => `m${Date.now()}_${idSeq++}`;

export default function AiCompanionPanel() {
  const open = useAiPanelStore((s) => s.open);
  const setOpen = useAiPanelStore((s) => s.setOpen);
  const pathname = usePathname();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: trimmed };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput('');
      setError(null);
      setSending(true);

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            page: pageLabel(pathname),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        if (data.configured === false) throw new Error('AI is not configured on the server.');
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', content: data.reply || '(no response)' },
        ]);
      } catch (e: any) {
        setError(e.message || 'Failed to reach the assistant');
      } finally {
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 40);
      }
    },
    [messages, sending, pathname],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const reset = () => {
    setMessages([]);
    setError(null);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const empty = messages.length === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-md p-0 gap-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 h-[56px] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles size={16} className="text-primary" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-foreground">AI Companion</span>
              <span className="text-[11px] text-muted-foreground">Ask about HalePulse or anything else</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!empty && (
              <button
                onClick={reset}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                aria-label="New chat"
              >
                <RefreshCw size={13} />
                New
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller className="flex-1 min-h-0">
            <MessageScrollerViewport className="px-4">
              <MessageScrollerContent className="py-4 gap-4">
                {empty ? (
                  <div className="flex flex-col items-center justify-center text-center gap-4 pt-10">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Sparkles size={24} className="text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">How can I help?</p>
                      <p className="text-xs text-muted-foreground max-w-[15rem]">
                        Ask me about using HalePulse, running the pharmacy, or anything else.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 w-full pt-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => void send(s)}
                          className="text-left text-[13px] text-foreground/80 rounded-lg border border-border px-3 py-2 hover:bg-foreground/5 hover:border-primary/40 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <MessageScrollerItem
                      key={m.id}
                      messageId={m.id}
                      scrollAnchor={i === messages.length - 1}
                      className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words',
                          m.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-foreground/[0.05] text-foreground rounded-bl-sm',
                        )}
                      >
                        {m.content}
                      </div>
                    </MessageScrollerItem>
                  ))
                )}

                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-foreground/[0.05] px-3.5 py-2.5">
                      <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Thinking…</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-destructive/10 px-3.5 py-2 text-[13px] text-destructive">
                      {error}
                    </div>
                  </div>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>

            <MessageScrollerButton direction="end" />
          </MessageScroller>
        </MessageScrollerProvider>

        {/* Composer */}
        <form onSubmit={onSubmit} className="border-t border-border p-3 shrink-0">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-foreground/[0.02] px-3 py-2 focus-within:border-primary/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask anything…"
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none max-h-32 leading-relaxed py-1"
              style={{ minHeight: '1.5rem' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              aria-label="Send"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            AI can make mistakes. It cannot see your live pharmacy data yet.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
