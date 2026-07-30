import { describe, expect, it } from 'vitest'
import {
  buildAppHeaderMenuConfig,
  FINALIZE_UNPAID_TOOLTIP,
} from './app-header-menu-config'
import type { AppHeaderMenuConfigInput } from './app-header-menu-config'

function input(
  overrides: Partial<AppHeaderMenuConfigInput> = {},
): AppHeaderMenuConfigInput {
  return {
    routeContext: 'home',
    billStatus: undefined,
    participantCount: 0,
    finalizeValidationPasses: true,
    unpaidCount: 0,
    ...overrides,
  }
}

function visibleIds(config: ReturnType<typeof buildAppHeaderMenuConfig>) {
  return config.filter((item) => !item.hidden).map((item) => item.id)
}

describe('buildAppHeaderMenuConfig', () => {
  it('returns no bill items on home', () => {
    expect(visibleIds(buildAppHeaderMenuConfig(input()))).toEqual([])
  })

  it('returns no bill items on login', () => {
    expect(
      visibleIds(buildAppHeaderMenuConfig(input({ routeContext: 'login' }))),
    ).toEqual([])
  })

  it('returns theme-only contexts for guest join and guest claim', () => {
    for (const routeContext of ['guestJoin', 'guestClaim'] as const) {
      expect(
        visibleIds(buildAppHeaderMenuConfig(input({ routeContext }))),
      ).toEqual([])
    }
  })

  describe('editor (draft)', () => {
    const base = input({
      routeContext: 'editor',
      billStatus: 'draft',
      participantCount: 2,
    })

    it('lists share link, rotate, finalize, and delete in order', () => {
      expect(visibleIds(buildAppHeaderMenuConfig(base))).toEqual([
        'shareJoinLink',
        'rotateShareToken',
        'finalizeBill',
        'deleteBill',
      ])
    })

    it('disables share link when there are no participants', () => {
      const items = buildAppHeaderMenuConfig({
        ...base,
        participantCount: 0,
      })
      expect(items.find((i) => i.id === 'shareJoinLink')?.disabled).toBe(true)
    })

    it('shows share bill text instead of join link on final bills', () => {
      expect(
        visibleIds(
          buildAppHeaderMenuConfig({
            ...base,
            billStatus: 'final',
          }),
        ),
      ).toEqual(['shareBillText', 'deleteBill'])
    })

    it('enables finalize when validation passes and all guests paid', () => {
      const item = buildAppHeaderMenuConfig(base).find(
        (i) => i.id === 'finalizeBill',
      )
      expect(item?.disabled).toBe(false)
      expect(item?.tooltip).toBeUndefined()
    })

    it('disables finalize with tooltip when guests are unpaid', () => {
      const item = buildAppHeaderMenuConfig({
        ...base,
        unpaidCount: 2,
      }).find((i) => i.id === 'finalizeBill')
      expect(item?.disabled).toBe(true)
      expect(item?.tooltip).toBe(FINALIZE_UNPAID_TOOLTIP)
    })

    it('disables finalize without tooltip for other validation failures', () => {
      const item = buildAppHeaderMenuConfig({
        ...base,
        finalizeValidationPasses: false,
        unpaidCount: 0,
      }).find((i) => i.id === 'finalizeBill')
      expect(item?.disabled).toBe(true)
      expect(item?.tooltip).toBeUndefined()
    })
  })

  describe('summary draft', () => {
    const base = input({
      routeContext: 'summary',
      billStatus: 'draft',
      participantCount: 2,
    })

    it('lists finalize, edit, share bill text, and delete', () => {
      expect(visibleIds(buildAppHeaderMenuConfig(base))).toEqual([
        'finalizeBill',
        'editBill',
        'shareBillText',
        'deleteBill',
      ])
    })
  })

  describe('summary final', () => {
    it('lists share bill text and delete only', () => {
      expect(
        visibleIds(
          buildAppHeaderMenuConfig(
            input({ routeContext: 'summary', billStatus: 'final' }),
          ),
        ),
      ).toEqual(['shareBillText', 'deleteBill'])
    })
  })

  describe('host claim (draft)', () => {
    const base = input({
      routeContext: 'hostClaim',
      billStatus: 'draft',
      participantCount: 1,
    })

    it('lists share link, rotate, go to editor, and delete — no finalize', () => {
      expect(visibleIds(buildAppHeaderMenuConfig(base))).toEqual([
        'shareJoinLink',
        'rotateShareToken',
        'goToEditor',
        'deleteBill',
      ])
    })

    it('does not include finalize', () => {
      const ids = buildAppHeaderMenuConfig(base).map((i) => i.id)
      expect(ids).not.toContain('finalizeBill')
    })
  })

  describe('host claim (final)', () => {
    it('lists share bill text and delete only', () => {
      expect(
        visibleIds(
          buildAppHeaderMenuConfig(
            input({ routeContext: 'hostClaim', billStatus: 'final' }),
          ),
        ),
      ).toEqual(['shareBillText', 'deleteBill'])
    })
  })
})
