'use client'

import { CalendarDate } from '@internationalized/date'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getWeekDays, isSameDay } from './utils/dates'
import { cn } from '@/lib/utils'

const DAY_ABBR = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']

type Props = {
  currentDate: CalendarDate
  today: CalendarDate
  onSelectDay: (day: CalendarDate) => void
  onPrevWeek: () => void
  onNextWeek: () => void
}

export default function MobileDayStrip({ currentDate, today, onSelectDay, onPrevWeek, onNextWeek }: Props) {
  const days = getWeekDays(currentDate)

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPrevWeek}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Poprzedni tydzień"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex flex-1 justify-between gap-1 overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden">
        {days.map((day, i) => {
          const isSelected = isSameDay(day, currentDate)
          const isToday    = isSameDay(day, today)

          return (
            <button
              key={i}
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex min-w-[44px] flex-col items-center justify-center rounded-xl px-2 py-2 transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                  ? 'border border-primary text-primary'
                  : 'bg-muted/40 text-foreground hover:bg-muted'
              )}
            >
              <span className="text-[11px] font-medium leading-none">{DAY_ABBR[i]}</span>
              <span className="mt-1 text-base font-bold leading-none">{day.day}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNextWeek}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Następny tydzień"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
