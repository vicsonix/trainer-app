import type { CalendarEvent } from '../types'

export type PositionedEvent = CalendarEvent & {
  column: number
  totalColumns: number
}

function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

export function positionEvents(events: CalendarEvent[]): PositionedEvent[] {
  if (events.length === 0) return []

  const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const columnOf = new Map<string, number>()
  const activeColumns: (CalendarEvent | undefined)[] = []

  for (const event of sorted) {
    let col = 0
    while (activeColumns[col] && overlaps(activeColumns[col]!, event)) {
      col++
    }
    activeColumns[col] = event
    columnOf.set(event.id, col)
  }

  return sorted.map(event => {
    const overlappingCols = sorted
      .filter(other => other.id === event.id || overlaps(event, other))
      .map(other => columnOf.get(other.id)!)
    const totalColumns = Math.max(...overlappingCols) + 1
    return { ...event, column: columnOf.get(event.id)!, totalColumns }
  })
}
