import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@tripwire/ui/button"
import { useTRPC } from "#/integrations/trpc/react"

export const Route = createFileRoute("/_admin/admin/research/$runId")({
  component: ResearchRunDetailPage,
})

function ResearchRunDetailPage() {
  const { runId } = Route.useParams()
  const trpc = useTRPC()

  const status = useQuery({
    ...trpc.research.status.queryOptions({ runId }),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === "queued" || s === "running" ? 2000 : false
    },
  })

  const run = status.data

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-2 flex items-center gap-2">
        <Link
          to="/admin/research"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← All runs
        </Link>
      </div>
      <h1 className="mb-1 text-2xl font-semibold">{run?.name ?? "Loading…"}</h1>
      <p className="mb-6 text-xs text-zinc-500">
        {run?.id} · created{" "}
        {run ? new Date(run.createdAt).toLocaleString() : ""}
      </p>

      {run && (
        <>
          <div className="mb-6 grid grid-cols-5 gap-4 rounded border border-white/10 p-4">
            <Stat label="Status" value={run.status} />
            <Stat label="Requested" value={String(run.stats.requested)} />
            <Stat label="Completed" value={String(run.stats.completed)} />
            <Stat label="Errored" value={String(run.stats.errored)} />
            <Stat label="PRs" value={String(run.stats.prs)} />
          </div>

          {run.status === "running" || run.status === "queued" ? (
            <p className="mb-6 text-sm text-zinc-500">
              In progress — this page refreshes every 2 seconds.
            </p>
          ) : null}

          {run.status === "completed" && (
            <div className="flex flex-wrap gap-2">
              <ExportButton
                runId={runId}
                kind="contributors"
                label="Download contributors.csv"
              />
              <ExportButton runId={runId} kind="prs" label="Download prs.csv" />
              <JsonlButton runId={runId} />
            </div>
          )}

          {run.errorMessage && (
            <pre className="mt-4 rounded border border-white/10 bg-red-500/10 p-3 text-sm text-red-300">
              {run.errorMessage}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 uppercase">{label}</div>
      <div className="mt-1 text-lg font-medium tabular-nums">{value}</div>
    </div>
  )
}

function ExportButton({
  runId,
  kind,
  label,
}: {
  runId: string
  kind: "contributors" | "prs"
  label: string
}) {
  const trpc = useTRPC()
  const query = useQuery({
    ...trpc.research.exportCsv.queryOptions({ runId, scope: kind }),
    enabled: false,
  })

  async function handleClick() {
    const result = await query.refetch()
    if (!result.data) return
    triggerDownload(result.data.filename, result.data.body, "text/csv")
  }

  return (
    <Button onClick={handleClick} disabled={query.isFetching}>
      {query.isFetching ? "Preparing…" : label}
    </Button>
  )
}

function JsonlButton({ runId }: { runId: string }) {
  const trpc = useTRPC()
  const query = useQuery({
    ...trpc.research.exportJsonl.queryOptions({ runId }),
    enabled: false,
  })

  async function handleClick() {
    const result = await query.refetch()
    if (!result.data) return
    triggerDownload(
      result.data.filename,
      result.data.body,
      "application/x-ndjson"
    )
  }

  return (
    <Button onClick={handleClick} disabled={query.isFetching}>
      {query.isFetching ? "Preparing…" : "Download .jsonl"}
    </Button>
  )
}

function triggerDownload(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
