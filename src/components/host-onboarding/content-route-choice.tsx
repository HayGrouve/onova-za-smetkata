import { CameraIcon, KeyboardIcon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { HOST_ONBOARDING_CONTENT_ROUTE } from '../../../shared/host-onboarding-messages.ts'
import type { HostOnboardingContentRoute } from '../../../shared/host-onboarding.ts'

export interface ContentRouteChoiceProps {
  onChoose: (route: HostOnboardingContentRoute) => void
}

export function ContentRouteChoice({ onChoose }: ContentRouteChoiceProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
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
