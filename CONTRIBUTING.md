# Contributing

## Setup

```
pnpm install
pnpm dev            docs site on :3000
pnpm typecheck
pnpm test           build pipeline tests
pnpm registry       regenerate variants and registry JSON
pnpm e2e            every component page, needs the dev server
pnpm perf <url>     frame timing; HEADED=1 for a real GPU, THROTTLE=4 for a slow CPU
```

`/lab/<slug>?prop=value` renders one component full screen in development.

## Repo

```
apps/web              docs site (Next.js App Router, Tailwind v4)
packages/components   component source, one folder per component
packages/build        variant pipeline and shadcn registry generator
brand/                logo and wordmark sources and generators
```

## A component

```
dot-grid/
  dot-grid.tsx         React shell: props, hooks, canvas. Starts with 'use client'.
  dot-grid.engine.ts   framework-free engine: state, physics, draw(ctx)
  dot-grid.meta.ts     props metadata for the playground, docs and registry
  index.ts             re-exports
```

Every component:

- renders through `useDotCanvas` (Canvas 2D or WebGL), or is a DOM component with an engine class
- is crisp on high-DPI screens, pauses offscreen and resizes with its container
- draws one static frame under `prefers-reduced-motion`
- hides decorative canvases from screen readers and never traps focus
- touches no `window` or `document` during render
- has zero runtime dependencies and typed props with a `<slug>Defaults` object
- keeps position and size utilities off its root, so the user's `className` always wins

Meta files use `satisfies ComponentMeta<Props>`, so a missing or mistyped prop fails the build.
Register the meta in `packages/components/src/meta.ts`, export from `src/index.ts`, add a preview in
`apps/web/components/previews/` and a case in `previews/registry.tsx`, then run `pnpm registry`.

## Before a pull request

- `pnpm typecheck`, `pnpm test` and `pnpm e2e` pass
- 60fps with no dropped frames in `HEADED=1 THROTTLE=4 pnpm perf`
- demo images are your own or licensed for redistribution
- comments are short and only where the code is not obvious

## Style

TypeScript strict, no `any`. Prettier: no semicolons, single quotes, width 100. Short lowercase
commit messages, one component or fix per commit.
