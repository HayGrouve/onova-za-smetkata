import { toBillCalculationSnapshot } from './bill-calculation-snapshot'
import type { BillCalculationSnapshot } from './bill-calculation-snapshot'
import { calculateBillTotals } from './bill-calculations'
import type { BillTotals } from './bill-calculations'
import type { BillStepCompletion, BillStepNumber } from './bill-step-completion'
import { getBillStepCompletion } from './bill-step-completion'
import { isHostParticipant } from './host-bill-participant'
import type { HostOnboardingContentRoute } from './host-onboarding'
import { calculateItemsSubtotalCents } from './tip-calculations'
import { countItemsWithEmptyUnits } from './unit-coverage'

export type { BillStepNumber as BillEditorStep }

export function clampBillEditorStep(value: unknown): BillStepNumber {
  const n = Number(value)
  if (n === 2 || n === 3 || n === 4) return n
  return 1
}

export function shouldRedirectFinalBillToSummary(
  billStatus: 'draft' | 'final',
  currentStep: BillStepNumber,
): boolean {
  return billStatus === 'final' && currentStep !== 4
}

export function toBillEditorDateInputValue(ms: number): string {
  const date = new Date(ms)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromBillEditorDateInputValue(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

export interface BillEditorParticipant {
  id: string
  name: string
  sortOrder: number
}

export interface BillEditorItem {
  id: string
  name: string
  unitPriceCents: number
  quantity: number
}

export interface BillEditorAssignment {
  itemId: string
  participantId: string
  unitIndex: number
}

export interface BillEditorPayment {
  participantId: string
  amountCents: number
}

export interface BillEditorRelations {
  participants: BillEditorParticipant[]
  items: BillEditorItem[]
  assignments: BillEditorAssignment[]
  payments: BillEditorPayment[]
}

export interface BillEditorDerivedInput {
  relations: BillEditorRelations
  hostParticipantId?: string
  tipCents: number
  restaurantNameDraft: string
}

export interface BillEditorDerivedState {
  itemsSubtotalCents: number
  billSnapshot: BillCalculationSnapshot
  totals: BillTotals
  unassignedItemsCount: number
  stepCompletion: BillStepCompletion
  guestCount: number
  hostParticipantName: string
}

export function buildBillEditorDerivedState(
  input: BillEditorDerivedInput,
): BillEditorDerivedState {
  const { relations, hostParticipantId, tipCents, restaurantNameDraft } = input

  const itemsSubtotalCents = calculateItemsSubtotalCents(
    relations.items.map((item) => ({
      id: item.id,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
  )

  const billSnapshot = toBillCalculationSnapshot(
    {
      participants: relations.participants.map((participant) => ({
        _id: participant.id,
        sortOrder: participant.sortOrder,
      })),
      items: relations.items.map((item) => ({
        _id: item.id,
        name: item.name,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
      assignments: relations.assignments,
      payments: relations.payments,
    },
    { tipCents, hostParticipantId },
  )

  const totals = calculateBillTotals(billSnapshot.calculationInput)
  const unassignedItemsCount = countItemsWithEmptyUnits(
    billSnapshot.calculationInput.items,
    billSnapshot.calculationInput.assignments,
  )
  const stepCompletion = getBillStepCompletion({
    restaurantName: restaurantNameDraft,
    ...billSnapshot.calculationInput,
  })

  const guestCount = relations.participants.filter(
    (participant) => !isHostParticipant(participant.id, hostParticipantId),
  ).length

  const hostParticipant = relations.participants.find((participant) =>
    isHostParticipant(participant.id, hostParticipantId),
  )

  return {
    itemsSubtotalCents,
    billSnapshot,
    totals,
    unassignedItemsCount,
    stepCompletion,
    guestCount,
    hostParticipantName: hostParticipant?.name ?? 'домакин',
  }
}

export interface BillEditorGuidanceInput {
  billId: string
  step: BillStepNumber
  restaurantName: string
  restaurantFromOcr: boolean
  hostParticipantName: string
  guestCount: number
  items: Array<{ id: string; unitPriceCents: number; quantity: number }>
  assignments: BillEditorAssignment[]
  receiptUploaded: boolean
  receiptScanning: boolean
  scanReviewOpen: boolean
}

export interface BuildBillEditorGuidanceInputArgs {
  billId: string
  step: BillStepNumber
  restaurantName: string
  restaurantFromOcr: boolean
  hostParticipantName: string
  guestCount: number
  relations: BillEditorRelations
  receiptUploaded: boolean
  receiptScanning: boolean
  scanReviewOpen: boolean
}

export function buildBillEditorGuidanceInput(
  input: BuildBillEditorGuidanceInputArgs,
): BillEditorGuidanceInput {
  return {
    billId: input.billId,
    step: input.step,
    restaurantName: input.restaurantName,
    restaurantFromOcr: input.restaurantFromOcr,
    hostParticipantName: input.hostParticipantName,
    guestCount: input.guestCount,
    items: input.relations.items.map((item) => ({
      id: item.id,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
    assignments: input.relations.assignments,
    receiptUploaded: input.receiptUploaded,
    receiptScanning: input.receiptScanning,
    scanReviewOpen: input.scanReviewOpen,
  }
}

export function shouldShowContentRouteChoice(input: {
  onboardingActive: boolean
  contentRoute: HostOnboardingContentRoute | undefined
  itemCount: number
}): boolean {
  return (
    input.onboardingActive &&
    input.contentRoute === undefined &&
    input.itemCount === 0
  )
}

export function isReceiptUploadedForEditor(input: {
  receiptStorageId?: string
  receiptUploadedForGuidance: boolean
}): boolean {
  return Boolean(input.receiptStorageId) || input.receiptUploadedForGuidance
}

export function isRestaurantFromOcr(input: {
  extractedRestaurantName?: string | null
  restaurantNameDraft: string
}): boolean {
  return Boolean(
    input.extractedRestaurantName?.trim() && input.restaurantNameDraft.trim(),
  )
}

export interface OcrRestaurantApplyResult {
  restaurantName: string
  appliedScanId: string
}

export function resolveOcrRestaurantApply(input: {
  scanId: string
  extractedRestaurantName?: string | null
  appliedScanId: string | null
  currentRestaurantName: string
}): OcrRestaurantApplyResult | null {
  const extracted = input.extractedRestaurantName?.trim()
  if (!extracted) return null
  if (input.appliedScanId === input.scanId) return null
  if (input.currentRestaurantName.trim()) return null
  return { restaurantName: extracted, appliedScanId: input.scanId }
}

export interface BillEditorMetadataFields {
  restaurantName: string
  date: string
  note: string
  tip: string
}

export function createInitialBillEditorMetadata(
  bill: {
    _id: string
    restaurantName: string
    date: number
    note?: string
    tipCents?: number
  },
  formatTip: (cents: number) => string,
): BillEditorMetadataFields {
  return {
    restaurantName: bill.restaurantName,
    date: toBillEditorDateInputValue(bill.date),
    note: bill.note ?? '',
    tip: formatTip(bill.tipCents ?? 0),
  }
}

export function shouldResetBillEditorMetadata(
  initializedBillId: string,
  nextBillId: string,
): boolean {
  return initializedBillId !== nextBillId
}
