'use node'

import { v } from 'convex/values'
import { Webhook } from 'svix'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'

export const handleWebhook = internalAction({
  args: {
    payload: v.string(),
    svixId: v.string(),
    svixTimestamp: v.string(),
    svixSignature: v.string(),
  },
  handler: async (ctx, args) => {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
    if (!signingSecret) {
      throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is not configured')
    }

    const webhook = new Webhook(signingSecret)
    const event = webhook.verify(args.payload, {
      'svix-id': args.svixId,
      'svix-timestamp': args.svixTimestamp,
      'svix-signature': args.svixSignature,
    }) as {
      type: string
      data: Record<string, unknown>
      id?: string
    }

    const eventId = event.id ?? args.svixId
    const payer = event.data.payer as { user_id?: string } | undefined
    const clerkSubject = payer?.user_id
    if (!clerkSubject) {
      throw new Error('Missing payer user_id in webhook payload')
    }

    await ctx.runMutation(internal.clerkWebhooks.applyBillingEvent, {
      eventId,
      eventType: event.type,
      clerkSubject,
      payload: event.data,
    })
  },
})
