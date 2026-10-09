// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { SUBSCRIPTION_MESSAGES } from '../shared/subscription-messages'
import { BILL_PARTICIPANTS_MAX } from '../shared/validation/constants'
import { FREE_FRIEND_GROUPS } from './lib/hostTier'
import { HOST_IDENTITY, seedBill, setupConvex } from './test.setup'
import type { SeededBill, TestConvex } from './test.setup'

const STRANGER = { subject: 'user_stranger', name: 'Непознат' }

afterEach(() => {
  vi.unstubAllEnvs()
})

async function participantNames(t: TestConvex, billId: SeededBill['billId']) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', billId))
      .collect(),
  )
  return rows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((participant) => participant.name)
}

describe('whose friend group it is', () => {
  it('another Host can neither change, delete nor use it', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const groupId = await bill.host.mutation(api.friendGroups.create, {
      name: 'Колеги',
      memberNames: ['Вики', 'Гошо'],
    })
    const strangerBill = await seedBill(t, {
      hostIdentity: STRANGER,
      guests: [],
    })

    for (const attempt of [
      strangerBill.host.mutation(api.friendGroups.update, {
        groupId,
        name: 'Хак',
        memberNames: ['Хакер'],
      }),
      strangerBill.host.mutation(api.friendGroups.remove, { groupId }),
      strangerBill.host.mutation(api.friendGroups.addToBill, {
        billId: strangerBill.billId,
        groupId,
      }),
    ]) {
      await expect(attempt).rejects.toThrow('Групата не е намерена.')
    }

    expect(
      await bill.host.query(api.friendGroups.get, { groupId }),
    ).toMatchObject({ name: 'Колеги', memberNames: ['Вики', 'Гошо'] })
    expect(await strangerBill.host.query(api.friendGroups.listAll, {})).toEqual(
      [],
    )
    expect(await participantNames(t, strangerBill.billId)).toEqual([
      STRANGER.name,
    ])
  })

  it('the owner of a bill cannot add someone else’s group to it', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const strangerGroupId = await t
      .withIdentity(STRANGER)
      .mutation(api.friendGroups.create, {
        name: 'Чужда',
        memberNames: ['Вики'],
      })

    await expect(
      bill.host.mutation(api.friendGroups.addToBill, {
        billId: bill.billId,
        groupId: strangerGroupId,
      }),
    ).rejects.toThrow('Групата не е намерена.')
  })
})

describe('how many friend groups a Host may keep', () => {
  const makeGroup = (host: SeededBill['host'], name: string) =>
    host.mutation(api.friendGroups.create, { name, memberNames: ['Вики'] })

  it('a Free Host keeps one group, and deleting it makes room', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    expect(FREE_FRIEND_GROUPS).toBe(1)

    const first = await makeGroup(host, 'Първа')
    await expect(makeGroup(host, 'Втора')).rejects.toMatchObject({
      data: {
        code: 'QUOTA_GROUPS',
        message: SUBSCRIPTION_MESSAGES.QUOTA_GROUPS,
      },
    })

    await host.mutation(api.friendGroups.remove, { groupId: first })
    await makeGroup(host, 'Втора')
  })

  it('a Pro Host is not held to the Free limit', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    await makeGroup(host, 'Първа')
    await t.run(async (ctx) => {
      const user = await ctx.db.query('users').first()
      await ctx.db.patch(user!._id, {
        plan: 'pro',
        subscriptionStatus: 'active',
      })
    })

    await makeGroup(host, 'Втора')
    expect(await host.query(api.friendGroups.listAll, {})).toHaveLength(2)
  })

  it('while Host Pro billing is off, every Host has Pro limits', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    await makeGroup(host, 'Първа')
    await makeGroup(host, 'Втора')
    expect(await host.query(api.friendGroups.listAll, {})).toHaveLength(2)
  })
})

describe('putting a group on a bill', () => {
  it('adds the members and skips names already on the bill', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани'] })
    const groupId = await bill.host.mutation(api.friendGroups.create, {
      name: 'Колеги',
      memberNames: ['Ани', 'Вики', 'Гошо'],
    })

    await expect(
      bill.host.mutation(api.friendGroups.addToBill, {
        billId: bill.billId,
        groupId,
      }),
    ).resolves.toEqual({ added: 2, skipped: 1 })
    expect(await participantNames(t, bill.billId)).toEqual([
      HOST_IDENTITY.name,
      'Ани',
      'Вики',
      'Гошо',
    ])

    await expect(
      bill.host.mutation(api.friendGroups.addToBill, {
        billId: bill.billId,
        groupId,
      }),
    ).resolves.toEqual({ added: 0, skipped: 3 })
  })

  it('reads names that look alike as one, within the picked names too', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани'] })
    const groupId = await bill.host.mutation(api.friendGroups.create, {
      name: 'Колеги',
      memberNames: ['Вики'],
    })

    await expect(
      bill.host.mutation(api.friendGroups.addToBill, {
        billId: bill.billId,
        groupId,
        names: ['  аНи ', 'Вики', 'вики', ' ', 'Гошо'],
      }),
    ).resolves.toEqual({ added: 2, skipped: 2 })
    expect(await participantNames(t, bill.billId)).toEqual([
      HOST_IDENTITY.name,
      'Ани',
      'Вики',
      'Гошо',
    ])
  })

  it('stops at the most seats a bill can have', async () => {
    const t = setupConvex()
    // The Host's own seat counts: two places are left.
    const guests = Array.from(
      { length: BILL_PARTICIPANTS_MAX - 3 },
      (_, index) => `Гост ${index + 1}`,
    )
    const bill = await seedBill(t, { guests })
    const groupId = await bill.host.mutation(api.friendGroups.create, {
      name: 'Колеги',
      memberNames: ['Вики', 'Гошо', 'Дани', 'Ела'],
    })

    await expect(
      bill.host.mutation(api.friendGroups.addToBill, {
        billId: bill.billId,
        groupId,
      }),
    ).resolves.toEqual({ added: 2, skipped: 2 })
    expect(await participantNames(t, bill.billId)).toHaveLength(
      BILL_PARTICIPANTS_MAX,
    )
  })
})
