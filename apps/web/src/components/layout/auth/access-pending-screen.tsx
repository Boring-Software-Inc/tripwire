import { authClient } from "@tripwire/auth/client"
import { TripwireLogo } from "@tripwire/ui/icons/tripwire-logo"
import type { AccessStatus } from "@tripwire/db"

/**
 * Minimal full-screen waitlist / access-status screen. Shared by the `/queue`
 * route and the in-shell `AccessGate` boundary so both render identically.
 */
export function AccessPendingScreen({
  email,
  image,
  status,
}: {
  email?: string | null
  image?: string | null
  status: AccessStatus
}) {
  const rejected = status === "rejected"

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-tw-bg px-6 antialiased">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-7 text-center">
        <TripwireLogo className="size-7 text-tw-text-primary" />

        <div className="flex flex-col gap-2.5">
          <h1 className="text-[17px] font-semibold text-tw-text-primary">
            {rejected ? "Not this time" : "You're on the waitlist"}
          </h1>
          <p className="text-[13px] leading-relaxed text-tw-text-secondary">
            {rejected
              ? "Your access request wasn't approved. Thanks for your interest in Tripwire — feel free to check back as we open up more broadly."
              : "You applied with GitHub — you're in line for the closed beta. We review requests manually and will email you the moment you're approved."}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-tw-text-muted">
          {image ? (
            <img src={image} alt="" className="size-5 rounded-full" />
          ) : null}
          {email ? <span>{email}</span> : null}
          <span className="text-tw-text-tertiary">·</span>
          <button
            type="button"
            onClick={() => authClient.signOut()}
            className="text-tw-text-tertiary underline-offset-2 hover:text-tw-text-secondary hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
