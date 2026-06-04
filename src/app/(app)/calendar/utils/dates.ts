import { CalendarDate, startOfWeek } from '@internationalized/date'

const LOCALE = 'pl-PL'

export function getMonthGrid(month: CalendarDate): CalendarDate[][] {
  const firstOfMonth = new CalendarDate(month.year, month.month, 1)
  const gridStart = startOfWeek(firstOfMonth, LOCALE)

  const grid: CalendarDate[][] = []
  let current = gridStart

  for (let row = 0; row < 6; row++) {
    const week: CalendarDate[] = []
    for (let col = 0; col < 7; col++) {
      week.push(current)
      current = current.add({ days: 1 })
    }
    grid.push(week)
  }

  return grid
}

export function getWeekDays(date: CalendarDate): CalendarDate[] {
  const start = startOfWeek(date, LOCALE)
  return Array.from({ length: 7 }, (_, i) => start.add({ days: i }))
}

export function toJsDate(d: CalendarDate, hours = 0, minutes = 0): Date {
  return new Date(d.year, d.month - 1, d.day, hours, minutes)
}

export function fromJsDate(d: Date): CalendarDate {
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

export function getTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 6; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 22) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

export function addDays(d: CalendarDate, n: number): CalendarDate {
  return d.add({ days: n })
}
