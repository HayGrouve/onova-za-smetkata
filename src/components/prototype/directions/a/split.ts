/** PROTOTYPE — Direction A: price preview for a Shared Unit (real allocation rule). */
import { splitUnitShareAmongAssignees } from '../../../../../shared/unit-share-allocation.ts'
import { formatEur } from '../mock/store.tsx'
import type { MockParticipant } from '../mock/data.ts'

function portions(
  unitPriceCents: number,
  ids: string[],
  participants: MockParticipant[],
) {
  return splitUnitShareAmongAssignees(
    unitPriceCents,
    ids,
    participants.map((p) => ({ id: p._id, sortOrder: p.sortOrder })),
  )
}

/** "по 1,45 €" or "по 1,45 до 1,46 €" when cents do not divide evenly. */
export function perHeadText(
  unitPriceCents: number,
  ids: string[],
  participants: MockParticipant[],
) {
  if (ids.length === 0) return ''
  const cents = portions(unitPriceCents, ids, participants).map((p) => p.cents)
  const lo = Math.min(...cents)
  const hi = Math.max(...cents)
  return lo === hi
    ? `по ${formatEur(lo)}`
    : `по ${formatEur(lo).replace(/\s?€/, '')} до ${formatEur(hi)}`
}

export function portionFor(
  unitPriceCents: number,
  ids: string[],
  participants: MockParticipant[],
  id: string,
) {
  return (
    portions(unitPriceCents, ids, participants).find((p) => p.id === id)
      ?.cents ?? 0
  )
}
