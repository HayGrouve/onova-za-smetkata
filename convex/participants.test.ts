// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { seedBill, setupConvex } from './test.setup'

afterEach(() => {
  vi.useRealTimers()
})

describe('recent names', () => {
  it('lists names from the newest bills first, each name once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const older = await seedBill(t, { guests: ['Ани', 'Боби'] })
    vi.setSystemTime(Date.now() + 60_000)
    await seedBill(t, { guests: ['Вики', 'боби', 'Гошо'] })
    const hostName = (await t.run((ctx) => ctx.db.get(older.hostSeat)))?.name

    const names = await older.host.query(api.participants.listRecentNames, {})

    expect(names).toEqual([hostName, 'Вики', 'боби', 'Гошо', 'Ани'])
    expect(
      await older.host.query(api.participants.listRecentNames, { limit: 2 }),
    ).toEqual([hostName, 'Вики'])
  })

  it('still reads the seats of a bill that predates stored names', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { guests: ['Ани', 'Боби'] })
    await t.run((ctx) =>
      ctx.db.patch(bill.billId, { listParticipantNames: undefined }),
    )
    const hostName = (await t.run((ctx) => ctx.db.get(bill.hostSeat)))?.name

    expect(await bill.host.query(api.participants.listRecentNames, {})).toEqual(
      [hostName, 'Ани', 'Боби'],
    )
  })
})
