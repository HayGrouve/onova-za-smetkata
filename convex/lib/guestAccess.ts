import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'

type GuestAccessCtx = QueryCtx | MutationCtx

/**
 * The bill id from a share link, which a Guest may have mangled. Queries that
 * open a link take it as a string so a malformed id reads as an invalid link
 * (production hides validator errors behind a generic „Server Error“).
 */
export function billIdFromLink(
  ctx: GuestAccessCtx,
  billId: string,
): Id<'bills'> {
  const id = ctx.db.normalizeId('bills', billId)
  if (!id) throw new ConvexError(GUEST_FLOW_MESSAGES.invalidShareLink)
  return id
}

export async function assertShareToken(
  ctx: GuestAccessCtx,
  billId: Id<'bills'>,
  shareToken: string,
): Promise<Doc<'bills'>> {
  const bill = await ctx.db.get(billId)
  if (!bill?.ownerId) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
  }
  if (!shareToken || !bill.shareToken || bill.shareToken !== shareToken) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.invalidShareLink)
  }
  return bill
}

export type GuestVisibleBill = {
  _id: Id<'bills'>
  restaurantName: string
  date: number
  note?: string
  status: 'draft' | 'final'
  tipCents?: number
  createdAt: number
  updatedAt: number
}

export function toGuestVisibleBill(bill: Doc<'bills'>): GuestVisibleBill {
  return {
    _id: bill._id,
    restaurantName: bill.restaurantName,
    date: bill.date,
    note: bill.note,
    status: bill.status,
    tipCents: bill.tipCents,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  }
}
