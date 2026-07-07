import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  bills: defineTable({
    restaurantName: v.string(),
    date: v.number(),
    note: v.optional(v.string()),
    receiptStorageId: v.optional(v.id('_storage')),
    status: v.union(v.literal('draft'), v.literal('final')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_updatedAt', ['updatedAt']),

  participants: defineTable({
    billId: v.id('bills'),
    name: v.string(),
    sortOrder: v.number(),
  }).index('by_billId', ['billId']),

  items: defineTable({
    billId: v.id('bills'),
    name: v.string(),
    unitPriceCents: v.number(),
    quantity: v.number(),
    note: v.optional(v.string()),
    sortOrder: v.number(),
  }).index('by_billId', ['billId']),

  itemAssignments: defineTable({
    itemId: v.id('items'),
    participantId: v.id('participants'),
  })
    .index('by_itemId', ['itemId'])
    .index('by_participantId', ['participantId']),

  payments: defineTable({
    billId: v.id('bills'),
    participantId: v.id('participants'),
    amountCents: v.number(),
    note: v.optional(v.string()),
    paidAt: v.number(),
  }).index('by_billId', ['billId']),
})
