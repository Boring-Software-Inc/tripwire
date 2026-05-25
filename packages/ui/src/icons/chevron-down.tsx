import { cn } from "../utils"

export function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block h-2 w-2.5 shrink-0", className)}
    >
      <path
        d="M1 1L5 5L9 1"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="square"
        fill="none"
      />
    </svg>
  )
}
