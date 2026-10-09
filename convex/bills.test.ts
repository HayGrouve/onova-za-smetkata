// @vitest-environment edge-runtime
import type { FunctionReturnType } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import { SUBSCRIPTION_MESSAGES } from '../shared/subscription-messages'
import { COMBINED_PAYMENT_MESSAGES } from '../shared/combined-payment-messages'
import {
  HOST_IDENTITY,
  hostTakesUnits,
  joinAsGuest,
  reserve,
  seedBill,
  setBillStatus,
  setupConvex,
} from './test.setup'
import type { SeededBill, TestConvex } from './test.setup'

const STRANGER = { subject: 'user_stranger' }

async function payEveryGuest(bill: SeededBill, amountCents: number) {
  for (const participantId of Object.values(bill.seats)) {
    await bill.host.mutation(api.payments.add, {
      billId: bill.billId,
      participantId,
      amountCents,
    })
  }
}

async function rowsOnBill(t: TestConvex, billId: SeededBill['billId']) {
  return await t.run(async (ctx) => {
    const count = async (rows: Promise<unknown[]>) => (await rows).length
    return {
      participants: await count(
        ctx.db
          .query('participants')
          .withIndex('by_billId', (q) => q.eq('billId', billId))
          .collect(),
      ),
      items: await count(
        ctx.db
          .query('items')
          .withIndex('by_billId', (q) => q.eq('billId', billId))
          .collect(),
      ),
      itemAssignments: await count(
        ctx.db
          .query('itemAssignments')
          .withIndex('by_billId', (q) => q.eq('billId', billId))
          .collect(),
      ),
      payments: await count(
        ctx.db
          .query('payments')
          .withIndex('by_billId', (q) => q.eq('billId', billId))
          .collect(),
      ),
      guestSessions: await count(
        ctx.db
          .query('guestSessions')
          .withIndex('by_billId', (q) => q.eq('billId', billId))
          .collect(),
      ),
      combinedPaymentRequests: await count(
        ctx.db
          .query('combinedPaymentRequests')
          .withIndex('by_billId_status', (q) => q.eq('billId', billId))
          .collect(),
      ),
    }
  })
}

describe('creating a bill', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('seats the Host under their Auth name and makes a share link', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: [] })

    const { bill: doc, participants } = await bill.host.query(api.bills.get, {
      billId: bill.billId,
    })
    expect(doc.status).toBe('draft')
    expect(doc.shareToken).toBeTruthy()
    expect(participants).toEqual([
      expect.objectContaining({
        _id: bill.hostSeat,
        name: HOST_IDENTITY.name,
      }),
    ])
  })

  it('a Free Host gets five bills a month', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    for (let index = 0; index < 5; index++) {
      await host.mutation(api.bills.create, {})
    }

    await expect(host.mutation(api.bills.create, {})).rejects.toMatchObject({
      data: {
        code: 'QUOTA_BILLS',
        message: SUBSCRIPTION_MESSAGES.QUOTA_BILLS,
      },
    })
  })

  it('bills started from Напътствия count against the same monthly quota', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const firstBillId = await host.mutation(
      api.hostOnboarding.createFirstBill,
      {},
    )
    for (let index = 0; index < 3; index++) {
      await host.mutation(api.bills.create, {})
    }
    await host.mutation(api.hostOnboarding.clearGuidedBill, {
      billId: firstBillId,
    })
    await host.mutation(api.hostOnboarding.startAnotherGuidedBill, {})

    const overQuota = { data: { code: 'QUOTA_BILLS' } }
    await expect(host.mutation(api.bills.create, {})).rejects.toMatchObject(
      overQuota,
    )
    const guided = await host.query(api.hostOnboarding.getForViewer, {})
    await host.mutation(api.hostOnboarding.clearGuidedBill, {
      billId: guided.guidedBillId!,
    })
    await expect(
      host.mutation(api.hostOnboarding.startAnotherGuidedBill, {}),
    ).rejects.toMatchObject(overQuota)
  })

  it('while Host Pro billing is off, a Host has no monthly cap', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    for (let index = 0; index < 5; index++) {
      await host.mutation(api.bills.create, {})
    }

    await expect(host.mutation(api.bills.create, {})).resolves.toBeTruthy()
  })
})

