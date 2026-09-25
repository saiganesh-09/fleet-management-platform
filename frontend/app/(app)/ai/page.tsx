'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, Sparkles, Bot, User as UserIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Which vehicles are currently available?',
  'Which vehicles have the highest maintenance cost?',
  "Show vehicles that haven't been used for 30 days",
  'Which vehicles have poor fuel efficiency?',
  'Which documents will expire next month?',
  'Which drivers completed the most trips?',
];

interface Msg { role: 'user' | 'assistant'; text: string; tool?: string | null }

export default function AiPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Hi! I\'m the FleetOps AI assistant. Ask me about your fleet — vehicles, drivers, trips, maintenance, fuel efficiency or documents.',
    },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (q: string) => aiApi.ask(q),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: 'assistant', text: res.data.answer, tool: res.data.toolUsed }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
    onError: (e) => {
      setMessages((m) => [...m, { role: 'assistant', text: `⚠ ${e.message} — is the AI service running?` }]);
    },
  });

  const submit = (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || ask.isPending) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    ask.mutate(question);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-primary" /> AI Fleet Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Natural-language answers over live fleet data. Uses the LLM when configured, otherwise a deterministic router over the same data APIs.
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-3', m.role === 'user' && 'justify-end')}>
                {m.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10"><Bot className="h-4 w-4 text-primary" /></div>
                )}
                <div className={cn(
                  'max-w-[75%] rounded-lg px-4 py-2.5 text-sm',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}>
                  <div className="prose-sm whitespace-pre-wrap [&_ul]:list-disc [&_ul]:pl-4">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                  {m.tool && <p className="mt-1 text-[10px] text-muted-foreground">via {m.tool}</p>}
                </div>
                {m.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary"><UserIcon className="h-4 w-4 text-primary-foreground" /></div>
                )}
              </div>
            ))}
            {ask.isPending && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10"><Bot className="h-4 w-4 text-primary" /></div>
                <div className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t p-3">
            {messages.length <= 2 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => submit(s)} className="rounded-full border px-3 py-1 text-xs hover:bg-accent">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); submit(); }}
            >
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your fleet…" />
              <Button type="submit" disabled={ask.isPending || !input.trim()}><Send /></Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
