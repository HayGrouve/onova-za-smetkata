/**
 * PROTOTYPE — in-memory bill store shared by the host and guest views of one
 * design direction. Money and claim rules come from the real `shared/`
 * modules, so totals behave exactly like the product. No persistence, no Convex.
 */
import { createContext, useContext, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { calculateBillTotals } from '../../../../../shared/bill-calculations.ts'
import type {
  BillTotals,
  ParticipantTotals,
} from '../../../../../shared/bill-calculations.ts'
import { toBillCalculationSnapshot } from '../../../../../shared/bill-calculation-snapshot.ts'
import type { BillCalculationSnapshot } from '../../../../../shared/bill-calculation-snapshot.ts'
import {
  buildClaimGroupSeatView,
  groupClaimItems,
  unitKey,
} from '../../../../../shared/claim-groups.ts'
import type {
  ClaimGroup,
  ClaimGroupSeatView,
  UnitRef,
} from '../../../../../shared/claim-groups.ts'
import {
  planReleaseUnit,
  planShareUnit,
  planTakeUnit,
} from '../../../../../shared/unit-claim-plan.ts'
import { buildParticipantShareView } from '../../../../../shared/participant-share-view.ts'
import type { ParticipantShareView } from '../../../../../shared/participant-share-view.ts'
import { formatEur } from '#/lib/format-currency.ts'
import {
  HOST_ID,
  SCANNED_RECEIPT,
  createEmptyBill,
  createSeedBill,
} from './data.ts'
import type {
  MockActivity,
  MockAssignment,
  MockBill,
  MockItem,
} from './data.ts'

export { formatEur }

/* ------------------------------------------------------------------ state */

interface ProtoState {
  bill: MockBill
  /** Seat the guest phone (the prototype viewer) picked; null = not joined. */
  guestSeatId: string | null
  /** Covered seats handled by the guest phone. */
  coveredSeatIds: string[]
  activity: MockActivity[]
  /** Simulated OCR in progress. */
  scanning: boolean
}

type Action =
  | { type: 'reset' }
  | { type: 'newBill' }
  | { type: 'setRestaurant'; name: string }
  | { type: 'setTipPercent'; percent: number }
  | { type: 'addItem'; item: Omit<MockItem, '_id' | 'sortOrder'> }
  | {
      type: 'updateItem'
      itemId: string
      patch: Partial<Omit<MockItem, '_id'>>
    }
  | { type: 'removeItem'; itemId: string }
  | { type: 'scanStart' }
  | { type: 'scanDone' }
  | { type: 'addParticipant'; name: string }
  | { type: 'renameParticipant'; participantId: string; name: string }
  | { type: 'removeParticipant'; participantId: string }
  | { type: 'takeUnit'; groupKey: string; participantId: string }
  | { type: 'releaseUnit'; groupKey: string; participantId: string }
  | {
      type: 'shareUnit'
      groupKey: string
      actorId: string
      withParticipantIds: string[]
      unit?: UnitRef
    }
  | { type: 'joinUnit'; unit: UnitRef; participantId: string }
  | { type: 'leaveUnit'; unit: UnitRef; participantId: string }
  | {
      type: 'setUnitMembers'
      unit: UnitRef
      participantIds: string[]
    }
  | { type: 'splitRestEvenly' }
  | { type: 'pickSeat'; participantId: string }
  | { type: 'joinAsNew'; name: string }
  | { type: 'leaveSeat' }
  | { type: 'setCovered'; participantIds: string[] }
  | { type: 'reportPaid'; participantIds: string[]; by?: string }
  | { type: 'cancelReport'; participantIds: string[] }
  | { type: 'confirmPayment'; participantId: string }
  | { type: 'markPaid'; participantId: string; amountCents?: number }
  | { type: 'undoPayment'; participantId: string }
  | { type: 'finalize' }
  | { type: 'reopen' }
  | { type: 'remoteJoin'; participantId: string }

function initialState(): ProtoState {
  return {
    bill: createSeedBill(),
    guestSeatId: null,
    coveredSeatIds: [],
    activity: [
      activity('p-desi', 'took', 'Деси взе Пилешка пържола', 6),
      activity('p-yavor', 'took', 'Явор взе 2 × Бира Загорка 0,5', 9),
      activity('p-yavor', 'joined', 'Явор отвори линка', 14),
      activity('p-desi', 'joined', 'Деси отвори линка', 15),
    ],
    scanning: false,
  }
}

let activitySeq = 0
function activity(
  participantId: string,
  kind: MockActivity['kind'],
  text: string,
  minutesAgo = 0,
): MockActivity {
  activitySeq += 1
  return {
    id: `a-${activitySeq}`,
    at: Date.now() - minutesAgo * 60_000,
    participantId,
    kind,
    text,
  }
}

function nameOf(bill: MockBill, id: string): string {
  return bill.participants.find((p) => p._id === id)?.name ?? 'Някой'
}

function groupsOf(bill: MockBill): ClaimGroup[] {
  return groupClaimItems(
    bill.items.map((i) => ({
      id: i._id,
      name: i.name,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      sortOrder: i.sortOrder,
    })),
  )
}

function withAssignments(
  state: ProtoState,
  assignments: MockAssignment[],
  event?: MockActivity,
): ProtoState {
  return {
    ...state,
    bill: { ...state.bill, assignments },
    activity: event ? [event, ...state.activity].slice(0, 40) : state.activity,
  }
}

function addMember(
  list: MockAssignment[],
  unit: UnitRef,
  participantId: string,
): MockAssignment[] {
  if (
    list.some(
      (a) =>
        a.itemId === unit.itemId &&
        a.unitIndex === unit.unitIndex &&
        a.participantId === participantId,
    )
  )
    return list
  return [...list, { ...unit, participantId }]
}

function removeMember(
  list: MockAssignment[],
  unit: UnitRef,
  participantId: string,
): MockAssignment[] {
  return list.filter(
    (a) =>
      !(
        a.itemId === unit.itemId &&
        a.unitIndex === unit.unitIndex &&
        a.participantId === participantId
      ),
  )
}

function subtotalOf(bill: MockBill): number {
  return bill.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0)
}