describe('editing seats and lines', () => {
  it('a seat or line added after a removal never shares a sort order', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      guests: ['Ани', 'Боби', 'Вики'],
      items: [
        { name: 'Бира', unitPriceCents: 300 },
        { name: 'Вода', unitPriceCents: 150 },
      ],
    })
    await bill.host.mutation(api.participants.remove, {
      participantId: bill.seats['Боби'],
    })
    await bill.host.mutation(api.items.remove, { itemId: bill.itemIds[0] })

    await bill.host.mutation(api.participants.add, {
      billId: bill.billId,
      name: 'Гошо',
    })
    await bill.host.mutation(api.items.add, {
      billId: bill.billId,
      name: 'Хляб',
      unitPriceCents: 200,
    })

    const { participants, items } = await bill.host.query(api.bills.get, {
      billId: bill.billId,
    })
    for (const rows of [participants, items]) {
      const orders = rows.map((row) => row.sortOrder)
      expect(new Set(orders).size).toBe(orders.length)
    }
  })
})

describe('a final bill is locked', () => {
  it('the Host cannot edit seats, lines or the split once it is final', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const { billId } = bill
    const [itemId] = bill.itemIds
    const groupId = await bill.host.mutation(api.friendGroups.create, {
      name: 'Колеги',
      memberNames: ['Вики'],
    })
    await setBillStatus(t, billId, 'final')

    for (const attempt of [
      () =>
        bill.host.mutation(api.items.add, {
          billId,
          name: 'Хляб',
          unitPriceCents: 200,
        }),
      () => bill.host.mutation(api.items.update, { itemId, unitPriceCents: 1 }),
      () => bill.host.mutation(api.items.remove, { itemId }),
      () => bill.host.mutation(api.participants.add, { billId, name: 'Вики' }),
      () =>
        bill.host.mutation(api.participants.remove, {
          participantId: bill.seats['Ани'],
        }),
      () => bill.host.mutation(api.friendGroups.addToBill, { billId, groupId }),
      () => bill.host.mutation(api.assignments.assignEven, { itemId }),
      () =>
        bill.host.mutation(api.assignments.assignAll, {
          billId,
          mode: 'all_items',
        }),
    ]) {
      await expect(attempt()).rejects.toThrow(
        GUEST_FLOW_MESSAGES.billFinalNoEdit,
      )
    }
    expect(await rowsOnBill(t, billId)).toMatchObject({
      participants: 3,
      items: 1,
    })
  })

  it('a stranger learns nothing about whether the bill is final', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await setBillStatus(t, bill.billId, 'final')
    const stranger = t.withIdentity(STRANGER)

    await expect(
      stranger.mutation(api.assignments.assignEven, {
        itemId: bill.itemIds[0],
      }),
    ).rejects.not.toThrow(GUEST_FLOW_MESSAGES.billFinalNoEdit)
    await expect(
      stranger.mutation(api.assignments.assignAll, {
        billId: bill.billId,
        mode: 'all_items',
      }),
    ).rejects.not.toThrow(GUEST_FLOW_MESSAGES.billFinalNoEdit)
  })
})

