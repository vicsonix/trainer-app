'use client'

import Link from 'next/link'
import { CheckCircle, XCircle, AlertTriangle, Zap, ExternalLink } from 'lucide-react'
import { TOOL_CONFIRMATION_LABELS, DESTRUCTIVE_TOOLS } from '@/lib/ai/tool-formatters'

type ToolOutput = {
  success: boolean
  action?: 'created' | 'updated' | 'deleted'
  entity?: 'client' | 'package' | 'appointment'
  name?: string
  href?: string
  error?: string
} | null

const ENTITY_LABELS: Record<string, Record<string, string>> = {
  client:      { created: 'Klient dodany',        updated: 'Klient zaktualizowany',     deleted: 'Klient usunięty' },
  package:     { created: 'Pakiet dodany',         updated: 'Pakiet zaktualizowany',     deleted: 'Pakiet usunięty' },
  appointment: { created: 'Wizyta zarezerwowana',  updated: 'Wizyta zaktualizowana',     deleted: 'Wizyta usunięta' },
}

const HREF_LABELS: Record<string, string> = {
  '/clients':  'Klienci',
  '/packages': 'Pakiety',
  '/calendar': 'Kalendarz',
}

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
    const output = (part.output ?? null) as ToolOutput
    const action = output?.action
    const entity = output?.entity
    const label = (entity && action && ENTITY_LABELS[entity]?.[action]) ?? 'Wykonano pomyślnie'
    const hrefLabel = output?.href ? HREF_LABELS[output.href] : undefined

    return (
      <div className="flex items-center gap-2 rounded-xl border border-jungle-teal-200 dark:border-jungle-teal-800/60 bg-jungle-teal-50 dark:bg-jungle-teal-900/15 px-3 py-2">
        <CheckCircle size={13} className="text-jungle-teal-600 dark:text-jungle-teal-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-jungle-teal-700 dark:text-jungle-teal-300 truncate">
            {label}{output?.name ? `: ${output.name}` : ''}
          </p>
        </div>
        {output?.href && action !== 'deleted' && hrefLabel && (
          <Link
            href={output.href}
            className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-jungle-teal-600 dark:text-jungle-teal-400 hover:underline"
          >
            {hrefLabel}
            <ExternalLink size={10} />
          </Link>
        )}
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
