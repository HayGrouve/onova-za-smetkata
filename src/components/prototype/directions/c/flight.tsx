/**
 * PROTOTYPE Direction C: "the avatar flies onto the line". A fixed overlay
 * animates a seat avatar from its source (brush in the rail, or the guest's
 * slip) to the receipt line it just claimed. Skipped under reduced motion.
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useProto } from '../mock/store.tsx'
import { SeatAvatar, seatIndex } from './ui.tsx'

interface Flight {
  id: number
  seatId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
}

type FlyFn = (seatId: string, groupKey: string) => void

const FlightContext = createContext<FlyFn>(() => {})

export function useFly(): FlyFn {
  return useContext(FlightContext)
}

function visible(selector: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return (
    all.find((el) => {
      const r = el.getBoundingClientRect()
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.top < window.innerHeight
      )
    }) ?? null
  )
}

let seq = 0

export function FlightLayer({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const { derived } = useProto()
  const [flights, setFlights] = useState<Flight[]>([])

  const fly = useCallback<FlyFn>(
    (seatId, groupKey) => {
      if (reduce) return
      const src = visible(`[data-seat-src="${seatId}"]`)
      const dst = visible(`[data-line="${CSS.escape(groupKey)}"] [data-slots]`)
      if (!src || !dst) return
      const a = src.getBoundingClientRect()
      const b = dst.getBoundingClientRect()
      seq += 1
      const flight: Flight = {
        id: seq,
        seatId,
        from: { x: a.left + a.width / 2 - 16, y: a.top + a.height / 2 - 16 },
        to: { x: b.right - 18, y: b.top + b.height / 2 - 16 },
      }
      setFlights((f) => [...f, flight])
    },
    [reduce],
  )

  const value = useMemo(() => fly, [fly])

  return (
    <FlightContext.Provider value={value}>
      {children}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
        <AnimatePresence>
          {flights.map((f) => {
            const seat = derived.seats.find((s) => s.participantId === f.seatId)
            if (!seat) return null
            return (
              <motion.span
                key={f.id}
                className="absolute left-0 top-0"
                initial={{ x: f.from.x, y: f.from.y, scale: 1.1, opacity: 1 }}
                animate={{
                  x: f.to.x,
                  y: [f.from.y, Math.min(f.from.y, f.to.y) - 60, f.to.y],
                  scale: [1.1, 1.25, 0.7],
                }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.55, ease: [0.3, 0.7, 0.4, 1] }}
                onAnimationComplete={() =>
                  setFlights((all) => all.filter((x) => x.id !== f.id))
                }
              >
                <SeatAvatar
                  seat={seat}
                  index={seatIndex(derived.seats, seat.participantId)}
                  className="shadow-[0_8px_18px_-6px_var(--c-shadow)]"
                />
              </motion.span>
            )
          })}
        </AnimatePresence>
      </div>
    </FlightContext.Provider>
  )
}
