import { describe, expect, it } from 'vitest'
import {
  deriveHostOnboardingGuidance,
  guidanceForEditorStep,
  isEditorStepGuidanceComplete,
  isEligibleForAutomaticOnboarding,
  isPreparedBill,
  shouldCompleteOnboarding,
  stepBarGuidanceLabel,
} from './host-onboarding'

const baseBill = {
  restaurantName: '',
  restaurantFromOcr: false,
  hostParticipantName: 'Цветомир',
  guestCount: 0,
  items: [] as { id: string; unitPriceCents: number; quantity: number }[],
  assignments: [] as {
    itemId: string
    participantId: string
    unitIndex: number
  }[],
  receiptUploaded: false,
  receiptScanning: false,
  scanReviewOpen: false,
}

describe('isEligibleForAutomaticOnboarding', () => {
  it('is eligible with no bills and notStarted lifecycle', () => {
    expect(
      isEligibleForAutomaticOnboarding({
        lifecycle: 'notStarted',
        billCount: 0,
      }),
    ).toBe(true)
  })

  it('is ineligible once any bill exists', () => {
    expect(
      isEligibleForAutomaticOnboarding({
        lifecycle: 'notStarted',
        billCount: 1,
      }),
    ).toBe(false)
  })

  it('is ineligible after skip or completion', () => {
    expect(
      isEligibleForAutomaticOnboarding({
        lifecycle: 'skipped',
        billCount: 0,
      }),
    ).toBe(false)
  })
})

describe('deriveHostOnboardingGuidance', () => {
  it('starts with content route choice', () => {
    const steps = deriveHostOnboardingGuidance({
      bill: baseBill,
      dismissedHintIds: [],
    })
    expect(steps[0]).toMatchObject({
      id: 'content-route',
      done: false,
      title: 'Изберете как да въведете сметката',
    })
  })

  it('shows scan review guidance while OCR sheet is open', () => {
    const steps = deriveHostOnboardingGuidance({
      bill: {
        ...baseBill,
        contentRoute: 'scan',
        scanReviewOpen: true,
      },
      dismissedHintIds: [],
    })
    expect(guidanceForEditorStep(steps, 1, [])).toMatchObject({
      id: 'scan-review',
    })
  })

  it('prompts to run OCR after receipt upload', () => {
    const steps = deriveHostOnboardingGuidance({
      bill: {
        ...baseBill,
        contentRoute: 'scan',
        receiptUploaded: true,
      },
      dismissedHintIds: [],
    })
    expect(guidanceForEditorStep(steps, 1, [])).toMatchObject({
      id: 'scan-run-ocr',
      title: 'Стартирайте разпознаването',
    })
  })

  it('shows processing guidance while OCR runs', () => {
    const steps = deriveHostOnboardingGuidance({
      bill: {
        ...baseBill,
        contentRoute: 'scan',
        receiptUploaded: true,
        receiptScanning: true,
      },
      dismissedHintIds: [],
    })
    expect(guidanceForEditorStep(steps, 1, [])).toMatchObject({
      id: 'scan-processing',
      title: 'Разпознаване на бележката…',
    })
  })
})

describe('isPreparedBill', () => {
  it('requires restaurant, guest, priced items, and full unit coverage', () => {
    expect(
      isPreparedBill({
        restaurantName: 'Механа',
        guestCount: 1,
        items: [{ id: 'i1', unitPriceCents: 500, quantity: 1 }],
        assignments: [{ itemId: 'i1', participantId: 'g1', unitIndex: 0 }],
      }),
    ).toBe(true)
  })
})

describe('shouldCompleteOnboarding', () => {
  it('completes only after both milestones while active', () => {
    expect(
      shouldCompleteOnboarding({
        lifecycle: 'active',
        preparedAt: 1,
        sharedAt: 2,
      }),
    ).toBe(true)
    expect(
      shouldCompleteOnboarding({
        lifecycle: 'active',
        preparedAt: 1,
      }),
    ).toBe(false)
  })
})

describe('stepBarGuidanceLabel', () => {
  it('points at the next step when the visible one has nothing left to teach', () => {
    const steps = deriveHostOnboardingGuidance({
      bill: {
        ...baseBill,
        contentRoute: 'manual',
        restaurantName: 'Механа',
        items: [{ id: 'i1', unitPriceCents: 500, quantity: 1 }],
        guestCount: 0,
      },
      dismissedHintIds: [],
    })
    const label = stepBarGuidanceLabel({
      steps,
      currentStep: 1,
      dismissedHintIds: [],
      stepLabels: ['Сметка', 'Участници', 'Разпределение', 'Плащания'],
    })
    expect(label).toEqual({
      kind: 'pointer',
      step: 2,
      label: 'Участници',
    })
  })
})

describe('isEditorStepGuidanceComplete', () => {
  it('is false for step 1 until content route, restaurant, and items are done', () => {
    const dismissed: string[] = []
    const beforeRoute = deriveHostOnboardingGuidance({
      bill: baseBill,
      dismissedHintIds: dismissed,
    })
    expect(isEditorStepGuidanceComplete(beforeRoute, 1, dismissed)).toBe(false)

    const manual = deriveHostOnboardingGuidance({
      bill: { ...baseBill, contentRoute: 'manual' },
      dismissedHintIds: dismissed,
    })
    expect(isEditorStepGuidanceComplete(manual, 1, dismissed)).toBe(false)

    const named = deriveHostOnboardingGuidance({
      bill: {
        ...baseBill,
        contentRoute: 'manual',
        restaurantName: 'Механа',
      },
      dismissedHintIds: dismissed,
    })
    expect(isEditorStepGuidanceComplete(named, 1, dismissed)).toBe(false)

    const ready = deriveHostOnboardingGuidance({
      bill: {
        ...baseBill,
        contentRoute: 'manual',
        restaurantName: 'Механа',
        items: [{ id: 'i1', unitPriceCents: 500, quantity: 1 }],
      },
      dismissedHintIds: dismissed,
    })
    expect(isEditorStepGuidanceComplete(ready, 1, dismissed)).toBe(true)
  })
})

describe('items guidance', () => {
  it('asks for items on step 1 after the restaurant', () => {
    const steps = deriveHostOnboardingGuidance({
      bill: { ...baseBill, contentRoute: 'manual', restaurantName: 'Механа' },
      dismissedHintIds: [],
    })
    expect(guidanceForEditorStep(steps, 1, [])).toMatchObject({
      id: 'items',
      step: 1,
    })
  })

  it('flags items without a price', () => {
    const steps = deriveHostOnboardingGuidance({
      bill: {
        ...baseBill,
        contentRoute: 'manual',
        restaurantName: 'Механа',
        items: [{ id: 'i1', unitPriceCents: 0, quantity: 1 }],
      },
      dismissedHintIds: [],
    })
    expect(steps.find((step) => step.id === 'items')).toMatchObject({
      done: false,
      body: 'Без цена артикулът не влиза в дяловете.',
    })
  })
})
