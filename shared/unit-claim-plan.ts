import type { AssignmentInput } from './bill-calculations'
import { CLAIM_MESSAGES } from './claim-messages'
import { indexUnitMembers, unitKey } from './claim-groups'
import type { UnitRef } from './claim-groups'

type PlanFailure = { ok: false; message: string }

export type UnitPlanResult = { ok: true; unit: UnitRef } | PlanFailure

export type SharePlanResult =
  { ok: true; unit: UnitRef; add: string[]; remove: string[] } | PlanFailure

/** First Unit (in group order) with no members — never joins someone else's Unit. */
export function planTakeUnit(input: {
  units: UnitRef[]
  assignments: AssignmentInput[]
}): UnitPlanResult {
  const members = indexUnitMembers(input.assignments)
  const free = input.units.find(
    (unit) => (members.get(unitKey(unit)) ?? []).length === 0,
  )
  if (!free) return { ok: false, message: CLAIM_MESSAGES.noFreeUnits }
  return { ok: true, unit: free }
}

/** Last Unit the seat holds alone. Shared Units are left to the share flow. */
export function planReleaseUnit(input: {
  units: UnitRef[]
  assignments: AssignmentInput[]
  participantId: string
}): UnitPlanResult {
  const members = indexUnitMembers(input.assignments)
  const solo = [...input.units].reverse().find((unit) => {
    const onUnit = members.get(unitKey(unit)) ?? []
    return onUnit.length === 1 && onUnit[0] === input.participantId
  })
  if (!solo) return { ok: false, message: CLAIM_MESSAGES.noSoloUnitToRelease }
  return { ok: true, unit: solo }
}

/**
 * Explicit share: set who shares a Unit with the actor.
 * - With `unit`: the actor must be on it; co-members become `withParticipantIds`.
 * - Without `unit`: share the actor's first solo Unit, else take a free one.
 */
export function planShareUnit(input: {
  units: UnitRef[]
  assignments: AssignmentInput[]
  actorId: string
  withParticipantIds: string[]
  unit?: UnitRef
}): SharePlanResult {
  const members = indexUnitMembers(input.assignments)
  const withIds = [...new Set(input.withParticipantIds)].filter(
    (id) => id !== input.actorId,
  )

  if (input.unit) {
    const target = input.unit
    const inGroup = input.units.some(
      (unit) => unitKey(unit) === unitKey(target),
    )
    if (!inGroup) return { ok: false, message: CLAIM_MESSAGES.unitNotInGroup }

    const current = members.get(unitKey(target)) ?? []
    if (!current.includes(input.actorId)) {
      return { ok: false, message: CLAIM_MESSAGES.notOnUnit }
    }
    return {
      ok: true,
      unit: target,
      add: withIds.filter((id) => !current.includes(id)),
      remove: current.filter(
        (id) => id !== input.actorId && !withIds.includes(id),
      ),
    }
  }

  if (withIds.length === 0) {
    return { ok: false, message: CLAIM_MESSAGES.noShareTargets }
  }

  const solo = input.units.find((unit) => {
    const onUnit = members.get(unitKey(unit)) ?? []
    return onUnit.length === 1 && onUnit[0] === input.actorId
  })
  if (solo) return { ok: true, unit: solo, add: withIds, remove: [] }

  const taken = planTakeUnit(input)
  if (!taken.ok) return taken
  return {
    ok: true,
    unit: taken.unit,
    add: [input.actorId, ...withIds],
    remove: [],
  }
}
