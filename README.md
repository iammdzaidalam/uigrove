# UIgrove

A grove of components.

Animated UI components with a signature look: dot fields, dithered logos, ASCII media, gooey text,
grain backgrounds, galleries and carousels. Each component ships as a few files with zero runtime
dependencies. Install with the shadcn CLI or copy the source from the docs.

## Install a component

Add the registry to your `components.json` once:

```json
{
  "registries": {
    "@uigrove": "https://uigrove.me/r/{name}.json"
  }
}
```

Then add any component:

```
npx shadcn@latest add @uigrove/dot-grid
```

Or skip the config and install straight from a URL:

```
npx shadcn@latest add https://uigrove.me/r/dot-grid.json
```

Files land in `components/uigrove/`, plus `hooks/use-dot-canvas.ts` for the canvas components.
Every docs page also shows the full source in TypeScript or JavaScript, with Tailwind or plain CSS.

## Components

| Name                       | What it does                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ascii-effect`             | An image or video rendered as live ASCII characters with flow, glitch and cursor ripple modes.                                                                                                                      |
| `circular-gallery`         | A ring of tangential image cards that the wheel flies into and spins endlessly, with cards flipping, swelling and pushing out toward the cursor at rest.                                                            |
| `devouring-sign-in`        | A large email field whose text is eaten into dust from the right when you submit.                                                                                                                                   |
| `dithered-logo`            | Any image or SVG turned into a dithered particle field that repels the cursor and ripples on click.                                                                                                                 |
| `dot-globe`                | A dotted globe drawn on canvas with approximate continents, auto rotation, drag with inertia and hoverable markers.                                                                                                 |
| `dot-grid`                 | A background grid of dots that pushes away from the cursor and springs back.                                                                                                                                        |
| `dot-matrix-text`          | Text rendered as a dot matrix that assembles from scattered dots as it scrolls into view.                                                                                                                           |
| `dust-transition`          | A scroll-driven hand-off where the hero dollies in, a flare bursts at the focus and the next scene eats through it as glowing dust.                                                                                 |
| `dynamic-island`           | A black pill that springs between a compact idle shape and richer live activity states.                                                                                                                             |
| `expand-on-hover-vertical` | A stack of pill-shaped image rows where the hovered row grows tall and the rest flatten.                                                                                                                            |
| `expand-on-hover`          | A row of tall pill-shaped image strips where the hovered strip widens and the rest shrink.                                                                                                                          |
| `film-grain`               | An animated film grain overlay for any section, drawn on the GPU and blended with what sits beneath it.                                                                                                             |
| `goo-carve-button`         | A pill button where a liquid blob carves into the surface on hover, chases the cursor, stretches into a teardrop with speed and reveals the blob colour underneath.                                                 |
| `gooey-dots`               | Drifting dots that merge into one liquid shape when they come close.                                                                                                                                                |
| `gooey-effect`             | Draggable shapes that melt into each other when they touch. Wrap any elements in GooeyEffect.Item; the wrapper and its parent must have no background colour so the filter only sees the shapes.                    |
| `grain-gradient`           | A WebGL surface with a curved, diffused edge between three colors, film grain and a slow breathing motion.                                                                                                          |
| `image-reveal`             | A sticky stage where each image wipes up from the bottom as you scroll, then settles back.                                                                                                                          |
| `image-wheel-3d`           | A tilted ring of image cards standing on edge like a rolodex, seen from above in perspective. The wheel turns with the mouse wheel or spins on its own, cards lift on hover and the camera leans toward the cursor. |
| `ink-bleed`                | Heavy text under a gooey filter where a drop of ink trails the cursor and melts into whichever letter it touches.                                                                                                   |
| `lens-carousel`            | A looping row of photo cards whose edges pass under two slabs of bending glass with colour fringing.                                                                                                                |
| `liquid-smoke`             | Slow plumes of smoke rising from the bottom of a section, drawn with warped noise on the GPU.                                                                                                                       |
| `morphing-text`            | Words that melt into one another: each fades through a blur while an alpha threshold turns the overlap into gooey bridges.                                                                                          |
| `orbit-tiles`              | Tiles drifting along a tilted elliptical orbit in perspective, sharp and large in front, soft and small behind, draggable to spin.                                                                                  |
| `pill-nav`                 | A floating pill navigation bar that unfolds into a full-height menu and opens a command search.                                                                                                                     |
| `scene-reveal`             | A scroll-driven hand-off where the hero pushes in and the next scene breaks through a growing window.                                                                                                               |
| `scroll-surf`              | A scroll-driven gallery where tilted cards surf toward the viewer along a perspective track.                                                                                                                        |
| `spine-gallery`            | Thin ruled columns with vertical names that open wide on hover to reveal a photo and a year.                                                                                                                        |
| `split-word-loader`        | A page loader whose word rises letter by letter, splits open around a window of cycling images, then grows the last image into the page.                                                                            |
| `text-tunnel`              | Rows of text scroll through a WebGL tunnel that folds and stretches them toward the edges, with bloom and a spectral fringe.                                                                                        |
| `vector-wordmark`          | A heavy wordmark that turns into a dotted vector outline with editor handles and coordinates around the cursor.                                                                                                     |
| `wheel-carousel`           | A rotating wheel of labels on a curve with a photo that crossfades to the active item.                                                                                                                              |
| `window-transition`        | A page transition that reveals the next page through a small rounded window growing to fill the viewport while the old page dims behind it.                                                                         |

Canvas components are crisp on high-DPI screens, pause when offscreen, resize with their
container, respect `prefers-reduced-motion`, and are safe to server-render.

## Develop

```
pnpm install
pnpm dev          # docs site on http://localhost:3000
pnpm registry     # regenerate variants and registry JSON
pnpm typecheck
pnpm test
pnpm perf http://localhost:3000/lab/dot-grid?gap=12   # frame timing in headless Chromium
```

See `CONTRIBUTING.md` for the conventions and how to add a component.

## License

Free to use in personal and commercial projects, not for redistribution. See `LICENSE`.
