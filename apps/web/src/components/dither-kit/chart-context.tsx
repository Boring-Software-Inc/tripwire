"use client";

import type { ScaleLinear } from "d3-scale";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { CommonChart } from "./common-context";
import type { BloomInput } from "./dither-paint";
import type { DitherColor, Seed } from "./palette";
import { seedOfColor } from "./palette";
import {
	buildBandScale,
	buildXScale,
	buildYScale,
	computeBands,
	indexAtBand,
	nearestIndex,
	type StackType,
} from "./scales";
import type { Dimensions } from "./use-chart-dimensions";

/** Which chart root a part is composed under — drives the boundary guards. */
export type ChartType = "area" | "bar" | "line" | "pie" | "radar";

export type ChartConfig = Record<
	string,
	{ label?: string; color: DitherColor }
>;

export type Margins = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

export const DEFAULT_MARGINS: Margins = {
	top: 10,
	right: 12,
	bottom: 22,
	left: 36,
};

type Row = Record<string, unknown>;

export type AreaVariant = "gradient" | "dotted" | "hatched" | "solid";
export type StrokeVariant = "solid" | "dashed";
export type SeriesKind = "area" | "line" | "bar";

/** What each series part (<Area />, <Line />, <Bar />) registers so the canvas
 * knows which series to paint and how. */
export type SeriesSpec = {
	dataKey: string;
	kind: SeriesKind;
	variant: AreaVariant;
	strokeVariant: StrokeVariant;
};

export type ChartContextValue = {
	chartType: ChartType; // which root this part is under
	config: ChartConfig;
	configKeys: string[]; // series order — drives stacking + legend
	data: Row[];
	dataLength: number;
	stackType: StackType;

	margins: Margins;
	plot: { width: number; height: number }; // inner drawing area
	ready: boolean; // true once measured (width > 0)

	xCenter: (index: number) => number; // category centre px within the plot
	bandwidth: number; // category slot width (0 for point/area scales)
	indexAtX: (px: number) => number; // nearest category for a pointer x
	// Bar geometry in plot px — one source of truth for the canvas + click rects.
	barSlot: (
		index: number,
		seriesIndex: number,
		seriesCount: number,
	) => { x: number; width: number };
	y: ScaleLinear<number, number>; // value → px within the plot
	bands: Record<string, [number, number][]>; // per-series [y0, y1] per row
	max: number;

	// Interaction state, shared by every part.
	selectedDataKey: string | null;
	selectDataKey: (key: string | null) => void;
	/** Legend-hover spotlight — dims every series but this one while set. */
	focusDataKey: string | null;
	setFocusDataKey: (key: string | null) => void;
	hoverIndex: number | null;
	setHoverIndex: (index: number | null) => void;
	markerIndex: number | null; // controlled crosshair override (e.g. committed point)
	cursorX: number;
	setCursorX: (px: number) => void;
	isMouseInChart: boolean;
	setMouseInChart: (over: boolean) => void;
	hovered: boolean; // parent-driven hover (e.g. the whole card) — lifts the fill
	bloom: BloomInput; // glow on the dither canvas
	bloomOnHover: boolean; // only bloom while hovered

	// Series register themselves so the canvas knows what (and how) to paint.
	seriesSpecs: Record<string, SeriesSpec>;
	registerSeries: (spec: SeriesSpec) => void;
	unregisterSeries: (dataKey: string) => void;

	// Entrance animation (prop-driven). `revision` bumps when the data changes or
	// the replay token advances, so the canvas can re-play its entrance.
	animate: boolean;
	animationDuration: number;
	revision: number;
	entranceDone: boolean; // true once the entrance has played — gates SVG markers
	markEntranceDone: () => void; // the canvas calls this when its reveal completes

	// Helpers.
	seedOf: (key: string) => Seed;
	common: CommonChart; // shared surface for <Legend> / <Tooltip>
};

const ChartContext = createContext<ChartContextValue | null>(null);

const ROOT_OF: Record<ChartType, string> = {
	area: "<AreaChart />",
	bar: "<BarChart />",
	line: "<LineChart />",
	pie: "<PieChart />",
	radar: "<RadarChart />",
};

/** Generic accessor for internal layers (canvas/overlay) that work for any root. */
export function useChart() {
	const ctx = use(ChartContext);
	if (!ctx) {
		throw new Error(
			"Chart parts must be used within a chart root (e.g. <AreaChart />).",
		);
	}
	return ctx;
}

/**
 * Boundary guard for a composable part. Throws a precise error when used outside
 * a root, or inside the wrong chart type — e.g. `<Bar />` placed in an area
 * chart. `kind` omitted means the part works under any root (grid, axes, …).
 */
