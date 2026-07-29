import { describe, expect, it } from 'vitest'
import {
  buildBillEditorDerivedState,
  buildBillEditorGuidanceInput,
  clampBillEditorStep,
  fromBillEditorDateInputValue,
  isRestaurantFromOcr,
  resolveOcrRestaurantApply,
  shouldRedirectFinalBillToSummary,
  shouldShowContentRouteChoice,
  toBillEditorDateInputValue,
} from './bill-editing-controller'

describe('clampBillEditorStep', () => {
  it('accepts steps 1–4 and defaults invalid values to 1', () => {
    expect(clampBillEditorStep(1)).toBe(1)
    expect(clampBillEditorStep(2)).toBe(2)
    expect(clampBillEditorStep(3)).toBe(3)
    expect(clampBillEditorStep(4)).toBe(4)
    expect(clampBillEditorStep(undefined)).toBe(1)
    expect(clampBillEditorStep('5')).toBe(1)
  })
})

describe('shouldRedirectFinalBillToSummary', () => {
  it('redirects draft bills only when not already on step 4', () => {
    expect(shouldRedirectFinalBillToSummary('final', 1)).toBe(true)
    expect(shouldRedirectFinalBillToSummary('final', 4)).toBe(false)
    expect(shouldRedirectFinalBillToSummary('draft', 2)).toBe(false)
  })
})

describe('bill editor date helpers', () => {
  it('round-trips a calendar date', () => {
    const ms = Date.UTC(2026, 6, 7)
    const value = toBillEditorDateInputValue(ms)
    expect(value).toBe('2026-07-07')
    expect(fromBillEditorDateInputValue(value)).toBe(
      new Date(2026, 6, 7).getTime(),
    )
  })
})

describe('buildBillEditorDerivedState', () => {
  const relations = {
    participants: [
      { id: 'host', name: 'Иван', sortOrder: 0 },
      { id: 'guest', name: 'Мария', sortOrder: 1 },
    ],
    items: [
      {
        id: 'i1',
        name: 'Салата',
        unitPriceCents: 1200,
        quantity: 1,
      },
    ],
    assignments: [{ itemId: 'i1', participantId: 'guest', unitIndex: 0 }],
    payments: [],
  }

  it('derives totals, completion, and host context from relations', () => {
    const derived = buildBillEditorDerivedState({
      relations,
      hostParticipantId: 'host',
      tipCents: 0,
      restaurantNameDraft: 'Механа',
    })

    expect(derived.itemsSubtotalCents).toBe(1200)
    expect(derived.totals.billTotalCents).toBe(1200)
    expect(derived.guestCount).toBe(1)
    expect(derived.hostParticipantName).toBe('Иван')
    expect(derived.stepCompletion[1]).toBe(true)
    expect(derived.stepCompletion[2]).toBe(true)
    expect(derived.stepCompletion[3]).toBe(true)
    expect(derived.unassignedItemsCount).toBe(0)
  })
})

describe('buildBillEditorGuidanceInput', () => {
  it('maps relations into guidance input', () => {
    const guidance = buildBillEditorGuidanceInput({
      billId: 'bill_1',
      step: 1,
      restaurantName: 'Механа',
      restaurantFromOcr: true,
      hostParticipantName: 'Иван',
      guestCount: 1,
      relations: {
        participants: [{ id: 'guest', name: 'Мария', sortOrder: 1 }],
        items: [{ id: 'i1', name: 'Салата', unitPriceCents: 500, quantity: 1 }],
        assignments: [],
        payments: [],
      },
      receiptUploaded: true,
      receiptScanning: false,
      scanReviewOpen: false,
    })

    expect(guidance).toEqual({
      billId: 'bill_1',
      step: 1,
      restaurantName: 'Механа',
      restaurantFromOcr: true,
      hostParticipantName: 'Иван',
      guestCount: 1,
      items: [{ id: 'i1', unitPriceCents: 500, quantity: 1 }],
      assignments: [],
      receiptUploaded: true,
      receiptScanning: false,
      scanReviewOpen: false,
    })
  })
})

describe('shouldShowContentRouteChoice', () => {
  it('shows only for onboarding with no route and no items', () => {
    expect(
      shouldShowContentRouteChoice({
        onboardingActive: true,
        contentRoute: undefined,
        itemCount: 0,
      }),
    ).toBe(true)
    expect(
      shouldShowContentRouteChoice({
        onboardingActive: true,
        contentRoute: 'scan',
        itemCount: 0,
      }),
    ).toBe(false)
    expect(
      shouldShowContentRouteChoice({
        onboardingActive: false,
        contentRoute: undefined,
        itemCount: 0,
      }),
    ).toBe(false)
  })
})

describe('isRestaurantFromOcr', () => {
  it('is true only when OCR extracted a name and draft is non-empty', () => {
    expect(
      isRestaurantFromOcr({
        extractedRestaurantName: 'Механа',
        restaurantNameDraft: 'Механа',
      }),
    ).toBe(true)
    expect(
      isRestaurantFromOcr({
        extractedRestaurantName: 'Механа',
        restaurantNameDraft: '',
      }),
    ).toBe(false)
  })
})

describe('resolveOcrRestaurantApply', () => {
  it('applies OCR restaurant name once when bill name is empty', () => {
    expect(
      resolveOcrRestaurantApply({
        scanId: 'scan_1',
        extractedRestaurantName: ' Механа ',
        appliedScanId: null,
        currentRestaurantName: '',
      }),
    ).toEqual({
      restaurantName: 'Механа',
      appliedScanId: 'scan_1',
    })
  })

  it('skips when already applied or restaurant is set', () => {
    expect(
      resolveOcrRestaurantApply({
        scanId: 'scan_1',
        extractedRestaurantName: 'Механа',
        appliedScanId: 'scan_1',
        currentRestaurantName: '',
      }),
    ).toBeNull()
    expect(
      resolveOcrRestaurantApply({
        scanId: 'scan_1',
        extractedRestaurantName: 'Механа',
        appliedScanId: null,
        currentRestaurantName: 'Бар',
      }),
    ).toBeNull()
  })
})
