import { useInView, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ClaimLine } from '#/components/receipt/claim-line.tsx'
import {
  Perforation,
  Receipt,
  ReceiptHeader,
  ReceiptTotals,
  RestaurantTitle,
  Rule,
} from '#/components/receipt/paper.tsx'
import {
  SeatAvatar,
  SeatsProvider,
  useSeatLookup,
} from '#/components/receipt/seats.tsx'
import { Stamp } from '#/components/receipt/stamp.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { groupClaimItems, unitKey } from '../../../shared/claim-groups.ts'
import type { UnitRef } from '../../../shared/claim-groups.ts'

/**
 * A made-up table, printed once. The numbers add up (items 35,70 €, tip 10%,
 * slips 17,38 + 11,33 + 10,56 = 39,27 €) but belong to no real bill.
 */
const PARTICIPANTS = [
  { _id: 'desi', name: 'Деси', sortOrder: 0 },
  { _id: 'niki', name: 'Ники', sortOrder: 1 },
  { _id: 'maria', name: 'Мария', sortOrder: 2 },
]

const ITEMS = [
  { id: 'salad', name: 'Шопска салата', unitPriceCents: 780, quantity: 1 },
  { id: 'chicken', name: 'Пилешка пържола', unitPriceCents: 1190, quantity: 1 },
  { id: 'beer', name: 'Бира 0,5 л', unitPriceCents: 320, quantity: 3 },
  { id: 'dessert', name: 'Тирамису', unitPriceCents: 640, quantity: 1 },
].map((item, sortOrder) => ({ ...item, sortOrder }))

const GROUPS = groupClaimItems(ITEMS)

const SUBTOTAL_CENTS = ITEMS.reduce(
  (sum, item) => sum + item.unitPriceCents * item.quantity,
  0,
)
const TIP_CENTS = Math.round(SUBTOTAL_CENTS * 0.1)

/** Who takes what, in the order the phones tap. */
const CLAIM_SCRIPT: Array<
  [itemId: string, unitIndex: number, seats: string[]]
> = [
  ['salad', 0, ['desi']],
  ['chicken', 0, ['desi']],
  ['beer', 0, ['niki']],
  ['beer', 1, ['niki']],
  ['salad', 0, ['desi', 'niki']],
  ['beer', 2, ['maria']],
  ['dessert', 0, ['maria']],
]

const STEP_MS = 800
const PAID_STEP = CLAIM_SCRIPT.length
const WAITING_STEP = PAID_STEP + 1

const DEMO_DATE = Date.UTC(2026, 9, 9, 17, 14)

const SLIPS = [
  { seatId: 'niki', cents: 1133, paidAt: PAID_STEP },
  { seatId: 'maria', cents: 1056, paidAt: WAITING_STEP },
] as const

/**
 * The product in one object: a Live receipt on which three phones take their
 * Units one after another, then two slips get their stamps. It plays once
 * when scrolled into view; reduced motion shows the finished receipt.
 */
export function LiveReceiptDemo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reduceMotion) {
      setStep(WAITING_STEP)
      return
    }
    if (!inView) return
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= WAITING_STEP) window.clearInterval(timer)
        return Math.min(current + 1, WAITING_STEP)
      })
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [inView, reduceMotion])

  const membersByUnit = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [itemId, unitIndex, seats] of CLAIM_SCRIPT.slice(0, step)) {
      map.set(unitKey({ itemId, unitIndex }), seats)
    }
    return map
  }, [step])

  const membersOf = (unit: UnitRef) => membersByUnit.get(unitKey(unit)) ?? []

  return (
    <div ref={ref} className={className} aria-hidden inert>
      <SeatsProvider participants={PARTICIPANTS} hostParticipantId="desi">
        <DemoPaper membersOf={membersOf} step={step} />
      </SeatsProvider>
    </div>
  )
}

function DemoPaper({
  membersOf,
  step,
}: {
  membersOf: (unit: UnitRef) => string[]
  step: number
}) {
  return (
    <Receipt
      innerClassName="sm:px-6"
      footer={
        <div className="slip px-4 pb-3 sm:px-6">
          <Perforation className="-mx-4 sm:-mx-6" />
          <ul className="divide-y divide-dashed divide-rule">
            {SLIPS.map((slip) => (
              <DemoSlip
                key={slip.seatId}
                seatId={slip.seatId}
                cents={slip.cents}
                stamped={step >= slip.paidAt}
                paid={slip.paidAt === PAID_STEP}
              />
            ))}
          </ul>
        </div>
      }
    >
      <ReceiptHeader
        date={DEMO_DATE}
        right="Маса 7"
        title={<RestaurantTitle as="p" name="Механа Чубрица" />}
      />
      <Rule />
      <ul className="text-[13px]">
        {GROUPS.map((group) => (
          <ClaimLine
            key={group.key}
            group={group}
            membersOf={membersOf}
            mode="readonly"
          />
        ))}
      </ul>
      <Rule />
      <ReceiptTotals subtotalCents={SUBTOTAL_CENTS} tipCents={TIP_CENTS} />
    </Receipt>
  )
}

function DemoSlip({
  seatId,
  cents,
  stamped,
  paid,
}: {
  seatId: string
  cents: number
  stamped: boolean
  paid: boolean
}) {
  const seat = useSeatLookup()(seatId)
  if (!seat) return null
  return (
    <li className="flex min-h-[64px] items-center gap-3 py-2">
      <SeatAvatar seat={seat} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{seat.label}</span>
        <span className="block text-[11px] text-ink-muted">дял</span>
      </span>
      <span className="flex min-w-[88px] items-center justify-end">
        {stamped ? (
          <Stamp
            kind={paid ? 'paid' : 'wait'}
            className="text-[10px] sm:text-[11px]"
          >
            {paid ? 'Платено' : 'Чака'}
          </Stamp>
        ) : null}
      </span>
      <span className="money w-[72px] text-right text-[14px]">
        {formatEur(cents)}
      </span>
    </li>
  )
}