export function tipCentsOf(bill: MockBill): number {
  return Math.round((subtotalOf(bill) * bill.tipPercent) / 100)
}

function snapshotOf(bill: MockBill): BillCalculationSnapshot {
  return toBillCalculationSnapshot(bill, {
    tipCents: tipCentsOf(bill),
    hostParticipantId: bill.hostParticipantId,
  })
}

function owedOf(bill: MockBill, participantId: string): number {
  const totals = calculateBillTotals(snapshotOf(bill).calculationInput)
  if (!(participantId in totals.byParticipant)) return 0
  const t = totals.byParticipant[participantId]
  return Math.max(0, t.owedCents - t.paidCents)
}

function reducer(state: ProtoState, action: Action): ProtoState {
  const { bill } = state
  switch (action.type) {
    case 'reset':
      return initialState()
    case 'newBill':
      return {
        ...state,
        bill: createEmptyBill(),
        guestSeatId: null,
        coveredSeatIds: [],
        activity: [],
      }
    case 'setRestaurant':
      return { ...state, bill: { ...bill, restaurantName: action.name } }
    case 'setTipPercent':
      return { ...state, bill: { ...bill, tipPercent: action.percent } }
    case 'addItem': {
      const sortOrder = bill.items.length
      const item: MockItem = {
        ...action.item,
        _id: `i-${Date.now()}-${sortOrder}`,
        sortOrder,
      }
      return { ...state, bill: { ...bill, items: [...bill.items, item] } }
    }
    case 'updateItem': {
      const items = bill.items.map((i) =>
        i._id === action.itemId ? { ...i, ...action.patch } : i,
      )
      const item = items.find((i) => i._id === action.itemId)
      // Drop memberships on Units that no longer exist.
      const assignments = item
        ? bill.assignments.filter(
            (a) => a.itemId !== item._id || a.unitIndex < item.quantity,
          )
        : bill.assignments
      return { ...state, bill: { ...bill, items, assignments } }
    }
    case 'removeItem':
      return {
        ...state,
        bill: {
          ...bill,
          items: bill.items.filter((i) => i._id !== action.itemId),
          assignments: bill.assignments.filter(
            (a) => a.itemId !== action.itemId,
          ),
        },
      }
    case 'scanStart':
      return { ...state, scanning: true }
    case 'scanDone': {
      const base = bill.items.length
      const items = SCANNED_RECEIPT.items.map((i, idx) => ({
        ...i,
        _id: `i-scan-${idx}`,
        sortOrder: base + idx,
      }))
      return {
        ...state,
        scanning: false,
        bill: {
          ...bill,
          restaurantName: bill.restaurantName || SCANNED_RECEIPT.restaurantName,
          items: [...bill.items, ...items],
        },
      }
    }
    case 'addParticipant': {
      const name = action.name.trim()
      if (!name) return state
      const sortOrder =
        Math.max(0, ...bill.participants.map((p) => p.sortOrder)) + 1
      return {
        ...state,
        bill: {
          ...bill,
          participants: [
            ...bill.participants,
            { _id: `p-${Date.now()}-${sortOrder}`, name, sortOrder },
          ],
        },
      }
    }
    case 'renameParticipant':
      return {
        ...state,
        bill: {
          ...bill,
          participants: bill.participants.map((p) =>
            p._id === action.participantId ? { ...p, name: action.name } : p,
          ),
        },
      }
    case 'removeParticipant':
      if (action.participantId === HOST_ID) return state
      return {
        ...state,
        bill: {
          ...bill,
          participants: bill.participants.filter(
            (p) => p._id !== action.participantId,
          ),
          assignments: bill.assignments.filter(
            (a) => a.participantId !== action.participantId,
          ),
        },
      }
    case 'takeUnit': {
      const group = groupsOf(bill).find((g) => g.key === action.groupKey)
      if (!group) return state
      const plan = planTakeUnit({
        units: group.units,
        assignments: bill.assignments,
      })
      if (!plan.ok) return state
      return withAssignments(
        state,
        addMember(bill.assignments, plan.unit, action.participantId),
        activity(
          action.participantId,
          'took',
          `${nameOf(bill, action.participantId)} взе ${group.name}`,
        ),
      )
    }
    case 'releaseUnit': {
      const group = groupsOf(bill).find((g) => g.key === action.groupKey)
      if (!group) return state
      const plan = planReleaseUnit({
        units: group.units,
        assignments: bill.assignments,
        participantId: action.participantId,
      })
      if (!plan.ok) return state
      return withAssignments(
        state,
        removeMember(bill.assignments, plan.unit, action.participantId),
        activity(
          action.participantId,
          'released',
          `${nameOf(bill, action.participantId)} върна ${group.name}`,
        ),
      )
    }
    case 'shareUnit': {
      const group = groupsOf(bill).find((g) => g.key === action.groupKey)
      if (!group) return state
      const plan = planShareUnit({
        units: group.units,
        assignments: bill.assignments,
        actorId: action.actorId,
        withParticipantIds: action.withParticipantIds,
        unit: action.unit,
      })
      if (!plan.ok) return state
      let next = addMember(bill.assignments, plan.unit, action.actorId)
      for (const id of plan.add) next = addMember(next, plan.unit, id)
      for (const id of plan.remove) next = removeMember(next, plan.unit, id)
      const names = action.withParticipantIds
        .map((id) => nameOf(bill, id))
        .join(', ')
      return withAssignments(
        state,
        next,
        activity(
          action.actorId,
          'shared',
          `${nameOf(bill, action.actorId)} сподели ${group.name} с ${names}`,
        ),
      )
    }
    case 'joinUnit':
      return withAssignments(
        state,
        addMember(bill.assignments, action.unit, action.participantId),
      )
    case 'leaveUnit':
      return withAssignments(
        state,
        removeMember(bill.assignments, action.unit, action.participantId),
      )
    case 'setUnitMembers': {
      const rest = bill.assignments.filter(
        (a) =>
          !(
            a.itemId === action.unit.itemId &&
            a.unitIndex === action.unit.unitIndex
          ),
      )
      return withAssignments(state, [
        ...rest,
        ...action.participantIds.map((participantId) => ({
          ...action.unit,
          participantId,
        })),
      ])
    }
    case 'splitRestEvenly': {
      const taken = new Set(bill.assignments.map((a) => unitKey(a)))
      const extra: MockAssignment[] = []
      for (const item of bill.items) {
        for (let u = 0; u < item.quantity; u++) {
          const unit = { itemId: item._id, unitIndex: u }
          if (taken.has(unitKey(unit))) continue
          for (const p of bill.participants)
            extra.push({ ...unit, participantId: p._id })
        }
      }
      return withAssignments(state, [...bill.assignments, ...extra])
    }
    case 'pickSeat':
      return {
        ...state,
        guestSeatId: action.participantId,
        bill: {
          ...bill,
          seatPhones: {
            ...bill.seatPhones,
            [action.participantId]: action.participantId,
          },
        },
        activity: [
          activity(
            action.participantId,
            'joined',
            `${nameOf(bill, action.participantId)} отвори линка`,
          ),
          ...state.activity,
        ],
      }
    case 'joinAsNew': {
      const name = action.name.trim()
      if (!name) return state
      const sortOrder =
        Math.max(0, ...bill.participants.map((p) => p.sortOrder)) + 1
      const id = `p-guest-${Date.now()}`
      return {
        ...state,
        guestSeatId: id,
        bill: {
          ...bill,
          participants: [...bill.participants, { _id: id, name, sortOrder }],
          seatPhones: { ...bill.seatPhones, [id]: id },
        },
        activity: [
          activity(id, 'joined', `${name} се добави към сметката`),
          ...state.activity,
        ],
      }
    }
    case 'leaveSeat': {
      if (!state.guestSeatId) return state
      const seatPhones = { ...bill.seatPhones }
      for (const [seat, phone] of Object.entries(seatPhones)) {
        if (phone === state.guestSeatId) delete seatPhones[seat]
      }
      return {
        ...state,
        guestSeatId: null,
        coveredSeatIds: [],
        bill: { ...bill, seatPhones },
      }
    }
    case 'setCovered': {
      if (!state.guestSeatId) return state
      const seatPhones = { ...bill.seatPhones }
      for (const id of state.coveredSeatIds) delete seatPhones[id]
      for (const id of action.participantIds) seatPhones[id] = state.guestSeatId
      return {
        ...state,
        coveredSeatIds: action.participantIds,
        bill: { ...bill, seatPhones },
      }
    }
    case 'reportPaid': {
      const by = action.by ?? state.guestSeatId ?? action.participantIds[0]
      const pending = [
        ...bill.pending.filter(
          (p) => !action.participantIds.includes(p.participantId),
        ),
        ...action.participantIds.map((participantId) => ({
          participantId,
          amountCents: owedOf(bill, participantId),
          reportedAt: Date.now(),
          byParticipantId: by,
        })),
      ]
      const total = pending
        .filter((p) => action.participantIds.includes(p.participantId))
        .reduce((s, p) => s + p.amountCents, 0)
      return {
        ...state,
        bill: { ...bill, pending },
        activity: [
          activity(
            by,
            'paid',
            `${nameOf(bill, by)} преведе ${formatEur(total)}`,
          ),
          ...state.activity,
        ],
      }
    }
    case 'cancelReport':
      return {
        ...state,
        bill: {
          ...bill,
          pending: bill.pending.filter(
            (p) => !action.participantIds.includes(p.participantId),
          ),
        },
      }
    case 'confirmPayment': {
      const p = bill.pending.find(
        (x) => x.participantId === action.participantId,
      )
      if (!p) return state
      return {
        ...state,
        bill: {
          ...bill,
          pending: bill.pending.filter(
            (x) => x.participantId !== action.participantId,
          ),
          payments: [
            ...bill.payments,
            {
              participantId: p.participantId,
              amountCents: p.amountCents,
              paidAt: Date.now(),
            },
          ],
        },
        activity: [
          activity(
            HOST_ID,
            'confirmed',
            `Потвърдихте ${formatEur(p.amountCents)} от ${nameOf(bill, p.participantId)}`,
          ),
          ...state.activity,
        ],
      }
    }
    case 'markPaid': {
      const amount = action.amountCents ?? owedOf(bill, action.participantId)
      if (amount <= 0) return state
      return {
        ...state,
        bill: {
          ...bill,
          pending: bill.pending.filter(
            (x) => x.participantId !== action.participantId,
          ),
          payments: [
            ...bill.payments,
            {
              participantId: action.participantId,
              amountCents: amount,
              paidAt: Date.now(),
            },
          ],
        },
        activity: [
          activity(
            HOST_ID,
            'confirmed',
            `Отбелязахте ${formatEur(amount)} от ${nameOf(bill, action.participantId)}`,
          ),
          ...state.activity,
        ],
      }
    }
    case 'undoPayment':
      return {
        ...state,
        bill: {
          ...bill,
          payments: bill.payments.filter(
            (p) => p.participantId !== action.participantId,
          ),
        },
      }
    case 'finalize':
      return { ...state, bill: { ...bill, status: 'final' } }
    case 'reopen':
      return { ...state, bill: { ...bill, status: 'draft' } }
    case 'remoteJoin':
      return {
        ...state,
        bill: {
          ...bill,
          seatPhones: {
            ...bill.seatPhones,
            [action.participantId]: action.participantId,
          },
        },
        activity: [
          activity(
            action.participantId,
            'joined',
            `${nameOf(bill, action.participantId)} отвори линка`,
          ),
          ...state.activity,
        ],
      }
  }
}

