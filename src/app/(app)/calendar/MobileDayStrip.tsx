'use client'

import { CalendarDate } from '@internationalized/date'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, isSameDay } from './utils/dates'
import { cn } from '@/lib/utils'

type Props = {
  currentDate: CalendarDate
  today: CalendarDate
  onSelectDay: (day: CalendarDate) => void
  onPrevDay: () => void
  onNextDay: () => void
}

export default function MobileDayStrip({ currentDate, today, onSelectDay, onPrevDay, onNextDay }: Props) {
  const days = [
    addDays(currentDate, -1),
    currentDate,
    addDays(currentDate, 1),
  ]

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevDay}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Poprzedni dzień"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex flex-1 justify-around gap-2 py-1">
        {days.map((day, i) => {
          const isSelected = isSameDay(day, currentDate)
          const isToday    = isSameDay(day, today)
          const jsDate     = new Date(day.year, day.month - 1, day.day)
          const abbr       = jsDate
            .toLocaleDateString('pl-PL', { weekday: 'short' })
            .replace('.', '')
            .slice(0, 2)
            .toUpperCase()

          return (
            <button
              key={i}
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex min-w-[64px] flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                  ? 'border border-primary text-primary'
                  : 'bg-muted/40 text-foreground hover:bg-muted'
              )}
            >
              <span className="text-[11px] font-medium leading-none">{abbr}</span>
              <span className="mt-1 text-base font-bold leading-none">{day.day}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNextDay}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Następny dzień"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
