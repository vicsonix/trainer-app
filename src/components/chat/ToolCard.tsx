'use client'

import { CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react'
import { TOOL_CONFIRMATION_LABELS, DESTRUCTIVE_TOOLS } from '@/lib/ai/tool-formatters'

type ApprovalPart = {
  type: string
  toolCallId: string
  state: 'approval-requested' | 'approval-responded' | 'output-available' | 'output-denied' | 'input-streaming' | 'input-available'
  input?: Record<string, unknown>
  output?: unknown
  errorText?: string
  approval?: { id: string; approved?: boolean }
}

export function ToolCard({
  part,
  onApprove,
  onDeny,
}: {
  part: ApprovalPart
  onApprove: (id: string) => void
  onDeny: (id: string) => void
}) {
  const toolName = part.type.replace(/^tool-/, '')
  const labelFn = TOOL_CONFIRMATION_LABELS[toolName]
  const isDestructive = DESTRUCTIVE_TOOLS.has(toolName)
  const label = labelFn ? labelFn((part.input ?? {}) as Record<string, unknown>) : toolName

  if (part.state === 'approval-requested' && part.approval) {
    return (
      <div
        className={`rounded-xl border p-3.5 space-y-3 shadow-sm ${
          isDestructive
            ? 'border-destructive/40 bg-destructive/5'
            : 'border-tiger-orange-300 bg-tiger-orange-50 dark:border-tiger-orange-800/60 dark:bg-tiger-orange-900/15'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            isDestructive
              ? 'bg-destructive/15'
              : 'bg-tiger-orange-100 dark:bg-tiger-orange-900/40'
          }`}>
            <AlertTriangle
              size={14}
              className={isDestructive ? 'text-destructive' : 'text-tiger-orange-600 dark:text-tiger-orange-400'}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Potwierdzenie</p>
            <p className="text-sm font-semibold leading-snug">{label}</p>
          </div>
        </div>
        <div className="flex gap-2 pl-9">
          <button
            onClick={() => onDeny(part.approval!.id)}
            className="flex-1 rounded-lg border border-soft-linen-300 dark:border-carbon-black-600 px-3 py-1.5 text-xs font-medium text-carbon-black-600 dark:text-carbon-black-300 hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={() => onApprove(part.approval!.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
              isDestructive
                ? 'bg-destructive hover:bg-destructive/90'
                : 'bg-lobster-pink-500 hover:bg-lobster-pink-600'
            }`}
          >
            Zatwierdź
          </button>
        </div>
      </div>
    )
  }

  if (part.state === 'output-available') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-jungle-teal-200 dark:border-jungle-teal-800/60 bg-jungle-teal-50 dark:bg-jungle-teal-900/15 px-3 py-2">
        <CheckCircle size={13} className="text-jungle-teal-600 dark:text-jungle-teal-400 shrink-0" />
        <p className="text-xs font-medium text-jungle-teal-700 dark:text-jungle-teal-300">Wykonano pomyślnie</p>
      </div>
    )
  }

  if (part.state === 'output-denied') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-soft-linen-300 dark:border-carbon-black-700 bg-soft-linen-50 dark:bg-carbon-black-900/50 px-3 py-2">
        <XCircle size={13} className="text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">Akcja anulowana</p>
      </div>
    )
  }

  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-soft-linen-200 dark:border-carbon-black-700 px-3 py-2">
        <Zap size={13} className="text-lobster-pink-400 shrink-0" />
        <p className="text-xs text-muted-foreground">Przetwarzanie…</p>
      </div>
    )
  }

  return null
}
