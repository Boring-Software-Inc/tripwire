# dither-kit

Composable **dithered** charts for React — area, line, bar, pie, radar — on a
tiny canvas engine with a recharts-style children-as-config API. No recharts.
Ordered-dither fills that hold up in light and dark, entrance animations, a
gliding scrub tooltip, selection, winking sparkles, and colour bloom.

> **This npm package is a namespace placeholder.** dither-kit ships as source
> through a [shadcn registry](https://ui.shadcn.com/docs/registry) — you install
> the actual components with the shadcn CLI, not from npm.

## Install

Register the namespace once in `components.json`:

```json
{
  "registries": {
    "@dither-kit": "https://tripwire.sh/r/{name}.json"
  }
}
```

…then add the charts you want:

```bash
npx shadcn@latest add @dither-kit/area-chart
npx shadcn@latest add @dither-kit/bar-chart
npx shadcn@latest add @dither-kit/pie-chart
npx shadcn@latest add @dither-kit/radar-chart
npx shadcn@latest add @dither-kit/dither-kit   # everything
```

Docs, live previews, and a tweak panel: **<https://tripwire.sh/dither-kit>**

## Credit

dither-kit exists because of [Evil Charts](https://www.evilcharts.com) by
[legions-developer](https://github.com/legions-developer/evilcharts) — the
original dithered, composable chart aesthetic that inspired every pixel here.
Go star it.
