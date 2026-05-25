import type { Dispatch, DragEvent, SetStateAction } from "react"
import {
  DragHandleDotsIcon8,
  ToolboxSearchLoupeIcon13,
} from "@tripwire/ui/icons/app-chrome-icons"
import type {
  PaletteGroup,
  PaletteItem,
} from "#/components/layout/app/rules/custom/rule-palette"

interface RulePalettePanelProps {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  groups: PaletteGroup[]
  onDragStart: (e: DragEvent<HTMLDivElement>, item: PaletteItem) => void
}

export function RulePalettePanel({
  search,
  setSearch,
  groups,
  onDragStart,
}: RulePalettePanelProps) {
  return (
    <div className="flex w-[220px] shrink-0 flex-col border-r border-tw-border bg-tw-surface">
      <div className="shrink-0 border-b border-tw-border p-2">
        <div className="flex h-8 items-center gap-2 rounded-[10px] bg-tw-card px-2.5">
          <ToolboxSearchLoupeIcon13 />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-[#6E6E6E]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-1.5">
        {groups.map((group) => (
          <div key={group.title} className="mb-3">
            <div className="mb-1.5 px-2 text-[11px] font-medium tracking-[0.08em] text-tw-text-tertiary uppercase">
              {group.title}
            </div>
            <div className="flex flex-col gap-px rounded-[10px] bg-tw-card p-1">
              {group.items.map((item) => (
                <div
                  key={`${item.type}-${item.label}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  className="flex cursor-grab items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-tw-hover active:cursor-grabbing"
                >
                  <span className="shrink-0 text-tw-text-muted opacity-60">
                    <DragHandleDotsIcon8 />
                  </span>
                  <span className="truncate text-[12px] leading-tight text-tw-text-primary">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
