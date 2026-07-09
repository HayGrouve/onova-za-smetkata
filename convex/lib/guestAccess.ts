import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

type GuestAccessCtx = QueryCtx | MutationCtx

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
