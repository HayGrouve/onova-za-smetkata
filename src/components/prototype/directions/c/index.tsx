/**
 * PROTOTYPE Direction C "Живата сметка". One living receipt is the whole
 * product: host and guests look at the same paper with different permissions,
 * moving through Сглобяване, На масата, Разплащане.
 */
import { MotionConfig } from 'motion/react'
import { useMemo, useState } from 'react'
import { useGoogleFont } from '../mock/fonts.ts'
import { useLiveTable } from '../mock/live.ts'
import { useProto } from '../mock/store.tsx'
import type { DirectionProps } from '../types.ts'
import { FlightLayer } from './flight.tsx'
import { InitialsContext, buildInitials } from './ui.tsx'
import { GuestClaim, GuestJoin, GuestPay } from './guest.tsx'
import { HostBill, HostShelf } from './host.tsx'
import type { Phase } from './receipt.tsx'
import './c.css'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Martian+Mono:wdth,wght@75..112.5,400..600&display=swap'

export function DirectionC({ view }: DirectionProps) {
  useGoogleFont(FONTS)
  useLiveTable(true)
  const { state, derived, dispatch } = useProto()
  const names = derived.seats.map((s) => s.name).join('|')
  const initials = useMemo(() => buildInitials(names.split('|')), [names])
  // Host screen state lives here so it survives flipping to the guest phone and back.
  const [hostScreen, setHostScreen] = useState<'shelf' | 'bill'>('bill')
  const [phase, setPhase] = useState<Phase>('table')
  const [printing, setPrinting] = useState(false)
  const [guestPaying, setGuestPaying] = useState(false)

  let screen
  if (view === 'host') {
    screen =
      hostScreen === 'shelf' ? (
        <HostShelf
          onOpen={() => {
            setPrinting(false)
            setHostScreen('bill')
          }}
          onNew={() => {
            dispatch({ type: 'newBill' })
            setPhase('assemble')
            setPrinting(true)
            setHostScreen('bill')
          }}
        />
      ) : (
        <HostBill
          phase={phase}
          setPhase={setPhase}
          onBack={() => setHostScreen('shelf')}
          printing={printing}
        />
      )
  } else if (!state.guestSeatId) {
    screen = <GuestJoin />
  } else if (guestPaying) {
    screen = <GuestPay onBack={() => setGuestPaying(false)} />
  } else {
    screen = <GuestClaim onPay={() => setGuestPaying(true)} />
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="proto-c c-table min-h-[100dvh]">
        <InitialsContext.Provider value={initials}>
          <FlightLayer>{screen}</FlightLayer>
        </InitialsContext.Provider>
      </div>
    </MotionConfig>
  )
}
