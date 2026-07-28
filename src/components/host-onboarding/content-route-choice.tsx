import { CameraIcon, KeyboardIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  hasSeenContentRouteChoice,
  markContentRouteChoiceSeen,
} from '#/lib/host-onboarding-session.ts'
import { cn } from '#/lib/utils.ts'
import { HOST_ONBOARDING_CONTENT_ROUTE } from '../../../shared/host-onboarding-messages.ts'
import type { HostOnboardingContentRoute } from '../../../shared/host-onboarding.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ContentRouteChoiceProps {
  billId: Id<'bills'>
  onChoose: (route: HostOnboardingContentRoute) => void
}

export function ContentRouteChoice({
  billId,
  onChoose,
}: ContentRouteChoiceProps) {
  const [shouldPop, setShouldPop] = useState(false)

  useEffect(() => {
    if (hasSeenContentRouteChoice(billId)) return
    const timer = window.setTimeout(() => setShouldPop(true), 550)
    return () => window.clearTimeout(timer)
  }, [billId])

  function handlePopEnd(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== 'content-route-choice-pop') return
    markContentRouteChoiceSeen(billId)
  }

  return (
    <div
      className={cn(
        'flex origin-center flex-col gap-3 rounded-xl border border-dashed p-4',
        shouldPop && 'content-route-choice-pop',
      )}
      onAnimationEnd={shouldPop ? handlePopEnd : undefined}
    >
      <div>
        <p className="font-medium text-primary">
          {HOST_ONBOARDING_CONTENT_ROUTE.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {HOST_ONBOARDING_CONTENT_ROUTE.body}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => onChoose('scan')}
        >
          <CameraIcon className={ICON.button} aria-hidden />
          {HOST_ONBOARDING_CONTENT_ROUTE.scan}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => onChoose('manual')}
        >
          <KeyboardIcon className={ICON.button} aria-hidden />
          {HOST_ONBOARDING_CONTENT_ROUTE.manual}
        </Button>
      </div>
    </div>
  )
}
