import { z } from 'zod'
import { calculateBillTotals } from './bill-calculations'
import type { AssignmentInput } from './bill-calculations'
import { groupClaimItems, indexUnitMembers, unitKey } from './claim-groups'
import type { ClaimGroup, UnitRef } from './claim-groups'
import { TIP_PRESETS, tipCentsFromPercent } from './tip-calculations'
import type { TipPercent } from './tip-calculations'
import { planReleaseUnit, planShareUnit, planTakeUnit } from './unit-claim-plan'
import {
  EUR_CENTS_MAX,
  ITEM_NAME_MAX,
  PERSON_NAME_MAX,
  QUANTITY_MAX,
  RESTAURANT_NAME_MAX,
} from './validation/constants'

/**
 * Quick bill: one phone passed around the table. Snap the receipt, everyone
 * marks what they had, everyone sees their total, then it is thrown away.
 * Nothing here is stored on the server; the phone keeps it for a while.
 */

export const QUICK_BILL_SEATS_MIN = 2
export const QUICK_BILL_SEATS_MAX = 20
export const QUICK_BILL_SEATS_DEFAULT = 4
/** Left untouched this long, the quick bill is gone. */
export const QUICK_BILL_TTL_MS = 12 * 60 * 60 * 1000
/** „Закръгли“ rounds each total to the nearest 50 cents for cash. */
export const CASH_ROUNDING_CENTS = 50

export interface QuickBillLine {
  id: string
  name: string
  unitPriceCents: number
  quantity: number
  /** „За всички“: every seat shares every Unit, now and when seats are added. */
  forEveryone: boolean
}

export interface QuickBillSeat {
  id: string
  /** „Човек N“ until someone types a name. */
  number: number
  name: string
  /** Pressed „Готово“ on their turn. */
  done: boolean
}

export interface QuickBill {
  version: 1
  createdAt: number
  updatedAt: number
  restaurantName: string
  /** The total printed on the receipt, when the scan read one. */
  receiptTotalCents: number | null
  lines: QuickBillLine[]
  seats: QuickBillSeat[]
  claims: AssignmentInput[]
  tipPercent: TipPercent
  roundForCash: boolean
  /** Next line id suffix; ids are never reused within one quick bill. */
  lineSeq: number
}

export interface QuickBillLineInput {
  name: string
  unitPriceCents: number
  quantity: number
}

export type QuickBillResult =
  { ok: true; bill: QuickBill } | { ok: false; message: string }

function clampSeatCount(count: number) {
  return Math.min(
    QUICK_BILL_SEATS_MAX,
    Math.max(QUICK_BILL_SEATS_MIN, Math.trunc(count)),
  )
}

function newSeat(number: number): QuickBillSeat {
  return { id: `s${number}`, number, name: '', done: false }
}

export function createQuickBill({
  now,
  seatCount = QUICK_BILL_SEATS_DEFAULT,
}: {
  now: number
  seatCount?: number
}): QuickBill {
  const count = clampSeatCount(seatCount)
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    restaurantName: '',
    receiptTotalCents: null,
    lines: [],
    seats: Array.from({ length: count }, (_, index) => newSeat(index + 1)),
    claims: [],
    tipPercent: 0,
    roundForCash: false,
    lineSeq: 1,
  }
}

export function quickBillSeatLabel(seat: QuickBillSeat): string {
  return seat.name.trim() || `Човек ${seat.number}`
}

/** Someone has marked, named themselves or finished a turn: losing it costs. */
export function isQuickBillUnderway(bill: QuickBill): boolean {
  return (
    bill.claims.length > 0 ||
    bill.seats.some((s) => s.done || s.name.trim() !== '')
  )
}

export function isQuickBillExpired(bill: QuickBill, now: number): boolean {
  return now - bill.updatedAt > QUICK_BILL_TTL_MS
}

function seatHasClaims(bill: QuickBill, seatId: string) {
  return bill.claims.some((claim) => claim.participantId === seatId)
}

