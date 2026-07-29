import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import {
  formatUsernameError,
  parseUsername,
  resolveHostParticipantName,
} from '#/lib/host-profile.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { HOST_ONBOARDING_WELCOME } from '../../../shared/host-onboarding-messages.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface WelcomeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stage: 'intro' | 'name'
  onAdvanceStage: () => void
  onDismiss: () => void
  authName?: string | null
  username?: string | null
  billCount?: number
  onConfirmName: (name: string) => Promise<Id<'bills'>>
  onStartGuidedWithExistingBills: () => Promise<Id<'bills'>>
}

export function WelcomeSheet({
  open,
  onOpenChange,
  stage,
  onAdvanceStage,
  onDismiss,
  authName,
  username,
  billCount = 0,
  onConfirmName,
  onStartGuidedWithExistingBills,
}: WelcomeSheetProps) {
  const navigate = useNavigate()
  const suggestedName = resolveHostParticipantName({ username, authName })
  const [name, setName] = useState(suggestedName)
  const [error, setError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const hasExistingBills = billCount > 0

  useEffect(() => {
    if (open && stage === 'name') {
      setName(suggestedName)
    }
  }, [open, stage, suggestedName])

  async function handleStartGuidedWithExistingBills() {
    setSubmitting(true)
    setError(undefined)
    try {
      const billId = await onStartGuidedWithExistingBills()
      await navigate({
        to: '/bills/$billId',
        params: { billId },
        search: { step: 1 },
      })
    } catch (startError) {
      setError(getConvexErrorMessage(startError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm() {
    if (hasExistingBills) {
      return
    }
    const parsed = parseUsername(name)
    if (!parsed.success) {
      setError(formatUsernameError(parsed.error))
      return
    }
    if (!parsed.data) {
      setError(HOST_ONBOARDING_WELCOME.nameEmptyError)
      return
    }

    setSubmitting(true)
    setError(undefined)
    try {
      const billId = await onConfirmName(parsed.data)
      await navigate({
        to: '/bills/$billId',
        params: { billId },
        search: { step: 1 },
      })
    } catch (confirmError) {
      setError(getConvexErrorMessage(confirmError))
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
                  ? 'Създаване...'
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
        ) : stage === 'intro' ? (
          <>
            <SheetHeader>
              <SheetTitle>{HOST_ONBOARDING_WELCOME.introTitle}</SheetTitle>
              <SheetDescription>
                {HOST_ONBOARDING_WELCOME.introBody}
              </SheetDescription>
            </SheetHeader>
            <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
              <Button className="h-11 w-full" onClick={onAdvanceStage}>
                {HOST_ONBOARDING_WELCOME.introPrimary}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full"
                onClick={onDismiss}
              >
                {HOST_ONBOARDING_WELCOME.introSecondary}
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{HOST_ONBOARDING_WELCOME.nameTitle}</SheetTitle>
              <SheetDescription>
                {HOST_ONBOARDING_WELCOME.nameBody}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2 px-4">
              <Label htmlFor="welcome-host-name">
                {HOST_ONBOARDING_WELCOME.nameFieldLabel}
              </Label>
              <Input
                id="welcome-host-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  if (error) setError(undefined)
                }}
                className="h-11"
                autoComplete="name"
              />
              <p className="text-xs text-muted-foreground">
                {HOST_ONBOARDING_WELCOME.nameHelper}
              </p>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <SheetFooter className="mt-6">
              <Button
                className="h-11 w-full"
                disabled={submitting}
                onClick={() => void handleConfirm()}
              >
                {submitting
                  ? 'Създаване...'
                  : HOST_ONBOARDING_WELCOME.namePrimary}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
