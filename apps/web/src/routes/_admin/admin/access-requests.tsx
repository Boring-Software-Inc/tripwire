import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { Button } from "@tripwire/ui/button"
import { Checkbox } from "@tripwire/ui/checkbox"
import { toastManager } from "@tripwire/ui/toast"
import { useTRPC } from "#/integrations/trpc/react"
import { toastFromError } from "#/lib/toast-error"
import { formatRelativeTime } from "#/lib/format"
import { buildSeo, formatPageTitle } from "#/lib/seo"

export const Route = createFileRoute("/_admin/admin/access-requests")({
  component: AccessRequestsPage,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Admin: access requests"),
      description: "Review, approve, and reject GitHub access requests.",
      robots: "noindex",
    }),
})

type StatusFilter = "pending" | "approved" | "rejected"

const PAGE_SIZE = 25

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

function AccessRequestsPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<StatusFilter>("pending")
  const [search, setSearch] = useState("")
  const [submittedSearch, setSubmittedSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const listInput = {
    status,
    search: submittedSearch || undefined,
    limit: PAGE_SIZE,
    offset,
  }

  const list = useQuery(trpc.accessRequests.list.queryOptions(listInput))

  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.accessRequests.list.queryKey(),
    })
    setSelected(new Set())
  }

  const approve = useMutation(
    trpc.accessRequests.approve.mutationOptions({
      onSuccess: () => {
        toastManager.add({ type: "success", title: "Approved" })
        invalidate()
      },
      onError: (err) => toastFromError(err),
    })
  )

  const reject = useMutation(
    trpc.accessRequests.reject.mutationOptions({
      onSuccess: () => {
        toastManager.add({ type: "success", title: "Rejected" })
        invalidate()
      },
      onError: (err) => toastFromError(err),
    })
  )

  const bulkApprove = useMutation(
    trpc.accessRequests.bulkApprove.mutationOptions({
      onSuccess: (res) => {
        toastManager.add({
          type: "success",
          title: `Approved ${res.approvedCount} ${
            res.approvedCount === 1 ? "request" : "requests"
          }`,
        })
        invalidate()
      },
      onError: (err) => toastFromError(err),
    })
  )

  const allSelected = items.length > 0 && selected.size === items.length
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const changeStatus = (next: StatusFilter) => {
    setStatus(next)
    setOffset(0)
    setSelected(new Set())
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittedSearch(search.trim())
    setOffset(0)
  }

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-10 md:px-[50px]">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold text-tw-text-primary">
          Access requests
        </h1>
        <p className="m-0 text-[13px] text-tw-text-muted">
          Review who's asked to join and approve or reject each request.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-tw-card p-0.5">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant="ghost"
              size="sm"
              onClick={() => changeStatus(tab.value)}
              className={`h-7 rounded-md px-3 text-[13px] font-medium ${
                status === tab.value
                  ? "bg-tw-inner text-tw-text-primary"
                  : "text-tw-text-muted hover:text-tw-text-primary"
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="flex items-center gap-1.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="h-7 w-56 rounded-lg border border-tw-border bg-tw-inner px-2.5 text-[13px] text-tw-text-primary placeholder:text-tw-text-tertiary focus:border-tw-text-tertiary focus:outline-none"
          />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      {status === "pending" && selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-tw-border bg-tw-card px-3 py-2">
          <span className="text-[13px] text-tw-text-secondary">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            loading={bulkApprove.isPending}
            onClick={() =>
              bulkApprove.mutate({ userIds: Array.from(selected) })
            }
          >
            Approve selected
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-tw-border">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-tw-border bg-tw-card text-left text-tw-text-muted">
              {status === "pending" ? (
                <th className="w-8 px-3 py-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              ) : null}
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">GitHub</th>
              <th className="px-3 py-2 font-medium">Account age</th>
              <th className="px-3 py-2 font-medium">Requested</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-tw-text-tertiary"
                >
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-tw-text-tertiary"
                >
                  No {status} requests.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <AccessRow
                  key={row.id}
                  row={row}
                  showCheckbox={status === "pending"}
                  selected={selected.has(row.id)}
                  onToggle={() => toggleRow(row.id)}
                  onApprove={() => approve.mutate({ userId: row.id })}
                  onReject={() => reject.mutate({ userId: row.id })}
                  actionsDisabled={approve.isPending || reject.isPending}
                  status={status}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[12px] text-tw-text-muted">
        <span>
          {pageStart}–{pageEnd} of {total}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pageEnd >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

interface AccessRowData {
  id: string
  name: string
  email: string
  image: string | null
  githubId: string | null
  waitlistedAt: Date | null
  createdAt: Date
}

interface AccessRowProps {
  row: AccessRowData
  showCheckbox: boolean
  selected: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  actionsDisabled: boolean
  status: StatusFilter
}

function AccessRow({
  row,
  showCheckbox,
  selected,
  onToggle,
  onApprove,
  onReject,
  actionsDisabled,
  status,
}: AccessRowProps) {
  const trpc = useTRPC()
  const githubId = row.githubId ? Number(row.githubId) : null

  const meta = useQuery({
    ...trpc.accessRequests.githubMeta.queryOptions(
      { githubId: githubId ?? 0 },
      { enabled: githubId !== null, staleTime: 5 * 60_000 }
    ),
  })

  const accountAge = useMemo(() => {
    if (!meta.data?.accountCreatedAt) return null
    return formatRelativeTime(meta.data.accountCreatedAt).replace(" ago", "")
  }, [meta.data?.accountCreatedAt])

  return (
    <tr className="border-b border-tw-border last:border-0 hover:bg-tw-hover/40">
      {showCheckbox ? (
        <td className="px-3 py-2.5 align-middle">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Select ${row.name}`}
          />
        </td>
      ) : null}

      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2.5">
          {row.image ? (
            <img
              src={row.image}
              alt=""
              className="size-7 shrink-0 rounded-full border border-tw-border"
            />
          ) : (
            <div className="size-7 shrink-0 rounded-full border border-tw-border bg-tw-inner" />
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-tw-text-primary">
              {row.name}
            </span>
            <span className="truncate text-[12px] text-tw-text-muted">
              {row.email}
            </span>
          </div>
          {row.waitlistedAt ? (
            <span
              title={`On the email waitlist since ${new Date(
                row.waitlistedAt
              ).toLocaleDateString()}`}
              className="shrink-0 rounded bg-tw-accent/15 px-1.5 py-px text-[10px] font-semibold tracking-wide text-tw-accent uppercase"
            >
              Waitlist
            </span>
          ) : null}
        </div>
      </td>

      <td className="px-3 py-2.5 align-middle">
        {meta.data ? (
          <a
            href={meta.data.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-tw-text-secondary hover:text-tw-text-primary"
          >
            @{meta.data.login}
            <ExternalLink className="size-3" />
          </a>
        ) : meta.isLoading ? (
          <span className="text-tw-text-tertiary">…</span>
        ) : (
          <span className="text-tw-text-tertiary">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 align-middle text-tw-text-secondary">
        {accountAge ?? <span className="text-tw-text-tertiary">—</span>}
      </td>

      <td className="px-3 py-2.5 align-middle text-tw-text-secondary">
        {formatRelativeTime(row.createdAt)}
      </td>

      <td className="px-3 py-2.5 text-right align-middle">
        {status === "pending" ? (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={actionsDisabled}
              onClick={onReject}
            >
              Reject
            </Button>
            <Button size="sm" disabled={actionsDisabled} onClick={onApprove}>
              Approve
            </Button>
          </div>
        ) : status === "rejected" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={actionsDisabled}
            onClick={onApprove}
          >
            Approve
          </Button>
        ) : null}
      </td>
    </tr>
  )
}
