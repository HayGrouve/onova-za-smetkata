/// <reference types="vite/client" />
// Convex skips files with more than one dot, so this never deploys.
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

// Function modules only: tests, this file and `.d.ts` all have extra dots.
export const modules = import.meta.glob([
  './**/*.ts',
  './_generated/*.js',
  '!./**/*.*.ts',
])

export function setupConvex() {
  return convexTest(schema, modules)
}

export type TestConvex = ReturnType<typeof setupConvex>

export const HOST_IDENTITY = { subject: 'user_host', name: 'Цвети' }

type SeedItem = { name: string; unitPriceCents: number; quantity?: number }

export type SeededBill = Awaited<ReturnType<typeof seedBill>>

/**
 * A draft bill made through the real Host mutations: restaurant, Guest seats,
 * lines. `seats` maps each Guest name to its Participant id.
 */
export async function seedBill(
  t: TestConvex,
  options: {
    restaurantName?: string
    guests?: string[]
    items?: SeedItem[]
    tipCents?: number
    hostIdentity?: { subject: string; name?: string }
  } = {},
) {
  const {
    restaurantName = 'Механа',
    guests = ['Ани', 'Боби'],
    items = [{ name: 'Бира', unitPriceCents: 300, quantity: 2 }],
    tipCents,
    hostIdentity = HOST_IDENTITY,
  } = options

  const host = t.withIdentity(hostIdentity)
  const billId = await host.mutation(api.bills.create, {})
  await host.mutation(api.bills.update, {
    billId,
    restaurantName,
    ...(tipCents !== undefined ? { tipCents } : {}),
  })

  const seats: Record<string, Id<'participants'>> = {}
  for (const name of guests) {
    seats[name] = await host.mutation(api.participants.add, { billId, name })
  }

  const itemIds: Id<'items'>[] = []
  for (const item of items) {
    itemIds.push(await host.mutation(api.items.add, { billId, ...item }))
  }

  const bill = await t.run((ctx) => ctx.db.get(billId))
  if (!bill?.shareToken || !bill.hostParticipantId) {
    throw new Error(
      'seedBill: bill was created without a share token or Host seat',
    )
  }

  return {
    host,
    billId,
    shareToken: bill.shareToken,
    hostSeat: bill.hostParticipantId,
    seats,
    itemIds,
  }
}

/** Open the join link on a fresh phone and pick `participantId` (plus Covered seats). */
export async function joinAsGuest(
  t: TestConvex,
  bill: Pick<SeededBill, 'billId' | 'shareToken'>,
  participantId: Id<'participants'>,
  coveredParticipantIds?: Id<'participants'>[],
) {
  const sessionToken = `session-${crypto.randomUUID()}`
  await t.mutation(api.guestSessions.claim, {
    billId: bill.billId,
    shareToken: bill.shareToken,
    participantId,
    sessionToken,
    ...(coveredParticipantIds ? { coveredParticipantIds } : {}),
  })
  return { sessionToken, participantId }
}

export async function unitMembers(t: TestConvex, itemId: Id<'items'>) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', itemId))
      .collect(),
  )
  const byUnit = new Map<number, Id<'participants'>[]>()
  for (const row of rows) {
    byUnit.set(row.unitIndex, [
      ...(byUnit.get(row.unitIndex) ?? []),
      row.participantId,
    ])
  }
  return byUnit
}

export async function setBillStatus(
  t: TestConvex,
  billId: Id<'bills'>,
  status: 'draft' | 'final',
) {
  await t.run((ctx) => ctx.db.patch(billId, { status }))
}

/** The Host paints one Unit of `itemId` for each seat, in order. */
export async function hostTakesUnits(
  bill: Pick<SeededBill, 'host'>,
  itemId: Id<'items'>,
  participantIds: Id<'participants'>[],
) {
  for (const participantId of participantIds) {
    await bill.host.mutation(api.assignments.takeUnit, {
      itemIds: [itemId],
      participantId,
    })
  }
}

export async function paymentsFor(
  t: TestConvex,
  participantId: Id<'participants'>,
) {
  return await t.run((ctx) =>
    ctx.db
      .query('payments')
      .withIndex('by_participantId', (q) =>
        q.eq('participantId', participantId),
      )
      .collect(),
  )
}

/** The phone picks the other Guests it pays for, leaving a Reservation. */
export async function reserve(
  t: TestConvex,
  args: {
    billId: Id<'bills'>
    sessionToken: string
    otherParticipantIds: Id<'participants'>[]
  },
) {
  const request = await t.mutation(api.combinedPayments.reserve, args)
  if (!request) {
    throw new Error('reserve: picking someone should leave a Reservation')
  }
  return request
}
