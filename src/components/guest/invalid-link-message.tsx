import { Link } from '@tanstack/react-router'
import { ReceiptMessage } from '#/components/receipt/receipt-states.tsx'
import { Button } from '#/components/ui/button.tsx'
import { GUEST_FLOW_MESSAGES } from '../../../shared/guest-flow-messages.ts'

/** A share link that cannot work: say so and offer the way home. */
export function InvalidLinkMessage({
  message = GUEST_FLOW_MESSAGES.invalidShareLink,
}: {
  message?: string
}) {
  return (
    <ReceiptMessage
      title="Линкът не работи"
      action={
        <Button asChild className="w-full">
          <Link to="/">Към началото</Link>
        </Button>
      }
    >
      {message}
    </ReceiptMessage>
  )
}
