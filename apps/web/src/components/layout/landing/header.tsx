import { Link } from "@tanstack/react-router"
import type { AuthClientSession } from "@tripwire/auth/client"
import { TripwireLogo } from "@tripwire/ui/icons/tripwire-logo"

export function LandingHeader({ session }: { session: AuthClientSession }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <TripwireLogo className="h-5 w-5 text-black/85" />
        <span className="text-md font-['Geist',system-ui,sans-serif] font-medium text-black/85">
          tripwire
        </span>
      </div>
      <div className="flex items-center gap-3.5">
        {session ? (
          <>
            <span className="text-[14px] text-black/60">Welcome back</span>
            <Link
              to="/home"
              className="flex h-7 items-center rounded-lg bg-black px-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black/85"
            >
              dashboard
            </Link>
          </>
        ) : (
          <>
            <span className="text-[14px] text-black/60">
              Already have access?
            </span>
            <Link
              to="/login"
              className="flex h-7 items-center rounded-lg bg-black px-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black/85"
            >
              login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
