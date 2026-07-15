import type { EmailMessage } from "@opencoredev/email-sdk"
import { env } from "@tripwire/env/server"
import { EMAIL_FROM } from "./index"

interface AccessApprovedInput {
  to: string
  name: string
}

/** "You're in" email sent when an admin approves an access request. The
 * sign-in link lands the user on /login, which routes them to onboarding
 * once the session resolves as approved. */
export function accessApprovedEmail(input: AccessApprovedInput): EmailMessage {
  const signInUrl = `${env.APP_URL}/login`
  const firstName = input.name.split(" ")[0] || "there"

  return {
    from: EMAIL_FROM,
    to: input.to,
    subject: "You're in — your Tripwire access is approved",
    text: [
      `Hi ${firstName},`,
      "",
      "Your request to join Tripwire has been approved. You can sign in now and get set up:",
      "",
      signInUrl,
      "",
      "Sign in with the same GitHub account you requested access with.",
      "",
      "— The Tripwire team",
    ].join("\n"),
    html: renderApprovedHtml(firstName, signInUrl),
  }
}

function renderApprovedHtml(firstName: string, signInUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0e0e0e;color:#e8e8e8;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;">
            <tr><td style="font-size:18px;font-weight:600;padding-bottom:24px;">You're in.</td></tr>
            <tr><td style="font-size:14px;line-height:1.6;color:#b8b8b8;padding-bottom:16px;">Hi ${firstName}, your request to join Tripwire has been approved. Sign in with the same GitHub account you requested access with and finish setting up.</td></tr>
            <tr><td style="padding:8px 0 24px;">
              <a href="${signInUrl}" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;">Sign in to Tripwire</a>
            </td></tr>
            <tr><td style="font-size:12px;color:#7a7a7a;">If the button doesn't work, paste this link into your browser:<br /><a href="${signInUrl}" style="color:#9ecf97;">${signInUrl}</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
