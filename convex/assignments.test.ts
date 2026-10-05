// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { CLAIM_MESSAGES } from '../shared/claim-messages'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import { GUEST_SESSION_TTL_MS } from './lib/guestSession'
import {
  hostTakesUnits,
  joinAsGuest,
  seedBill,
  setBillStatus,
  setupConvex,
  unitMembers,
} from './test.setup'

afterEach(() => {
  vi.useRealTimers()
})

/** „Бира“ printed on two lines: one Claim group of four Units. */
const twoBeerLines = [
  { name: 'Бира', unitPriceCents: 300, quantity: 2 },
  { name: 'Бира', unitPriceCents: 300, quantity: 2 },
]

describe('taking Units', () => {
  it('two phones taking the same Claim group never land on the same Unit', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { items: twoBeerLines })
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    const take = (guest: typeof ani) =>
      t.mutation(api.assignments.takeUnit, {
        itemIds: bill.itemIds,
        ...guest,
      })

    const taken = [await take(ani), await take(bobi), await take(ani)]
    taken.push(await take(bobi))

    expect(taken).toEqual([
      { itemId: bill.itemIds[0], unitIndex: 0 },
      { itemId: bill.itemIds[0], unitIndex: 1 },
      { itemId: bill.itemIds[1], unitIndex: 0 },
      { itemId: bill.itemIds[1], unitIndex: 1 },
    ])
    for (const itemId of bill.itemIds) {
      for (const members of (await unitMembers(t, itemId)).values()) {
        expect(members).toHaveLength(1)
      }
    }
    await expect(take(ani)).rejects.toThrow(CLAIM_MESSAGES.noFreeUnits)
  })

  it('releasing gives back the last Unit the seat holds alone, never a shared one', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
    })
    const [itemId] = bill.itemIds
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    await t.mutation(api.assignments.shareUnit, {
      itemIds: [itemId],
      ...ani,
      withParticipantIds: [bill.seats['Боби']],
    })
    await t.mutation(api.assignments.takeUnit, { itemIds: [itemId], ...ani })

    await expect(
      t.mutation(api.assignments.releaseUnit, { itemIds: [itemId], ...ani }),
    ).resolves.toEqual({ itemId, unitIndex: 1 })
    await expect(
      t.mutation(api.assignments.releaseUnit, { itemIds: [itemId], ...ani }),
    ).rejects.toThrow(CLAIM_MESSAGES.noSoloUnitToRelease)

    const members = await unitMembers(t, itemId)
    expect(members.get(0)).toEqual([bill.seats['Ани'], bill.seats['Боби']])
    expect(members.has(1)).toBe(false)
  })
})

describe('sharing Units', () => {
  it('puts the friend on the Unit right away, and either member can change it', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби', 'Вики'] })
    const [itemId] = bill.itemIds
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])

    const unit = await t.mutation(api.assignments.shareUnit, {
      itemIds: [itemId],
      ...ani,
      withParticipantIds: [bill.seats['Боби']],
    })
    expect((await unitMembers(t, itemId)).get(unit.unitIndex)).toEqual([
      bill.seats['Ани'],
      bill.seats['Боби'],
    ])

    // Боби is on the Shared Unit, so Боби may swap Ани for Вики.
    await t.mutation(api.assignments.shareUnit, {
      itemIds: [itemId],
      ...bobi,
      unit,
      withParticipantIds: [bill.seats['Вики']],
    })
    expect((await unitMembers(t, itemId)).get(unit.unitIndex)).toEqual([
      bill.seats['Боби'],
      bill.seats['Вики'],
    ])

    // Ани is off it now and can no longer edit it.
    await expect(
      t.mutation(api.assignments.shareUnit, {
        itemIds: [itemId],
        ...ani,
        unit,
        withParticipantIds: [],
      }),
    ).rejects.toThrow(CLAIM_MESSAGES.notOnUnit)
  })

  it('refuses to share with a seat from another bill', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const other = await seedBill(t, { guests: ['Чужд'] })
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])

    await expect(
      t.mutation(api.assignments.shareUnit, {
        itemIds: bill.itemIds,
        ...ani,
        withParticipantIds: [other.seats['Чужд']],
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.participantNotOnBill)
  })
})

