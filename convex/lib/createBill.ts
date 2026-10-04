import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { planHostParticipantOnBillCreate } from '../../shared/host-bill-participant'
import { createShareToken } from './shareToken'
import { touchBill } from './touchBill'
import {
  assertBillCreateQuota,
  formatUsageMonthKey,
  incrementUsageCount,
  usageCounterKey,
} from './hostTier'

/**
 * The one way a bill comes to exist: an empty draft with a share link and the
 * Host's seat, counted against the Host's monthly bill quota. Every entry point
 * (home „Нова сметка“, Напътствия first bill, guided bills) goes through here.
 */
export async function createBillForOwner(
  ctx: MutationCtx,
  owner: Doc<'users'>,
): Promise<Id<'bills'>> {
  const now = Date.now()
  await assertBillCreateQuota(ctx, owner, owner._id, now)

  const billId = await ctx.db.insert('bills', {
    ownerId: owner._id,
    restaurantName: '',
    date: now,
    status: 'draft',
    shareToken: createShareToken(),
    listBillTotalCents: 0,
    listParticipantNames: [],
    createdAt: now,
    updatedAt: now,
  })

  const hostPlan = planHostParticipantOnBillCreate({ authName: owner.name })
  const hostParticipantId = await ctx.db.insert('participants', {
    billId,
    name: hostPlan.name,
    sortOrder: hostPlan.sortOrder,
  })
  await ctx.db.patch(billId, { hostParticipantId })
  await touchBill(ctx, billId)

  await incrementUsageCount(
    ctx,
    usageCounterKey(owner._id, 'bills', formatUsageMonthKey(now)),
    now,
  )

  return billId
}
