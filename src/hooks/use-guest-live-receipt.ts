import { useMemo } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { buildLiveReceipt } from '../../shared/live-receipt'
import type { LiveReceipt } from '../../shared/live-receipt'
import type { api } from '../../convex/_generated/api'

type GuestBillData = NonNullable<
  FunctionReturnType<typeof api.bills.getForGuest>
>
type ActiveSeats = FunctionReturnType<
  typeof api.guestSessions.listActiveForBill
>

/**
 * The Live receipt on a Guest phone. The server sends each seat's money as
 * this phone may see it; the lines, totals and seats come from the bill.
 */
export function useGuestLiveReceipt(
  data: GuestBillData,
  activeSeats: ActiveSeats | undefined,
): LiveReceipt {
  return useMemo(
    () =>
      buildLiveReceipt({
        participants: data.participants,
        items: data.items,
        assignments: data.assignments,
        tipCents: data.bill.tipCents,
        hostParticipantId: data.hostParticipantId,
        seatMoney: Object.fromEntries(
          data.participantBalances.map((row) => [row.participantId, row]),
        ),
        joinedSeatIds: (activeSeats ?? []).map((seat) => seat.participantId),
      }),
    [data, activeSeats],
  )
}