describe('finalizing', () => {
  it('waits for a restaurant, every Unit claimed and every Guest paid', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { restaurantName: '' })
    const finalize = () =>
      bill.host.mutation(api.bills.finalize, { billId: bill.billId })

    await expect(finalize()).rejects.toThrow('Въведете име на ресторант.')
    await bill.host.mutation(api.bills.update, {
      billId: bill.billId,
      restaurantName: 'Механа',
    })
    await expect(finalize()).rejects.toThrow('Има 1 неразпределен артикул.')
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    await expect(finalize()).rejects.toThrow(
      'Маркирайте всички участници като платили',
    )

    await payEveryGuest(bill, 300)
    await finalize()
    expect(await t.run((ctx) => ctx.db.get(bill.billId))).toMatchObject({
      status: 'final',
    })
  })

  it('waits for the Host to settle sent transfers and drops unsent ones', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      guests: ['Ани', 'Боби', 'Вики'],
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
    })
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    // Ани sent a transfer; the Host took cash from everyone instead.
    const sent = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [],
    })
    // Боби picked Вики to pay for but never opened Revolut.
    const unsent = await reserve(t, {
      billId: bill.billId,
      sessionToken: bobi.sessionToken,
      otherParticipantIds: [bill.seats['Вики']],
    })
    await payEveryGuest(bill, 300)
    const finalize = () =>
      bill.host.mutation(api.bills.finalize, { billId: bill.billId })

    await expect(finalize()).rejects.toThrow(
      COMBINED_PAYMENT_MESSAGES.transfersAwaitingHost,
    )
    await bill.host.mutation(api.combinedPayments.reject, {
      billId: bill.billId,
      requestId: sent.requestId,
    })
    await finalize()

    expect(await t.run((ctx) => ctx.db.get(unsent.requestId))).toMatchObject({
      status: 'cancelled',
    })
    expect(
      await bill.host.query(api.combinedPayments.listPendingForBill, {
        billId: bill.billId,
      }),
    ).toEqual([])
  })

  it('locks every edit and logs the Guests’ phones out', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    await payEveryGuest(bill, 300)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])

    await bill.host.mutation(api.bills.finalize, { billId: bill.billId })

    expect((await rowsOnBill(t, bill.billId)).guestSessions).toBe(0)
    const { billId, host } = bill
    const edits = [
      host.mutation(api.bills.update, { billId, restaurantName: 'Друго' }),
      host.mutation(api.bills.rotateShareToken, { billId }),
      host.mutation(api.items.add, {
        billId,
        name: 'Вода',
        unitPriceCents: 100,
      }),
      host.mutation(api.items.remove, { itemId: bill.itemIds[0] }),
      host.mutation(api.participants.add, { billId, name: 'Нов' }),
      host.mutation(api.participants.remove, {
        participantId: bill.seats['Ани'],
      }),
      host.mutation(api.payments.undoLast, {
        billId,
        participantId: bill.seats['Ани'],
      }),
      host.mutation(api.assignments.assignAll, { billId, mode: 'all_items' }),
      t.mutation(api.assignments.releaseUnit, {
        itemIds: bill.itemIds,
        ...ani,
      }),
    ]
    for (const edit of edits) {
      await expect(edit).rejects.toThrow(
        /Сметката е (приключена|завършена)|Сесията изтече/,
      )
    }
    expect(await rowsOnBill(t, bill.billId)).toMatchObject({
      participants: 3,
      items: 1,
      itemAssignments: 2,
      payments: 2,
    })
  })
})

describe('who can see and change a bill', () => {
  it('nobody but the owner reads, edits, finalizes or deletes it', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await seedBill(t, { hostIdentity: STRANGER })
    const { billId } = bill

    for (const caller of [t.withIdentity(STRANGER), t]) {
      await expect(caller.query(api.bills.get, { billId })).rejects.toThrow()
      for (const attempt of [
        caller.mutation(api.bills.update, { billId, restaurantName: 'Хак' }),
        caller.mutation(api.bills.finalize, { billId }),
        caller.mutation(api.bills.rotateShareToken, { billId }),
        caller.mutation(api.bills.remove, { billId }),
        caller.mutation(api.participants.add, { billId, name: 'Хак' }),
        caller.mutation(api.items.add, {
          billId,
          name: 'Хак',
          unitPriceCents: 1,
        }),
      ]) {
        await expect(attempt).rejects.toThrow()
      }
    }
    expect(await rowsOnBill(t, billId)).toMatchObject({
      participants: 3,
      items: 1,
    })
  })

  it('Guests need the share link and never see owner data', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)

    await expect(
      t.query(api.bills.getForGuest, {
        billId: bill.billId,
        shareToken: 'guessed',
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.invalidShareLink)

    const view = await t.query(api.bills.getForGuest, {
      billId: bill.billId,
      shareToken: bill.shareToken,
    })
    expect(view.bill).not.toHaveProperty('ownerId')
    expect(view.bill).not.toHaveProperty('shareToken')
    expect(view.bill).not.toHaveProperty('receiptStorageId')
    expect(view.myPayments).toEqual([])
  })

  it('a Guest phone sees every seat’s money but only its own sent transfer', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби', 'Вики'] })
    const [itemId] = bill.itemIds
    await bill.host.mutation(api.items.update, { itemId, quantity: 3 })
    await hostTakesUnits(bill, itemId, Object.values(bill.seats))
    await bill.host.mutation(api.payments.add, {
      billId: bill.billId,
      participantId: bill.seats['Вики'],
      amountCents: 300,
    })
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    const sent = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: bobi.sessionToken,
      otherParticipantIds: [],
    })
    const moneyAsSeenBy = async (sessionToken: string) =>
      Object.fromEntries(
        (
          await t.query(api.bills.getForGuest, {
            billId: bill.billId,
            shareToken: bill.shareToken,
            sessionToken,
          })
        ).participantBalances.map((row) => [
          row.participantId,
          {
            owedCents: row.owedCents,
            remainingCents: row.remainingCents,
            sent: row.sent,
          },
        ]),
      )

    const onAnisPhone = await moneyAsSeenBy(ani.sessionToken)
    expect(onAnisPhone[bill.seats['Ани']]).toEqual({
      owedCents: 300,
      remainingCents: 300,
      sent: null,
    })
    expect(onAnisPhone[bill.seats['Боби']].sent).toBeNull()
    expect(onAnisPhone[bill.seats['Вики']]).toMatchObject({
      owedCents: 300,
      remainingCents: 0,
    })
    expect(
      (await moneyAsSeenBy(bobi.sessionToken))[bill.seats['Боби']].sent,
    ).toEqual({
      requestId: sent.requestId,
      totalCents: 300,
      payerId: bill.seats['Боби'],
    })
  })
})

