import {
  getMentionTrigger,
  type ListedUserSuggestion,
} from "#/lib/chat/mentions"

export function listClasses(list: ListedUserSuggestion["list"]) {
  switch (list) {
    case "blacklist":
      return "border-[#F56D5D26] bg-[#F56D5D14] text-[#F2A39A]"
    case "whitelist":
      return "border-[#67E19F26] bg-[#67E19F14] text-[#A7E9C3]"
    case "github":
      return "border-white/15 bg-white/10 text-tw-text-secondary"
  }
}

export function listBadgeLabel(list: ListedUserSuggestion["list"]): string {
  return list === "github" ? "GitHub" : list
}

export function MentionAvatar({
  user,
  size = "size-5",
}: {
  user: ListedUserSuggestion
  size?: string
}) {
  const src =
    user.avatarUrl ?? `https://github.com/${user.githubUsername}.png?size=40`
  return (
    <img
      src={src}
      alt=""
      className={`${size} shrink-0 rounded-full bg-tw-inner`}
      loading="lazy"
    />
  )
}

interface SlashRunner {
  run: (raw: string) => Promise<{ status: "done" | "error"; message?: string }>
}

/** Compose outgoing message from inline text + chipped mentions (slash-aware). */
export function buildComposedLine(
  text: string,
  mentions: ListedUserSuggestion[],
  slashCommandRunner: SlashRunner | undefined
): string {
  const trimmed = text.trim()
  if (slashCommandRunner && text.trimStart().startsWith("/")) {
    const handlesInText = new Set(
      (trimmed.match(/@[A-Za-z0-9_-]+/g) ?? []).map((t) => t.toLowerCase())
    )
    const handles = mentions
      .filter((m) => !handlesInText.has(`@${m.githubUsername}`.toLowerCase()))
      .map((m) => `@${m.githubUsername}`)
      .join(" ")
    return [trimmed, handles].filter(Boolean).join(" ").trim()
  }

  const everyChipAlreadyInText =
    mentions.length > 0 &&
    mentions.every((m) => {
      const esc = m.githubUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`@${esc}(?:\\s|$)`, "i").test(trimmed)
    })

  if (everyChipAlreadyInText) {
    return trimmed
  }

  // Message first, then chipped @handles — matches composer layout
  // (text left, chips right).
  return [trimmed, ...mentions.map((m) => `@${m.githubUsername}`)]
    .filter(Boolean)
    .join(" ")
    .trim()
}

/** Slash args: chip picked users instead of inserting `@name` into the input. */
export function stripMentionTriggerOnly(
  value: string,
  trigger: NonNullable<ReturnType<typeof getMentionTrigger>>
): { value: string; cursorPosition: number } {
  const before = value.slice(0, trigger.start)
  const after = value.slice(trigger.end)
  const nextValue = `${before}${after}`.replace(/\s{2,}/g, " ")
  const cursorPosition = Math.min(trigger.start, nextValue.length)
  return { value: nextValue, cursorPosition }
}