describe('who may claim for a seat', () => {
  it('a phone can act only for the seats its session holds', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби', 'Вики'] })
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'], [
      bill.seats['Вики'],
    ])
    const take = (args: { participantId: string; sessionToken?: string }) =>
      t.mutation(api.assignments.takeUnit, {
        itemIds: bill.itemIds,
        participantId: args.participantId as (typeof bill.seats)[string],
        sessionToken: args.sessionToken,
      })

    await expect(
      take({
        participantId: bill.seats['Боби'],
        sessionToken: ani.sessionToken,
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)
    await expect(take({ participantId: bill.seats['Ани'] })).rejects.toThrow(
      GUEST_FLOW_MESSAGES.sessionRequired,
    )
    // A Covered seat is held by the same phone.
    await expect(
      take({
        participantId: bill.seats['Вики'],
        sessionToken: ani.sessionToken,
      }),
    ).resolves.toMatchObject({ unitIndex: 0 })
  })

  it('a signed-in stranger is treated like any Guest without a session', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await seedBill(t, { hostIdentity: { subject: 'user_stranger' } })
    const stranger = t.withIdentity({ subject: 'user_stranger' })

    await expect(
      stranger.mutation(api.assignments.takeUnit, {
        itemIds: bill.itemIds,
        participantId: bill.seats['Ани'],
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionRequired)
    await expect(
      stranger.mutation(api.assignments.assignAll, {
        billId: bill.billId,
        mode: 'all_items',
      }),
    ).rejects.toThrow()
  })

  it('a session from one bill does not open another bill', async () => {
    const t = setupConvex()
    const billA = await seedBill(t)
    const billB = await seedBill(t)
    const ani = await joinAsGuest(t, billA, billA.seats['Ани'])

    await expect(
      t.mutation(api.assignments.takeUnit, {
        itemIds: billB.itemIds,
        participantId: billB.seats['Ани'],
        sessionToken: ani.sessionToken,
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)
  })

  it('an expired session cannot claim, and its seat opens for another phone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])

    vi.setSystemTime(Date.now() + GUEST_SESSION_TTL_MS + 1)
    await expect(
      t.mutation(api.assignments.takeUnit, { itemIds: bill.itemIds, ...ani }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.sessionExpired)

    const newPhone = await joinAsGuest(t, bill, bill.seats['Ани'])
    await expect(
      t.mutation(api.assignments.takeUnit, {
        itemIds: bill.itemIds,
        ...newPhone,
      }),
    ).resolves.toMatchObject({ unitIndex: 0 })
  })

  it('the Host paints any seat without a session', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)

    await bill.host.mutation(api.assignments.takeUnit, {
      itemIds: bill.itemIds,
      participantId: bill.seats['Боби'],
    })
    expect((await unitMembers(t, bill.itemIds[0])).get(0)).toEqual([
      bill.seats['Боби'],
    ])
  })
})

describe('claims on a locked or malformed bill', () => {
  it('nothing can be claimed once the bill is final', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    await setBillStatus(t, bill.billId, 'final')

    await expect(
      t.mutation(api.assignments.takeUnit, { itemIds: bill.itemIds, ...ani }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.billFinalNoEdit)
    await expect(
      bill.host.mutation(api.assignments.assignAll, {
        billId: bill.billId,
        mode: 'all_items',
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.billFinalNoEdit)
  })

  it('a Claim group cannot mix lines from two bills', async () => {
    const t = setupConvex()
    const billA = await seedBill(t)
    const billB = await seedBill(t)
    const ani = await joinAsGuest(t, billA, billA.seats['Ани'])

    await expect(
      t.mutation(api.assignments.takeUnit, {
        itemIds: [...billA.itemIds, ...billB.itemIds],
        ...ani,
      }),
    ).rejects.toThrow(CLAIM_MESSAGES.invalidItems)
  })

  it('rejects a Unit index past the line quantity', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])

    await expect(
      t.mutation(api.assignments.joinUnit, {
        itemId: bill.itemIds[0],
        unitIndex: 2,
        ...ani,
      }),
    ).rejects.toThrow('Невалиден номер на бройка.')
  })
})

describe('Host bulk assignment', () => {
  it('assignAll unassigned_only fills empty lines and leaves claimed ones alone', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      items: [
        { name: 'Бира', unitPriceCents: 300, quantity: 1 },
        { name: 'Салата', unitPriceCents: 800, quantity: 1 },
      ],
    })
    const [beer, salad] = bill.itemIds
    await bill.host.mutation(api.assignments.takeUnit, {
      itemIds: [beer],
      participantId: bill.seats['Ани'],
    })

    await bill.host.mutation(api.assignments.assignAll, {
      billId: bill.billId,
      mode: 'unassigned_only',
    })

    expect((await unitMembers(t, beer)).get(0)).toEqual([bill.seats['Ани']])
    expect((await unitMembers(t, salad)).get(0)).toEqual([
      bill.hostSeat,
      bill.seats['Ани'],
      bill.seats['Боби'],
    ])
  })

  it('assignAll unassigned_only fills only the free Units of a partly claimed line', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      items: [{ name: 'Бира', unitPriceCents: 500, quantity: 3 }],
    })
    const [beer] = bill.itemIds
    await hostTakesUnits(bill, beer, [bill.seats['Ани'], bill.seats['Ани']])

    await bill.host.mutation(api.assignments.assignAll, {
      billId: bill.billId,
      mode: 'unassigned_only',
    })

    const units = await unitMembers(t, beer)
    expect(units.get(0)).toEqual([bill.seats['Ани']])
    expect(units.get(1)).toEqual([bill.seats['Ани']])
    expect(units.get(2)).toEqual([
      bill.hostSeat,
      bill.seats['Ани'],
      bill.seats['Боби'],
    ])
  })
})