/** Whether „−“ may drop the last seat: never one that already took something. */
export function canRemoveLastQuickBillSeat(bill: QuickBill): boolean {
  const last = bill.seats.at(-1)
  return (
    bill.seats.length > QUICK_BILL_SEATS_MIN &&
    last !== undefined &&
    !seatHasClaims(bill, last.id)
  )
}

export function setQuickBillSeatCount(
  bill: QuickBill,
  count: number,
): QuickBill {
  const target = clampSeatCount(count)
  let next = bill
  while (next.seats.length > target && canRemoveLastQuickBillSeat(next)) {
    next = { ...next, seats: next.seats.slice(0, -1) }
  }
  if (next.seats.length < target) {
    const highest = Math.max(0, ...next.seats.map((s) => s.number))
    const added = Array.from({ length: target - next.seats.length }, (_, i) =>
      newSeat(highest + i + 1),
    )
    next = { ...next, seats: [...next.seats, ...added] }
  }
  return next
}

/** Kept as typed (the label trims), so a space mid-name survives each keystroke. */
export function renameQuickBillSeat(
  bill: QuickBill,
  seatId: string,
  name: string,
): QuickBill {
  const typed = name.slice(0, PERSON_NAME_MAX)
  return {
    ...bill,
    seats: bill.seats.map((s) => (s.id === seatId ? { ...s, name: typed } : s)),
  }
}

export function markQuickBillSeatDone(
  bill: QuickBill,
  seatId: string,
): QuickBill {
  return {
    ...bill,
    seats: bill.seats.map((s) => (s.id === seatId ? { ...s, done: true } : s)),
  }
}

function newLine(id: string, input: QuickBillLineInput): QuickBillLine {
  return {
    id,
    name: input.name,
    unitPriceCents: input.unitPriceCents,
    quantity: input.quantity,
    forEveryone: false,
  }
}

/** Lines from a scan replace whatever was there, claims included. */
export function replaceQuickBillLines(
  bill: QuickBill,
  scan: {
    lines: QuickBillLineInput[]
    restaurantName?: string
    receiptTotalCents?: number
  },
): QuickBill {
  return {
    ...bill,
    restaurantName: (scan.restaurantName ?? '')
      .trim()
      .slice(0, RESTAURANT_NAME_MAX),
    receiptTotalCents: scan.receiptTotalCents ?? null,
    lines: scan.lines.map((line, index) =>
      newLine(`l${bill.lineSeq + index}`, line),
    ),
    claims: [],
    lineSeq: bill.lineSeq + scan.lines.length,
  }
}

export function addQuickBillLine(
  bill: QuickBill,
  input: QuickBillLineInput,
): QuickBill {
  return {
    ...bill,
    lines: [...bill.lines, newLine(`l${bill.lineSeq}`, input)],
    lineSeq: bill.lineSeq + 1,
  }
}

/** A smaller quantity drops the claims on the Units that are gone. */
export function updateQuickBillLine(
  bill: QuickBill,
  lineId: string,
  patch: Partial<QuickBillLineInput>,
): QuickBill {
  const lines = bill.lines.map((line) =>
    line.id === lineId ? { ...line, ...patch } : line,
  )
  const quantity = lines.find((line) => line.id === lineId)?.quantity ?? 0
  return {
    ...bill,
    lines,
    claims: bill.claims.filter(
      (claim) => claim.itemId !== lineId || claim.unitIndex < quantity,
    ),
  }
}

export function removeQuickBillLine(
  bill: QuickBill,
  lineId: string,
): QuickBill {
  return {
    ...bill,
    lines: bill.lines.filter((line) => line.id !== lineId),
    claims: bill.claims.filter((claim) => claim.itemId !== lineId),
  }
}

/** „За всички“ on: what was taken from the line no longer matters. */
export function setQuickBillLineForEveryone(
  bill: QuickBill,
  lineId: string,
  forEveryone: boolean,
): QuickBill {
  return {
    ...bill,
    lines: bill.lines.map((line) =>
      line.id === lineId ? { ...line, forEveryone } : line,
    ),
    claims: forEveryone
      ? bill.claims.filter((claim) => claim.itemId !== lineId)
      : bill.claims,
  }
}

