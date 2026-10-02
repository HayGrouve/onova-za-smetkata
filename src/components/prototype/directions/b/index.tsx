/**
 * PROTOTYPE - Direction B „Фокус“. One task per screen, one huge number,
 * sentence-style questions; everything else waits in „Детайли“.
 * Screen state lives here so flipping host/guest keeps each side's place.
 */
import { useCallback, useState } from 'react'
import { MotionConfig } from 'motion/react'
import type { DirectionProps } from '../types.ts'
import { BStyles, B_FONT_URL } from './theme.tsx'
import { ScreenSwap } from './ui.tsx'
import { HostHome } from './host-home.tsx'
import { NewBill } from './host-new.tsx'
import { LiveStatus, PersonScreen } from './host-live.tsx'
import { GuestApp } from './guest.tsx'
import type { GuestRoute, HostRoute } from './routes.ts'

export function DirectionB({ view }: DirectionProps) {
  const [host, setHost] = useState<{ route: HostRoute; dir: number }>({
    route: { name: 'home' },
    dir: 1,
  })
  const [guest, setGuest] = useState<{ route: GuestRoute; dir: number }>({
    route: 'claim',
    dir: 1,
  })
  const [paidFor, setPaidFor] = useState<string[]>([])

  const go = useCallback((route: HostRoute, dir = 1) => {
    setHost({ route, dir })
    window.scrollTo({ top: 0 })
  }, [])
  const goGuest = useCallback((route: GuestRoute, dir = 1) => {
    setGuest({ route, dir })
    window.scrollTo({ top: 0 })
  }, [])

  const r = host.route
  const hostKey =
    r.name === 'new'
      ? `new-${r.step}`
      : r.name === 'person'
        ? `p-${r.id}`
        : r.name

  return (
    <MotionConfig reducedMotion="user">
      {/* React 19 hoists this into <head> and suspends until it loads: no fallback flash. */}
      <link rel="stylesheet" href={B_FONT_URL} precedence="default" />
      <BStyles />
      <div className="proto-b min-h-[100dvh]">
        {view === 'host' ? (
          <ScreenSwap id={hostKey} dir={host.dir}>
            {r.name === 'home' && <HostHome go={go} />}
            {r.name === 'new' && <NewBill step={r.step} go={go} />}
            {r.name === 'live' && <LiveStatus go={go} />}
            {r.name === 'person' && <PersonScreen id={r.id} go={go} />}
          </ScreenSwap>
        ) : (
          <GuestApp
            route={guest.route}
            dir={guest.dir}
            go={goGuest}
            paidFor={paidFor}
            setPaidFor={setPaidFor}
          />
        )}
      </div>
    </MotionConfig>
  )
}
