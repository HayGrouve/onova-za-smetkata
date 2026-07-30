import { createFileRoute } from '@tanstack/react-router'
import {
  LegalPageLayout,
  buildLegalPageHead,
} from '#/components/legal-page-layout.tsx'

export const Route = createFileRoute('/terms')({
  head: () => buildLegalPageHead('Общи условия', '/terms'),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPageLayout title="Общи условия">
      <p>
        С използването на <strong>Онова за сметката</strong> („приложението“)
        приемате настоящите условия. Ако не сте съгласни, моля не използвайте
        приложението.
      </p>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">Услугата</h2>
        <p>
          Приложението помага на групи да разделят ресторантски сметки: добавяне
          на участници, разпределяне на артикули и проследяване на плащания.
          Предоставя се „както е“ без гаранция за непрекъсната работа.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">Акаунти</h2>
        <p>
          Само домакините (създателите на сметки) се регистрират с Google или
          магически линк. Отговорни сте за сигурността на достъпа до акаунта си.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">
          Гости и съдържание
        </h2>
        <p>
          Гостите участват без акаунт чрез споделен линк. Вие и участниците
          носите отговорност за въведените имена и суми. Не публикувайте
          незаконно или обидно съдържание.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">
          Точност на изчисленията
        </h2>
        <p>
          Приложението улеснява разделяне на сметки, но не замества ваша
          проверка на сумите. Не носим отговорност за финансови спорове между
          участници.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">
          Ограничение на отговорността
        </h2>
        <p>
          До максимално допустимата от закона степен не отговаряме за непреки
          щети, загуба на данни или пропуснати ползи, произтичащи от
          използването на приложението.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">Промени</h2>
        <p>
          Можем да актуализираме условията. Продължаващото използване след
          промяна означава приемане на новата версия.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">Контакт</h2>
        <p>
          Въпроси:{' '}
          <a
            href="mailto:support@onova-za-smetkata.com"
            className="underline underline-offset-2 hover:text-foreground"
          >
            support@onova-za-smetkata.com
          </a>
        </p>
      </section>

      <p className="text-xs">Последна актуализация: юли 2026 г.</p>
    </LegalPageLayout>
  )
}
