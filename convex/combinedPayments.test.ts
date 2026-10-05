// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import { COMBINED_PAYMENT_MESSAGES } from '../shared/combined-payment-messages'
import {
  hostTakesUnits,
  joinAsGuest,
  paymentsFor,
  reserve,
  seedBill,
  setupConvex,
} from './test.setup'
import type { TestConvex } from './test.setup'

/** Ани, Боби and Вики each have one €3 Бира. */
async function seedClaimedBill(t: TestConvex) {
  const bill = await seedBill(t, {
    guests: ['Ани', 'Боби', 'Вики'],
    items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
  })
  await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
  return bill
}

describe('a Guest paying their own Share', () => {
  it('shows up for the Host right away and is recorded on confirm', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])

    const { requestId, totalCents } = await t.mutation(
      api.combinedPayments.recordTransfer,
      {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [],
      },
    )
    expect(totalCents).toBe(300)
    expect(
      await bill.host.query(api.combinedPayments.listPendingForBill, {
        billId: bill.billId,
      }),
    ).toEqual([expect.objectContaining({ _id: requestId })])

    await bill.host.mutation(api.combinedPayments.confirm, {
      billId: bill.billId,
      requestId,
    })

    expect(await paymentsFor(t, bill.seats['Ани'])).toEqual([
      expect.objectContaining({ amountCents: 300 }),
    ])
    expect(
      await bill.host.query(api.combinedPayments.listPendingForBill, {
        billId: bill.billId,
      }),
    ).toEqual([])
  })

  it('a Guest with nothing left to pay cannot start a payment', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    await bill.host.mutation(api.payments.add, {
      billId: bill.billId,
      participantId: bill.seats['Ани'],
      amountCents: 300,
    })
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])

    await expect(
      t.mutation(api.combinedPayments.recordTransfer, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [],
      }),
    ).rejects.toThrow(COMBINED_PAYMENT_MESSAGES.payerNothingOwed)
  })
})

describe('paying for others', () => {
  it('stays hidden until Revolut opens, then pays every seat on confirm', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const pending = () =>
      bill.host.query(api.combinedPayments.listPendingForBill, {
        billId: bill.billId,
      })

    const { requestId, totalCents } = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    expect(totalCents).toBe(600)
    expect(await pending()).toEqual([])
    await expect(
      bill.host.mutation(api.combinedPayments.confirm, {
        billId: bill.billId,
        requestId,
      }),
    ).rejects.toThrow(COMBINED_PAYMENT_MESSAGES.transferNotInitiated)

    await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    expect(await pending()).toEqual([
      expect.objectContaining({ _id: requestId, totalCents: 600 }),
    ])
    await bill.host.mutation(api.combinedPayments.confirm, {
      billId: bill.billId,
      requestId,
    })

    for (const seat of [bill.seats['Ани'], bill.seats['Боби']]) {
      expect(await paymentsFor(t, seat)).toEqual([
        expect.objectContaining({
          amountCents: 300,
          note: COMBINED_PAYMENT_MESSAGES.combinedPaymentNote,
        }),
      ])
    }
    expect(await paymentsFor(t, bill.seats['Вики'])).toEqual([])
  })

  it('one seat cannot be in two pay-for-others requests', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    const cover = (sessionToken: string) =>
      reserve(t, {
        billId: bill.billId,
        sessionToken,
        otherParticipantIds: [bill.seats['Вики']],
      })

    await cover(ani.sessionToken)
    await expect(cover(bobi.sessionToken)).rejects.toThrow(
      COMBINED_PAYMENT_MESSAGES.coveredPendingExists,
    )
  })

  it('a Guest whose own transfer is on its way cannot be paid for again', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: bobi.sessionToken,
      otherParticipantIds: [],
    })

    await expect(
      reserve(t, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [bill.seats['Боби']],
      }),
    ).rejects.toThrow(COMBINED_PAYMENT_MESSAGES.coveredPendingExists)

    // Switching an existing pick over to Боби is refused the same way.
    await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Вики']],
    })
    await expect(
      reserve(t, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [bill.seats['Боби']],
      }),
    ).rejects.toThrow(COMBINED_PAYMENT_MESSAGES.coveredPendingExists)
  })

  it('a Guest someone else is paying for cannot send their own transfer', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })

    for (const attempt of [
      t.mutation(api.combinedPayments.recordTransfer, {
        billId: bill.billId,
        sessionToken: bobi.sessionToken,
        otherParticipantIds: [],
      }),
      reserve(t, {
        billId: bill.billId,
        sessionToken: bobi.sessionToken,
        otherParticipantIds: [bill.seats['Вики']],
      }),
    ]) {
      await expect(attempt).rejects.toThrow(
        COMBINED_PAYMENT_MESSAGES.payerCoveredByOther,
      )
    }
  })

  it('confirm refuses when the covered Guest paid in the meantime', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const { requestId } = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    await bill.host.mutation(api.payments.add, {
      billId: bill.billId,
      participantId: bill.seats['Боби'],
      amountCents: 300,
    })

    await expect(
      bill.host.mutation(api.combinedPayments.confirm, {
        billId: bill.billId,
        requestId,
      }),
    ).rejects.toThrow(COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid)
    expect(await paymentsFor(t, bill.seats['Ани'])).toEqual([])
  })
})

