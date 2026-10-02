/** PROTOTYPE — Direction A guest phone: Join → Claim → Pay → Done. */
import { useEffect, useState } from 'react'
import { useProto } from '../../mock/store.tsx'
import { Join } from './join.tsx'
import { Claim } from './claim.tsx'
import { Pay } from './pay.tsx'
import { Done } from './done.tsx'

type Screen = 'claim' | 'pay' | 'done'

export function GuestApp() {
  const { state } = useProto()
  const [screen, setScreen] = useState<Screen>('claim')
  const joined = !!state.guestSeatId
  // New screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen, joined])
  if (!state.guestSeatId) return <Join onJoined={() => setScreen('claim')} />
  if (screen === 'pay')
    return (
      <Pay
        onBack={() => setScreen('claim')}
        onReported={() => setScreen('done')}
      />
    )
  if (screen === 'done') return <Done onBack={() => setScreen('claim')} />
  return (
    <Claim onPay={() => setScreen('pay')} onStatus={() => setScreen('done')} />
  )
}
