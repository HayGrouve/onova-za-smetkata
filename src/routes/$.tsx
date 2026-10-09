import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ReceiptMessage } from '#/components/receipt/receipt-states.tsx'
import { Button } from '#/components/ui/button.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

export const Route = createFileRoute('/$')({
  // Throwing `notFound()` (rather than just rendering the page) makes SSR
  // answer 404, so crawlers do not index unknown URLs as real pages.
  loader: () => {
    throw notFound()
  },
  head: () => buildNoIndexHead('Страницата не е намерена'),
  notFoundComponent: NotFoundPage,
})

function NotFoundPage() {
  return (
    <ReceiptMessage
      title="Страницата не е намерена"
      headingLevel="h1"
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
