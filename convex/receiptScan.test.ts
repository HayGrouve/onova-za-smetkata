// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { HOST_IDENTITY, setupConvex } from './test.setup'

beforeEach(() => {
  // The scheduled OCR action must never reach Gemini from a test.
  vi.stubEnv('GEMINI_API_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('receipt scans', () => {
  it('a Host cannot start unlimited scans by spreading them over new bills', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(['receipt'], { type: 'image/jpeg' })),
    )

    let started = 0
    let refused = 0
    for (let index = 0; index < 4; index++) {
      const billId = await host.mutation(api.bills.create, {})
      await host.mutation(api.bills.update, {
        billId,
        receiptStorageId: storageId,
      })
      for (let scan = 0; scan < 8; scan++) {
        try {
          await host.mutation(api.receiptScan.startScan, { billId })
          started++
        } catch {
          refused++
        }
      }
    }

    expect(started).toBe(20)
    expect(refused).toBe(12)
  })
})
