import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

const THRESHOLD_MS  = 500
const MOVE_CANCEL_PX = 8

export type LongPressHandlers = {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp:   (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerLeave:(e: React.PointerEvent) => void
  onPointerCancel:(e: React.PointerEvent) => void
  onClick:       (e: React.MouseEvent)   => void
}

/**
 * On touch/coarse-pointer devices: fires `onLongPress` after a sustained hold
 * without significant finger movement. Short taps and scroll gestures are ignored.
 * On mouse/fine-pointer devices: fires `onLongPress` on the regular click.
 */
export function useLongPress(onLongPress: () => void): {
  handlers: LongPressHandlers
  longPressing: boolean
} {
  const isTouch  = useRef(false)
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired    = useRef(false)
  const origin   = useRef({ x: 0, y: 0 })
  const [longPressing, setLongPressing] = useState(false)

  useEffect(() => {
    isTouch.current = window.matchMedia('(pointer: coarse)').matches
  }, [])

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setLongPressing(false)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTouch.current) return
    fired.current = false
    origin.current = { x: e.clientX, y: e.clientY }
    setLongPressing(true)
    timer.current = setTimeout(() => {
      fired.current = true
      setLongPressing(false)
      onLongPress()
    }, THRESHOLD_MS)
  }, [onLongPress])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isTouch.current || !timer.current) return
    const dx = Math.abs(e.clientX - origin.current.x)
    const dy = Math.abs(e.clientY - origin.current.y)
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) cancel()
  }, [cancel])

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    cancel()
  }, [cancel])

  const onClick = useCallback((e: React.MouseEvent) => {
    if (isTouch.current) {
      // Suppress any synthetic click that follows a long press
      if (fired.current) e.stopPropagation()
      return
    }
    // Desktop: fire immediately on click
    onLongPress()
  }, [onLongPress])

  return {
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerMove,
      onPointerLeave: cancel as unknown as (e: React.PointerEvent) => void,
      onPointerCancel: cancel as unknown as (e: React.PointerEvent) => void,
      onClick,
    },
    longPressing,
  }
}
