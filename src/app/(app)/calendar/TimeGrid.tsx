'use client'

import { useState, useEffect } from 'react'
import { CalendarDate } from '@internationalized/date'
import type { CalendarEvent } from './types'
import { getTimeSlots, toJsDate, fromJsDate, isSameDay } from './utils/dates'
import { positionEvents } from './utils/eventPositioning'
import { useLongPress } from './utils/useLongPress'
import { cn } from '@/lib/utils'

export const SLOT_HEIGHT = 48
const START_HOUR = 6

export type TimeGridProps = {
  days: CalendarDate[]
  events: CalendarEvent[]
  today: CalendarDate
  onSlotClick: (datetime: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Design pattern from Vanguard: dark card bg with subtle colour tint + vivid left accent bar
// + matching vivid time text. Name stays in foreground colour for legibility in both themes.
const EVENT_COLORS = [
  { accent: 'border-l-lobster-pink-500', time: 'text-lobster-pink-500 dark:text-lobster-pink-400' },
  { accent: 'border-l-jungle-teal-500',  time: 'text-jungle-teal-600  dark:text-jungle-teal-400'  },
  { accent: 'border-l-tiger-orange-500', time: 'text-tiger-orange-600 dark:text-tiger-orange-400' },
  { accent: 'border-l-soft-linen-500',   time: 'text-soft-linen-600  dark:text-soft-linen-400'   },
] as const

function clientColorScheme(clientId: string) {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) {
    hash = (hash * 31 + clientId.charCodeAt(i)) | 0
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]
}

function CurrentTimeIndicator({ days, today }: { days: CalendarDate[]; today: CalendarDate }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const todayColIdx = days.findIndex(d => isSameDay(d, today))
  if (todayColIdx === -1) return null

  const totalMins = now.getHours() * 60 + now.getMinutes()
  if (totalMins < START_HOUR * 60 || totalMins > 22 * 60) return null

  const top      = ((totalMins - START_HOUR * 60) / 30) * SLOT_HEIGHT
  const leftPct  = (todayColIdx / days.length) * 100
  const widthPct = (1 / days.length) * 100
  const timeLabel = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div
      className="pointer-events-none absolute z-20 flex items-center"
      style={{ top, left: `${leftPct}%`, width: `${widthPct}%` }}
    >
      <div className="size-2 shrink-0 rounded-full bg-primary" />
      <div className="h-px flex-1 bg-primary shadow-[0_0_6px_rgba(210,45,61,0.4)]" />
      <span className="rounded-sm bg-primary px-1 text-[10px] font-bold text-primary-foreground">
        {timeLabel}
      </span>
    </div>
  )
}

// Each slot is its own component so the useLongPress hook can be called at the top level.
function SlotButton({
  slot,
  slotIdx,
  onTrigger,
}: {
  slot: string
  slotIdx: number
  onTrigger: () => void
}) {
  const { handlers, longPressing } = useLongPress(onTrigger)

  return (
    <button
      aria-label={slot}
      {...handlers}
      className={cn(
        'block w-full p-0 border-b transition-colors',
        slotIdx % 2 === 0 ? 'border-border/30' : 'border-border',
        longPressing ? 'bg-primary/20' : 'hover:bg-muted/50',
      )}
      style={{ height: SLOT_HEIGHT }}
    />
  )
}

// Pure content — no scroll container. WeekView/DayView own the scroll + sticky headers.
export default function TimeGrid({ days, events, today, onSlotClick, onEventClick }: TimeGridProps) {
  const slots = getTimeSlots()

  return (
    <div className="flex">
      {/* Time labels — absolutely positioned using the same pixel math as events
          so labels never drift from grid lines regardless of button UA defaults */}
      <div
        className="relative w-10 shrink-0 border-r border-border"
        style={{ height: slots.length * SLOT_HEIGHT }}
      >
        {slots.map((slot, i) => {
          if (i % 2 !== 0) return null
          return (
            <span
              key={slot}
              className="absolute right-2 select-none text-[11px] leading-none text-muted-foreground"
              style={{ top: i === 0 ? 2 : i * SLOT_HEIGHT - 11 }}
            >
              {slot}
            </span>
          )
        })}
      </div>

      {/* Day columns */}
      <div className="relative flex flex-1">
        <CurrentTimeIndicator days={days} today={today} />

        {days.map((day, dayIdx) => {
          const isToday    = isSameDay(day, today) && days.length > 1
          const dayEvents  = events.filter(e => isSameDay(fromJsDate(e.startsAt), day))
          const positioned = positionEvents(dayEvents)

          return (
            <div
              key={dayIdx}
              className={cn('relative flex-1 border-r border-border last:border-r-0', isToday && 'bg-primary/5')}
            >
              {slots.map((slot, slotIdx) => {
                const [h, m] = slot.split(':').map(Number)
                return (
                  <SlotButton
                    key={slot}
                    slot={slot}
                    slotIdx={slotIdx}
                    onTrigger={() => onSlotClick(toJsDate(day, h, m))}
                  />
                )
              })}

              {positioned.map(event => {
                const startMins    = event.startsAt.getHours() * 60 + event.startsAt.getMinutes()
                const endMins      = event.endsAt.getHours()   * 60 + event.endsAt.getMinutes()
                const offsetMins   = startMins - START_HOUR * 60
                const durationMins = endMins - startMins

                const top    = Math.max(0, (offsetMins / 30) * SLOT_HEIGHT)
                const height = Math.max(SLOT_HEIGHT, (durationMins / 30) * SLOT_HEIGHT)
                const left   = `${(event.column / event.totalColumns) * 100}%`
                const width  = `${(1 / event.totalColumns) * 100}%`
                const colors = clientColorScheme(event.clientId)
                const subtitle = event.notes || event.packageName
                const isCancelledOrNoShow = event.status === 'cancelled' || event.status === 'no_show'
                const isCompleted = event.status === 'completed'

                return (
                  <button
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick(event) }}
                    className={cn(
                      'absolute z-10 overflow-hidden rounded-sm border border-border border-l-2 p-2 text-left transition-colors',
                      isCompleted
                        ? 'bg-green-100 hover:bg-green-200 dark:bg-green-950 dark:hover:bg-green-900 border-l-green-500'
                        : cn('bg-card hover:bg-event-hover', colors.accent),
                      event.status === 'cancelled' && 'opacity-40',
                      event.status === 'no_show'   && 'opacity-50',
                    )}
                    style={{ top, height, left, width }}
                  >
                    <p className={cn(
                      'truncate text-[10px] leading-none font-semibold mb-1',
                      isCompleted ? 'text-green-700 dark:text-green-400' : colors.time
                    )}>
                      {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
                    </p>
                    <p className={cn(
                      'truncate text-xs font-semibold leading-tight text-foreground',
                      event.status === 'cancelled' && 'line-through'
                    )}>
                      {event.clientName}
                    </p>
                    {subtitle && height > SLOT_HEIGHT && (
                      <p className="mt-0.5 truncate text-[10px] leading-none text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                    {event.scheduledSessions !== null && height > SLOT_HEIGHT * 1.5 && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="inline-block rounded-full bg-jungle-teal-500 px-1.5 text-[10px] font-semibold text-white">
                          {event.scheduledSessions} zajęte
                        </span>
                        {event.remainingSessions !== null && (
                          <span className={cn(
                            'inline-block rounded-full px-1.5 text-[10px] font-semibold text-white',
                            event.remainingSessions <= 2 ? 'bg-destructive' : 'bg-primary'
                          )}>
                            {event.remainingSessions} dostępne
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