describe('deleting a bill', () => {
  it('removes everything on it', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    await bill.host.mutation(api.payments.add, {
      billId: bill.billId,
      participantId: bill.seats['Ани'],
      amountCents: 300,
    })
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: bobi.sessionToken,
      otherParticipantIds: [],
    })

    await bill.host.mutation(api.bills.remove, { billId: bill.billId })

    expect(await t.run((ctx) => ctx.db.get(bill.billId))).toBeNull()
    expect(await rowsOnBill(t, bill.billId)).toEqual({
      participants: 0,
      items: 0,
      itemAssignments: 0,
      payments: 0,
      guestSessions: 0,
      combinedPaymentRequests: 0,
    })
  })
})

describe("a bill's receipt photo", () => {
  const MINUTE_MS = 60 * 1000

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  async function storePhoto(t: TestConvex) {
    return await t.run((ctx) =>
      ctx.storage.store(new Blob(['receipt'], { type: 'image/jpeg' })),
    )
  }

  async function photoExists(t: TestConvex, storageId: Id<'_storage'>) {
    return await t.run(
      async (ctx) => (await ctx.db.system.get('_storage', storageId)) !== null,
    )
  }

  async function receiptOf(t: TestConvex, billId: Id<'bills'>) {
    return await t.run(
      async (ctx) => (await ctx.db.get(billId))?.receiptStorageId ?? null,
    )
  }

  it('is a fresh upload, kept when the bill is saved with it again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const billId = await host.mutation(api.bills.create, {})
    const photo = await storePhoto(t)
    await host.mutation(api.bills.update, { billId, receiptStorageId: photo })

    // Saving the bill later with its own photo is no new upload.
    vi.setSystemTime(Date.now() + 60 * MINUTE_MS)
    await host.mutation(api.bills.update, {
      billId,
      restaurantName: 'Механа',
      receiptStorageId: photo,
    })

    expect(await receiptOf(t, billId)).toBe(photo)
    expect(await photoExists(t, photo)).toBe(true)
  })

  it('is never a photo another bill holds', async () => {
    const t = setupConvex()
    const owner = t.withIdentity(HOST_IDENTITY)
    const ownersBill = await owner.mutation(api.bills.create, {})
    const photo = await storePhoto(t)
    await owner.mutation(api.bills.update, {
      billId: ownersBill,
      receiptStorageId: photo,
    })

    const stranger = t.withIdentity(STRANGER)
    const strangersBill = await stranger.mutation(api.bills.create, {})
    await expect(
      stranger.mutation(api.bills.update, {
        billId: strangersBill,
        receiptStorageId: photo,
      }),
    ).rejects.toThrow()

    // Deleting the stranger's bill must not take the owner's photo with it.
    await stranger.mutation(api.bills.remove, { billId: strangersBill })
    expect(await receiptOf(t, ownersBill)).toBe(photo)
    expect(await photoExists(t, photo)).toBe(true)
  })

  it('is never a photo a quick scan is reading', async () => {
    // The scheduled read must not run (and delete the photo) mid-test.
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.useFakeTimers()
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const photo = await storePhoto(t)
    const started = await host.mutation(api.quickScan.start, {
      storageId: photo,
    })
    expect(started.ok).toBe(true)

    const billId = await host.mutation(api.bills.create, {})
    await expect(
      host.mutation(api.bills.update, { billId, receiptStorageId: photo }),
    ).rejects.toThrow()
    expect(await receiptOf(t, billId)).toBeNull()
  })

  it('is never an old upload or a missing one, and a refusal keeps the current photo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const billId = await host.mutation(api.bills.create, {})
    const current = await storePhoto(t)
    await host.mutation(api.bills.update, { billId, receiptStorageId: current })

    const old = await storePhoto(t)
    vi.setSystemTime(Date.now() + 11 * MINUTE_MS)
    await expect(
      host.mutation(api.bills.update, { billId, receiptStorageId: old }),
    ).rejects.toThrow()
    expect(await photoExists(t, old)).toBe(true)

    const gone = await storePhoto(t)
    await t.run((ctx) => ctx.storage.delete(gone))
    await expect(
      host.mutation(api.bills.update, { billId, receiptStorageId: gone }),
    ).rejects.toThrow()

    expect(await receiptOf(t, billId)).toBe(current)
    expect(await photoExists(t, current)).toBe(true)
  })
})

