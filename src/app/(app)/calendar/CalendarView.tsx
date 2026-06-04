'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date'
import type { CalendarView, CalendarEvent } from './types'
import { getWeekDays, fromJsDate, isSameDay } from './utils/dates'
import CalendarNav from './CalendarNav'
import MobileDayStrip from './MobileDayStrip'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'

type Props = {
  events: CalendarEvent[]
  onSlotClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

export default function CalendarView({ events, onSlotClick, onEventClick }: Props) {
  const [view, setView]         = useState<CalendarView>('week')
  const [isMobile, setIsMobile] = useState(false)
  const [currentDate, setCurrentDate] = useState<CalendarDate>(() => today(getLocalTimeZone()))
  const todayDate = today(getLocalTimeZone())

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = (matches: boolean) => {
      setIsMobile(matches)
      // 'week' view is not available on mobile — fall back to 'day'
      if (matches) setView(prev => prev === 'week' ? 'day' : prev)
    }
    const handler = (e: MediaQueryListEvent) => sync(e.matches)
    mq.addEventListener('change', handler)
    sync(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function navigate(dir: 'prev' | 'next' | 'today') {
    if (dir === 'today') { setCurrentDate(today(getLocalTimeZone())); return }
    const delta = dir === 'next' ? 1 : -1
    setCurrentDate(prev => {
      if (view === 'month') {
        let m = prev.month + delta
        let y = prev.year
        if (m > 12) { m = 1; y++ }
        if (m < 1)  { m = 12; y-- }
        return new CalendarDate(y, m, 1)
      }
      if (view === 'week') return prev.add({ weeks: delta })
      return prev.add({ days: delta })
    })
  }

  const visibleEvents = (() => {
    if (view === 'month') {
      return events.filter(e => {
        const d = fromJsDate(e.startsAt)
        return d.year === currentDate.year && d.month === currentDate.month
      })
    }
    if (view === 'week') {
      const days = getWeekDays(currentDate)
      return events.filter(e => {
        const d = fromJsDate(e.startsAt)
        return d.compare(days[0]) >= 0 && d.compare(days[6]) <= 0
      })
    }
    return events.filter(e => isSameDay(fromJsDate(e.startsAt), currentDate))
  })()

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    const dayEvents = events.filter(e => isSameDay(fromJsDate(e.startsAt), currentDate))
    const monthEvents = events.filter(e => {
      const d = fromJsDate(e.startsAt)
      return d.year === currentDate.year && d.month === currentDate.month
    })
    // Short month label fits alongside the tab group on one line
    const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'short', year: 'numeric' }).format(
      new Date(currentDate.year, currentDate.month - 1, currentDate.day)
    )

    const MOBILE_VIEWS: { value: CalendarView; label: string }[] = [
      { value: 'month', label: 'Miesiąc' },
      { value: 'day',   label: 'Dzień' },
    ]

    return (
      <div className="flex flex-col gap-2">
        {/* Single header row: month nav on left, [Dziś|Miesiąc|Dzień] tabs on right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentDate(prev => prev.add({ months: -1 }))}
              aria-label="Poprzedni miesiąc"
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[72px] text-center text-xs font-semibold capitalize">
              {monthLabel}
            </span>
            <button
              onClick={() => setCurrentDate(prev => prev.add({ months: 1 }))}
              aria-label="Następny miesiąc"
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex rounded-lg border border-border overflow-hidden">
            {/* Dziś is an action, not a view — sits alongside the view tabs */}
            <button
              onClick={() => setCurrentDate(today(getLocalTimeZone()))}
              className="border-r border-border px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-muted"
            >
              Dziś
            </button>
            {MOBILE_VIEWS.map(v => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  view === v.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground hover:bg-muted'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Month view — compact dots, tap day → switches to day view */}
        {view === 'month' && (
          <MonthView
            month={currentDate}
            events={monthEvents}
            today={todayDate}
            onSlotClick={date => { setCurrentDate(date); setView('day') }}
            onEventClick={onEventClick}
            isMobile
          />
        )}

        {/* Day view: 3-day strip + height-constrained time grid */}
        {view === 'day' && (
          <>
            <MobileDayStrip
              currentDate={currentDate}
              today={todayDate}
              onSelectDay={setCurrentDate}
              onPrevDay={() => setCurrentDate(prev => prev.add({ days: -1 }))}
              onNextDay={() => setCurrentDate(prev => prev.add({ days: 1 }))}
            />
            <DayView
              day={currentDate}
              events={dayEvents}
              today={todayDate}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
              hideHeader
              scrollHeight="calc(100dvh - 310px)"
            />
          </>
        )}
      </div>
    )
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <CalendarNav
        view={view}
        currentDate={currentDate}
        onViewChange={setView}
        onNavigate={navigate}
      />

      {view === 'month' && (
        <MonthView
          month={currentDate}
          events={visibleEvents}
          today={todayDate}
          onSlotClick={date => onSlotClick(new Date(date.year, date.month - 1, date.day))}
          onEventClick={onEventClick}
        />
      )}
      {view === 'week' && (
        <WeekView
          week={currentDate}
          events={visibleEvents}
          today={todayDate}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
        />
      )}
      {view === 'day' && (
        <DayView
          day={currentDate}
          events={visibleEvents}
          today={todayDate}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
        />
      )}
    </div>
  )
}
