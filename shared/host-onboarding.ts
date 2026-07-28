import type { AssignmentInput, ItemInput } from './bill-calculations'
import { resolveHostParticipantName } from './host-profile'
import { itemHasFullUnitCoverage } from './unit-coverage'
import { HOST_ONBOARDING_SCAN } from './host-onboarding-messages'

export const HOST_ONBOARDING_VERSION = 1

export type HostOnboardingLifecycle =
  'notStarted' | 'active' | 'skipped' | 'completed'

export type HostOnboardingContentRoute = 'scan' | 'manual'

export type GuidanceAnchor =
  'content' | 'bill-details' | 'participants' | 'allocation' | 'share'

export type GuidanceStepNumber = 1 | 2 | 3 | 4

export interface GuidanceStep {
  id: string
  anchor: GuidanceAnchor
  step: GuidanceStepNumber
  title: string
  body: string
  done: boolean
}

export interface HostOnboardingBillContext {
  restaurantName: string
  restaurantFromOcr: boolean
  hostParticipantName: string
  guestCount: number
  items: ItemInput[]
  assignments: AssignmentInput[]
  contentRoute?: HostOnboardingContentRoute
  receiptUploaded: boolean
  receiptScanning: boolean
  scanReviewOpen: boolean
  sharedAt?: number
}

export interface DeriveGuidanceInput {
  bill: HostOnboardingBillContext
  dismissedHintIds: string[]
}

export function isTerminalOnboardingLifecycle(
  lifecycle: HostOnboardingLifecycle,
): boolean {
  return lifecycle === 'skipped' || lifecycle === 'completed'
}

export function isEligibleForAutomaticOnboarding(input: {
  lifecycle: HostOnboardingLifecycle
  billCount: number
}): boolean {
  return (
    !isTerminalOnboardingLifecycle(input.lifecycle) &&
    input.billCount === 0 &&
    input.lifecycle === 'notStarted'
  )
}

export function isPreparedBill(input: {
  restaurantName: string
  guestCount: number
  items: ItemInput[]
  assignments: AssignmentInput[]
}): boolean {
  const restaurantReady = input.restaurantName.trim().length > 0
  const guestsReady = input.guestCount >= 1
  const itemsReady =
    input.items.length > 0 &&
    input.items.every((item) => item.unitPriceCents > 0)
  const unitsReady =
    input.items.length > 0 &&
    input.items.every((item) =>
      itemHasFullUnitCoverage(item, input.assignments),
    )

  return restaurantReady && guestsReady && itemsReady && unitsReady
}

export function planUsernameOnWelcomeConfirm(
  confirmedName: string,
  currentUsername: string | undefined,
  authName: string | undefined,
): { shouldSaveUsername: boolean; username?: string } {
  const suggested = resolveHostParticipantName({
    username: currentUsername,
    authName,
  })
  if (confirmedName === suggested) {
    return { shouldSaveUsername: false }
  }
  return { shouldSaveUsername: true, username: confirmedName }
}

function hasMultiUnitItem(items: ItemInput[]): boolean {
  return items.some((item) => item.quantity > 1)
}

