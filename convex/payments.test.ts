// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import {
  hostTakesUnits,
  paymentsFor,
  seedBill,
  setBillStatus,
  setupConvex,
} from './test.setup'
import type { TestConvex } from './test.setup'

afterEach(() => {
  vi.useRealTimers()
})

/** Ани and Боби each have one €3 Бира. */
async function seedClaimedBill(t: TestConvex) {
  const bill = await seedBill(t)
  await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
  return bill
}

describe('the Host recording payments', () => {
  it('a payment lowers what is Outstanding on the home list', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)

    await bill.host.mutation(api.payments.add, {
      billId: bill.billId,
      participantId: bill.seats['Ани'],
      amountCents: 300,
    })

    expect(await t.run((ctx) => ctx.db.get(bill.billId))).toMatchObject({
      listBillTotalCents: 600,
      listOutstandingCents: 300,
      listCollectedCents: 300,
    })
  })

  it('cannot record more than the Share or mark the Host seat', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const add = (participantId: typeof bill.hostSeat, amountCents: number) =>
      bill.host.mutation(api.payments.add, {
        billId: bill.billId,
        participantId,
        amountCents,
      })

    await add(bill.seats['Ани'], 200)
    await expect(add(bill.seats['Ани'], 200)).rejects.toThrow(
      'Сумата надвишава дължимото.',
    )
    await expect(add(bill.hostSeat, 100)).rejects.toThrow(
      'Домакинът не се маркира като платил.',
    )
  })

  it('undo removes only the latest payment', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    for (const amountCents of [100, 150]) {
      await bill.host.mutation(api.payments.add, {
        billId: bill.billId,
        participantId: bill.seats['Ани'],
        amountCents,
      })
      vi.setSystemTime(Date.now() + 1_000)
    }

    await bill.host.mutation(api.payments.undoLast, {
      billId: bill.billId,
      participantId: bill.seats['Ани'],
    })

    expect(await paymentsFor(t, bill.seats['Ани'])).toEqual([
      expect.objectContaining({ amountCents: 100 }),
    ])
  })

  it('undo picks the newest payment even when two share a timestamp', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    for (const amountCents of [100, 150]) {
      await bill.host.mutation(api.payments.add, {
        billId: bill.billId,
        participantId: bill.seats['Ани'],
        amountCents,
      })
    }

    await bill.host.mutation(api.payments.undoLast, {
      billId: bill.billId,
      participantId: bill.seats['Ани'],
    })

    expect(await paymentsFor(t, bill.seats['Ани'])).toEqual([
      expect.objectContaining({ amountCents: 100 }),
    ])
  })

  it('only the owner records payments, and only on a draft bill', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    await seedBill(t, { hostIdentity: { subject: 'user_stranger' } })
    const args = {
      billId: bill.billId,
      participantId: bill.seats['Ани'],
      amountCents: 300,
    }

    await expect(
      t
        .withIdentity({ subject: 'user_stranger' })
        .mutation(api.payments.add, args),
    ).rejects.toThrow()
    await expect(t.mutation(api.payments.add, args)).rejects.toThrow(
      'Изисква се вход',
    )

    await setBillStatus(t, bill.billId, 'final')
    await expect(bill.host.mutation(api.payments.add, args)).rejects.toThrow(
      GUEST_FLOW_MESSAGES.billFinalNoEdit,
    )
    expect(await paymentsFor(t, bill.seats['Ани'])).toEqual([])
  })
})
