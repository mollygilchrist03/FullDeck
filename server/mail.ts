/**
 * Transactional email via Resend (https://resend.com) — plain text, one call.
 * Needs RESEND_API_KEY and MAIL_FROM. Without them `sendMail` is a no-op that
 * logs the message so the flows are still testable in dev / on a deployment
 * with no mail configured.
 */
type Headers = Record<string, string | string[] | undefined>

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM)
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!mailConfigured()) {
    console.log(`[mail:not-configured] to=${to} subject="${subject}"\n${text}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }),
  })
  if (!res.ok) throw new Error(`mail send failed: ${res.status} ${await res.text()}`)
}

/** Absolute origin of the current request, for building links in emails. */
export function originOf(headers: Headers): string {
  const proto = (headers['x-forwarded-proto'] as string) ?? 'https'
  const host = (headers['x-forwarded-host'] as string) ?? (headers.host as string)
  return `${proto}://${host}`
}
