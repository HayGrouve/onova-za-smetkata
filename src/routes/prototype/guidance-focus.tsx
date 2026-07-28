import { createFileRoute } from '@tanstack/react-router'
import { CameraIcon, KeyboardIcon, UserPlusIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import { BillStepsBar } from '#/components/bills/bill-steps-bar.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import { useGuidanceFocus } from '#/lib/guidance-focus/use-guidance-focus.ts'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { getBillStepCompletion } from '#/lib/bill-step-completion.ts'
import { deriveHostOnboardingGuidance } from '../../../shared/host-onboarding.ts'
import { HOST_ONBOARDING_CONTENT_ROUTE } from '../../../shared/host-onboarding-messages.ts'

export const Route = createFileRoute('/prototype/guidance-focus')({
  head: () => buildNoIndexHead('Prototype — guidance focus'),
  component: GuidanceFocusPrototypePage,
})

function GuidanceFocusPrototypePage() {
  const [step, setStep] = useState<BillStep>(1)
  const [contentRoute, setContentRoute] = useState<
    'scan' | 'manual' | undefined
  >()
  const [restaurantName, setRestaurantName] = useState('')
  const [guestCount, setGuestCount] = useState(0)

  const stepCompletion = useMemo(
    () =>
      getBillStepCompletion({
        restaurantName,
        participants:
          guestCount > 0
            ? [
                { id: 'host', name: 'Аз' },
                { id: 'g1', name: 'Гост' },
              ]
            : [{ id: 'host', name: 'Аз' }],
        items: [],
        assignments: [],
        hostParticipantId: 'host',
      }),
    [restaurantName, guestCount],
  )

  const guidanceBundle = useMemo(() => {
    const dismissedHintIds: string[] = []
    const steps = deriveHostOnboardingGuidance({
      bill: {
        restaurantName,
        restaurantFromOcr: false,
        hostParticipantName: 'Аз',
        guestCount,
        items: [],
        assignments: [],
        contentRoute,
        receiptUploaded: false,
        receiptScanning: false,
        scanReviewOpen: false,
      },
      dismissedHintIds,
    })
    return { steps, dismissedHintIds }
  }, [contentRoute, restaurantName, guestCount])

  const goToStep = useCallback(
    (next: BillStep, options?: { resetScroll?: boolean }) => {
      void options
      setStep(next)
    },
    [],
  )

  const guidanceFocus = useGuidanceFocus({
    enabled: true,
    steps: guidanceBundle.steps,
    dismissedHintIds: guidanceBundle.dismissedHintIds,
    currentEditorStep: step,
  })

  const activeStep = guidanceBundle.steps.find(
    (s) => s.id === guidanceFocus.activeStepId,
  )

  return (
    <div className="page-shell pb-24">
      <div className="page-container flex flex-col gap-4">
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              PROTOTYPE — guidance focus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Drives <code className="text-foreground">useGuidanceFocus</code>{' '}
              through content-route → restaurant → participants. Complete each
              control to chain scroll+pop.
            </p>
            <p>
              Active step:{' '}
              <strong className="text-foreground">
                {activeStep?.id ?? '—'}
              </strong>{' '}
              · editor step {step}
            </p>
          </CardContent>
        </Card>

        <BillStepsBar
          step={step}
          completed={stepCompletion}
          onStepSelect={(s) => goToStep(s)}
        />

        {step === 1 && (
          <>
            {!contentRoute ? (
              <GuidanceTarget
                stepId="content-route"
                register={guidanceFocus.registerTarget}
                shouldPop={guidanceFocus.poppingStepId === 'content-route'}
                reducedHighlight={
                  guidanceFocus.reducedHighlightStepId === 'content-route'
                }
                onPopAnimationEnd={guidanceFocus.onPopAnimationEnd}
              >
                <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
                  <p className="font-medium text-primary">
                    {HOST_ONBOARDING_CONTENT_ROUTE.title}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1"
                      onClick={() => setContentRoute('scan')}
                    >
                      <CameraIcon className={ICON.button} aria-hidden />
                      {HOST_ONBOARDING_CONTENT_ROUTE.scan}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1"
                      onClick={() => setContentRoute('manual')}
                    >
                      <KeyboardIcon className={ICON.button} aria-hidden />
                      {HOST_ONBOARDING_CONTENT_ROUTE.manual}
                    </Button>
                  </div>
                </div>
              </GuidanceTarget>
            ) : null}

            <GuidanceTarget
              stepId="restaurant"
              register={guidanceFocus.registerTarget}
              shouldPop={guidanceFocus.poppingStepId === 'restaurant'}
              reducedHighlight={
                guidanceFocus.reducedHighlightStepId === 'restaurant'
              }
              onPopAnimationEnd={guidanceFocus.onPopAnimationEnd}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Данни за сметката</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="proto-restaurant">Ресторант</Label>
                    <Input
                      id="proto-restaurant"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Напр. Механа Крайречна"
                      className="h-11"
                    />
                  </div>
                </CardContent>
              </Card>
            </GuidanceTarget>
          </>
        )}

        {step === 2 && (
          <GuidanceTarget
            stepId="participants"
            register={guidanceFocus.registerTarget}
            shouldPop={guidanceFocus.poppingStepId === 'participants'}
            reducedHighlight={
              guidanceFocus.reducedHighlightStepId === 'participants'
            }
            onPopAnimationEnd={guidanceFocus.onPopAnimationEnd}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Участници</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Име на участник"
                    className="h-11 flex-1"
                    readOnly
                    value={guestCount > 0 ? 'Гост' : ''}
                  />
                  <Button
                    type="button"
                    className="h-11"
                    onClick={() => setGuestCount(1)}
                    disabled={guestCount > 0}
                  >
                    <UserPlusIcon className={ICON.button} aria-hidden />
                    Добави
                  </Button>
                </div>
              </CardContent>
            </Card>
          </GuidanceTarget>
        )}

        <Card className={cn('text-xs', step === 3 && 'opacity-60')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Guidance state</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono">
              {guidanceBundle.steps.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    s.done && 'text-muted-foreground line-through',
                    s.id === guidanceFocus.activeStepId &&
                      'font-semibold text-primary',
                  )}
                >
                  {s.id} · step {s.step} · {s.done ? 'done' : 'open'}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
