import { nodeColors } from "#/components/layout/app/automations/node-types"

export interface PaletteItem {
  type: string
  label: string
  sublabel: string
  color: string
  data: Record<string, unknown>
}

export interface PaletteGroup {
  title: string
  items: PaletteItem[]
}

export const rulePaletteGroups: PaletteGroup[] = [
  {
    title: "Conditions",
    items: [
      {
        type: "condition",
        label: "Signal Condition",
        sublabel: "Check any signal",
        color: nodeColors.condition,
        data: { signalMode: true, signal: "", operator: "", value: "" },
      },
    ],
  },
  {
    title: "Logic Gates",
    items: [
      {
        type: "logic",
        label: "AND",
        sublabel: "All inputs must pass",
        color: nodeColors.logic,
        data: { gate: "AND" },
      },
      {
        type: "logic",
        label: "OR",
        sublabel: "Any input can pass",
        color: nodeColors.logic,
        data: { gate: "OR" },
      },
      {
        type: "logic",
        label: "NOT",
        sublabel: "Invert the result",
        color: nodeColors.logic,
        data: { gate: "NOT" },
      },
    ],
  },
  {
    title: "Transform",
    items: [
      {
        type: "transform",
        label: "Fetch GitHub User",
        sublabel: "Enrich with profile data",
        color: nodeColors.transform,
        data: { transform: "fetch_github_user" },
      },
      {
        type: "transform",
        label: "Compute Score",
        sublabel: "Calculate contributor score",
        color: nodeColors.transform,
        data: { transform: "compute_score" },
      },
      {
        type: "transform",
        label: "Fetch PR Files",
        sublabel: "Get changed file list",
        color: nodeColors.transform,
        data: { transform: "fetch_pr_files" },
      },
      {
        type: "transform",
        label: "Scan History",
        sublabel: "Check repo history for user",
        color: nodeColors.transform,
        data: { transform: "scan_history" },
      },
      {
        type: "transform",
        label: "Detect Language",
        sublabel: "Analyze content language",
        color: nodeColors.transform,
        data: { transform: "detect_language" },
      },
    ],
  },
]
