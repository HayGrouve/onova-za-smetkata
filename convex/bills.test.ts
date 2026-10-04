// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import { SUBSCRIPTION_MESSAGES } from '../shared/subscription-messages'
import { COMBINED_PAYMENT_MESSAGES } from '../shared/combined-payment-messages'
import {
  HOST_IDENTITY,
  hostTakesUnits,
  joinAsGuest,
  seedBill,
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
    const sent = await t.mutation(api.combinedPayments.createSolo, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: ani.sessionToken,
    })
    // Боби picked Вики to pay for but never opened Revolut.
    const unsent = await t.mutation(api.combinedPayments.create, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: bobi.sessionToken,
      coveredParticipantIds: [bill.seats['Вики']],
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
    await t.mutation(api.combinedPayments.createSolo, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: bobi.sessionToken,
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
