import { describe, expect, it } from 'vitest'
import { buildHomeOverview, readStoredCollectionSummary } from './homeOverview'
import type { HomeOverviewDraft } from './homeOverview'

type Summary = HomeOverviewDraft['summary']

function draft(
  id: string,
  summary: Partial<Summary>,
  bill: Partial<HomeOverviewDraft['bill']> = {},
): HomeOverviewDraft {
  return {
    bill: {
      _id: id as never,
      restaurantName: 'Механа',
      date: 100,
      updatedAt: 200,
      ...bill,
    },
    summary: {
      listBillTotalCents: 0,
      listOutstandingCents: 0,
      listCollectedCents: 0,
      listGuestBalances: [],
      listPrepared: false,
      listFirstIncompleteStep: 1,
      listUnassignedItemCount: 0,
      listHasPricedItems: false,
      ...summary,
    },
  }
}

const owing = draft(
  'b1',
  {
    listBillTotalCents: 3000,
    listOutstandingCents: 1500,
    listCollectedCents: 500,
    listGuestBalances: [
      {
        participantId: 'p1' as never,
        name: 'Иван',
        owedCents: 1000,
        paidCents: 0,
      },
      {
        participantId: 'p2' as never,
        name: 'Мария',
        owedCents: 1000,
        paidCents: 500,
      },
    ],
    listPrepared: true,
    listFirstIncompleteStep: 4,
    listHasPricedItems: true,
  },
  { shareToken: 'tok' },
)

const settled = draft('b2', {
  listBillTotalCents: 2000,
  listOutstandingCents: 0,
  listCollectedCents: 1000,
  listGuestBalances: [
    {
      participantId: 'p3' as never,
      name: 'Иван',
      owedCents: 1000,
      paidCents: 1000,
    },
  ],
  listPrepared: true,
  listFirstIncompleteStep: 4,
  listHasPricedItems: true,
})

const unfinished = draft('b3', {
  listOutstandingCents: 800,
  listCollectedCents: 200,
  listGuestBalances: [
    {
      participantId: 'p4' as never,
      name: 'иван',
      owedCents: 1000,
      paidCents: 200,
    },
  ],
  listFirstIncompleteStep: 3,
  listUnassignedItemCount: 2,
  listHasPricedItems: true,
})

describe('buildHomeOverview', () => {
  it('returns an empty overview for no drafts', () => {
    expect(buildHomeOverview([], false)).toEqual({
      owedCents: 0,
      collectedCents: 0,
      owingBillCount: 0,
      debtors: [],
      openBills: [],
      truncated: false,
    })
  })

  it('sums owed over collect bills and collected over collect + close', () => {
    const overview = buildHomeOverview([owing, settled, unfinished], true)

    expect(overview.owedCents).toBe(1500)
    expect(overview.collectedCents).toBe(1500)
    expect(overview.owingBillCount).toBe(1)
    expect(overview.truncated).toBe(true)
  })

  it('lists debtors only from collect bills', () => {
    const overview = buildHomeOverview([owing, settled, unfinished], false)

    expect(overview.debtors).toEqual([
      {
        key: 'иван',
        name: 'Иван',
        outstandingCents: 1000,
        bills: [
          {
            billId: 'b1',
            restaurantName: 'Механа',
            date: 100,
            outstandingCents: 1000,
            shareToken: 'tok',
          },
        ],
      },
      {
        key: 'мария',
        name: 'Мария',
        outstandingCents: 500,
        bills: [
          {
            billId: 'b1',
            restaurantName: 'Механа',
            date: 100,
            outstandingCents: 500,
            shareToken: 'tok',
          },
        ],
      },
    ])
  })

  it('maps each draft to an open bill with next action, keeping order', () => {
    const overview = buildHomeOverview([owing, settled, unfinished], false)

    expect(overview.openBills).toEqual([
      {
        billId: 'b1',
        restaurantName: 'Механа',
        date: 100,
        updatedAt: 200,
        billTotalCents: 3000,
        outstandingCents: 1500,
        collectedCents: 500,
        guestCount: 2,
        owingGuestCount: 2,
        paidGuestCount: 0,
        nextAction: 'collect',
        firstIncompleteStep: 4,
        missing: null,
        shareToken: 'tok',
      },
      {
        billId: 'b2',
        restaurantName: 'Механа',
        date: 100,
        updatedAt: 200,
        billTotalCents: 2000,
        outstandingCents: 0,
        collectedCents: 1000,
        guestCount: 1,
        owingGuestCount: 1,
        paidGuestCount: 1,
        nextAction: 'close',
        firstIncompleteStep: 4,
        missing: null,
      },
      {
        billId: 'b3',
        restaurantName: 'Механа',
        date: 100,
        updatedAt: 200,
        billTotalCents: 0,
        outstandingCents: 800,
        collectedCents: 200,
        guestCount: 1,
        owingGuestCount: 1,
        paidGuestCount: 0,
        nextAction: 'finish',
        firstIncompleteStep: 3,
        missing: '2 неразпределени',
      },
    ])
  })

  it('counts only Guests with a Share in the paid denominator', () => {
    const hostCovered = draft('b5', {
      listGuestBalances: [
        {
          participantId: 'p5' as never,
          name: 'Ани',
          owedCents: 0,
          paidCents: 0,
        },
        {
          participantId: 'p6' as never,
          name: 'Боби',
          owedCents: 0,
          paidCents: 0,
        },
      ],
      listPrepared: true,
      listFirstIncompleteStep: 4,
      listHasPricedItems: true,
    })

    expect(buildHomeOverview([hostCovered], false).openBills[0]).toMatchObject({
      nextAction: 'close',
      guestCount: 2,
      owingGuestCount: 0,
      paidGuestCount: 0,
    })
  })

  it('hints the missing restaurant on an empty draft', () => {
    const overview = buildHomeOverview(
      [draft('b4', {}, { restaurantName: '' })],
      false,
    )

    expect(overview.openBills[0]).toMatchObject({
      nextAction: 'finish',
      firstIncompleteStep: 1,
      missing: 'Липсва ресторант',
    })
  })
})

describe('readStoredCollectionSummary', () => {
  it('returns null for bills written before the collection fields', () => {
    expect(
      readStoredCollectionSummary({
        listBillTotalCents: 1000,
        listParticipantNames: [],
      } as never),
    ).toBeNull()
  })

  it('reads stored fields', () => {
    expect(
      readStoredCollectionSummary({
        listBillTotalCents: 1000,
        listOutstandingCents: 0,
        listCollectedCents: 0,
        listGuestBalances: [],
        listPrepared: false,
        listFirstIncompleteStep: 1,
        listUnassignedItemCount: 0,
        listHasPricedItems: false,
      } as never),
    ).toEqual({
      listBillTotalCents: 1000,
      listOutstandingCents: 0,
      listCollectedCents: 0,
      listGuestBalances: [],
      listPrepared: false,
      listFirstIncompleteStep: 1,
      listUnassignedItemCount: 0,
      listHasPricedItems: false,
    })
  })
})
