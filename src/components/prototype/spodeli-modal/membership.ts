/**
 * PROTOTYPE helpers — in-memory unit membership for Сподели modal variants.
 */
import {
  previewShareCents,
  formatShareParticipantCount,
} from '#/lib/guest-share-preview.ts'
import {
  INITIAL_MEMBERSHIP,
  ME_ID,
  ME_LABEL,
  MOCK_ITEM,
  PARTICIPANT_LABELS,
  type ParticipantId,
  type UnitMembership,
} from './mock-data.ts'

export function cloneMembership(source: UnitMembership = INITIAL_MEMBERSHIP) {
  const next: UnitMembership = {}
  for (let i = 0; i < MOCK_ITEM.quantity; i++) {
    next[i] = [...(source[i] ?? [])]
  }
  return next
}

export function myUnitCount(membership: UnitMembership): number {
  let count = 0
  for (let i = 0; i < MOCK_ITEM.quantity; i++) {
    if ((membership[i] ?? []).includes(ME_ID)) count += 1
  }
  return count
}

export function coveredUnitCount(membership: UnitMembership): number {
  let count = 0
  for (let i = 0; i < MOCK_ITEM.quantity; i++) {
    if ((membership[i] ?? []).length > 0) count += 1
  }
  return count
}

export function toggleMeOnUnit(
  membership: UnitMembership,
  unitIndex: number,
): UnitMembership {
  const next = cloneMembership(membership)
  const ids = next[unitIndex] ?? []
  next[unitIndex] = ids.includes(ME_ID)
    ? ids.filter((id) => id !== ME_ID)
    : [...ids, ME_ID]
  return next
}

export function isMeOnUnit(
  membership: UnitMembership,
  unitIndex: number,
): boolean {
  return (membership[unitIndex] ?? []).includes(ME_ID)
}

export function otherLabelsOnUnit(
  membership: UnitMembership,
  unitIndex: number,
): string[] {
  return (membership[unitIndex] ?? [])
    .filter((id) => id !== ME_ID)
    .map((id) => PARTICIPANT_LABELS[id as ParticipantId] ?? id)
}

export function unitSharePreviewCents(
  membership: UnitMembership,
  unitIndex: number,
  joining: boolean,
): number {
  const ids = membership[unitIndex] ?? []
  return previewShareCents(MOCK_ITEM.unitPriceCents, ids, ME_ID, joining)
}

export function membershipStateDump(membership: UnitMembership): string {
  const units = Array.from({ length: MOCK_ITEM.quantity }, (_, i) => ({
    unitIndex: i,
    participants: membership[i] ?? [],
    myShareCents: unitSharePreviewCents(
      membership,
      i,
      !isMeOnUnit(membership, i),
    ),
  }))
  return JSON.stringify(
    {
      myUnits: myUnitCount(membership),
      coveredUnits: coveredUnitCount(membership),
      units,
    },
    null,
    2,
  )
}

export {
  formatShareParticipantCount,
  MOCK_ITEM,
  ME_ID,
  ME_LABEL,
  type UnitMembership,
}
