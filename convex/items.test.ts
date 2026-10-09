// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import {
  hostTakesUnits,
  seedBill,
  setupConvex,
  unitMembers,
} from './test.setup'

describe('changing how many of a line there are', () => {
  it('lowering the quantity frees the Units past the new count', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
    })
    const [itemId] = bill.itemIds
    await hostTakesUnits(bill, itemId, [
      bill.seats['Ани'],
      bill.seats['Боби'],
      bill.seats['Ани'],
    ])

    await bill.host.mutation(api.items.update, { itemId, quantity: 1 })

    const members = await unitMembers(t, itemId)
    expect([...members.keys()]).toEqual([0])
    expect(members.get(0)).toEqual([bill.seats['Ани']])
  })

  it('raising the quantity keeps every claim', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, {
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 2 }],
    })
    const [itemId] = bill.itemIds
    await hostTakesUnits(bill, itemId, [bill.seats['Ани'], bill.seats['Боби']])

    await bill.host.mutation(api.items.update, { itemId, quantity: 4 })

    const members = await unitMembers(t, itemId)
    expect(members.get(0)).toEqual([bill.seats['Ани']])
    expect(members.get(1)).toEqual([bill.seats['Боби']])
    expect(members.has(2)).toBe(false)
  })
})
