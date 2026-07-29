import { createFileRoute } from '@tanstack/react-router'
import { CameraIcon, KeyboardIcon, UserPlusIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import {
  BillStepsBar,
  BILL_STEP_LABELS,
} from '#/components/bills/bill-steps-bar.tsx'
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
import { computeGuidanceState } from '../../../shared/guidance-controller.ts'
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
                { id: 'host', sortOrder: 0 },
                { id: 'g1', sortOrder: 1 },
              ]
            : [{ id: 'host', sortOrder: 0 }],
        items: [],
        assignments: [],
        hostParticipantId: 'host',
      }),
    [restaurantName, guestCount],
  )

  const guidanceState = useMemo(
    () =>
      computeGuidanceState({
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
        dismissedHintIds: [],
        editorStep: step,
        stepLabels: BILL_STEP_LABELS,
      }),
    [contentRoute, restaurantName, guestCount, step],
  )

  const goToStep = useCallback(
    (next: BillStep, options?: { resetScroll?: boolean }) => {
      void options
      setStep(next)
    },
    [],
  )

  const guidanceFocus = useGuidanceFocus({
    enabled: true,
    activeStep: guidanceState.activeStep,
    currentEditorStep: step,
    editorStepGuidanceComplete: guidanceState.editorStepGuidanceComplete,
  })

  const activeStep = guidanceState.activeStep

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
              <GuidanceTarget stepId="content-route" focus={guidanceFocus}>
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

            <GuidanceTarget stepId="restaurant" focus={guidanceFocus}>
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
          <GuidanceTarget stepId="participants" focus={guidanceFocus}>
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
              {guidanceState.steps.map((s) => (
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
