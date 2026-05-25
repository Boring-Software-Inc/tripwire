import { cn } from "../utils"

export function AutomationsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-[18px] shrink-0", className)}
    >
      <path
        d="M5 4V7.25C5 7.664 5.336 8 5.75 8H8.75M19.012 20V16.75C19.012 16.336 18.676 16 18.262 16H15.012M4 12C4 16.418 7.582 20 12 20C14.636 20 17.03 18.725 18.5 16.758M20 12C20 7.582 16.418 4 12 4C9.364 4 6.97 5.275 5.5 7.242"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
