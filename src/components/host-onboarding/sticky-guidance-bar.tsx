import { ChevronDownIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  readCollapsedHintIds,
  setHintCollapsedThisSession,
} from '#/lib/host-onboarding-session.ts'
import { cn } from '#/lib/utils.ts'
import { guidanceCollapsedPreview } from '../../../shared/guidance-bar-summary.ts'
import {
  HOST_ONBOARDING_HANDOFF,
  HOST_ONBOARDING_HOME,
  HOST_ONBOARDING_STEP_BAR,
} from '../../../shared/host-onboarding-messages.ts'
import type { GuidanceStep } from '../../../shared/host-onboarding.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export type EditorGuidancePanel =
  | {
      kind: 'hint'
      hintId: string
      step: GuidanceStep
      onDismissHint: () => void
      onStopGuidance: () => void
    }
  | {
      kind: 'handoff'
      hintId: string
      onDismiss: () => void
    }

export interface StickyGuidanceBarProps {
  billId: Id<'bills'>
  panel: EditorGuidancePanel | null
  /** Bumps when session-local collapse flags change. */
  sessionVersion: number
  onSessionChange: () => void
}

export function StickyGuidanceBar({
  billId,
  panel,
  sessionVersion,
  onSessionChange,
}: StickyGuidanceBarProps) {
  if (!panel) return null

  return (
    <StickyGuidanceBarContent
      key={`${panel.kind}:${panel.hintId}`}
      billId={billId}
      panel={panel}
      sessionVersion={sessionVersion}
      onSessionChange={onSessionChange}
    />
  )
}

function StickyGuidanceBarContent({
  billId,
  panel,
  sessionVersion,
  onSessionChange,
}: StickyGuidanceBarProps & { panel: EditorGuidancePanel }) {
  const [open, setOpen] = useState(
    () => !readCollapsedHintIds(billId).includes(panel.hintId),
  )

  useEffect(() => {
    setOpen(!readCollapsedHintIds(billId).includes(panel.hintId))
  }, [billId, panel.hintId, sessionVersion])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    setHintCollapsedThisSession(billId, panel.hintId, !nextOpen)
    onSessionChange()
  }

  const isHandoff = panel.kind === 'handoff'
  const title =
    panel.kind === 'hint' ? panel.step.title : HOST_ONBOARDING_HANDOFF.title
  const body =
    panel.kind === 'hint' ? panel.step.body : HOST_ONBOARDING_HANDOFF.body
  const preview = guidanceCollapsedPreview(body)

  return (
    <div
      className={cn(
        'border-b px-4 py-2',
        isHandoff
          ? 'border-success/40 bg-success/5'
          : 'border-primary/40 bg-primary/5',
      )}
    >
      <Collapsible open={open} onOpenChange={handleOpenChange}>
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <div className="flex items-start gap-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="tap-feedback min-w-0 flex-1 rounded-md text-left"
                aria-expanded={open}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{title}</p>
                    {!open && preview ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {preview}
                      </p>
                    ) : null}
                  </div>
                  <ChevronDownIcon
                    className={cn(
                      ICON.button,
                      'mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200',
                      open && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </div>
              </button>
            </CollapsibleTrigger>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
              aria-label={HOST_ONBOARDING_STEP_BAR.dismissHint}
              onClick={() => {
                if (panel.kind === 'hint') {
                  panel.onDismissHint()
                } else {
                  panel.onDismiss()
                }
              }}
            >
              ×
            </button>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
            {body ? (
              <p className="text-sm text-muted-foreground">{body}</p>
            ) : null}
            {panel.kind === 'hint' ? (
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={panel.onStopGuidance}
                >
                  {HOST_ONBOARDING_HOME.stopGuidance}
                </Button>
              </div>
            ) : null}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}
