import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'

export const extractedItemValidator = v.object({
  name: v.string(),
  unitPriceCents: v.number(),
  quantity: v.number(),
  confidence: v.union(v.literal('high'), v.literal('low')),
})

export default defineSchema({
  ...authTables,

  bills: defineTable({
    ownerId: v.id('users'),
    restaurantName: v.string(),
    date: v.number(),
    note: v.optional(v.string()),
    receiptStorageId: v.optional(v.id('_storage')),
    status: v.union(v.literal('draft'), v.literal('final')),
    tipCents: v.optional(v.number()),
    shareToken: v.optional(v.string()),
    listBillTotalCents: v.optional(v.number()),
    listOutstandingCents: v.optional(v.number()),
    listParticipantNames: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_updatedAt', ['updatedAt'])
    .index('by_ownerId_updatedAt', ['ownerId', 'updatedAt'])
    .index('by_shareToken', ['shareToken']),

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
    billId: v.id('bills'),
    itemId: v.id('items'),
    participantId: v.id('participants'),
    units: v.optional(v.number()),
  })
    .index('by_itemId', ['itemId'])
    .index('by_participantId', ['participantId'])
    .index('by_billId', ['billId'])
    .index('by_itemId_participantId', ['itemId', 'participantId']),

  rateLimitBuckets: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_key', ['key']),

  guestSessions: defineTable({
    billId: v.id('bills'),
    participantId: v.id('participants'),
    sessionToken: v.string(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_billId', ['billId'])
    .index('by_sessionToken', ['sessionToken'])
    .index('by_participantId', ['participantId']),

  payments: defineTable({
    billId: v.id('bills'),
    participantId: v.id('participants'),
    amountCents: v.number(),
    note: v.optional(v.string()),
    paidAt: v.number(),
  })
    .index('by_billId', ['billId'])
    .index('by_participantId', ['participantId']),

  paymentSettings: defineTable({
    userId: v.id('users'),
    revolutUsername: v.optional(v.string()),
    iban: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  friendGroups: defineTable({
    userId: v.id('users'),
    name: v.string(),
    memberNames: v.array(v.string()),
    sortOrder: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  receiptScans: defineTable({
    billId: v.id('bills'),
    storageId: v.id('_storage'),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('done'),
      v.literal('failed'),
    ),
    extractedRestaurantName: v.optional(v.string()),
    extractedItems: v.optional(v.array(extractedItemValidator)),
    receiptTotalCents: v.optional(v.number()),
    itemsTotalCents: v.optional(v.number()),
    totalsMismatch: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_billId', ['billId']),
})
