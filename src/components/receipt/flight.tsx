import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { SeatAvatar, useSeatLookup } from '#/components/receipt/seats.tsx'

/**
 * "The avatar flies onto the line." A fixed overlay animates a seat avatar
 * from its source (`data-seat-src`, the brush in the rail or the guest's slip)
 * to the receipt line it just claimed (`data-line`). Skipped under reduced
 * motion.
 */
type FlyFn = (seatId: string, lineKey: string) => void

const FlightContext = createContext<FlyFn>(() => {})

export function useFly(): FlyFn {
  return useContext(FlightContext)
}

interface Flight {
  id: number
  seatId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
}

function firstVisible(selector: string): HTMLElement | null {
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

let flightSeq = 0

export function FlightLayer({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const seatOf = useSeatLookup()
  const [flights, setFlights] = useState<Flight[]>([])

  const fly = useCallback<FlyFn>(
    (seatId, lineKey) => {
      if (reduce) return
      const src = firstVisible(`[data-seat-src="${CSS.escape(seatId)}"]`)
      const dst = firstVisible(
        `[data-line="${CSS.escape(lineKey)}"] [data-slots]`,
      )
      if (!src || !dst) return
      const a = src.getBoundingClientRect()
      const b = dst.getBoundingClientRect()
      flightSeq += 1
      setFlights((all) => [
        ...all,
        {
          id: flightSeq,
          seatId,
          from: { x: a.left + a.width / 2 - 16, y: a.top + a.height / 2 - 16 },
          to: { x: b.right - 18, y: b.top + b.height / 2 - 16 },
        },
      ])
    },
    [reduce],
  )

  return (
    <FlightContext.Provider value={fly}>
      {children}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
        <AnimatePresence>
          {flights.map((flight) => {
            const seat = seatOf(flight.seatId)
            if (!seat) return null
            return (
              <motion.span
                key={flight.id}
                className="absolute top-0 left-0"
                initial={{
                  x: flight.from.x,
                  y: flight.from.y,
                  scale: 1.1,
                  opacity: 1,
                }}
                animate={{
                  x: flight.to.x,
                  y: [
                    flight.from.y,
                    Math.min(flight.from.y, flight.to.y) - 60,
                    flight.to.y,
                  ],
                  scale: [1.1, 1.25, 0.7],
                }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.55, ease: [0.3, 0.7, 0.4, 1] }}
                onAnimationComplete={() =>
                  setFlights((all) => all.filter((f) => f.id !== flight.id))
                }
              >
                <SeatAvatar
                  seat={seat}
                  className="shadow-[0_8px_18px_-6px_var(--paper-shadow)]"
                />
              </motion.span>
            )
          })}
        </AnimatePresence>
      </div>
    </FlightContext.Provider>
  )
}