export function useChartPart(
	part: string,
	kind?: ChartType | ChartType[],
): ChartContextValue {
	const ctx = use(ChartContext);
	if (!ctx) {
		const where = kind
			? ROOT_OF[Array.isArray(kind) ? kind[0] : kind]
			: "a chart root";
		throw new Error(`<${part} /> must be used within ${where}.`);
	}
	if (kind) {
		const allowed = Array.isArray(kind) ? kind : [kind];
		if (!allowed.includes(ctx.chartType)) {
			throw new Error(
				`<${part} /> is not valid inside ${ROOT_OF[ctx.chartType]} — it belongs in ${allowed
					.map((k) => ROOT_OF[k])
					.join(" or ")}.`,
			);
		}
	}
	return ctx;
}

export { ChartContext };

/** A counter that advances whenever `data` changes identity or `token` advances
 * — drives entrance replays without remounting. */
export function useRevision(data: unknown, token: number) {
	const rev = useRef(0);
	const prevData = useRef(data);
	const prevToken = useRef(token);
	if (prevData.current !== data || prevToken.current !== token) {
		prevData.current = data;
		prevToken.current = token;
		rev.current += 1;
	}
	return rev.current;
}

/**
 * Builds the shared context value: resolves the plot rect from the measured
 * size minus margins, computes the x/y scales and the per-series stack bands,
 * and owns the selection + hover state every part reads.
 */
