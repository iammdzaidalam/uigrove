import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { ThemeProvider } from '@/components/theme'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://uigrove.me'),
  title: {
    default: 'UIgrove',
    template: '%s · UIgrove',
  },
  description:
    'A grove of components. Animated UI components with a signature look, installable with the shadcn CLI.',
  openGraph: {
    siteName: 'UIgrove',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#09090c',
  colorScheme: 'dark',
}

const themeScript = `(function(){try{var t=localStorage.getItem('uigrove-theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}})()`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-fg">
        <ThemeProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ThemeProvider>
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  )
}
