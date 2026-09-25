import { LightbulbIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  dismissClaimHint,
  isClaimHintDismissed,
} from '#/lib/claim-hint-storage.ts'

/** First-visit how-to for the claim page; dismissed once per device. */
export function ClaimHint() {
  const [visible, setVisible] = useState(() => !isClaimHintDismissed())
  if (!visible) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <LightbulbIcon className={ICON.section} aria-hidden />
        Как се отбелязва
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
        <li>Натиснете „Мое“ или „+“ за всяка бройка, която сте консумирали.</li>
        <li>
          Делили сте нещо с някого? Натиснете „Сподели“ и изберете с кого.
        </li>
        <li>Накрая — „Към плащане“.</li>
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 self-end"
        onClick={() => {
          dismissClaimHint()
          setVisible(false)
        }}
      >
        Разбрах
      </Button>
    </div>
  )
}
