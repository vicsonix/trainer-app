'use client'

import { CalendarDate } from '@internationalized/date'
import type { CalendarEvent } from './types'
import { getMonthGrid, fromJsDate, isSameDay } from './utils/dates'
import { cn } from '@/lib/utils'

const WEEKDAY_HEADERS = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'ND']
const WEEKEND_COLS = new Set([5, 6]) // Sob, Nd (0-indexed)

const CHIP_COLORS = [
  'border-l-lobster-pink-500 bg-background hover:bg-lobster-pink-500/10',
  'border-l-jungle-teal-500 bg-background hover:bg-jungle-teal-500/10',
  'border-l-tiger-orange-500 bg-background hover:bg-tiger-orange-500/10',
  'border-l-soft-linen-500 bg-background hover:bg-soft-linen-500/10',
] as const

function chipColorClass(clientId: string): string {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) {
    hash = (hash * 31 + clientId.charCodeAt(i)) | 0
  }
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length]
}

type Props = {
  month: CalendarDate
  events: CalendarEvent[]
  today: CalendarDate
  onSlotClick: (date: CalendarDate) => void
  onEventClick: (event: CalendarEvent) => void
}

export default function MonthView({ month, events, today, onSlotClick, onEventClick }: Props) {
  const grid = getMonthGrid(month)

  return (
    <div className="flex flex-col rounded-lg border border-border">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/20">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={cn(
              'py-2.5 text-center text-[10px] font-semibold tracking-wider',
              WEEKEND_COLS.has(i) ? 'text-muted-foreground/40' : 'text-muted-foreground'
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {grid.flat().map((date, i) => {
          const colIdx = i % 7
          const isCurrentMonth = date.month === month.month
          const isToday        = isSameDay(date, today)
          const isWeekend      = WEEKEND_COLS.has(colIdx)
          const dayEvents      = events.filter(e => isSameDay(fromJsDate(e.startsAt), date))

          return (
            <button
              key={i}
              onClick={() => onSlotClick(date)}
              className={cn(
                'min-h-28 border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-muted/40',
                !isCurrentMonth && 'opacity-40',
                isWeekend && isCurrentMonth && 'bg-muted/20'
              )}
            >
              <span className={cn(
                'inline-flex size-6 items-center justify-center rounded-full text-sm',
                isToday
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : isWeekend
                  ? 'text-muted-foreground'
                  : 'text-foreground'
              )}>
                {date.day}
              </span>

              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick(event) }}
                    className={cn(
                      'flex items-center gap-1 rounded-sm border-l-2 px-1 py-0.5 cursor-pointer transition-colors',
                      event.status === 'completed'
                        ? 'border-l-green-500 bg-green-500/15 hover:bg-green-500/25'
                        : chipColorClass(event.clientId),
                      event.status === 'cancelled' && 'opacity-40',
                      event.status === 'no_show'   && 'opacity-50',
                    )}
                  >
                    <span className={cn(
                      'truncate text-[11px] font-medium text-foreground',
                      event.status === 'cancelled' && 'line-through'
                    )}>
                      {event.clientName}
                    </span>
                    {event.remainingSessions !== null && event.remainingSessions <= 2 && event.status === 'scheduled' && (
                      <span className="ml-auto shrink-0 rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                        {event.remainingSessions}
                      </span>
                    )}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} więcej
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
