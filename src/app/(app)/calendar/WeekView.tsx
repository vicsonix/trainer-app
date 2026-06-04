'use client'

import { CalendarDate } from '@internationalized/date'
import type { CalendarEvent } from './types'
import { getWeekDays, isSameDay } from './utils/dates'
import TimeGrid from './TimeGrid'
import { cn } from '@/lib/utils'

const WEEKDAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']
const WEEKEND_COLS  = new Set([5, 6])

type Props = {
  week: CalendarDate
  events: CalendarEvent[]
  today: CalendarDate
  onSlotClick: (datetime: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

export default function WeekView({ week, events, today, onSlotClick, onEventClick }: Props) {
  const days = getWeekDays(week)

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div
        className="overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        style={{ height: 'calc(100vh - 260px)', minHeight: '400px' }}
      >
        {/* Sticky day-header row — inside the scroll so scrollbar width is shared */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-card">
          <div className="w-14 shrink-0 border-r border-border flex items-center justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              GMT+2
            </span>
          </div>
          {days.map((day, i) => {
            const isToday   = isSameDay(day, today)
            const isWeekend = WEEKEND_COLS.has(i)
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 border-r border-border last:border-r-0 py-3 text-center',
                  isToday && 'bg-primary/5',
                  isWeekend && !isToday && 'bg-muted/20'
                )}
              >
                <div className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider',
                  isToday ? 'text-primary' : isWeekend ? 'text-muted-foreground/40' : 'text-muted-foreground'
                )}>
                  {WEEKDAY_NAMES[i]}
                </div>
                <div className={cn(
                  'mx-auto mt-1 text-xl font-bold leading-none',
                  isToday ? 'text-primary' : isWeekend ? 'text-muted-foreground/50' : 'text-foreground'
                )}>
                  {day.day}
                </div>
              </div>
            )
          })}
        </div>

        <TimeGrid
          days={days}
          events={events}
          today={today}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
        />
      </div>
    </div>
  )
}
