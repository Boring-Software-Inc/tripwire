// Builds the Dither Kit shadcn registry — one item per chart, plus a shared
// `core` engine they all depend on.
//
//   bun run registry:build
//
// Emits public/r/<item>.json for every item below, plus public/r/registry.json
// (the index). Consumers register the namespace once in components.json:
//
//   { "registries": { "@dither-kit": "https://<your-host>/r/{name}.json" } }
//
// …then install just the chart they want — its `core` dependency is pulled
// automatically:
//
//   npx shadcn@latest add @dither-kit/radar-chart
//   npx shadcn@latest add @dither-kit/area-chart   # area + line
//   npx shadcn@latest add @dither-kit/dither-kit    # everything
//
// Dither Kit is heavily inspired by Evil Charts (https://www.evilcharts.com,
// https://github.com/legions-developer/evilcharts) — huge thanks to that
// project for the composable, dithered chart aesthetic that started this.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "apps/web/src/components/dither-kit");
const OUT = join(ROOT, "apps/web/public/r");

// Where files land in a consumer's project (relative to its root).
const TARGET_DIR = "components/dither-kit";
const NS = "@dither-kit";
const HOMEPAGE = "https://tripwire.sh/dither-kit";
const AUTHOR = "ripgrim";

// Shared npm deps live on `core`; chart items inherit them via registryDependencies.
const CORE_DEPS = ["motion", "d3-scale", "d3-shape", "clsx", "tailwind-merge"];
const CORE_DEV_DEPS = ["@types/d3-scale", "@types/d3-shape"];

// The engine every chart shares: contexts, scales, dither painter, the two
// canvas-agnostic shells, and the cross-family chrome (legend/tooltip/grid/axes/dot).
const CORE_FILES = [
	"lib.ts",
	"palette.ts",
	"scales.ts",
	"polar.ts",
	"dither-paint.ts",
	"use-chart-dimensions.ts",
	"chart-context.tsx",
	"common-context.tsx",
	"series-context.tsx",
	"polar-context.tsx",
	"cartesian-root.tsx",
	"polar-root.tsx",
	"grid.tsx",
	"x-axis.tsx",
	"y-axis.tsx",
	"dot.tsx",
	"legend.tsx",
	"tooltip.tsx",
];

const ITEMS = [
	{
		name: "core",
		title: "Dither Kit — Core",
		description:
			"Shared engine for Dither Kit: contexts, d3 scales, the ordered-dither canvas painter, the canvas-agnostic chart shells, and the legend/tooltip/grid/axes/dot chrome. Installed automatically by every chart.",
		files: CORE_FILES,
		registryDependencies: [],
		dependencies: CORE_DEPS,
		devDependencies: CORE_DEV_DEPS,
	},
	{
		name: "area-chart",
		title: "Dither Area & Line Chart",
		description:
			"Composable dithered area + line charts — children-as-config API with the ordered-dither fill, winking sparkles, a gliding scrub tooltip, selection, and colour bloom. Includes Sparkline. Inspired by Evil Charts (evilcharts.com).",
		files: [
			"area-chart.tsx",
			"cartesian-canvas.tsx",
			"area.tsx",
			"sparkline.tsx",
		],
		registryDependencies: [`${NS}/core`],
		dependencies: [],
		devDependencies: [],
	},
	{
		name: "bar-chart",
		title: "Dither Bar Chart",
		description:
			"Composable dithered bar chart — grouped or stacked, with a staggered grow-in wave, the ordered-dither fill, scrub tooltip, selection, and colour bloom. Inspired by Evil Charts (evilcharts.com).",
		files: ["bar-chart.tsx", "bar-canvas.tsx", "bar.tsx"],
		registryDependencies: [`${NS}/core`],
		dependencies: [],
		devDependencies: [],
	},
	{
		name: "pie-chart",
		title: "Dither Pie / Donut Chart",
		description:
			"Composable dithered pie / donut chart — per-pixel radial dither, clockwise sweep-in, slice hover-pop, and colour bloom. Inspired by Evil Charts (evilcharts.com).",
		files: ["pie-chart.tsx", "pie-canvas.tsx", "pie.tsx"],
		registryDependencies: [`${NS}/core`],
		dependencies: [],
		devDependencies: [],
	},
	{
		name: "radar-chart",
		title: "Dither Radar Chart",
		description:
			"Composable dithered radar chart — polygon-membership dither, scale-in entrance, vertex markers, the dither frame, and colour bloom. Inspired by Evil Charts (evilcharts.com).",
		files: [
			"radar-chart.tsx",
			"radar-canvas.tsx",
			"radar.tsx",
			"radar-frame.tsx",
		],
		registryDependencies: [`${NS}/core`],
		dependencies: [],
		devDependencies: [],
	},
	{
		name: "dither-kit",
		title: "Dither Kit — Everything",
		description:
			"All of Dither Kit: area, line, bar, pie, and radar dithered charts on one tiny canvas engine. Inspired by Evil Charts (evilcharts.com).",
		// The barrel only ships here — it re-exports every chart, so it is only
		// valid when everything is installed.
		files: ["index.ts"],
		registryDependencies: [
			`${NS}/area-chart`,
			`${NS}/bar-chart`,
			`${NS}/pie-chart`,
			`${NS}/radar-chart`,
		],
		dependencies: [],
		devDependencies: [],
	},
];

mkdirSync(OUT, { recursive: true });

function fileEntry(name) {
	return {
		path: `${TARGET_DIR}/${name}`,
		type: "registry:component",
		target: `${TARGET_DIR}/${name}`,
		content: readFileSync(join(SRC, name), "utf8"),
	};
}

for (const it of ITEMS) {
	const files = it.files.map(fileEntry);
	const json = {
		$schema: "https://ui.shadcn.com/schema/registry-item.json",
		name: it.name,
		type: "registry:component",
		title: it.title,
		description: it.description,
		author: AUTHOR,
		dependencies: it.dependencies,
		devDependencies: it.devDependencies,
		registryDependencies: it.registryDependencies,
		files,
	};
	writeFileSync(
		join(OUT, `${it.name}.json`),
		`${JSON.stringify(json, null, 2)}\n`,
	);
}

// Registry index — items list with file content stripped.
const registry = {
	$schema: "https://ui.shadcn.com/schema/registry.json",
	name: "dither-kit",
	homepage: HOMEPAGE,
	items: ITEMS.map((it) => ({
		name: it.name,
		type: "registry:component",
		title: it.title,
		description: it.description,
		dependencies: it.dependencies,
		registryDependencies: it.registryDependencies,
		files: it.files.map((name) => ({
			path: `${TARGET_DIR}/${name}`,
			type: "registry:component",
			target: `${TARGET_DIR}/${name}`,
		})),
	})),
};
writeFileSync(join(OUT, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`);

const total = ITEMS.reduce((n, it) => n + it.files.length, 0);
console.log(
	`registry: wrote ${ITEMS.length} items (${total} file refs) → public/r/{${ITEMS.map((i) => i.name).join(",")}}.json (+ registry.json)`,
);