/** Claim groups for the lines people still mark one by one. */
export function quickBillClaimGroups(bill: QuickBill): ClaimGroup[] {
  return groupClaimItems(
    bill.lines.flatMap((line, index) =>
      line.forEveryone ? [] : [{ ...line, sortOrder: index }],
    ),
  )
}

function participantsOf(bill: QuickBill) {
  return bill.seats.map((s, index) => ({ id: s.id, sortOrder: index }))
}

function unitsOf(bill: QuickBill, lineIds: string[]): UnitRef[] {
  return bill.lines
    .filter((line) => lineIds.includes(line.id) && !line.forEveryone)
    .flatMap((line) =>
      Array.from({ length: line.quantity }, (_, unitIndex) => ({
        itemId: line.id,
        unitIndex,
      })),
    )
}

function isOnUnit(claim: AssignmentInput, unit: UnitRef, seatId: string) {
  return (
    claim.itemId === unit.itemId &&
    claim.unitIndex === unit.unitIndex &&
    claim.participantId === seatId
  )
}

function withClaim(bill: QuickBill, unit: UnitRef, seatId: string) {
  if (bill.claims.some((claim) => isOnUnit(claim, unit, seatId))) return bill
  return {
    ...bill,
    claims: [...bill.claims, { ...unit, participantId: seatId }],
  }
}

function withoutClaim(bill: QuickBill, unit: UnitRef, seatId: string) {
  return {
    ...bill,
    claims: bill.claims.filter((claim) => !isOnUnit(claim, unit, seatId)),
  }
}

/** „Мое“: the seat takes the first free Unit of the group, alone. */
export function takeQuickBillUnit(
  bill: QuickBill,
  lineIds: string[],
  seatId: string,
): QuickBillResult {
  const plan = planTakeUnit({
    units: unitsOf(bill, lineIds),
    assignments: bill.claims,
  })
  if (!plan.ok) return plan
  return { ok: true, bill: withClaim(bill, plan.unit, seatId) }
}

/** „−“: gives back the last Unit the seat holds alone. */
export function releaseQuickBillUnit(
  bill: QuickBill,
  lineIds: string[],
  seatId: string,
): QuickBillResult {
  const plan = planReleaseUnit({
    units: unitsOf(bill, lineIds),
    assignments: bill.claims,
    participantId: seatId,
  })
  if (!plan.ok) return plan
  return { ok: true, bill: withoutClaim(bill, plan.unit, seatId) }
}

/** „Сподели“: the seat and the chosen seats split one Unit. */
export function shareQuickBillUnit(
  bill: QuickBill,
  lineIds: string[],
  seatId: string,
  withSeatIds: string[],
  unit?: UnitRef,
): QuickBillResult {
  const plan = planShareUnit({
    units: unitsOf(bill, lineIds),
    assignments: bill.claims,
    actorId: seatId,
    withParticipantIds: withSeatIds,
    unit,
  })
  if (!plan.ok) return plan
  let next = bill
  for (const id of plan.add) next = withClaim(next, plan.unit, id)
  for (const id of plan.remove) next = withoutClaim(next, plan.unit, id)
  return { ok: true, bill: next }
}

/** „Споделихме я“: the seat joins a Unit someone already has. */
export function joinQuickBillUnit(
  bill: QuickBill,
  unit: UnitRef,
  seatId: string,
): QuickBill {
  return withClaim(bill, unit, seatId)
}

export function leaveQuickBillUnit(
  bill: QuickBill,
  unit: UnitRef,
  seatId: string,
): QuickBill {
  return withoutClaim(bill, unit, seatId)
}

/** „Раздели по равно“: every Unit nobody took goes to every seat. */
export function splitQuickBillLeftovers(bill: QuickBill): QuickBill {
  const members = indexUnitMembers(bill.claims)
  const free = quickBillClaimGroups(bill)
    .flatMap((group) => group.units)
    .filter((unit) => (members.get(unitKey(unit)) ?? []).length === 0)
  return {
    ...bill,
    claims: [
      ...bill.claims,
      ...free.flatMap((unit) =>
        bill.seats.map((s) => ({ ...unit, participantId: s.id })),
      ),
    ],
  }
}

