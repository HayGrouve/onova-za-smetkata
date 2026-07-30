import { describe, expect, it } from 'vitest'
import { guidanceCollapsedPreview } from './guidance-bar-summary'

describe('guidanceCollapsedPreview', () => {
  it('returns the first sentence when body has multiple sentences', () => {
    expect(
      guidanceCollapsedPreview(
        'Първо изречение. Второ изречение с повече детайли.',
      ),
    ).toBe('Първо изречение.')
  })

  it('returns the full text when there is no sentence terminator', () => {
    expect(guidanceCollapsedPreview('Само един ред без точка')).toBe(
      'Само един ред без точка',
    )
  })

  it('returns empty string for blank body', () => {
    expect(guidanceCollapsedPreview('   ')).toBe('')
  })
})
