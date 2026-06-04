'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CalendarDate } from '@internationalized/date'
import { CalendarView } from './types'
import { getWeekDays } from './utils/dates'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  view: CalendarView
  currentDate: CalendarDate
  onViewChange: (view: CalendarView) => void
  onNavigate: (dir: 'prev' | 'next' | 'today') => void
}

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Miesiąc' },
  { value: 'week',  label: 'Tydzień' },
  { value: 'day',   label: 'Dzień' },
]

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatLabel(view: CalendarView, date: CalendarDate): string {
  const jsDate = new Date(date.year, date.month - 1, date.day)

  if (view === 'month') {
    return capitalize(
      new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(jsDate)
    )
  }

  if (view === 'week') {
    const days = getWeekDays(date)
    const startJs = new Date(days[0].year, days[0].month - 1, days[0].day)
    const endJs   = new Date(days[6].year, days[6].month - 1, days[6].day)
    const start = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(startJs)
    const end   = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }).format(endJs)
    return `${start} – ${end}`
  }

  return capitalize(
    new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(jsDate)
  )
}

export default function CalendarNav({ view, currentDate, onViewChange, onNavigate }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Period pill: [<] label [>] + Today */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3 rounded-full border border-border bg-muted/40 px-4 py-1.5">
          <button
            onClick={() => onNavigate('prev')}
            aria-label="Poprzedni"
            className="text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[120px] text-center text-xs font-semibold uppercase tracking-widest">
            {formatLabel(view, currentDate)}
          </span>
          <button
            onClick={() => onNavigate('next')}
            aria-label="Następny"
            className="text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={() => onNavigate('today')}>
          Dziś
        </Button>
      </div>

      {/* View switcher */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => onViewChange(v.value)}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              view === v.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-muted'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
