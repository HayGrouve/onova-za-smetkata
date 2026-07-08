import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

export const Route = createFileRoute('/$')({
  head: () => buildNoIndexHead('Страницата не е намерена'),
  component: NotFoundPage,
})

function NotFoundPage() {
  return (
    <div className="page-container flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-10 text-center">
      <h1 className="text-lg font-semibold">Страницата не е намерена</h1>
      <p className="text-sm text-muted-foreground">
        Проверете адреса или се върнете към началото.
      </p>
      <Button asChild className="h-11">
        <Link to="/">Към началото</Link>
      </Button>
    </div>
  )
}
