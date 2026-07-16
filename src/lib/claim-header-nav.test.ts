import { describe, expect, it } from 'vitest'
import { getClaimHeaderBack } from './claim-header-nav'

describe('getClaimHeaderBack', () => {
  it('returns editor back nav for host claim mode', () => {
    expect(getClaimHeaderBack({ billId: 'bill_1', mode: 'host' })).toEqual({
      backTo: '/bills/$billId',
      backParams: { billId: 'bill_1' },
      backSearch: { step: 3 },
    })
  })

  it('returns null for guest claim (no mode)', () => {
    expect(getClaimHeaderBack({ billId: 'bill_1' })).toBeNull()
  })
})
