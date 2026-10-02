// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import { GUEST_SESSION_TTL_MS } from './lib/guestSession'
import { joinAsGuest, seedBill, setupConvex } from './test.setup'
import type { SeededBill, TestConvex } from './test.setup'

afterEach(() => {
  vi.useRealTimers()
})

function activeSeats(t: TestConvex, bill: SeededBill) {
  return t.query(api.guestSessions.listActiveForBill, {
    billId: bill.billId,
    shareToken: bill.shareToken,
  })
}

describe('picking a seat', () => {
  it('a seat belongs to one phone; the same phone may pick it again', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])

    await expect(joinAsGuest(t, bill, bill.seats['Ани'])).rejects.toThrow(
      GUEST_FLOW_MESSAGES.nameTaken,
    )
    await expect(
      t.mutation(api.guestSessions.claim, {
        billId: bill.billId,
        shareToken: bill.shareToken,
        ...ani,
      }),
    ).resolves.toEqual({ ok: true })
  })

  it('switching seats frees the old one', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const phone = await joinAsGuest(t, bill, bill.seats['Ани'])

    await t.mutation(api.guestSessions.claim, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      participantId: bill.seats['Боби'],
      sessionToken: phone.sessionToken,
    })

    expect(await activeSeats(t, bill)).toEqual([
      expect.objectContaining({ participantId: bill.seats['Боби'] }),
    ])
    await expect(joinAsGuest(t, bill, bill.seats['Ани'])).resolves.toBeTruthy()
  })

  it('a wrong or rotated share link does not let anyone in', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const oldLink = { ...bill }

    await expect(
      joinAsGuest(t, { ...bill, shareToken: 'guessed' }, bill.seats['Ани']),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.invalidShareLink)

    await bill.host.mutation(api.bills.rotateShareToken, {
      billId: bill.billId,
    })
    await expect(joinAsGuest(t, oldLink, bill.seats['Ани'])).rejects.toThrow(
      GUEST_FLOW_MESSAGES.invalidShareLink,
    )
  })

  it('a seat from another bill cannot be picked through this link', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const other = await seedBill(t, { guests: ['Чужд'] })

    await expect(joinAsGuest(t, bill, other.seats['Чужд'])).rejects.toThrow(
      GUEST_FLOW_MESSAGES.participantNotOnBill,
    )
  })

  it('a quiet phone loses its seat after the TTL; a heartbeat keeps it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])

    vi.setSystemTime(Date.now() + GUEST_SESSION_TTL_MS - 1_000)
    await t.mutation(api.guestSessions.heartbeat, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      ...bobi,
    })
    vi.setSystemTime(Date.now() + 2_000)

    await expect(joinAsGuest(t, bill, bill.seats['Ани'])).resolves.toBeTruthy()
    await expect(joinAsGuest(t, bill, bill.seats['Боби'])).rejects.toThrow(
      GUEST_FLOW_MESSAGES.nameTaken,
    )
    await expect(
      t.mutation(api.guestSessions.heartbeat, {
        billId: bill.billId,
        shareToken: bill.shareToken,
        ...ani,
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)
  })
})

describe('Covered seats', () => {
  it('locks Covered seats to the phone and shows who holds them', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби', 'Вики'] })
    await joinAsGuest(t, bill, bill.seats['Ани'], [bill.seats['Вики']])

    expect(await activeSeats(t, bill)).toEqual([
      expect.objectContaining({ participantId: bill.seats['Ани'] }),
      expect.objectContaining({
        participantId: bill.seats['Вики'],
        heldByParticipantId: bill.seats['Ани'],
      }),
    ])
    await expect(joinAsGuest(t, bill, bill.seats['Вики'])).rejects.toThrow(
      GUEST_FLOW_MESSAGES.nameTaken,
    )
    await expect(
      joinAsGuest(t, bill, bill.seats['Боби'], [bill.seats['Вики']]),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.coveredSeatTaken)
  })

  it('never covers the Host seat or the own seat', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)

    await expect(
      joinAsGuest(t, bill, bill.seats['Ани'], [bill.hostSeat]),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.coveredSeatIsHost)
    await expect(
      joinAsGuest(t, bill, bill.seats['Ани'], [bill.seats['Ани']]),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.coveredSeatIsOwn)
  })

  it('cannot change Covered seats after the transfer was sent', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби', 'Вики'] })
    const [itemId] = bill.itemIds
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'], [
      bill.seats['Боби'],
    ])
    for (const participantId of [bill.seats['Ани'], bill.seats['Боби']]) {
      await t.mutation(api.assignments.takeUnit, {
        itemIds: [itemId],
        participantId,
        sessionToken: ani.sessionToken,
      })
    }
    const { requestId } = await t.mutation(api.combinedPayments.create, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: ani.sessionToken,
      coveredParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.combinedPayments.initiateTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      requestId,
    })

    await expect(
      t.mutation(api.guestSessions.updateCoveredSeats, {
        billId: bill.billId,
        shareToken: bill.shareToken,
        sessionToken: ani.sessionToken,
        coveredParticipantIds: [bill.seats['Вики']],
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.coveredSeatsLocked)
  })

  it('removing a Participant drops them from every phone’s Covered seats', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби', 'Вики'] })
    await joinAsGuest(t, bill, bill.seats['Ани'], [
      bill.seats['Боби'],
      bill.seats['Вики'],
    ])

    await bill.host.mutation(api.participants.remove, {
      participantId: bill.seats['Вики'],
    })

    expect(await activeSeats(t, bill)).toEqual([
      expect.objectContaining({ participantId: bill.seats['Ани'] }),
      expect.objectContaining({ participantId: bill.seats['Боби'] }),
    ])
  })
})

describe('leaving the bill', () => {
  it('release frees the seats and cancels unsent pay requests, but keeps sent transfers', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      guests: ['Ани', 'Боби', 'Вики'],
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
    })
    const [itemId] = bill.itemIds
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const vicky = await joinAsGuest(t, bill, bill.seats['Вики'])
    for (const participantId of Object.values(bill.seats)) {
      await bill.host.mutation(api.assignments.takeUnit, {
        itemIds: [itemId],
        participantId,
      })
    }
    // Ани picks Боби to pay for but has not opened Revolut yet.
    const unsent = await t.mutation(api.combinedPayments.create, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: ani.sessionToken,
      coveredParticipantIds: [bill.seats['Боби']],
    })
    // Вики already sent a transfer for her own Share.
    const sent = await t.mutation(api.combinedPayments.createSolo, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: vicky.sessionToken,
    })

    for (const phone of [ani, vicky]) {
      await t.mutation(api.guestSessions.release, {
        billId: bill.billId,
        shareToken: bill.shareToken,
        sessionToken: phone.sessionToken,
      })
    }

    expect(await activeSeats(t, bill)).toEqual([])
    const status = (id: typeof unsent.requestId) =>
      t.run(async (ctx) => (await ctx.db.get(id))?.status)
    expect(await status(unsent.requestId)).toBe('cancelled')
    expect(await status(sent.requestId)).toBe('pending')
    // Боби is free to pay for himself again.
    await expect(joinAsGuest(t, bill, bill.seats['Боби'])).resolves.toBeTruthy()
  })
})
