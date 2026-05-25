import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { Button } from "@tripwire/ui/button"
import { onWorkflowMutation } from "#/lib/workflow/events"
import {
  buildChangeSummary,
  type EditorSnapshot,
} from "#/lib/workflow/pending-changes"
import { PendingChangesToolbar } from "#/components/layout/app/automations/pending-changes-toolbar"
import { PlayTriangleIcon13 } from "@tripwire/ui/icons/app-chrome-icons"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "#/integrations/trpc/react"
import { nodeTypes, nodeColors } from "./node-types"
import type { SimNodeResult } from "#/lib/workflow/graph-evaluator"
import { WorkflowSidebar, type SidebarTab } from "./workflow-sidebar"
import { SimulationPanel } from "./simulation-panel"
import { toastManager } from "@tripwire/ui/toast"

interface WorkflowEditorProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onSave?: (nodes: Node[], edges: Edge[]) => void
  isSaving?: boolean
  saveLabel?: string
  repoId?: string
  workflowId?: string
  onRemoteUpdate?: () => void
}

const getId = () =>
  `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export function WorkflowEditor({
  initialNodes = [],
  initialEdges = [],
  onSave,
  isSaving,
  saveLabel,
  repoId,
  workflowId,
  onRemoteUpdate,
}: WorkflowEditorProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [search, setSearch] = useState("")
  const [showSim, setShowSim] = useState(false)
  const [simResults, setSimResults] = useState<SimNodeResult[] | null>(null)
  const [simStep, setSimStep] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("toolbox")
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const initialSnapshot = useRef(
    JSON.stringify({
      n: initialNodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      e: initialEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    })
  )

  const [pendingChangeSummary, setPendingChangeSummary] = useState<
    string | null
  >(null)
  const preChangeSnapshot = useRef<EditorSnapshot | null>(null)

  const isDirty =
    JSON.stringify({
      n: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      e: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }) !== initialSnapshot.current

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  useEffect(() => {
    if (!workflowId) return
    return onWorkflowMutation((mutatedId) => {
      if (mutatedId !== workflowId) return
      preChangeSnapshot.current = {
        nodes: nodesRef.current.map((n) => ({ ...n })),
        edges: edgesRef.current.map((e) => ({ ...e })),
      }
      queryClient
        .fetchQuery(trpc.workflows.get.queryOptions({ id: workflowId }))
        .then((wf) => {
          if (!wf) return
          const def = wf.definition as { nodes: Node[]; edges: Edge[] }
          const before: EditorSnapshot = preChangeSnapshot.current ?? {
            nodes: nodesRef.current,
            edges: edgesRef.current,
          }
          const after: EditorSnapshot = { nodes: def.nodes, edges: def.edges }
          const summary = buildChangeSummary(before, after)
          setNodes(def.nodes)
          setEdges(def.edges)
          setPendingChangeSummary(summary)
        })
        .catch(() => {
          onRemoteUpdate?.()
        })
    })
  }, [workflowId, onRemoteUpdate, trpc, queryClient, setNodes, setEdges])

  const handleAcceptChanges = () => {
    setPendingChangeSummary(null)
    preChangeSnapshot.current = null
    initialSnapshot.current = JSON.stringify({
      n: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      e: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    })
  }

  const handleRevertChanges = () => {
    if (preChangeSnapshot.current) {
      setNodes(preChangeSnapshot.current.nodes)
      setEdges(preChangeSnapshot.current.edges)
    }
    setPendingChangeSummary(null)
    preChangeSnapshot.current = null
  }

  const handleNodeDataChange = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) => nds.map((n) => (n.id !== nodeId ? n : { ...n, data })))
    },
    [setNodes]
  )

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
    setSidebarTab("editor")
  }, [])

  // No-op: keep selectedNodeId so the editor panel stays populated.
  // Selection clears when the user clicks a different node.
  const onPaneClick = () => {}

  const visibleSteps = simResults?.slice(0, simStep) ?? []
  const displayNodes = useMemo(() => {
    if (!simResults || visibleSteps.length === 0) return nodes
    const resultMap = new Map(visibleSteps.map((r) => [r.nodeId, r]))
    const triggerIds = new Set(
      nodes.filter((n) => n.type === "trigger").map((n) => n.id)
    )
    return nodes.map((n) => {
      const r = resultMap.get(n.id)
      const isTrigger = triggerIds.has(n.id) && simStep > 0
      if (!r && !isTrigger) return n
      const status = r?.status ?? "executed"
      const isLatest =
        visibleSteps.length > 0 &&
        visibleSteps[visibleSteps.length - 1]?.nodeId === n.id
      const glowColor =
        status === "pass"
          ? isLatest
            ? "0 0 0 2px #67E19F"
            : "0 0 0 2px #67E19F66"
          : status === "fail"
            ? isLatest
              ? "0 0 0 2px #F56D5D"
              : "0 0 0 2px #F56D5D66"
            : status === "executed"
              ? isLatest
                ? "0 0 0 2px #34A6FF"
                : "0 0 0 2px #34A6FF66"
              : undefined
      return glowColor
        ? {
            ...n,
            style: { ...n.style, boxShadow: glowColor, borderRadius: "12px" },
          }
        : n
    })
  }, [nodes, simResults, visibleSteps, simStep])

  const displayEdges = useMemo(() => {
    if (!simResults || visibleSteps.length === 0) return edges
    const activeEdgeMap = new Map<string, SimNodeResult>()
    for (const step of visibleSteps) {
      if (step.edgeId) activeEdgeMap.set(step.edgeId, step)
    }
    const latestEdgeId =
      visibleSteps.length > 0
        ? visibleSteps[visibleSteps.length - 1]?.edgeId
        : null
    return edges.map((e) => {
      const step = activeEdgeMap.get(e.id)
      if (!step) return e
      const isLatest = e.id === latestEdgeId
      const color =
        step.status === "pass"
          ? "#67E19F"
          : step.status === "fail"
            ? "#F56D5D"
            : step.status === "executed"
              ? "#34A6FF"
              : "#9F9FA9"
      return {
        ...e,
        animated: true,
        style: {
          stroke: color,
          strokeWidth: isLatest ? 2.5 : 2,
          opacity: isLatest ? 1 : 0.6,
          transition: "stroke 0.3s, stroke-width 0.3s, opacity 0.3s",
        },
      }
    })
  }, [edges, simResults, visibleSteps])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#27272A", strokeWidth: 1.5 },
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData("application/reactflow-type")
      const dataStr = e.dataTransfer.getData("application/reactflow-data")
      if (!type || !rfInstance || !reactFlowWrapper.current) return

      if (
        type === "trigger" &&
        nodesRef.current.some((n) => n.type === "trigger")
      ) {
        toastManager.add({
          type: "error",
          title: "Only one trigger per workflow",
        })
        return
      }

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })
      const newId = getId()
      setNodes((nds) => [
        ...nds,
        { id: newId, type, position, data: dataStr ? JSON.parse(dataStr) : {} },
      ])
      setSelectedNodeId(newId)
    },
    [rfInstance, setNodes]
  )

  const handleSave = () => {
    if (onSave) onSave(nodes, edges)
    initialSnapshot.current = JSON.stringify({
      n: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      e: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    })
  }

  return (
    <div className="flex h-full w-full">
      <WorkflowSidebar
        search={search}
        setSearch={setSearch}
        selectedNodeId={selectedNodeId}
        nodes={nodes}
        onNodeDataChange={handleNodeDataChange}
        workflowId={workflowId}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
      />
      <div className="relative flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "#27272A", strokeWidth: 1.5 },
          }}
          className="!bg-tw-bg"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#FFFFFF08"
          />
          <Controls className="!rounded-lg !border-tw-border !bg-tw-card [&>button]:!border-tw-border [&>button]:!bg-tw-card [&>button]:!text-tw-text-muted [&>button:hover]:!bg-tw-hover" />
          <MiniMap
            nodeColor={(n) => {
              if (simResults) {
                const r = simResults.find((sr) => sr.nodeId === n.id)
                if (r?.status === "pass") return "#67E19F"
                if (r?.status === "fail") return "#F56D5D"
                if (r?.status === "executed") return "#34A6FF"
              }
              return nodeColors[n.type as keyof typeof nodeColors] ?? "#9F9FA9"
            }}
            maskColor="#0D0D0F99"
            className="!rounded-lg !border-tw-border !bg-tw-surface"
          />
        </ReactFlow>

        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowSim(!showSim)
              if (showSim) {
                setSimResults(null)
                setSimStep(0)
              }
            }}
            className={
              showSim
                ? "bg-tw-card text-[#FAFAFA]"
                : "text-tw-text-muted hover:text-tw-text-primary"
            }
          >
            <PlayTriangleIcon13 />
            Test
          </Button>
          {onSave && (
            <Button
              variant={isDirty || saveLabel ? "default" : "secondary"}
              size="sm"
              onClick={handleSave}
              loading={isSaving}
              className="border-tw-border px-2"
            >
              {saveLabel ?? "Save"}
            </Button>
          )}
        </div>

        {pendingChangeSummary && (
          <PendingChangesToolbar
            summary={pendingChangeSummary}
            onAccept={handleAcceptChanges}
            onCancel={handleRevertChanges}
          />
        )}
      </div>
      {showSim && (
        <SimulationPanel
          nodes={nodes}
          edges={edges}
          simResults={simResults}
          setSimResults={setSimResults}
          simStep={simStep}
          setSimStep={setSimStep}
          repoId={repoId}
        />
      )}
    </div>
  )
}
