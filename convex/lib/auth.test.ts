// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../_generated/api'
import { setupConvex } from '../test.setup'
import type { TestConvex } from '../test.setup'

const SMETKATA = 'https://smetkata.onovaza.com'
const KUHNYATA = 'https://kuhnyata.onovaza.com'

afterEach(() => {
  vi.unstubAllEnvs()
})

async function storedUser(t: TestConvex, subject: string) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerkSubject', (q) => q.eq('clerkSubject', subject))
      .unique()
  })
}

/** A Host that already has a `users` row, created while the check is off. */
async function existingHost(t: TestConvex, subject: string) {
  await t.withIdentity({ subject }).mutation(api.users.ensureCurrent, {})
}

describe('azp check (CLERK_AUTHORIZED_PARTIES)', () => {
  describe('env unset', () => {
    it('accepts a token without azp', async () => {
      const t = setupConvex()
      const host = t.withIdentity({ subject: 'user_a' })
      await host.mutation(api.bills.create, {})
      expect(
        await host.query(api.users.viewer, { nowMs: Date.now() }),
      ).not.toBeNull()
    })

    it('accepts a token with any azp', async () => {
      const t = setupConvex()
      const host = t.withIdentity({ subject: 'user_a', azp: KUHNYATA })
      await host.mutation(api.bills.create, {})
      expect(
        await host.query(api.users.viewer, { nowMs: Date.now() }),
      ).not.toBeNull()
    })
  })

  describe('env set', () => {
    it('treats a token without azp as signed out', async () => {
      const t = setupConvex()
      await existingHost(t, 'user_a')
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', SMETKATA)
      const host = t.withIdentity({ subject: 'user_a' })

      await expect(host.mutation(api.bills.create, {})).rejects.toThrow(
        'Изисква се вход',
      )
      expect(
        await host.query(api.users.viewer, { nowMs: Date.now() }),
      ).toBeNull()
    })

    it('treats a token minted by another origin as signed out', async () => {
      const t = setupConvex()
      await existingHost(t, 'user_a')
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', SMETKATA)
      const host = t.withIdentity({ subject: 'user_a', azp: KUHNYATA })

      await expect(host.mutation(api.bills.create, {})).rejects.toThrow(
        'Изисква се вход',
      )
      expect(
        await host.query(api.users.viewer, { nowMs: Date.now() }),
      ).toBeNull()
    })

    it('does not create a users row for a rejected token', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', SMETKATA)
      const t = setupConvex()
      const host = t.withIdentity({ subject: 'user_new', azp: KUHNYATA })

      await expect(host.mutation(api.users.ensureCurrent, {})).rejects.toThrow(
        'Изисква се вход',
      )
      expect(await storedUser(t, 'user_new')).toBeNull()
    })

    it('accepts a listed azp, with spaces and several origins', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', `${KUHNYATA}, ${SMETKATA},`)
      const t = setupConvex()
      const host = t.withIdentity({ subject: 'user_a', azp: SMETKATA })

      const billId = await host.mutation(api.bills.create, {})
      expect(billId).toBeTruthy()
      expect(
        await host.query(api.users.viewer, { nowMs: Date.now() }),
      ).not.toBeNull()
    })
  })
})

describe('profile photo on a new users row', () => {
  it('stores the picture claim', async () => {
    const t = setupConvex()
    await t
      .withIdentity({
        subject: 'user_a',
        picture: 'https://img.example/new.png',
      })
      .mutation(api.users.ensureCurrent, {})
    expect((await storedUser(t, 'user_a'))?.image).toBe(
      'https://img.example/new.png',
    )
  })

  it('falls back to pictureUrl when only the old claim exists', async () => {
    const t = setupConvex()
    await t
      .withIdentity({
        subject: 'user_a',
        pictureUrl: 'https://img.example/old.png',
      })
      .mutation(api.users.ensureCurrent, {})
    expect((await storedUser(t, 'user_a'))?.image).toBe(
      'https://img.example/old.png',
    )
  })

  it('prefers picture over pictureUrl', async () => {
    const t = setupConvex()
    await t
      .withIdentity({
        subject: 'user_a',
        picture: 'https://img.example/new.png',
        pictureUrl: 'https://img.example/old.png',
      })
      .mutation(api.users.ensureCurrent, {})
    expect((await storedUser(t, 'user_a'))?.image).toBe(
      'https://img.example/new.png',
    )
  })
})
