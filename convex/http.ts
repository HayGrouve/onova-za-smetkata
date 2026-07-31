import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

http.route({
  path: '/clerk/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = await request.text()
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing Svix headers', { status: 400 })
    }

    try {
      await ctx.runAction(internal.clerkWebhookAction.handleWebhook, {
        payload,
        svixId,
        svixTimestamp,
        svixSignature,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Webhook processing failed'
      if (message.includes('not configured')) {
        return new Response(message, { status: 500 })
      }
      return new Response(message, { status: 400 })
    }

    return new Response(null, { status: 200 })
  }),
})

export default http
