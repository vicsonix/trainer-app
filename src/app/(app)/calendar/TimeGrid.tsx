'use client'

import { useState, useEffect } from 'react'
import { CalendarDate } from '@internationalized/date'
import type { CalendarEvent } from './types'
import { getTimeSlots, toJsDate, fromJsDate, isSameDay } from './utils/dates'
import { positionEvents } from './utils/eventPositioning'
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
  { hover: 'hover:bg-lobster-pink-500/10', accent: 'border-l-lobster-pink-500', time: 'text-lobster-pink-500 dark:text-lobster-pink-400' },
  { hover: 'hover:bg-jungle-teal-500/10',  accent: 'border-l-jungle-teal-500',  time: 'text-jungle-teal-600  dark:text-jungle-teal-400'  },
  { hover: 'hover:bg-tiger-orange-500/10', accent: 'border-l-tiger-orange-500', time: 'text-tiger-orange-600 dark:text-tiger-orange-400' },
  { hover: 'hover:bg-soft-linen-500/10',   accent: 'border-l-soft-linen-500',   time: 'text-soft-linen-600  dark:text-soft-linen-400'   },
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

// Pure content — no scroll container. WeekView/DayView own the scroll + sticky headers.
export default function TimeGrid({ days, events, today, onSlotClick, onEventClick }: TimeGridProps) {
  const slots = getTimeSlots()

  return (
    <div className="flex pt-3">
      {/* Time labels */}
      <div className="w-14 shrink-0 border-r border-border">
        {slots.map((slot, i) => (
          <div key={slot} className="relative" style={{ height: SLOT_HEIGHT }}>
            {i % 2 === 0 && (
              <span className="absolute right-2 -top-2 select-none text-[11px] leading-none text-muted-foreground">
                {slot}
              </span>
            )}
          </div>
        ))}
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
                  <button
                    key={slot}
                    onClick={() => onSlotClick(toJsDate(day, h, m))}
                    className={cn(
                      'w-full border-b transition-colors hover:bg-muted/50',
                      slotIdx % 2 === 0 ? 'border-border' : 'border-border/30'
                    )}
                    style={{ height: SLOT_HEIGHT }}
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
                      'absolute z-10 overflow-hidden rounded-sm border-l-2 bg-background p-2 text-left transition-colors',
                      isCompleted
                        ? 'bg-green-500/15 hover:bg-green-500/25 border-l-green-500'
                        : cn(colors.hover, colors.accent),
                      event.status === 'cancelled' && 'opacity-40',
                      event.status === 'no_show'   && 'opacity-50',
                    )}
                    style={{ top, height, left, width }}
                  >
                    <p className={cn(
                      'truncate text-[10px] leading-none font-semibold mb-1',
                      isCompleted ? 'text-green-600 dark:text-green-400' : colors.time
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
                    {event.remainingSessions !== null && event.remainingSessions <= 2 && height > SLOT_HEIGHT * 1.5 && (
                      <span className={cn('mt-1 inline-block rounded-full px-1.5 text-[10px] font-semibold', colors.time)}>
                        {event.remainingSessions} wizyt
                      </span>
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
