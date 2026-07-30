import { createFileRoute } from '@tanstack/react-router'
import {
  LegalPageLayout,
  buildLegalPageHead,
} from '#/components/legal-page-layout.tsx'

export const Route = createFileRoute('/privacy')({
  head: () => buildLegalPageHead('Политика за поверителност', '/privacy'),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPageLayout title="Политика за поверителност">
      <p>
        <strong>Онова за сметката</strong> („приложението“) е уеб приложение за
        разделяне на ресторантски сметки. Тази политика описва какви данни
        събираме и как ги използваме.
      </p>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">
          Какви данни събираме
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Данни за вход (само домакини):</strong> имейл адрес и име от
            Google или от магически линк. Използват се единствено за
            идентификация на акаунта ви.
          </li>
          <li>
            <strong>Данни за сметки:</strong> имена на участници, артикули,
            разпределения и плащания, които вие или гостите на масата въвеждат.
          </li>
          <li>
            <strong>Технически данни:</strong> стандартни логове от хостинга и
            базата данни за сигурност и отстраняване на проблеми.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">
          Гости без акаунт
        </h2>
        <p>
          Гостите на масата могат да участват чрез QR линк без регистрация.
          Избират само име за сметката; не събираме имейл или профил от гостите.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">
          Как използваме данните
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>За предоставяне на функционалността на приложението</li>
          <li>За изпращане на линкове за вход по имейл (магически линк)</li>
          <li>За поддръжка, сигурност и подобряване на услугата</li>
        </ul>
        <p>Не продаваме лични данни на трети страни.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">
          Споделяне с трети страни
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Google</strong> — при вход с Google (OAuth), според
            политиката на Google
          </li>
          <li>
            <strong>Convex</strong> — хостинг на базата данни и автентикация
          </li>
          <li>
            <strong>Vercel</strong> — хостинг на уеб приложението
          </li>
          <li>
            <strong>Resend</strong> — изпращане на имейли за магически линк
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">Съхранение</h2>
        <p>
          Данните се съхраняват, докато поддържате акаунт и сметки в
          приложението. Можете да поискате изтриване, като се свържете с нас.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium text-foreground">Контакт</h2>
        <p>
          За въпроси относно поверителността:{' '}
          <a
            href="mailto:privacy@onova-za-smetkata.com"
            className="underline underline-offset-2 hover:text-foreground"
          >
            privacy@onova-za-smetkata.com
          </a>
        </p>
      </section>

      <p className="text-xs">Последна актуализация: юли 2026 г.</p>
    </LegalPageLayout>
  )
}
