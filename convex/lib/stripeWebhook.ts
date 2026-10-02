/** Stripe's own libraries reject signatures older than five minutes. */
const SIGNATURE_TOLERANCE_SECONDS = 300

/** Events that can change a Host's subscription; each triggers a re-fetch. */
const SUBSCRIPTION_SYNC_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
])

export function isSubscriptionSyncEvent(type: string): boolean {
  return SUBSCRIPTION_SYNC_EVENTS.has(type)
}

function parseSignatureHeader(
  header: string,
): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key === 't' && /^\d+$/.test(value)) timestamp = Number(value)
    if (key === 'v1') signatures.push(value)
  }
  if (timestamp === null || signatures.length === 0) return null
  return { timestamp, signatures }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  )
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

/**
 * Checks a `Stripe-Signature` header against the raw request body: an HMAC of
 * `{t}.{body}` under the endpoint secret, signed within the last five minutes.
 */
export async function verifyStripeSignature(input: {
  payload: string
  header: string | null
  secret: string
  nowMs: number
}): Promise<boolean> {
  if (!input.header) return false
  const parsed = parseSignatureHeader(input.header)
  if (!parsed) return false
  const ageSeconds = Math.abs(input.nowMs / 1000 - parsed.timestamp)
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false

  const expected = await hmacSha256Hex(
    input.secret,
    `${parsed.timestamp}.${input.payload}`,
  )
  return parsed.signatures.some((signature) =>
    timingSafeEqual(signature, expected),
  )
}

export interface StripeEventSummary {
  id: string
  type: string
  /** The Stripe customer the event is about, if its object names one. */
  customerId: string | null
}

function readCustomerId(object: unknown): string | null {
  if (!object || typeof object !== 'object') return null
  const customer = Reflect.get(object, 'customer')
  if (typeof customer === 'string') return customer
  if (customer && typeof customer === 'object') {
    const id = Reflect.get(customer, 'id')
    if (typeof id === 'string') return id
  }
  return null
}

/** Reads the event id, type and customer from a verified webhook body. */
export function parseStripeEvent(payload: string): StripeEventSummary | null {
  let event: unknown
  try {
    event = JSON.parse(payload)
  } catch {
    return null
  }
  if (!event || typeof event !== 'object') return null
  const id = Reflect.get(event, 'id')
  const type = Reflect.get(event, 'type')
  if (typeof id !== 'string' || typeof type !== 'string') return null
  const data = Reflect.get(event, 'data')
  const object =
    data && typeof data === 'object' ? Reflect.get(data, 'object') : null
  return { id, type, customerId: readCustomerId(object) }
}
