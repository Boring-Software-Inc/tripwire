import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "#/integrations/trpc/react"

export const Route = createFileRoute("/_admin")({
  component: AdminShell,
})

function AdminShell() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const me = useQuery({ ...trpc.auth.me.queryOptions() })

  useEffect(() => {
    if (me.isLoading) return
    if (!me.data) {
      navigate({ to: "/login" })
      return
    }
    if (!me.data.isAdmin) {
      navigate({ to: "/home" })
    }
  }, [me.data, me.isLoading, navigate])

  if (me.isLoading || !me.data || !me.data.isAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-red-300 uppercase">
              Admin
            </span>
            <span className="font-mono text-sm text-zinc-400">tripwire</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/admin/research"
              activeProps={{ className: "text-white" }}
              inactiveProps={{ className: "text-zinc-400 hover:text-white" }}
            >
              Research
            </Link>
            <Link
              to="/home"
              className="rounded border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5"
            >
              ← Exit admin
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
