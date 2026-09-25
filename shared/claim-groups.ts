import type { AssignmentInput, ParticipantInput } from './bill-calculations'
import { splitUnitShareAmongAssignees } from './unit-share-allocation'

/** One Unit on an item line. */
export interface UnitRef {
  itemId: string
  unitIndex: number
}

export interface ClaimGroupItem {
  id: string
  name: string
  unitPriceCents: number
  quantity: number
  sortOrder: number
}

/**
 * Identical item lines (same normalized name and unit price) shown as one row
 * on the claim page. Units span every line in the group.
 */
export interface ClaimGroup {
  key: string
  name: string
  unitPriceCents: number
  sortOrder: number
  itemIds: string[]
  units: UnitRef[]
}

export interface SharedUnitView {
  unit: UnitRef
  coMemberIds: string[]
  myShareCents: number
}

export interface OthersUnitView {
  unit: UnitRef
  memberIds: string[]
}

export interface ClaimJoinOption {
  memberIds: string[]
  units: UnitRef[]
  /** What the seat would pay for one of these Units after joining. */
  joinedShareCents: number
}

export interface ClaimGroupSeatView {
  totalUnits: number
  freeUnits: UnitRef[]
  mySoloUnits: UnitRef[]
  mySharedUnits: SharedUnitView[]
  othersUnits: OthersUnitView[]
  otherClaimantCounts: Array<{ participantId: string; units: number }>
  joinOptions: ClaimJoinOption[]
  myUnitCount: number
  claimedUnitCount: number
  myShareCents: number
}

export function normalizeItemName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('bg')
}

function claimGroupKey(item: Pick<ClaimGroupItem, 'name' | 'unitPriceCents'>) {
  return `${normalizeItemName(item.name)}|${item.unitPriceCents}`
}

export function groupClaimItems(items: ClaimGroupItem[]): ClaimGroup[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
  const groups = new Map<string, ClaimGroup>()

  for (const item of sorted) {
    const key = claimGroupKey(item)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        name: item.name,
        unitPriceCents: item.unitPriceCents,
        sortOrder: item.sortOrder,
        itemIds: [],
        units: [],
      }
      groups.set(key, group)
    }
    group.itemIds.push(item.id)
    for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
      group.units.push({ itemId: item.id, unitIndex })
    }
  }

  return [...groups.values()]
}

function sortBySeatOrder(
  participantIds: string[],
  participants: ParticipantInput[],
): string[] {
  const order = new Map(participants.map((p) => [p.id, p.sortOrder]))
  return [...new Set(participantIds)].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
  )
}

/** Member ids on each Unit, keyed by `itemId:unitIndex`. */
export function indexUnitMembers(
  assignments: AssignmentInput[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const assignment of assignments) {
    const key = unitKey(assignment)
    const members = map.get(key) ?? []
    if (!members.includes(assignment.participantId)) {
      members.push(assignment.participantId)
    }
    map.set(key, members)
  }
  return map
}

export function unitKey(unit: UnitRef): string {
  return `${unit.itemId}:${unit.unitIndex}`
}

function portionFor(
  unitPriceCents: number,
  memberIds: string[],
  participantId: string,
  participants: ParticipantInput[],
): number {
  return (
    splitUnitShareAmongAssignees(unitPriceCents, memberIds, participants).find(
      (portion) => portion.id === participantId,
    )?.cents ?? 0
  )
}

export function buildClaimGroupSeatView(input: {
  group: ClaimGroup
  assignments: AssignmentInput[]
  seatId: string
  participants: ParticipantInput[]
}): ClaimGroupSeatView {
  const { group, seatId, participants } = input
  const membersByUnit = indexUnitMembers(input.assignments)

  const freeUnits: UnitRef[] = []
  const mySoloUnits: UnitRef[] = []
  const mySharedUnits: SharedUnitView[] = []
  const othersUnits: OthersUnitView[] = []
  const otherCounts = new Map<string, number>()
  const joinOptionsByKey = new Map<string, ClaimJoinOption>()
  let myShareCents = 0

  for (const unit of group.units) {
    const memberIds = sortBySeatOrder(
      membersByUnit.get(unitKey(unit)) ?? [],
      participants,
    )

    if (memberIds.length === 0) {
      freeUnits.push(unit)
      continue
    }

    if (memberIds.includes(seatId)) {
      const share = portionFor(
        group.unitPriceCents,
        memberIds,
        seatId,
        participants,
      )
      myShareCents += share
      if (memberIds.length === 1) {
        mySoloUnits.push(unit)
      } else {
        mySharedUnits.push({
          unit,
          coMemberIds: memberIds.filter((id) => id !== seatId),
          myShareCents: share,
        })
      }
      continue
    }

    othersUnits.push({ unit, memberIds })
    for (const id of memberIds) {
      otherCounts.set(id, (otherCounts.get(id) ?? 0) + 1)
    }

    const optionKey = memberIds.join(',')
    const option = joinOptionsByKey.get(optionKey)
    if (option) {
      option.units.push(unit)
    } else {
      joinOptionsByKey.set(optionKey, {
        memberIds,
        units: [unit],
        joinedShareCents: portionFor(
          group.unitPriceCents,
          [...memberIds, seatId],
          seatId,
          participants,
        ),
      })
    }
  }

  const otherClaimantCounts = sortBySeatOrder(
    [...otherCounts.keys()],
    participants,
  ).map((participantId) => ({
    participantId,
    units: otherCounts.get(participantId) ?? 0,
  }))

  const joinOptions = [...joinOptionsByKey.values()].sort(
    (a, b) => a.memberIds.length - b.memberIds.length,
  )

  return {
    totalUnits: group.units.length,
    freeUnits,
    mySoloUnits,
    mySharedUnits,
    othersUnits,
    otherClaimantCounts,
    joinOptions,
    myUnitCount: mySoloUnits.length + mySharedUnits.length,
    claimedUnitCount: group.units.length - freeUnits.length,
    myShareCents,
  }
}
