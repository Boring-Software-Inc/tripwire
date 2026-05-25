import { cn } from "../utils"

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-1 -2 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block size-4 shrink-0", className)}
    >
      <circle cx="8.5" cy="8.5" r="7.5" />
      <path d="M14 14L18 18" />
    </svg>
  )
}