describe('searching the bill archive', () => {
  it('finds an older bill on the first page, past twenty newer ones', async () => {
    const t = setupConvex()
    const old = await seedBill(t, {
      restaurantName: 'Механа Старата',
      guests: [],
    })
    for (let i = 0; i < 25; i++) {
      await old.host.mutation(api.bills.create, {})
    }

    const firstPage = await old.host.query(api.bills.listWithSummary, {
      paginationOpts: { numItems: 20, cursor: null },
      search: 'механа',
    })

    expect(firstPage.page.map((row) => row.bill._id)).toEqual([old.billId])
    expect(firstPage.isDone).toBe(true)
  })

  it('pages through matches without skipping or repeating any', async () => {
    const t = setupConvex()
    const first = await seedBill(t, { restaurantName: 'Кафе 0', guests: [] })
    const ids = [first.billId]
    for (let i = 1; i < 5; i++) {
      const billId = await first.host.mutation(api.bills.create, {})
      await first.host.mutation(api.bills.update, {
        billId,
        restaurantName: `Кафе ${i}`,
      })
      await first.host.mutation(api.bills.create, {})
      ids.push(billId)
    }

    const seen: string[] = []
    let cursor: string | null = null
    for (let pages = 0; pages < 10; pages++) {
      const result: FunctionReturnType<typeof api.bills.listWithSummary> =
        await first.host.query(api.bills.listWithSummary, {
          paginationOpts: { numItems: 2, cursor },
          search: 'кафе',
        })
      seen.push(...result.page.map((row) => row.bill._id))
      if (result.isDone) break
      cursor = result.continueCursor
    }

    expect(seen).toEqual([...ids].reverse())
  })
})

describe('touching the bill after an edit', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const billRow = (t: TestConvex, billId: SeededBill['billId']) =>
    t.run((ctx) => ctx.db.get(billId))

  it('an edit that moves no totals leaves the bill row alone for a minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t)
    const [itemId] = bill.itemIds
    const before = await billRow(t, bill.billId)

    vi.setSystemTime(Date.now() + 10_000)
    await bill.host.mutation(api.items.update, { itemId, name: 'Наливна' })
    await bill.host.mutation(api.items.update, { itemId, name: 'Наливна' })
    expect(await billRow(t, bill.billId)).toEqual(before)

    // Past the debounce window the same kind of edit bumps the bill again.
    vi.setSystemTime(Date.now() + 61_000)
    await bill.host.mutation(api.items.update, { itemId, name: 'Бира' })
    expect((await billRow(t, bill.billId))?.updatedAt).toBe(Date.now())
  })

  it('an edit that changes the stored summary always writes it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t)

    vi.setSystemTime(Date.now() + 1_000)
    await hostTakesUnits(bill, bill.itemIds[0], [bill.seats['Ани']])
    const afterTake = await billRow(t, bill.billId)
    expect(afterTake?.updatedAt).toBe(Date.now())

    vi.setSystemTime(Date.now() + 1_000)
    await bill.host.mutation(api.participants.add, {
      billId: bill.billId,
      name: 'Вики',
    })
    const afterAdd = await billRow(t, bill.billId)
    expect(afterAdd?.listParticipantNames).toContain('Вики')
    expect(afterAdd?.updatedAt).toBe(Date.now())
    expect(afterAdd?.listGuestBalances).not.toEqual(
      afterTake?.listGuestBalances,
    )
  })
})
