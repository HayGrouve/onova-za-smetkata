const SITE_NAME = 'Онова за сметката'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function buildMagicLinkHtml(url: string): string {
  const safeUrl = escapeHtml(url)
  return `<!DOCTYPE html>
<html lang="bg">
  <body style="margin:0;background:#0a1418;font-family:Manrope,Arial,sans-serif;color:#f3faf5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <tr>
        <td style="text-align:center;padding-bottom:24px;">
          <div style="font-size:22px;font-weight:700;">${SITE_NAME}</div>
        </td>
      </tr>
      <tr>
        <td style="background:#173a40;border-radius:16px;padding:28px 24px;text-align:center;">
          <p style="margin:0 0 12px;font-size:18px;font-weight:600;">Влезте в профила си</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#d7ece8;">
            Натиснете бутона по-долу, за да влезете. Линкът е валиден 24 часа.
          </p>
          <a href="${safeUrl}" style="display:inline-block;background:#4fb8b2;color:#0a1418;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px;">
            Влез
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding-top:20px;font-size:13px;line-height:1.5;color:#94a3b8;text-align:center;">
          Ако не сте поискали този имейл, можете спокойно да го игнорирате.
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendMagicLinkEmail(options: {
  to: string
  url: string
  from: string
  apiKey: string
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: options.from,
      to: options.to,
      subject: `Влез в ${SITE_NAME}`,
      html: buildMagicLinkHtml(options.url),
      text: `Влез в ${SITE_NAME}\n\n${options.url}\n\nАко не сте поискали този имейл, игнорирайте го.`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend error: ${await response.text()}`)
  }
}
