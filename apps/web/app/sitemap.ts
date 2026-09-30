import type { MetadataRoute } from 'next'
import { componentMetas } from '@uigrove/components/meta'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://uigrove.me'
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/components`, changeFrequency: 'weekly', priority: 0.9 },
    ...componentMetas.map((meta) => ({
      url: `${base}/components/${meta.name}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
