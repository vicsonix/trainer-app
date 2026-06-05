'use client'

import type { UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ToolCard } from './ToolCard'

type AddToolApprovalResponse = (opts: { id: string; approved: boolean }) => void

function AssistantMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 last:mb-0 pl-5 space-y-1 list-disc marker:text-muted-foreground">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 last:mb-0 pl-5 space-y-1 list-decimal marker:text-muted-foreground">{children}</ol>,
        li: ({ children }) => <li className="leading-7">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-4 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-3 first:mt-0">{children}</h3>,
        code: ({ children, className }) => {
          const isBlock = !!className
          return isBlock ? (
            <code className="block bg-soft-linen-100 dark:bg-carbon-black-800 rounded-lg px-3.5 py-3 text-xs font-mono my-3 overflow-x-auto whitespace-pre">
              {children}
            </code>
          ) : (
            <code className="bg-soft-linen-100 dark:bg-carbon-black-800 rounded-md px-1.5 py-0.5 text-xs font-mono">
              {children}
            </code>
          )
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-soft-linen-300 dark:border-carbon-black-600 pl-4 text-muted-foreground my-3">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-soft-linen-200 dark:border-carbon-black-700 my-4" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-soft-linen-200 dark:border-carbon-black-700 px-3 py-1.5 text-left font-semibold bg-soft-linen-50 dark:bg-carbon-black-900">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-soft-linen-200 dark:border-carbon-black-700 px-3 py-1.5">
            {children}
          </td>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

export function MessageBubble({
  message,
  onApprove,
  onDeny,
}: {
  message: UIMessage
  onApprove: AddToolApprovalResponse
  onDeny: AddToolApprovalResponse
}) {
  const isUser = message.role === 'user'

  const visibleParts = message.parts.filter((part) => {
    if (part.type === 'text') {
      return (part as { type: 'text'; text: string }).text.trim() !== ''
    }
    return part.type.startsWith('tool-')
  })

  if (visibleParts.length === 0) return null

  if (isUser) {
    const textParts = visibleParts.filter((p) => p.type === 'text')
    const text = textParts
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join(' ')

    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] bg-soft-linen-100 dark:bg-carbon-black-800 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-7 break-words">
          {text}
        </div>
      </div>
    )
  }

  // Assistant message — no bubble, full width
  return (
    <div className="text-sm text-foreground">
      {visibleParts.map((part, i) => {
        if (part.type === 'text') {
          const textPart = part as { type: 'text'; text: string }
          return <AssistantMarkdown key={i} text={textPart.text} />
        }

        if (part.type.startsWith('tool-')) {
          const toolPart = part as unknown as {
            type: string
            toolCallId: string
            state: 'approval-requested' | 'approval-responded' | 'output-available' | 'output-denied' | 'input-streaming' | 'input-available'
            input?: Record<string, unknown>
            output?: unknown
            approval?: { id: string; approved?: boolean }
          }
          return (
            <div key={i} className="my-2">
              <ToolCard
                part={toolPart}
                onApprove={(id) => onApprove({ id, approved: true })}
                onDeny={(id) => onDeny({ id, approved: false })}
              />
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
