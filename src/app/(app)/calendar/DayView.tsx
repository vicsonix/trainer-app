'use client'

import { CalendarDate } from '@internationalized/date'
import type { CalendarEvent } from './types'
import { isSameDay } from './utils/dates'
import TimeGrid from './TimeGrid'
import { cn } from '@/lib/utils'

type Props = {
  day: CalendarDate
  events: CalendarEvent[]
  today: CalendarDate
  onSlotClick: (datetime: Date) => void
  onEventClick: (event: CalendarEvent) => void
  hideHeader?: boolean
  scrollHeight?: string
}

export default function DayView({ day, events, today, onSlotClick, onEventClick, hideHeader = false, scrollHeight }: Props) {
  const isToday  = isSameDay(day, today)
  const jsDate   = new Date(day.year, day.month - 1, day.day)
  const dayLabel = new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(jsDate)

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div
        className="overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        style={{ height: scrollHeight ?? 'calc(100vh - 260px)', minHeight: scrollHeight ? undefined : '400px' }}
      >
        {!hideHeader && (
          <div className="sticky top-0 z-20 flex border-b border-border bg-card">
            <div className="w-10 shrink-0 border-r border-border flex items-center justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                GMT+2
              </span>
            </div>
            <div className={cn('flex-1 py-3 text-center', isToday && 'bg-primary/5')}>
              <div className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                isToday ? 'text-primary' : 'text-muted-foreground'
              )}>
                {dayLabel}
              </div>
              <div className={cn(
                'mt-1 text-xl font-bold leading-none',
                isToday ? 'text-primary' : 'text-foreground'
              )}>
                {day.day}
              </div>
            </div>
          </div>
        )}

        <TimeGrid
          days={[day]}
          events={events}
          today={today}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
        />
      </div>
    </div>
  )
}