export function useChartController({
	chartType,
	data,
	config,
	stackType,
	dimensions,
	margins,
	animate = true,
	animationDuration = 900,
	replayToken = 0,
	markerIndex = null,
	hovered = false,
	bloom = "off",
	bloomOnHover = false,
	defaultSelectedDataKey = null,
	onSelectionChange,
}: {
	chartType: ChartType;
	data: Row[];
	config: ChartConfig;
	stackType: StackType;
	dimensions: Dimensions;
	margins: Margins;
	animate?: boolean;
	animationDuration?: number;
	replayToken?: number;
	markerIndex?: number | null;
	hovered?: boolean;
	bloom?: BloomInput;
	bloomOnHover?: boolean;
	defaultSelectedDataKey?: string | null;
	onSelectionChange?: (key: string | null) => void;
}): ChartContextValue {
	const configKeys = useMemo(() => Object.keys(config), [config]);
	const revision = useRevision(data, replayToken);

	// Flips true after the entrance plays (reset on each replay) so DOM markers
	// can fade in with the fill instead of floating over the empty plot.
	const [entranceDone, setEntranceDone] = useState(!animate);

	const [selectedDataKey, setSelectedDataKey] = useState<string | null>(
		defaultSelectedDataKey,
	);
	const [focusDataKey, setFocusDataKey] = useState<string | null>(null);
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const [cursorX, setCursorX] = useState(0);
	const [isMouseInChart, setMouseInChart] = useState(false);
	const [seriesSpecs, setSeriesSpecs] = useState<Record<string, SeriesSpec>>(
		{},
	);

	const registerSeries = useCallback((spec: SeriesSpec) => {
		setSeriesSpecs((prev) => {
			const cur = prev[spec.dataKey];
			return cur &&
				cur.kind === spec.kind &&
				cur.variant === spec.variant &&
				cur.strokeVariant === spec.strokeVariant
				? prev
				: { ...prev, [spec.dataKey]: spec };
		});
	}, []);
	const unregisterSeries = useCallback((dataKey: string) => {
		setSeriesSpecs((prev) => {
			if (!(dataKey in prev)) return prev;
			const next = { ...prev };
			delete next[dataKey];
			return next;
		});
	}, []);

	const selectDataKey = useCallback(
		(key: string | null) => {
			setSelectedDataKey(key);
			onSelectionChange?.(key);
		},
		[onSelectionChange],
	);

	const plotWidth = Math.max(
		0,
		dimensions.width - margins.left - margins.right,
	);
	const plotHeight = Math.max(
		0,
		dimensions.height - margins.top - margins.bottom,
	);
	const ready = plotWidth > 0 && plotHeight > 0;

	// Reset the entrance gate on mount / replay; the canvas flips it true via
	// `markEntranceDone` exactly when its reveal completes, so the DOM markers
	// fade in perfectly in sync with the fill (no parallel timer to drift).
	// biome-ignore lint/correctness/useExhaustiveDependencies: `revision` intentionally re-arms the gate on replay
	useEffect(() => {
		setEntranceDone(!animate);
	}, [animate, revision]);
	const markEntranceDone = useCallback(() => setEntranceDone(true), []);

	const { bands, max } = useMemo(
		() => computeBands(data, configKeys, stackType),
		[data, configKeys, stackType],
	);

	const isBar = chartType === "bar";
	const xPoint = useMemo(
		() => buildXScale(data.length, plotWidth),
		[data.length, plotWidth],
	);
	const xBand = useMemo(
		() => buildBandScale(data.length, plotWidth),
		[data.length, plotWidth],
	);
	const bandwidth = isBar ? xBand.bandwidth() : 0;
	const xCenter = useCallback(
		(i: number) =>
			isBar ? (xBand(i) ?? 0) + xBand.bandwidth() / 2 : (xPoint(i) ?? 0),
		[isBar, xBand, xPoint],
	);
	const indexAtX = useCallback(
		(px: number) =>
			isBar
				? indexAtBand(px, data.length, plotWidth)
				: nearestIndex(px, data.length, plotWidth),
		[isBar, data.length, plotWidth],
	);
	const stacked = stackType === "stacked" || stackType === "percent";
	const barSlot = useCallback(
		(i: number, si: number, n: number) => {
			const center = xCenter(i);
			if (stacked) {
				const w = bandwidth * 0.9;
				return { x: center - w / 2, width: w };
			}
			const slot = bandwidth / Math.max(n, 1);
			return {
				x: center - bandwidth / 2 + si * slot + slot * 0.08,
				width: slot * 0.84,
			};
		},
		[xCenter, bandwidth, stacked],
	);
	const y = useMemo(() => buildYScale(max, plotHeight), [max, plotHeight]);

	const seedOf = useCallback(
		(key: string) => seedOfColor(config[key]?.color ?? "grey"),
		[config],
	);

	const common = useMemo<CommonChart>(
		() => ({
			names: configKeys,
			labelOf: (n) => config[n]?.label ?? n,
			seedOf,
			selectedDataKey,
			selectDataKey,
			focusDataKey,
			setFocusDataKey,
			hoverIndex,
			ready,
			tooltipLeft: Math.max(
				48,
				Math.min(plotWidth + margins.left - 48, cursorX),
			),
			// Follow the highest hovered node so the card rides the data path, but
			// keep enough headroom that the upward-lifted card never clips the top.
			tooltipTop: (() => {
				const floor = margins.top + 44;
				if (hoverIndex == null) return floor;
				let minY = Number.POSITIVE_INFINITY;
				for (const key of configKeys) {
					const b = bands[key]?.[hoverIndex];
					if (b) minY = Math.min(minY, y(b[1]));
				}
				if (!Number.isFinite(minY)) return floor;
				return Math.max(floor, margins.top + minY);
			})(),
			heading: (i, labelKey) =>
				labelKey ? String(data[i]?.[labelKey] ?? "") : null,
			itemsAt: (i) =>
				configKeys.map((name) => {
					const raw = data[i]?.[name];
					return {
						name,
						label: config[name]?.label ?? name,
						value: typeof raw === "number" ? raw : 0,
						seed: seedOf(name),
						dimmed: (() => {
							const emphasis = selectedDataKey ?? focusDataKey;
							return emphasis !== null && emphasis !== name;
						})(),
					};
				}),
		}),
		[
			configKeys,
			config,
			seedOf,
			selectedDataKey,
			selectDataKey,
			focusDataKey,
			hoverIndex,
			ready,
			plotWidth,
			margins,
			cursorX,
			data,
			bands,
			y,
		],
	);

	return useMemo(
		() => ({
			chartType,
			config,
			configKeys,
			data,
			dataLength: data.length,
			stackType,
			margins,
			plot: { width: plotWidth, height: plotHeight },
			ready,
			xCenter,
			bandwidth,
			indexAtX,
			barSlot,
			y,
			bands,
			max,
			selectedDataKey,
			selectDataKey,
			focusDataKey,
			setFocusDataKey,
			hoverIndex,
			setHoverIndex,
			markerIndex,
			cursorX,
			setCursorX,
			isMouseInChart,
			setMouseInChart,
			hovered,
			bloom,
			bloomOnHover,
			seriesSpecs,
			registerSeries,
			unregisterSeries,
			animate,
			animationDuration,
			revision,
			entranceDone,
			markEntranceDone,
			seedOf,
			common,
		}),
		[
			chartType,
			config,
			configKeys,
			data,
			stackType,
			margins,
			plotWidth,
			plotHeight,
			ready,
			xCenter,
			bandwidth,
			indexAtX,
			barSlot,
			y,
			bands,
			max,
			selectedDataKey,
			selectDataKey,
			focusDataKey,
			hoverIndex,
			markerIndex,
			cursorX,
			isMouseInChart,
			hovered,
			bloom,
			bloomOnHover,
			seriesSpecs,
			registerSeries,
			unregisterSeries,
			animate,
			animationDuration,
			revision,
			entranceDone,
			markEntranceDone,
			seedOf,
			common,
		],
	);
}
