// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import { GUEST_SESSION_TTL_MS } from './lib/guestSession'
import {
  hostTakesUnits,
  joinAsGuest,
  reserve,
  seedBill,
  setupConvex,
} from './test.setup'
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

  it('the Host seat is never a Guest’s to pick', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)

    await expect(joinAsGuest(t, bill, bill.hostSeat)).rejects.toThrow(
      GUEST_FLOW_MESSAGES.hostSeatNotJoinable,
    )
    expect(await activeSeats(t, bill)).toEqual([])
  })

  it('a phone needs a real session token', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    for (const sessionToken of ['', 'short', 'x'.repeat(10_000)]) {
      await expect(
        t.mutation(api.guestSessions.claim, {
          billId: bill.billId,
          shareToken: bill.shareToken,
          participantId: bill.seats['Ани'],
          sessionToken,
        }),
      ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionRequired)
    }
  })

  it('rotating the share link signs every phone off at once', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби', 'Вики'] })
    await hostTakesUnits(bill, bill.itemIds[0], [
      bill.seats['Ани'],
      bill.seats['Боби'],
    ])
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const reservation = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })

    await bill.host.mutation(api.bills.rotateShareToken, {
      billId: bill.billId,
    })

    // Session calls carry no share link: the old phone is stopped because
    // rotating ended its session, not because it sent a stale link.
    await expect(
      t.mutation(api.assignments.takeUnit, {
        itemIds: bill.itemIds,
        ...ani,
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)
    await expect(
      t.mutation(api.guestSessions.heartbeat, { billId: bill.billId, ...ani }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)
    await expect(
      t.mutation(api.combinedPayments.recordTransfer, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        otherParticipantIds: [],
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)
    expect(
      await t.run((ctx) => ctx.db.get(reservation.requestId)),
    ).toMatchObject({ status: 'cancelled' })
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
    await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })

    await expect(
      t.mutation(api.guestSessions.updateCoveredSeats, {
        billId: bill.billId,
        sessionToken: ani.sessionToken,
        coveredParticipantIds: [bill.seats['Вики']],
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.coveredSeatsLocked)
  })

  it('re-joining cannot change Covered seats after the transfer was sent', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      guests: ['Ани', 'Боби', 'Вики'],
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
    })
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'], [
      bill.seats['Боби'],
    ])
    await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })

    await t.mutation(api.guestSessions.claim, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      participantId: bill.seats['Ани'],
      sessionToken: ani.sessionToken,
      coveredParticipantIds: [bill.seats['Вики']],
    })

    expect(await activeSeats(t, bill)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: bill.seats['Боби'],
          heldByParticipantId: bill.seats['Ани'],
        }),
      ]),
    )
    await expect(joinAsGuest(t, bill, bill.seats['Вики'])).resolves.toBeTruthy()
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

describe('coming back after the TTL', () => {
  it('a phone back from Revolut still sees its sent transfer and cannot pay twice', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t)
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const sent = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [],
    })

    // Ани sits in the Revolut app long enough for the session to lapse, then
    // comes back on the same tab — and once more from a fresh tab.
    for (const sessionToken of [ani.sessionToken, 'session-new-phone-token']) {
      vi.setSystemTime(Date.now() + GUEST_SESSION_TTL_MS + 1_000)
      await t.mutation(api.guestSessions.claim, {
        billId: bill.billId,
        shareToken: bill.shareToken,
        participantId: bill.seats['Ани'],
        sessionToken,
      })
      const pending = await t.query(api.combinedPayments.getPendingForGuest, {
        billId: bill.billId,
        sessionToken,
      })
      expect(pending?._id).toBe(sent.requestId)
      // Opening Revolut again records nothing new: the same transfer waits.
      await expect(
        t.mutation(api.combinedPayments.recordTransfer, {
          billId: bill.billId,
          sessionToken,
          otherParticipantIds: [],
        }),
      ).resolves.toEqual(sent)
    }
  })

  it('an expired phone cannot send, change or cancel a pay request', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t, {
      guests: ['Ани', 'Боби', 'Вики'],
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
    })
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const { requestId } = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })

    vi.setSystemTime(Date.now() + GUEST_SESSION_TTL_MS + 1_000)
    const asAni = { billId: bill.billId, sessionToken: ani.sessionToken }
    for (const attempt of [
      t.mutation(api.combinedPayments.recordTransfer, {
        ...asAni,
        otherParticipantIds: [bill.seats['Боби']],
      }),
      t.mutation(api.combinedPayments.cancel, { ...asAni, requestId }),
      reserve(t, { ...asAni, otherParticipantIds: [bill.seats['Вики']] }),
    ]) {
      await expect(attempt).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)
    }
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({
      status: 'pending',
      coveredParticipantIds: [bill.seats['Боби']],
    })
    expect(
      (await t.run((ctx) => ctx.db.get(requestId)))?.transferInitiatedAt,
    ).toBeUndefined()
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
    const unsent = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Боби']],
    })
    // Вики already sent a transfer for her own Share.
    const sent = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: vicky.sessionToken,
      otherParticipantIds: [],
    })

    for (const phone of [ani, vicky]) {
      await t.mutation(api.guestSessions.release, {
        billId: bill.billId,
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

  it('releasing with an unknown token leaves no trace', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const buckets = () =>
      t.run(
        async (ctx) =>
          (await ctx.db.query('rateLimitBuckets').collect()).length,
      )
    const before = await buckets()

    for (let index = 0; index < 5; index++) {
      await t.mutation(api.guestSessions.release, {
        billId: bill.billId,
        sessionToken: `unknown-token-${index}-padding`,
      })
    }

    expect(await buckets()).toBe(before)
  })
})