describe('one request per phone, priced when it is sent', () => {
  it('sending prices afresh: a Guest who paid meanwhile drops out', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const { requestId } = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби'], bill.seats['Вики']],
    })
    await bill.host.mutation(api.payments.add, {
      billId: bill.billId,
      participantId: bill.seats['Боби'],
      amountCents: 300,
    })

    const sent = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби'], bill.seats['Вики']],
    })

    expect(sent).toEqual({ requestId, totalCents: 600 })
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({
      coveredParticipantIds: [bill.seats['Вики']],
      transferInitiatedAt: expect.any(Number),
    })
  })

  it('picking nobody drops the Reservation and frees the seat', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    const { requestId } = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })

    expect(
      await t.mutation(api.combinedPayments.reserve, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [],
      }),
    ).toBeNull()
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({
      status: 'cancelled',
    })
    await expect(
      t.mutation(api.combinedPayments.recordTransfer, {
        billId: bill.billId,
        sessionToken: bobi.sessionToken,
        otherParticipantIds: [],
      }),
    ).resolves.toMatchObject({ totalCents: 300 })
  })

  it('Covered seats are always in the request; a sent one is not sent twice', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'], [
      bill.seats['Вики'],
    ])
    const send = () =>
      t.mutation(api.combinedPayments.recordTransfer, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [],
      })

    const first = await send()
    expect(first.totalCents).toBe(600)
    expect(await send()).toEqual(first)
    await expect(
      reserve(t, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [bill.seats['Боби']],
      }),
    ).rejects.toThrow(COMBINED_PAYMENT_MESSAGES.selectionLockedAfterTransfer)
    expect(
      await bill.host.query(api.combinedPayments.listPendingForBill, {
        billId: bill.billId,
      }),
    ).toEqual([
      expect.objectContaining({
        _id: first.requestId,
        coveredParticipantIds: [bill.seats['Вики']],
      }),
    ])
  })

  it('a tab still on the previous Pay step keeps working through the old calls', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const vicky = await joinAsGuest(t, bill, bill.seats['Вики'])
    const asAni = { billId: bill.billId, sessionToken: ani.sessionToken }

    const { requestId } = await t.mutation(api.combinedPayments.create, {
      ...asAni,
      coveredParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.combinedPayments.updateCovered, {
      ...asAni,
      requestId,
      coveredParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.combinedPayments.initiateTransfer, {
      ...asAni,
      requestId,
    })
    const solo = await t.mutation(api.combinedPayments.createSolo, {
      billId: bill.billId,
      sessionToken: vicky.sessionToken,
    })

    expect(
      await bill.host.query(api.combinedPayments.listPendingForBill, {
        billId: bill.billId,
      }),
    ).toEqual([
      expect.objectContaining({ _id: requestId, totalCents: 600 }),
      expect.objectContaining({ _id: solo.requestId, totalCents: 300 }),
    ])
  })
})

describe('when a seat leaves the bill', () => {
  it('removing a Participant cancels unsent requests that pay for or cover them', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const covering = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })

    await bill.host.mutation(api.participants.remove, {
      participantId: bill.seats['Боби'],
    })

    expect(await t.run((ctx) => ctx.db.get(covering.requestId))).toMatchObject({
      status: 'cancelled',
    })
  })

  it('a seat with a sent transfer stays until the Host settles the transfer', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const vicky = await joinAsGuest(t, bill, bill.seats['Вики'])
    const covering = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    const own = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: vicky.sessionToken,
      otherParticipantIds: [],
    })
    const remove = (name: string) =>
      bill.host.mutation(api.participants.remove, {
        participantId: bill.seats[name],
      })

    for (const name of ['Боби', 'Вики']) {
      await expect(remove(name)).rejects.toThrow(
        COMBINED_PAYMENT_MESSAGES.participantHasTransfer,
      )
    }
    await bill.host.mutation(api.combinedPayments.reject, {
      billId: bill.billId,
      requestId: own.requestId,
    })
    await remove('Вики')
    expect(
      await bill.host.query(api.combinedPayments.listPendingForBill, {
        billId: bill.billId,
      }),
    ).toEqual([expect.objectContaining({ _id: covering.requestId })])
  })
})

describe('who may act on a pay request', () => {
  it('another phone cannot send or cancel someone else’s request', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    const { requestId } = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Вики']],
    })

    await expect(
      t.mutation(api.combinedPayments.cancel, {
        billId: bill.billId,
        sessionToken: bobi.sessionToken,
        requestId,
      }),
    ).rejects.toThrow(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    // Боби's phone can only ever send its own request.
    const own = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: bobi.sessionToken,
      otherParticipantIds: [],
    })
    expect(own.requestId).not.toBe(requestId)
    const anis = await t.run((ctx) => ctx.db.get(requestId))
    expect(anis?.status).toBe('pending')
    expect(anis?.transferInitiatedAt).toBeUndefined()
  })

  it('only the Host confirms or rejects', async () => {
    const t = setupConvex()
    const bill = await seedClaimedBill(t)
    await seedBill(t, { hostIdentity: { subject: 'user_stranger' } })
    const stranger = t.withIdentity({ subject: 'user_stranger' })
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const { requestId } = await t.mutation(
      api.combinedPayments.recordTransfer,
      {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [],
      },
    )

    for (const action of [
      api.combinedPayments.confirm,
      api.combinedPayments.reject,
    ]) {
      await expect(
        stranger.mutation(action, { billId: bill.billId, requestId }),
      ).rejects.toThrow()
    }

    await bill.host.mutation(api.combinedPayments.reject, {
      billId: bill.billId,
      requestId,
    })
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({
      status: 'rejected',
    })
    expect(await paymentsFor(t, bill.seats['Ани'])).toEqual([])
  })
})