/** Contextual curriculum derived from real bill state (#56, #63). */
export function deriveHostOnboardingGuidance(
  input: DeriveGuidanceInput,
): GuidanceStep[] {
  const { bill } = input
  const hostSeat = bill.hostParticipantName

  const content: GuidanceStep = (() => {
    if (!bill.contentRoute) {
      return {
        id: 'content-route',
        anchor: 'content',
        step: 1,
        title: 'Изберете как да въведете сметката',
        body: 'При дълга бележка снимката е по-бърза; при няколко артикула въведете ги ръчно.',
        done: false,
      }
    }
    if (bill.contentRoute === 'scan' && bill.items.length === 0) {
      if (bill.scanReviewOpen) {
        return {
          id: 'scan-review',
          anchor: 'content',
          step: 1,
          title: HOST_ONBOARDING_SCAN.reviewTitle,
          body: HOST_ONBOARDING_SCAN.reviewBody,
          done: false,
        }
      }
      if (bill.receiptScanning) {
        return {
          id: 'scan-processing',
          anchor: 'content',
          step: 1,
          title: HOST_ONBOARDING_SCAN.processingTitle,
          body: HOST_ONBOARDING_SCAN.processingBody,
          done: false,
        }
      }
      if (bill.receiptUploaded) {
        return {
          id: 'scan-run-ocr',
          anchor: 'content',
          step: 1,
          title: HOST_ONBOARDING_SCAN.runOcrTitle,
          body: HOST_ONBOARDING_SCAN.runOcrBody,
          done: false,
        }
      }
      return {
        id: 'scan-upload',
        anchor: 'content',
        step: 1,
        title: HOST_ONBOARDING_SCAN.uploadTitle,
        body: HOST_ONBOARDING_SCAN.uploadBody,
        done: bill.receiptUploaded,
      }
    }
    return {
      id: 'content-route',
      anchor: 'content',
      step: 1,
      title: 'Изберете как да въведете сметката',
      body: '',
      done: true,
    }
  })()

  const details: GuidanceStep = {
    id: 'restaurant',
    anchor: 'bill-details',
    step: 1,
    title: bill.restaurantFromOcr
      ? 'Проверете ресторанта'
      : 'Добавете ресторанта',
    body: bill.restaurantFromOcr
      ? 'Името е разпознато от бележката — потвърдете го или го поправете.'
      : 'Името се вижда от гостите, когато отворят линка.',
    done: bill.restaurantName.trim() !== '',
  }

  const participants: GuidanceStep = {
    id: 'participants',
    anchor: 'participants',
    step: 2,
    title: 'Добавете хората на масата',
    body: `Вашето място „${hostSeat}" вече е добавено — добавете поне един гост, за да разпределите сметката.`,
    done: bill.guestCount > 0,
  }

  const allocation: GuidanceStep = {
    id: 'allocation',
    anchor: 'allocation',
    step: 3,
    title:
      bill.items.length === 0
        ? 'Добавете артикулите'
        : 'Разпределете артикулите',
    body:
      bill.items.length === 0
        ? 'Наименование и цена са достатъчни — бройката умножава цената.'
        : bill.items.some((item) => item.unitPriceCents <= 0)
          ? 'Без цена артикулът не влиза в дяловете.'
          : hasMultiUnitItem(bill.items)
            ? 'Всяка бройка отива при някого — изберете повече от един участник, за да я разделите поравно.'
            : 'Всеки артикул отива при някого — изберете повече от един участник, за да го разделите поравно.',
    done:
      bill.items.length > 0 &&
      bill.items.every((item) => item.unitPriceCents > 0) &&
      bill.items.every((item) =>
        itemHasFullUnitCoverage(item, input.bill.assignments),
      ),
  }

  const prepared = isPreparedBill({
    restaurantName: bill.restaurantName,
    guestCount: bill.guestCount,
    items: bill.items,
    assignments: bill.assignments,
  })

  const share: GuidanceStep = {
    id: 'share',
    anchor: 'share',
    step: 4,
    title: 'Споделете сметката с гостите',
    body: prepared
      ? 'Сметката е готова за споделяне — може да я редактирате и след това.'
      : 'Щом всичко е разпределено, споделете линка оттук.',
    done: bill.sharedAt !== undefined,
  }

  return [content, details, participants, allocation, share]
}

export function currentGuidanceStep(
  steps: GuidanceStep[],
  dismissedHintIds: string[],
): GuidanceStep | undefined {
  return steps.find((step) => !step.done && !dismissedHintIds.includes(step.id))
}

export function guidanceForEditorStep(
  steps: GuidanceStep[],
  editorStep: GuidanceStepNumber,
  dismissedHintIds: string[],
): GuidanceStep | undefined {
  return steps.find(
    (step) =>
      !step.done &&
      step.step === editorStep &&
      !dismissedHintIds.includes(step.id),
  )
}

/** True when every onboarding hint for an editor step is done or dismissed. */
export function isEditorStepGuidanceComplete(
  steps: GuidanceStep[],
  editorStep: GuidanceStepNumber,
  dismissedHintIds: string[],
): boolean {
  const relevant = steps.filter((step) => step.step === editorStep)
  if (relevant.length === 0) return false
  return relevant.every(
    (step) => step.done || dismissedHintIds.includes(step.id),
  )
}

export function nextGuidanceStep(
  steps: GuidanceStep[],
  dismissedHintIds: string[],
): GuidanceStep | undefined {
  return currentGuidanceStep(steps, dismissedHintIds)
}

export function shouldCompleteOnboarding(input: {
  lifecycle: HostOnboardingLifecycle
  preparedAt?: number
  sharedAt?: number
}): boolean {
  return (
    input.lifecycle === 'active' &&
    input.preparedAt !== undefined &&
    input.sharedAt !== undefined
  )
}

export function stepBarGuidanceLabel(input: {
  steps: GuidanceStep[]
  currentStep: GuidanceStepNumber
  dismissedHintIds: string[]
  stepLabels: readonly string[]
}):
  | { kind: 'on' }
  | { kind: 'pointer'; step: GuidanceStepNumber; label: string }
  | null {
  const stepGuidance = guidanceForEditorStep(
    input.steps,
    input.currentStep,
    input.dismissedHintIds,
  )
  if (stepGuidance) {
    return { kind: 'on' }
  }

  const next = nextGuidanceStep(input.steps, input.dismissedHintIds)
  if (!next || next.step === input.currentStep) {
    return null
  }

  return {
    kind: 'pointer',
    step: next.step,
    label: input.stepLabels[next.step - 1] ?? '',
  }
}