/* ---------------------------------------------------------------- derived */

export interface SeatSummary {
  participantId: string
  name: string
  initial: string
  isHost: boolean
  /** Seat is locked to some phone (joined via link). */
  joined: boolean
  /** The phone handling this seat, if any. */
  phoneSeatId: string | null
  totals: ParticipantTotals
  /** Still to collect (0 for the host). */
  remainingCents: number
  pendingCents: number
  claimedUnits: number
}

export interface DerivedBill {
  bill: MockBill
  subtotalCents: number
  tipCents: number
  totals: BillTotals
  groups: ClaimGroup[]
  totalUnits: number
  claimedUnits: number
  unclaimedUnits: number
  /** Money on Units nobody has claimed yet. */
  unclaimedCents: number
  outstandingCents: number
  collectedCents: number
  pendingCents: number
  seats: SeatSummary[]
  guests: SeatSummary[]
  labels: Record<string, string>
  /** Everything claimed and every guest paid. */
  settled: boolean
  seatView: (groupKey: string, seatId: string) => ClaimGroupSeatView
  shareView: (participantId: string) => ParticipantShareView
  /** Members on a Unit, in seat order. */
  unitMembers: (unit: UnitRef) => string[]
}

function deriveBill(bill: MockBill): DerivedBill {
  const snapshot = snapshotOf(bill)
  const totals = calculateBillTotals(snapshot.calculationInput)
  const groups = groupsOf(bill)
  const subtotalCents = subtotalOf(bill)
  const tipCents = tipCentsOf(bill)
  const labels = Object.fromEntries(
    bill.participants.map((p) => [p._id, p.name]),
  )
  const participantsInput = snapshot.calculationInput.participants

  const membersByUnit = new Map<string, string[]>()
  for (const a of bill.assignments) {
    const key = unitKey(a)
    membersByUnit.set(key, [...(membersByUnit.get(key) ?? []), a.participantId])
  }
  const order = new Map(bill.participants.map((p) => [p._id, p.sortOrder]))
  const unitMembers = (unit: UnitRef) =>
    [...(membersByUnit.get(unitKey(unit)) ?? [])].sort(
      (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
    )

  let totalUnits = 0
  let claimedUnits = 0
  let unclaimedCents = 0
  for (const item of bill.items) {
    for (let u = 0; u < item.quantity; u++) {
      totalUnits += 1
      if (
        (membersByUnit.get(unitKey({ itemId: item._id, unitIndex: u })) ?? [])
          .length > 0
      ) {
        claimedUnits += 1
      } else {
        unclaimedCents += item.unitPriceCents
      }
    }
  }

  const seats: SeatSummary[] = bill.participants
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => {
      const isHost = p._id === bill.hostParticipantId
      const t = totals.byParticipant[p._id] ?? {
        owedCents: 0,
        paidCents: 0,
        balanceCents: 0,
        status: 'unpaid' as const,
      }
      const pending = bill.pending.find((x) => x.participantId === p._id)
      return {
        participantId: p._id,
        name: p.name,
        initial: p.name.trim().charAt(0).toUpperCase(),
        isHost,
        joined: isHost || p._id in bill.seatPhones,
        phoneSeatId: isHost ? p._id : (bill.seatPhones[p._id] ?? null),
        totals: t,
        remainingCents: isHost ? 0 : Math.max(0, t.owedCents - t.paidCents),
        pendingCents: pending?.amountCents ?? 0,
        claimedUnits: bill.assignments.filter((a) => a.participantId === p._id)
          .length,
      }
    })
  const guests = seats.filter((s) => !s.isHost)
  const outstandingCents = guests.reduce((s, g) => s + g.remainingCents, 0)
  const collectedCents = guests.reduce((s, g) => s + g.totals.paidCents, 0)
  const pendingCents = bill.pending.reduce((s, p) => s + p.amountCents, 0)

  return {
    bill,
    subtotalCents,
    tipCents,
    totals,
    groups,
    totalUnits,
    claimedUnits,
    unclaimedUnits: totalUnits - claimedUnits,
    unclaimedCents,
    outstandingCents,
    collectedCents,
    pendingCents,
    seats,
    guests,
    labels,
    settled:
      totalUnits > 0 && claimedUnits === totalUnits && outstandingCents === 0,
    seatView: (groupKey, seatId) => {
      const group = groups.find((g) => g.key === groupKey) ?? groups[0]
      return buildClaimGroupSeatView({
        group,
        assignments: bill.assignments,
        seatId,
        participants: participantsInput,
      })
    },
    shareView: (participantId) =>
      buildParticipantShareView({
        breakdownInput: snapshot.breakdownInput,
        totals: totals.byParticipant[participantId] ?? {
          owedCents: 0,
          paidCents: 0,
          balanceCents: 0,
          status: 'unpaid',
        },
        participantId,
        participantLabels: labels,
      }),
    unitMembers,
  }
}

/* ---------------------------------------------------------------- context */

export interface ProtoStore {
  state: ProtoState
  derived: DerivedBill
  dispatch: (action: Action) => void
  /** Seats the guest phone pays/claims for (own + covered). */
  mySeatIds: string[]
  /** Simulate OCR: 1.8 s scanning state, then items appear. */
  scanReceipt: () => void
}

const StoreContext = createContext<ProtoStore | null>(null)

export function MockBillProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const derived = useMemo(() => deriveBill(state.bill), [state.bill])
  const value = useMemo<ProtoStore>(
    () => ({
      state,
      derived,
      dispatch,
      mySeatIds: state.guestSeatId
        ? [state.guestSeatId, ...state.coveredSeatIds]
        : [],
      scanReceipt: () => {
        dispatch({ type: 'scanStart' })
        window.setTimeout(() => dispatch({ type: 'scanDone' }), 1800)
      },
    }),
    [state, derived],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useProto(): ProtoStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useProto must be used inside MockBillProvider')
  return store
}