/** Claims plus „За всички“ lines spelled out for every current seat. */
function allAssignments(bill: QuickBill): AssignmentInput[] {
  const everyone = bill.lines
    .filter((line) => line.forEveryone)
    .flatMap((line) =>
      Array.from({ length: line.quantity }, (_, unitIndex) =>
        bill.seats.map((s) => ({
          itemId: line.id,
          unitIndex,
          participantId: s.id,
        })),
      ).flat(),
    )
  return [...bill.claims, ...everyone]
}

function roundForCash(cents: number) {
  return Math.round(cents / CASH_ROUNDING_CENTS) * CASH_ROUNDING_CENTS
}

export interface QuickBillSeatTotal {
  id: string
  label: string
  /** Food + tip, to the cent. */
  shareCents: number
  /** What to hand over: the Share, rounded when „Закръгли“ is on. */
  amountCents: number
}

export interface QuickBillSummary {
  seats: QuickBillSeatTotal[]
  linesCents: number
  tipCents: number
  totalCents: number
  /** Sum of the amounts people hand over (differs from total when rounded). */
  amountsTotalCents: number
  unassignedUnits: number
  unassignedCents: number
  receiptMismatch: { linesCents: number; receiptCents: number } | null
}

export function summarizeQuickBill(bill: QuickBill): QuickBillSummary {
  const linesCents = bill.lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  )
  const tipCents = tipCentsFromPercent(linesCents, bill.tipPercent)
  const totals = calculateBillTotals({
    participants: participantsOf(bill),
    items: bill.lines,
    assignments: allAssignments(bill),
    payments: [],
    tipCents,
  })

  const seats = bill.seats.map((s) => {
    const shareCents = totals.byParticipant[s.id].owedCents
    return {
      id: s.id,
      label: quickBillSeatLabel(s),
      shareCents,
      amountCents: bill.roundForCash ? roundForCash(shareCents) : shareCents,
    }
  })

  const members = indexUnitMembers(bill.claims)
  const free = quickBillClaimGroups(bill).flatMap((group) =>
    group.units
      .filter((unit) => (members.get(unitKey(unit)) ?? []).length === 0)
      .map(() => group.unitPriceCents),
  )

  const receiptCents = bill.receiptTotalCents
  return {
    seats,
    linesCents,
    tipCents,
    totalCents: linesCents + tipCents,
    amountsTotalCents: seats.reduce((sum, s) => sum + s.amountCents, 0),
    unassignedUnits: free.length,
    unassignedCents: free.reduce((sum, cents) => sum + cents, 0),
    receiptMismatch:
      receiptCents !== null && Math.abs(linesCents - receiptCents) > 1
        ? { linesCents, receiptCents }
        : null,
  }
}

const centsSchema = z.number().int().min(0).max(EUR_CENTS_MAX)

const quickBillSchema = z.object({
  version: z.literal(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  restaurantName: z.string().max(RESTAURANT_NAME_MAX),
  receiptTotalCents: z.number().int().min(0).nullable(),
  lines: z.array(
    z.object({
      id: z.string(),
      name: z.string().max(ITEM_NAME_MAX),
      unitPriceCents: centsSchema,
      quantity: z.number().int().min(1).max(QUANTITY_MAX),
      forEveryone: z.boolean(),
    }),
  ),
  seats: z
    .array(
      z.object({
        id: z.string(),
        number: z.number().int().min(1),
        name: z.string().max(PERSON_NAME_MAX),
        done: z.boolean(),
      }),
    )
    .min(QUICK_BILL_SEATS_MIN)
    .max(QUICK_BILL_SEATS_MAX),
  claims: z.array(
    z.object({
      itemId: z.string(),
      participantId: z.string(),
      unitIndex: z.number().int().min(0),
    }),
  ),
  tipPercent: z
    .number()
    .refine((value): value is TipPercent =>
      (TIP_PRESETS as readonly number[]).includes(value),
    ),
  roundForCash: z.boolean(),
  lineSeq: z.number().int().min(1),
})

/** A quick bill read back from the phone's storage, or null if it is not one. */
export function parseQuickBill(value: unknown): QuickBill | null {
  const parsed = quickBillSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
