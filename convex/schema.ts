import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const extractedItemValidator = v.object({
  name: v.string(),
  unitPriceCents: v.number(),
  quantity: v.number(),
  confidence: v.union(v.literal('high'), v.literal('low')),
})

export default defineSchema({
  users: defineTable({
    clerkSubject: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    /** Retired Username (`Потребителско име`); kept so existing rows validate. */
    username: v.optional(v.string()),
    /**
     * Host Pro billing mirror, written by the Stripe sync (`billing.ts`) and
     * read by `lib/hostTier.ts`. `'pro'` once the Host has a Stripe
     * subscription, else `'free'`.
     */
    plan: v.optional(v.union(v.literal('free'), v.literal('pro'))),
    /**
     * Retired Clerk Billing plan slug, superseded by `plan`; cleared by
     * `backfill:planFromClerkPlanSlug`. Drop once every environment has run it.
     */
    clerkPlanSlug: v.optional(v.string()),
    /** Stripe subscription status, as Stripe reports it. */
    subscriptionStatus: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    graceUntil: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    /** When the Stripe state behind the mirror was fetched; older syncs are dropped. */
    billingSyncedAt: v.optional(v.number()),
  })
    .index('by_clerkSubject', ['clerkSubject'])
    .index('email', ['email'])
    .index('by_stripeCustomerId', ['stripeCustomerId']),

  /** Stripe webhook event ids already handled (deliveries repeat). */
  processedWebhookEvents: defineTable({
    eventId: v.string(),
    processedAt: v.number(),
  })
    .index('by_eventId', ['eventId'])
    .index('by_processedAt', ['processedAt']),

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
    /**
     * Collection summary for the home screen (`shared/bill-collection.ts`).
     * Written by `touchBill`; `backfill:refreshBillListSummaries` fills old bills.
     */
    listCollectedCents: v.optional(v.number()),
    listGuestBalances: v.optional(
      v.array(
        v.object({
          participantId: v.id('participants'),
          name: v.string(),
          owedCents: v.number(),
          paidCents: v.number(),
        }),
      ),
    ),
    listPrepared: v.optional(v.boolean()),
    listFirstIncompleteStep: v.optional(v.number()),
    listUnassignedItemCount: v.optional(v.number()),
    listHasPricedItems: v.optional(v.boolean()),
    /** Participant seat for the Host; set at bill create. */
    hostParticipantId: v.optional(v.id('participants')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_updatedAt', ['updatedAt'])
    .index('by_ownerId_updatedAt', ['ownerId', 'updatedAt'])
    .index('by_ownerId_status_updatedAt', ['ownerId', 'status', 'updatedAt'])
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
    unitIndex: v.number(),
  })
    .index('by_itemId', ['itemId'])
    .index('by_participantId', ['participantId'])
    .index('by_billId', ['billId'])
    .index('by_itemId_participantId_unitIndex', [
      'itemId',
      'participantId',
      'unitIndex',
    ]),

  rateLimitBuckets: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_windowStart', ['windowStart']),

  guestSessions: defineTable({
    billId: v.id('bills'),
    participantId: v.id('participants'),
    /** Covered seats: extra Participants this phone claims and pays for. */
    coveredParticipantIds: v.optional(v.array(v.id('participants'))),
    sessionToken: v.string(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_billId', ['billId'])
    .index('by_sessionToken', ['sessionToken'])
    .index('by_participantId', ['participantId'])
    .index('by_lastSeenAt', ['lastSeenAt']),

  payments: defineTable({
    billId: v.id('bills'),
    participantId: v.id('participants'),
    amountCents: v.number(),
    note: v.optional(v.string()),
    paidAt: v.number(),
  })
    .index('by_billId', ['billId'])
    .index('by_participantId', ['participantId']),

  combinedPaymentRequests: defineTable({
    billId: v.id('bills'),
    payerParticipantId: v.id('participants'),
    coveredParticipantId: v.optional(v.id('participants')),
    coveredParticipantIds: v.optional(v.array(v.id('participants'))),
    payerAmountCents: v.number(),
    coveredAmountCents: v.number(),
    coveredAmountsByParticipant: v.optional(v.record(v.string(), v.number())),
    totalCents: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('rejected'),
      v.literal('cancelled'),
    ),
    guestSessionId: v.id('guestSessions'),
    createdAt: v.number(),
    transferInitiatedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  })
    .index('by_billId_status', ['billId', 'status'])
    .index('by_guestSessionId', ['guestSessionId']),

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
      v.literal('failed'),
      v.literal('done'),
    ),
    extractedRestaurantName: v.optional(v.string()),
    extractedItems: v.optional(v.array(extractedItemValidator)),
    receiptTotalCents: v.optional(v.number()),
    itemsTotalCents: v.optional(v.number()),
    totalsMismatch: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_billId', ['billId'])
    .index('by_createdAt', ['createdAt']),

  /**
   * A receipt read for a quick bill, which lives only on the Host's phone.
   * The photo is deleted once read; the phone takes the lines and discards
   * the row, and the cleanup cron sweeps whatever is left.
   */
  quickScans: defineTable({
    ownerId: v.id('users'),
    storageId: v.optional(v.id('_storage')),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('failed'),
      v.literal('done'),
    ),
    extractedRestaurantName: v.optional(v.string()),
    extractedItems: v.optional(v.array(extractedItemValidator)),
    receiptTotalCents: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_storageId', ['storageId']),

  hostOnboarding: defineTable({
    userId: v.id('users'),
    version: v.number(),
    lifecycle: v.union(
      v.literal('notStarted'),
      v.literal('active'),
      v.literal('skipped'),
      v.literal('completed'),
    ),
    guidedBillId: v.optional(v.id('bills')),
    preparedAt: v.optional(v.number()),
    sharedAt: v.optional(v.number()),
    skippedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    paymentCheckpointDismissed: v.boolean(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),
})
