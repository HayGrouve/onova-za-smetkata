import { Link, createFileRoute } from '@tanstack/react-router'
import { ReceiptMessage } from '#/components/receipt/receipt-states.tsx'
import { Button } from '#/components/ui/button.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

export const Route = createFileRoute('/$')({
  head: () => buildNoIndexHead('Страницата не е намерена'),
  component: NotFoundPage,
})

function NotFoundPage() {
  return (
    <ReceiptMessage
      title="Страницата не е намерена"
      action={
        <Button asChild className="w-full">
          <Link to="/">Към началото</Link>
        </Button>
      }
    >
      Тази бележка не е на масата. Проверете адреса или се върнете към началото.
    </ReceiptMessage>
  )
}
