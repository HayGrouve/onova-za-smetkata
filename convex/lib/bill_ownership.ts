import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'

export function assertBillOwnedBy(
  bill: { ownerId: Id<'users'> },
  userId: Id<'users'>,
): void {
  if (bill.ownerId !== userId) {
    throw new ConvexError('Сметката не е намерена')
  }
}
