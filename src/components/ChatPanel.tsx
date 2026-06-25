'use client'

import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithApprovalResponses, DefaultChatTransport, type UIMessage } from 'ai'
import Link from 'next/link'
import { X, Maximize2, ArrowUp, Users, CalendarDays, BarChart3, UserPlus, Bot, SquarePen, History, ChevronLeft } from 'lucide-react'
import { MessageBubble } from './chat/MessageBubble'
import {
  createConversationAction,
  saveMessageAction,
  loadConversationAction,
  listConversationsAction,
  renameConversationAction,
} from '@/app/actions/conversations'

type ConversationMeta = { id: string; title: string; updated_at: string }

const SUGGESTIONS = [
  { icon: Users, iconBg: 'bg-jungle-teal-100 dark:bg-jungle-teal-900/40', iconColor: 'text-jungle-teal-600 dark:text-jungle-teal-400', label: 'Lista klientów', prompt: 'Pokaż listę moich klientów' },
  { icon: CalendarDays, iconBg: 'bg-tiger-orange-100 dark:bg-tiger-orange-900/40', iconColor: 'text-tiger-orange-600 dark:text-tiger-orange-400', label: 'Wizyty w tym tygodniu', prompt: 'Jakie mam wizyty w tym tygodniu?' },
  { icon: BarChart3, iconBg: 'bg-lobster-pink-100 dark:bg-lobster-pink-900/40', iconColor: 'text-lobster-pink-600 dark:text-lobster-pink-400', label: 'Statystyki miesiąca', prompt: 'Pokaż statystyki z tego miesiąca' },
  { icon: UserPlus, iconBg: 'bg-soft-linen-200 dark:bg-carbon-black-800', iconColor: 'text-carbon-black-600 dark:text-carbon-black-300', label: 'Dodaj klienta', prompt: 'Chcę dodać nowego klienta' },
]

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Dzisiaj'
  if (days === 1) return 'Wczoraj'
  if (days < 7) return `${days} dni temu`
  return new Date(dateStr).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })
}

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState('')
  const [showThreads, setShowThreads] = useState(false)
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const conversationIdRef = useRef<string | null>(null)
  const savedMessageIdsRef = useRef<Set<string>>(new Set())
  const hasLoadedRef = useRef(false)
  const titleUpdatedRef = useRef(false)

  const { messages, sendMessage, status, addToolApprovalResponse, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: async ({ messages: allMessages }: { messages: UIMessage[] }) => {
      try {
        const convId = conversationIdRef.current
        if (!convId) return
        for (const msg of allMessages) {
          if (!savedMessageIdsRef.current.has(msg.id)) {
            await saveMessageAction(convId, msg)
            savedMessageIdsRef.current.add(msg.id)
          }
        }
      } catch {
        // non-blocking
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  // Load conversation list + most recent messages when panel first opens
  useEffect(() => {
    if (!open || hasLoadedRef.current) return
    hasLoadedRef.current = true

    listConversationsAction().then(async (convs) => {
      setConversations(convs)
      setLoadingConversations(false)
      if (convs.length > 0) {
        const latest = convs[0]
        const loaded = await loadConversationAction(latest.id)
        if (loaded.length > 0) {
          conversationIdRef.current = latest.id
          titleUpdatedRef.current = true
          setActiveConversationId(latest.id)
          loaded.forEach((m) => savedMessageIdsRef.current.add(m.id))
          setMessages(loaded)
        }
      }
      setLoadingMessages(false)
    })
  }, [open, setMessages])

  useEffect(() => {
    if (!showThreads) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, showThreads])

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const startNewConversation = async () => {
    const result = await createConversationAction('Nowa rozmowa')
    if ('error' in result) return
    conversationIdRef.current = result.id
    savedMessageIdsRef.current = new Set()
    titleUpdatedRef.current = false
    setActiveConversationId(result.id)
    setConversations((prev) => [
      { id: result.id, title: 'Nowa rozmowa', updated_at: new Date().toISOString() },
      ...prev,
    ])
    setMessages([])
    setShowThreads(false)
  }

  const loadConversation = async (conv: ConversationMeta) => {
    const loaded = await loadConversationAction(conv.id)
    conversationIdRef.current = conv.id
    savedMessageIdsRef.current = new Set(loaded.map((m) => m.id))
    titleUpdatedRef.current = true
    setActiveConversationId(conv.id)
    setMessages(loaded)
    setShowThreads(false)
  }

  const send = async (text?: string) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || isLoading) return

    if (!conversationIdRef.current) {
      const newTitle = trimmed.slice(0, 60)
      const result = await createConversationAction(newTitle)
      if ('error' in result) return
      conversationIdRef.current = result.id
      titleUpdatedRef.current = true
      setActiveConversationId(result.id)
      setConversations((prev) => [
        { id: result.id, title: newTitle, updated_at: new Date().toISOString() },
        ...prev,
      ])
    } else if (!titleUpdatedRef.current) {
      titleUpdatedRef.current = true
      const newTitle = trimmed.slice(0, 60)
      void renameConversationAction(conversationIdRef.current, newTitle)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationIdRef.current
            ? { ...c, title: newTitle, updated_at: new Date().toISOString() }
            : c,
        ),
      )
    }

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

  if (!open) return null

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full md:w-[380px] z-40 flex flex-col bg-white/85 dark:bg-carbon-black-900/90 backdrop-blur-md border-l border-soft-linen-200 dark:border-carbon-black-800 shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-soft-linen-200 dark:border-carbon-black-800 shrink-0">
        <div className="flex items-center gap-2">
          {showThreads ? (
            <button
              onClick={() => setShowThreads(false)}
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Wróć do czatu"
            >
              <ChevronLeft size={16} />
            </button>
          ) : (
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-sm">
              <Bot size={13} className="text-white" />
            </div>
          )}
          <span className="text-sm font-semibold">{showThreads ? 'Wątki' : 'Asystent'}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => void startNewConversation()}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
            aria-label="Nowa rozmowa"
          >
            <SquarePen size={15} />
          </button>
          <button
            onClick={() => setShowThreads((v) => !v)}
            className={`rounded-lg p-2 transition-colors ${showThreads ? 'text-lobster-pink-500' : 'text-muted-foreground hover:text-foreground hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800'}`}
            aria-label="Wątki"
          >
            <History size={15} />
          </button>
          <Link
            href="/assistant"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
            aria-label="Pełny ekran"
          >
            <Maximize2 size={15} />
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
            aria-label="Zamknij"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {showThreads ? (
          // ── Thread list ──
          <div className="px-3 py-3">
            {loadingConversations ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-soft-linen-100 dark:bg-carbon-black-800 animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">Brak wątków</div>
            ) : (
              <ul className="space-y-0.5">
                {conversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      onClick={() => loadConversation(conv)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                        activeConversationId === conv.id
                          ? 'bg-lobster-pink-50 dark:bg-lobster-pink-950/40 ring-1 ring-lobster-pink-200 dark:ring-lobster-pink-800'
                          : 'hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800'
                      }`}
                    >
                      <p className="text-xs font-medium truncate leading-snug">{conv.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatRelativeDate(conv.updated_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : loadingMessages ? (
          // ── Loading skeleton (initial open) ──
          <div className="px-4 py-6 flex flex-col gap-4">
            {[80, 60, 90].map((w, i) => (
              <div key={i} className={`h-8 rounded-xl bg-soft-linen-100 dark:bg-carbon-black-800 animate-pulse`} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : isEmpty ? (
          // ── Welcome / suggestions ──
          <div className="flex flex-col items-center justify-center h-full px-4 gap-6">
            <div className="text-center">
              <p className="text-base font-semibold mb-1">Witaj, trenerze!</p>
              <p className="text-xs text-muted-foreground">Zadaj pytanie lub wybierz sugestię.</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map(({ icon: Icon, iconBg, iconColor, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => send(prompt)}
                  className="flex items-center gap-3 rounded-xl bg-card ring-1 ring-foreground/10 px-3 py-2.5 text-left transition-all duration-200 hover:ring-lobster-pink-400 hover:shadow-md hover:shadow-lobster-pink-100/60 dark:hover:shadow-lobster-pink-950/60"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon size={15} className={iconColor} />
                  </div>
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // ── Messages ──
          <div className="px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onApprove={addToolApprovalResponse}
                onDeny={addToolApprovalResponse}
              />
            ))}
            {isLoading && (
              <div data-testid="typing-indicator" className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input — hidden in threads view */}
      {!showThreads && (
        <div className="shrink-0 px-4 pb-4 pt-3 border-t border-soft-linen-200 dark:border-carbon-black-800">
          <div className="relative rounded-2xl border border-soft-linen-300 dark:border-carbon-black-700 bg-white/80 dark:bg-carbon-black-900/80 focus-within:border-lobster-pink-400 dark:focus-within:border-lobster-pink-500 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => { setInput(e.target.value); resizeTextarea() }}
              onKeyDown={handleKeyDown}
              placeholder="Wpisz wiadomość…"
              disabled={isLoading}
              className="w-full resize-none bg-transparent text-sm px-4 pt-3.5 pb-12 outline-none placeholder:text-muted-foreground leading-relaxed min-h-[52px] max-h-[160px] disabled:opacity-50"
            />
            <div className="absolute bottom-2.5 right-2.5">
              <button
                onClick={() => send()}
                disabled={!input.trim() || isLoading}
                aria-label="Wyślij"
                className="w-8 h-8 rounded-xl bg-lobster-pink-500 hover:bg-lobster-pink-600 disabled:bg-soft-linen-200 dark:disabled:bg-carbon-black-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ArrowUp size={15} className="text-white disabled:text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
