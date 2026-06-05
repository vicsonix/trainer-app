'use client'

import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithApprovalResponses, DefaultChatTransport } from 'ai'
import { ArrowUp, Users, CalendarDays, BarChart3, UserPlus, Plus, PanelRight, MessageSquare, Bot } from 'lucide-react'
import { MessageBubble } from '@/components/chat/MessageBubble'

const SUGGESTIONS = [
  { icon: Users, iconBg: 'bg-jungle-teal-100 dark:bg-jungle-teal-900/40', iconColor: 'text-jungle-teal-600 dark:text-jungle-teal-400', label: 'Lista klientów', prompt: 'Pokaż listę moich klientów' },
  { icon: CalendarDays, iconBg: 'bg-tiger-orange-100 dark:bg-tiger-orange-900/40', iconColor: 'text-tiger-orange-600 dark:text-tiger-orange-400', label: 'Wizyty w tym tygodniu', prompt: 'Jakie mam wizyty w tym tygodniu?' },
  { icon: BarChart3, iconBg: 'bg-lobster-pink-100 dark:bg-lobster-pink-900/40', iconColor: 'text-lobster-pink-600 dark:text-lobster-pink-400', label: 'Statystyki miesiąca', prompt: 'Pokaż statystyki z tego miesiąca' },
  { icon: UserPlus, iconBg: 'bg-soft-linen-200 dark:bg-carbon-black-800', iconColor: 'text-carbon-black-600 dark:text-carbon-black-300', label: 'Dodaj klienta', prompt: 'Chcę dodać nowego klienta' },
]

export default function AssistantPage() {
  const [input, setInput] = useState('')
  const [threadsOpen, setThreadsOpen] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  })

  const isLoading = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const send = (text?: string) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || isLoading) return
    sendMessage({ text: trimmed })
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex overflow-hidden h-[calc(100dvh-7.5rem)] md:h-screen">

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 md:border-r border-soft-linen-200 dark:border-carbon-black-800">

        {/* Chat header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-soft-linen-200 dark:border-carbon-black-800 shrink-0 bg-white/50 dark:bg-carbon-black-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-sm">
              <Bot size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold">Asystent</span>
          </div>
          <button
            onClick={() => setThreadsOpen((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
            aria-label="Pokaż / ukryj wątki"
          >
            <PanelRight size={16} />
          </button>
        </div>

        {/* Messages / welcome */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full px-6 gap-8">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-lg shadow-lobster-pink-200/60 dark:shadow-lobster-pink-950/60">
                  <Bot size={26} className="text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-lobster-pink-100 dark:bg-lobster-pink-900/50 px-3 py-1 text-xs font-semibold text-lobster-pink-600 dark:text-lobster-pink-300 mb-3">
                    <span className="size-1.5 rounded-full bg-lobster-pink-500 animate-pulse" />
                    AI Asystent
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent mb-2">Witaj, trenerze!</h1>
                  <p className="text-muted-foreground text-base max-w-sm">
                    Zadaj pytanie lub wybierz sugestię — asystent zajmie się resztą.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                {SUGGESTIONS.map(({ icon: Icon, iconBg, iconColor, label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => send(prompt)}
                    className="group flex items-center gap-3 rounded-xl bg-card ring-1 ring-foreground/10 px-4 py-3.5 text-left transition-all duration-200 hover:ring-lobster-pink-400 hover:shadow-md hover:shadow-lobster-pink-100/60 dark:hover:shadow-lobster-pink-950/60"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                      <Icon size={17} className={iconColor} />
                    </div>
                    <span className="text-sm font-medium flex-1">{label}</span>
                    <Plus size={14} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl w-full px-5 py-8 space-y-6">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onApprove={addToolApprovalResponse}
                  onDeny={addToolApprovalResponse}
                />
              ))}
              {isLoading && (
                <div data-testid="typing-indicator" className="flex items-center gap-1.5 py-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-soft-linen-200 dark:border-carbon-black-800 bg-white/50 dark:bg-carbon-black-900/50 backdrop-blur-sm px-5 pb-4 pt-3">
          <div className="mx-auto max-w-3xl w-full">
            <div className="relative w-full rounded-2xl border border-soft-linen-300 dark:border-carbon-black-700 bg-white/80 dark:bg-carbon-black-900/80 focus-within:border-lobster-pink-400 dark:focus-within:border-lobster-pink-500 transition-colors shadow-sm">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); resizeTextarea() }}
                onKeyDown={handleKeyDown}
                placeholder="Wpisz wiadomość…"
                disabled={isLoading}
                className="w-full resize-none bg-transparent text-sm px-4 pt-4 pb-14 outline-none placeholder:text-muted-foreground leading-relaxed min-h-[56px] max-h-[200px] disabled:opacity-50"
              />
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || isLoading}
                  aria-label="Wyślij"
                  className="w-9 h-9 rounded-xl bg-lobster-pink-500 hover:bg-lobster-pink-600 disabled:bg-soft-linen-200 dark:disabled:bg-carbon-black-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <ArrowUp size={16} className="text-white" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Enter — wyślij · Shift+Enter — nowa linia
            </p>
          </div>
        </div>
      </div>

      {/* ── Threads sidebar ── */}
      {threadsOpen && (
        <div className="hidden md:flex w-64 flex-col shrink-0 border-l border-soft-linen-200 dark:border-carbon-black-800 bg-white/30 dark:bg-carbon-black-900/30 backdrop-blur-sm">

          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-soft-linen-200 dark:border-carbon-black-800 shrink-0">
            <span className="text-sm font-semibold">Wątki</span>
            <button
              onClick={() => send()}
              aria-label="Nowy wątek"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Thread list — empty until Phase 6 */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-soft-linen-100 dark:bg-carbon-black-800 flex items-center justify-center">
                <MessageSquare size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5">Brak wątków</p>
                <p className="text-[11px] text-muted-foreground">Historia rozmów pojawi się tutaj.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
