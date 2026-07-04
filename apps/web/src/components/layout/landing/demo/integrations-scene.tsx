"use client"

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GithubIcon,
  InfoIcon,
  SearchIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import { ACCOUNTS, REPOS } from "./data"
import { listStagger, rowIn } from "./motion"
import { ACCENT, V } from "./theme"

const PAGE_SIZE = 5

/** modkit's GitHub integrations page: account cards, the active-repository
 * picker with working pagination and set-active. */
export function IntegrationsScene() {
  const [page, setPage] = useState(0)
  const [activeRepo, setActiveRepo] = useState("vercel/next.js")

  const pageCount = Math.ceil(REPOS.length / PAGE_SIZE)
  const rows = REPOS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <motion.div
      className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-5 pt-4 pb-4"
      variants={listStagger}
    >
      <motion.header variants={rowIn} className="flex flex-col gap-1">
        <h1 className="text-[20px] font-semibold" style={{ color: V.fg }}>
          GitHub
        </h1>
        <p className="text-[12px]" style={{ color: V.fg2 }}>
          Connect GitHub to{" "}
          <span className="font-medium" style={{ color: V.fg }}>
            acme
          </span>{" "}
          and choose the repository modkit moderates.
        </p>
      </motion.header>

      {/* connected accounts */}
      <motion.div variants={rowIn} className="flex flex-col gap-1">
        {ACCOUNTS.map((a) => (
          <div
            key={a.login}
            className="flex items-center justify-between gap-4 rounded-xl p-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={a.avatar}
                alt={a.login}
                className="size-8 shrink-0 rounded-lg border"
                style={{ borderColor: V.border, background: V.surface2 }}
              />
              <div className="flex min-w-0 flex-col">
                <span
                  className="truncate text-[12px] font-medium"
                  style={{ color: V.fg }}
                >
                  {a.login}
                </span>
                <span className="truncate text-[11px]" style={{ color: V.fg2 }}>
                  {a.type}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
              <span className="rounded-md px-2 py-1" style={{ color: V.fg2 }}>
                Manage
              </span>
              <span
                className="rounded-md px-2 py-1"
                style={{ background: V.surface1, color: V.fg }}
              >
                Uninstall
              </span>
            </div>
          </div>
        ))}
        <span
          className="self-center p-1.5 text-[11px]"
          style={{ color: V.fg2 }}
        >
          + Connect another account
        </span>
      </motion.div>

      {/* active repository */}
      <motion.div variants={rowIn} className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold" style={{ color: V.fg }}>
            Active repository
          </h2>
          <span className="text-[11px] tabular-nums" style={{ color: V.fg2 }}>
            {REPOS.length} connected
          </span>
        </div>

        <div
          className="flex h-8 items-center gap-2 rounded-xl px-3"
          style={{ background: V.surface1 }}
        >
          <SearchIcon size={12} style={{ color: V.fg2 }} />
          <span className="text-[11px]" style={{ color: V.fg2 }}>
            Filter repositories…
          </span>
        </div>

        <div
          className="overflow-hidden rounded-xl"
          style={{ background: V.surface1 }}
        >
          {rows.map((repo, i) => {
            const full = `${repo.owner}/${repo.name}`
            const active = full === activeRepo
            return (
              <div
                key={full}
                onClick={() => setActiveRepo(full)}
                className="flex w-full items-center gap-3 px-3 py-2.5"
                style={{
                  borderTop: i > 0 ? `1px solid ${V.border}` : undefined,
                }}
              >
                <GithubIcon
                  size={14}
                  className="shrink-0"
                  style={{ color: active ? V.fg : V.fg2 }}
                />
                <div className="flex min-w-0 flex-col">
                  <span
                    className="truncate text-[12px] leading-tight font-medium"
                    style={{ color: V.fg }}
                  >
                    {repo.name}
                  </span>
                  <span
                    className="truncate text-[10px] leading-tight"
                    style={{ color: V.fg2 }}
                  >
                    {repo.owner}
                    {repo.isPrivate ? " · private" : ""}
                  </span>
                </div>
                <div className="ml-auto shrink-0 pl-3">
                  {active ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-medium"
                      style={{ color: ACCENT.emerald400 }}
                    >
                      <CheckIcon size={11} />
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: V.fg2 }}>
                      Set active
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* pagination */}
        <div className="flex items-center justify-between">
          <span
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium"
            style={{ color: V.fg2, opacity: page === 0 ? 0.5 : 1 }}
          >
            <ChevronLeftIcon size={12} />
            Prev
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: pageCount }, (_, i) => (
              <span
                key={`page-${i + 1}`}
                onClick={() => setPage(i)}
                className="inline-flex size-7 items-center justify-center rounded-lg border text-[11px] font-medium"
                style={
                  i === page
                    ? {
                        borderColor: V.border,
                        background: V.surface0,
                        color: V.fg,
                      }
                    : { borderColor: "transparent", color: V.fg2 }
                }
              >
                {i + 1}
              </span>
            ))}
          </div>
          <span
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium"
            style={{ color: V.fg2, opacity: page >= pageCount - 1 ? 0.5 : 1 }}
          >
            Next
            <ChevronRightIcon size={12} />
          </span>
        </div>

        <p
          className="flex items-start gap-1.5 text-[10px] leading-relaxed"
          style={{ color: V.fg2 }}
        >
          <InfoIcon size={11} className="mt-0.5 shrink-0" />
          <span>
            The active repository is the one modkit watches — its issues, pull
            requests, and comments flow into your queue and run through automod.
          </span>
        </p>
      </motion.div>
    </motion.div>
  )
}
