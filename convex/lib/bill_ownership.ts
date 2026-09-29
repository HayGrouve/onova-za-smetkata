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

/** Signed-in caller owns this bill (false when signed out or the bill is gone). */
export function isBillOwner(
  bill: { ownerId: Id<'users'> } | null,
  userId: Id<'users'> | null,
): boolean {
  return bill !== null && userId !== null && bill.ownerId === userId
}
