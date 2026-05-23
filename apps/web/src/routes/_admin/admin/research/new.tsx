import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@tripwire/ui/button"
import { useTRPC } from "#/integrations/trpc/react"
import { toastFromError } from "#/lib/toast-error"

export const Route = createFileRoute("/_admin/admin/research/new")({
  component: NewResearchRunPage,
})

function NewResearchRunPage() {
  const trpc = useTRPC()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [usernamesText, setUsernamesText] = useState("")
  const [cutoffDate, setCutoffDate] = useState("2022-11-30")
  const [prLimit, setPrLimit] = useState(100)
  const [repoFullName, setRepoFullName] = useState("")

  const kickoff = useMutation({
    ...trpc.research.kickoff.mutationOptions(),
    onSuccess: ({ runId }) => {
      navigate({ to: "/admin/research/$runId", params: { runId } })
    },
    onError: (err) => {
      toastFromError(err, { fallbackTitle: "Couldn't start research run" })
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const usernames = usernamesText
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
    if (usernames.length === 0) return

    kickoff.mutate({
      name,
      usernames,
      cutoffDate: new Date(cutoffDate).toISOString(),
      prLimitPerUser: prLimit,
      repoFullName: repoFullName || undefined,
    })
  }

  const usernameCount = usernamesText
    .split(/[\s,]+/)
    .filter((u) => u.trim().length > 0).length

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">New Research Run</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 200-user pilot"
            className="w-full rounded border border-white/10 bg-transparent px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Usernames{" "}
            <span className="text-xs text-zinc-500">({usernameCount})</span>
          </label>
          <textarea
            value={usernamesText}
            onChange={(e) => setUsernamesText(e.target.value)}
            placeholder="one per line, or comma-separated"
            rows={10}
            className="w-full rounded border border-white/10 bg-transparent px-3 py-2 font-mono text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Cutoff date
            </label>
            <input
              type="date"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
              className="w-full rounded border border-white/10 bg-transparent px-3 py-2"
            />
            <p className="mt-1 text-xs text-zinc-500">
              PRs before this date are labeled <code>pre_ai</code>; on/after are{" "}
              <code>post_ai</code>.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              PRs per user
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={prLimit}
              onChange={(e) => setPrLimit(Number(e.target.value))}
              className="w-full rounded border border-white/10 bg-transparent px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Repo context (optional)
          </label>
          <input
            value={repoFullName}
            onChange={(e) => setRepoFullName(e.target.value)}
            placeholder="owner/repo"
            className="w-full rounded border border-white/10 bg-transparent px-3 py-2"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Authenticated via <code>RESEARCH_GH_TOKEN</code> (PAT with{" "}
            <code>public_repo</code> scope). Works against any public repo — the
            GH App does not need to be installed.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={kickoff.isPending}>
            {kickoff.isPending ? "Starting…" : "Start run"}
          </Button>
        </div>
      </form>
    </div>
  )
}
