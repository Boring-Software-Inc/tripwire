import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@tripwire/ui/button"
import { useTRPC } from "#/integrations/trpc/react"

export const Route = createFileRoute("/_admin/admin/research/")({
  component: ResearchRunsPage,
})

function ResearchRunsPage() {
  const trpc = useTRPC()
  const runs = useQuery({ ...trpc.research.list.queryOptions({ limit: 50 }) })

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Research Runs</h1>
        <Link to="/admin/research/new">
          <Button>New run</Button>
        </Link>
      </div>

      {runs.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : runs.data && runs.data.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 uppercase">
            <tr>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-right">Requested</th>
              <th className="px-2 py-2 text-right">Done</th>
              <th className="px-2 py-2 text-right">Errored</th>
              <th className="px-2 py-2 text-right">PRs</th>
              <th className="px-2 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.data.map((run) => (
              <tr
                key={run.id}
                className="border-t border-white/5 hover:bg-white/5"
              >
                <td className="px-2 py-2">
                  <Link
                    to="/admin/research/$runId"
                    params={{ runId: run.id }}
                    className="text-blue-400 hover:underline"
                  >
                    {run.name}
                  </Link>
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {run.stats.requested}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {run.stats.completed}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {run.stats.errored}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {run.stats.prs}
                </td>
                <td className="px-2 py-2 text-xs text-zinc-500">
                  {new Date(run.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="py-12 text-center text-sm text-zinc-500">
          No runs yet. Click <span className="font-mono">New run</span> to get
          started.
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-yellow-500/20 text-yellow-300",
    running: "bg-blue-500/20 text-blue-300",
    completed: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
  }
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        colors[status] ?? "bg-white/10"
      }`}
    >
      {status}
    </span>
  )
}
