'use client'

import { DotGrid } from '@uigrove/components/dot-grid'
import { GooeyDots } from '@uigrove/components/gooey-dots'
import { DotMatrixText } from '@uigrove/components/dot-matrix-text'
import { GrainGradient } from '@uigrove/components/grain-gradient'
import { DitheredLogo } from '@uigrove/components/dithered-logo'
import { AsciiEffect } from '@uigrove/components/ascii-effect'
import { WheelCarousel, wheelCarouselDemoItems } from '@uigrove/components/wheel-carousel'
import { ScrollSurf, scrollSurfDemoItems } from '@uigrove/components/scroll-surf'
import { SplitWordLoaderPreview } from './split-word-loader'
import { TextTunnelPreview } from './text-tunnel'
import { MorphingTextPreview } from './morphing-text'
import { DynamicIslandPreview } from './dynamic-island'
import { PillNavPreview } from './pill-nav'
import { DustTransitionPreview } from './dust-transition'
import { InkBleedPreview } from './ink-bleed'
import { GooCarveButtonPreview } from './goo-carve-button'
import { LiquidSmokePreview } from './liquid-smoke'
import { DotGlobePreview } from './dot-globe'
import { OrbitTilesInfiniteLoopPreview } from './orbit-tiles'
import { WindowPageTransitionPreview } from './window-transition'
import { FilmGrainEffectPreview } from './film-grain'
import { LensCarouselPreview } from './lens-carousel'
import { CircularGalleryPreview } from './circular-gallery'
import { VectorWordmarkPreview } from './vector-wordmark'
import { GooeyEffectPreview } from './gooey-effect'
import { DevouringSignInPreview } from './devouring-sign-in'
import { ImageRevealPreview } from './image-reveal'
import { SceneRevealPreview } from './scene-reveal'
import { SpineGalleryPreview } from './spine-gallery'
import { ExpandOnHoverVerticalPreview } from './expand-on-hover-vertical'
import { ExpandOnHoverPreview } from './expand-on-hover'
import { ImageWheel3DPreview } from './image-wheel-3d'

export interface ComponentPreviewProps {
  slug: string
  values: Record<string, unknown>
}

export function ComponentPreview({ slug, values }: ComponentPreviewProps) {
  switch (slug) {
    case 'dot-grid':
      return <DotGrid {...values} className="absolute inset-0" />
    case 'gooey-dots':
      return <GooeyDots {...values} className="absolute inset-0" />
    case 'grain-gradient':
      return <GrainGradient {...values} className="absolute inset-0" />
    case 'dithered-logo':
      return (
        <DitheredLogo
          {...values}
          src={(values.src as string) || '/brand/uigrove-mark-dark.svg'}
          className="absolute inset-0"
        />
      )
    case 'ascii-effect':
      return (
        <AsciiEffect
          {...values}
          src={(values.src as string) || '/demo/statue.png'}
          className="absolute inset-0"
        />
      )
    case 'wheel-carousel':
      return (
        <div className="absolute inset-0 flex items-center px-8">
          <WheelCarousel {...values} items={wheelCarouselDemoItems} className="w-full" />
        </div>
      )
    case 'scroll-surf':
      return (
        <div className="absolute inset-0 overflow-y-auto [container-type:size]">
          <ScrollSurf {...values} items={scrollSurfDemoItems} viewportHeight="100cqh" />
        </div>
      )
    case 'dot-matrix-text':
      return (
        <div className="absolute inset-0 flex items-center px-8">
          <DotMatrixText {...(values as { text: string })} className="w-full" />
        </div>
      )
    case 'expand-on-hover':
      return <ExpandOnHoverPreview values={values} />
    case 'expand-on-hover-vertical':
      return <ExpandOnHoverVerticalPreview values={values} />
    case 'spine-gallery':
      return <SpineGalleryPreview values={values} />
    case 'scene-reveal':
      return <SceneRevealPreview values={values} />
    case 'image-reveal':
      return <ImageRevealPreview values={values} />
    case 'devouring-sign-in':
      return <DevouringSignInPreview values={values} />
    case 'gooey-effect':
      return <GooeyEffectPreview values={values} />
    case 'vector-wordmark':
      return <VectorWordmarkPreview values={values} />
    case 'circular-gallery':
      return <CircularGalleryPreview values={values} />
    case 'lens-carousel':
      return <LensCarouselPreview values={values} />
    case 'film-grain':
      return <FilmGrainEffectPreview values={values} />
    case 'window-transition':
      return <WindowPageTransitionPreview values={values} />
    case 'orbit-tiles':
      return <OrbitTilesInfiniteLoopPreview values={values} />
    case 'dot-globe':
      return <DotGlobePreview values={values} />
    case 'liquid-smoke':
      return <LiquidSmokePreview values={values} />
    case 'goo-carve-button':
      return <GooCarveButtonPreview values={values} />
    case 'ink-bleed':
      return <InkBleedPreview values={values} />
    case 'dust-transition':
      return <DustTransitionPreview values={values} />
    case 'pill-nav':
      return <PillNavPreview values={values} />
    case 'dynamic-island':
      return <DynamicIslandPreview values={values} />
    case 'image-wheel-3d':
      return <ImageWheel3DPreview values={values} />
    case 'morphing-text':
      return <MorphingTextPreview values={values} />
    case 'text-tunnel':
      return <TextTunnelPreview values={values} />
    case 'split-word-loader':
      return <SplitWordLoaderPreview values={values} />
    default:
      return null
  }
}
