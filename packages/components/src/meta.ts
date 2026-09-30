import { dotGridMeta } from './dot-grid/dot-grid.meta'
import { gooeyDotsMeta } from './gooey-dots/gooey-dots.meta'
import { dotMatrixTextMeta } from './dot-matrix-text/dot-matrix-text.meta'
import { grainGradientMeta } from './grain-gradient/grain-gradient.meta'
import { ditheredLogoMeta } from './dithered-logo/dithered-logo.meta'
import { asciiEffectMeta } from './ascii-effect/ascii-effect.meta'
import { wheelCarouselMeta } from './wheel-carousel/wheel-carousel.meta'
import { scrollSurfMeta } from './scroll-surf/scroll-surf.meta'
import { expandOnHoverMeta } from './expand-on-hover/expand-on-hover.meta'
import { expandOnHoverVerticalMeta } from './expand-on-hover-vertical/expand-on-hover-vertical.meta'
import { spineGalleryMeta } from './spine-gallery/spine-gallery.meta'
import { sceneRevealMeta } from './scene-reveal/scene-reveal.meta'
import { imageRevealMeta } from './image-reveal/image-reveal.meta'
import { devouringSignInMeta } from './devouring-sign-in/devouring-sign-in.meta'
import { gooeyEffectMeta } from './gooey-effect/gooey-effect.meta'
import { vectorWordmarkMeta } from './vector-wordmark/vector-wordmark.meta'
import { circularGalleryMeta } from './circular-gallery/circular-gallery.meta'
import { lensCarouselMeta } from './lens-carousel/lens-carousel.meta'
import { filmGrainMeta } from './film-grain/film-grain.meta'
import { windowTransitionMeta } from './window-transition/window-transition.meta'
import { orbitTilesMeta } from './orbit-tiles/orbit-tiles.meta'
import { dotGlobeMeta } from './dot-globe/dot-globe.meta'
import { liquidSmokeMeta } from './liquid-smoke/liquid-smoke.meta'
import { gooCarveButtonMeta } from './goo-carve-button/goo-carve-button.meta'
import { inkBleedMeta } from './ink-bleed/ink-bleed.meta'
import { dustTransitionMeta } from './dust-transition/dust-transition.meta'
import { pillNavMeta } from './pill-nav/pill-nav.meta'
import { dynamicIslandMeta } from './dynamic-island/dynamic-island.meta'
import { morphingTextMeta } from './morphing-text/morphing-text.meta'
import { textTunnelMeta } from './text-tunnel/text-tunnel.meta'
import { splitWordLoaderMeta } from './split-word-loader/split-word-loader.meta'
import { imageWheel3DMeta } from './image-wheel-3d/image-wheel-3d.meta'
import type { AnyComponentMeta } from './lib/meta'

export const componentMetas = [
  dotGridMeta,
  gooeyDotsMeta,
  dotMatrixTextMeta,
  grainGradientMeta,
  ditheredLogoMeta,
  asciiEffectMeta,
  wheelCarouselMeta,
  scrollSurfMeta,
  expandOnHoverMeta,
  expandOnHoverVerticalMeta,
  spineGalleryMeta,
  sceneRevealMeta,
  imageRevealMeta,
  devouringSignInMeta,
  gooeyEffectMeta,
  vectorWordmarkMeta,
  circularGalleryMeta,
  lensCarouselMeta,
  filmGrainMeta,
  windowTransitionMeta,
  orbitTilesMeta,
  dotGlobeMeta,
  liquidSmokeMeta,
  gooCarveButtonMeta,
  inkBleedMeta,
  dustTransitionMeta,
  pillNavMeta,
  dynamicIslandMeta,
  imageWheel3DMeta,
  morphingTextMeta,
  textTunnelMeta,
  splitWordLoaderMeta,
] as const satisfies readonly AnyComponentMeta[]

export type ComponentSlug = (typeof componentMetas)[number]['name']

export function getComponentMeta(slug: string): AnyComponentMeta | undefined {
  return componentMetas.find((m) => m.name === slug)
}

export { defaultsFrom } from './lib/meta'
export type * from './lib/meta'
