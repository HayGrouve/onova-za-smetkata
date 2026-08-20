import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { HOST_ONBOARDING_WELCOME } from '../../../shared/host-onboarding-messages.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface WelcomeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDismiss: () => void
  billCount?: number
  onCreateFirstBill: () => Promise<Id<'bills'>>
  onStartGuidedWithExistingBills: () => Promise<Id<'bills'>>
}

export function WelcomeSheet({
  open,
  onOpenChange,
  onDismiss,
  billCount = 0,
  onCreateFirstBill,
  onStartGuidedWithExistingBills,
}: WelcomeSheetProps) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const hasExistingBills = billCount > 0

  async function navigateToGuidedBill(billId: Id<'bills'>) {
    await navigate({
      to: '/bills/$billId',
      params: { billId },
      search: { step: 1 },
    })
  }

  async function handleStartGuidedWithExistingBills() {
    setSubmitting(true)
    setError(undefined)
    try {
      const billId = await onStartGuidedWithExistingBills()
      await navigateToGuidedBill(billId)
    } catch (startError) {
      setError(getConvexErrorMessage(startError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateFirstBill() {
    if (hasExistingBills) return
    setSubmitting(true)
    setError(undefined)
    try {
      const billId = await onCreateFirstBill()
      await navigateToGuidedBill(billId)
    } catch (createError) {
      setError(getConvexErrorMessage(createError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        {hasExistingBills ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {HOST_ONBOARDING_WELCOME.existingBillsTitle}
              </SheetTitle>
              <SheetDescription>
                {HOST_ONBOARDING_WELCOME.existingBillsBlocked}
              </SheetDescription>
            </SheetHeader>
            {error ? (
              <p className="px-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
              <Button
                className="h-11 w-full"
                disabled={submitting}
                onClick={() => void handleStartGuidedWithExistingBills()}
              >
                {submitting
                  ? HOST_ONBOARDING_WELCOME.creating
                  : HOST_ONBOARDING_WELCOME.startGuidedWithExistingBills}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full"
                disabled={submitting}
                onClick={onDismiss}
              >
                {HOST_ONBOARDING_WELCOME.closeWelcome}
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{HOST_ONBOARDING_WELCOME.introTitle}</SheetTitle>
              <SheetDescription>
                {HOST_ONBOARDING_WELCOME.introBody}
              </SheetDescription>
            </SheetHeader>
            {error ? (
              <p className="px-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
              <Button
                className="h-11 w-full"
                disabled={submitting}
                onClick={() => void handleCreateFirstBill()}
              >
                {submitting
                  ? HOST_ONBOARDING_WELCOME.creating
                  : HOST_ONBOARDING_WELCOME.introPrimary}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full"
                disabled={submitting}
                onClick={onDismiss}
              >
                {HOST_ONBOARDING_WELCOME.introSecondary}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
