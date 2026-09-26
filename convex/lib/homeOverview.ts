import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import {
  aggregateDebtors,
  countPaidGuests,
  deriveBillNextAction,
  describeMissingForBill,
  toGuestBalance,
} from '../../shared/bill-collection'
import type { DebtorBillInput } from '../../shared/bill-collection'
import type { BillStepNumber } from '../../shared/bill-step-completion'
import type { BillListSummaryFields } from './billListSummary'

/** Most recent drafts considered by `bills.homeOverview`. */
export const HOME_OVERVIEW_DRAFT_LIMIT = 50

const debtorBillValidator = v.object({
  billId: v.id('bills'),
  restaurantName: v.string(),
  date: v.number(),
  outstandingCents: v.number(),
  shareToken: v.optional(v.string()),
})

const stepValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
)

export const homeOverviewValidator = v.object({
  owedCents: v.number(),
  collectedCents: v.number(),
  owingBillCount: v.number(),
  debtors: v.array(
    v.object({
      key: v.string(),
      name: v.string(),
      outstandingCents: v.number(),
      bills: v.array(debtorBillValidator),
    }),
  ),
  openBills: v.array(
    v.object({
      billId: v.id('bills'),
      restaurantName: v.string(),
      date: v.number(),
      updatedAt: v.number(),
      billTotalCents: v.number(),
      outstandingCents: v.number(),
      collectedCents: v.number(),
      guestCount: v.number(),
      /** Guests with a positive Share — the denominator for „N от M платили“. */
      owingGuestCount: v.number(),
      paidGuestCount: v.number(),
      nextAction: v.union(
        v.literal('finish'),
        v.literal('collect'),
        v.literal('close'),
      ),
      firstIncompleteStep: stepValidator,
      missing: v.union(v.string(), v.null()),
      shareToken: v.optional(v.string()),
    }),
  ),
  truncated: v.boolean(),
})

export type HomeOverview = Infer<typeof homeOverviewValidator>

type StoredCollectionSummary = Pick<
  BillListSummaryFields,
  | 'listBillTotalCents'
  | 'listOutstandingCents'
  | 'listCollectedCents'
  | 'listGuestBalances'
  | 'listPrepared'
  | 'listFirstIncompleteStep'
  | 'listUnassignedItemCount'
  | 'listHasPricedItems'
>

/** Stored collection fields, or null when the bill predates them (needs backfill). */
export function readStoredCollectionSummary(
  bill: Doc<'bills'>,
): StoredCollectionSummary | null {
  if (
    bill.listPrepared === undefined ||
    bill.listOutstandingCents === undefined ||
    bill.listCollectedCents === undefined ||
    bill.listGuestBalances === undefined ||
    bill.listFirstIncompleteStep === undefined ||
    bill.listUnassignedItemCount === undefined ||
    bill.listHasPricedItems === undefined
  ) {
    return null
  }
  return {
    listBillTotalCents: bill.listBillTotalCents ?? 0,
    listOutstandingCents: bill.listOutstandingCents,
    listCollectedCents: bill.listCollectedCents,
    listGuestBalances: bill.listGuestBalances,
    listPrepared: bill.listPrepared,
    listFirstIncompleteStep: bill.listFirstIncompleteStep,
    listUnassignedItemCount: bill.listUnassignedItemCount,
    listHasPricedItems: bill.listHasPricedItems,
  }
}

function toStepNumber(step: number): BillStepNumber {
  return step === 1 || step === 2 || step === 3 ? step : 4
}

export interface HomeOverviewDraft {
  bill: Pick<
    Doc<'bills'>,
    '_id' | 'restaurantName' | 'date' | 'updatedAt' | 'shareToken'
  >
  summary: StoredCollectionSummary
}

/** Drafts must be ordered most recently updated first. */
export function buildHomeOverview(
  drafts: HomeOverviewDraft[],
  truncated: boolean,
): HomeOverview {
  let owedCents = 0
  let collectedCents = 0
  let owingBillCount = 0
  const owingBills: DebtorBillInput<Id<'bills'>>[] = []

  const openBills = drafts.map(({ bill, summary }) => {
    const guestBalances = summary.listGuestBalances.map(toGuestBalance)
    const nextAction = deriveBillNextAction({
      status: 'draft',
      prepared: summary.listPrepared,
      outstandingCents: summary.listOutstandingCents,
    })

    if (nextAction === 'collect') {
      owedCents += summary.listOutstandingCents
      owingBillCount++
      owingBills.push({
        billId: bill._id,
        restaurantName: bill.restaurantName,
        date: bill.date,
        shareToken: bill.shareToken,
        guestBalances,
      })
    }
    if (nextAction === 'collect' || nextAction === 'close') {
      collectedCents += summary.listCollectedCents
    }

    return {
      billId: bill._id,
      restaurantName: bill.restaurantName,
      date: bill.date,
      updatedAt: bill.updatedAt,
      billTotalCents: summary.listBillTotalCents,
      outstandingCents: summary.listOutstandingCents,
      collectedCents: summary.listCollectedCents,
      guestCount: guestBalances.length,
      owingGuestCount: guestBalances.filter((b) => b.owedCents > 0).length,
      paidGuestCount: countPaidGuests(guestBalances),
      nextAction,
      firstIncompleteStep: toStepNumber(summary.listFirstIncompleteStep),
      missing:
        nextAction === 'finish'
          ? describeMissingForBill({
              restaurantName: bill.restaurantName,
              guestCount: guestBalances.length,
              hasPricedItems: summary.listHasPricedItems,
              unassignedItemCount: summary.listUnassignedItemCount,
            })
          : null,
      ...(bill.shareToken !== undefined ? { shareToken: bill.shareToken } : {}),
    }
  })

  return {
    owedCents,
    collectedCents,
    owingBillCount,
    debtors: aggregateDebtors(owingBills),
    openBills,
    truncated,
  }
}
